'use server';

import { db } from '@/db';
import { incidents, children, centres } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { requirePermission } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function getIncidents(centreId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    // Fetch all incidents for the centre. The inner join on children includes
    // isNull(children.deletedAt) so that incidents for soft-deleted children
    // do not surface in the list (Milestone 3K defect D4).
    const query = db.select({
        id: incidents.id,
        type: incidents.type,
        date: incidents.date,
        description: incidents.description,
        treatment: incidents.treatment,
        witnesses: incidents.witnesses,
        childId: incidents.childId,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        createdAt: incidents.createdAt,
    })
    .from(incidents)
    .innerJoin(
        children,
        and(
            eq(children.id, incidents.childId),
            // D4: exclude soft-deleted children from incident list
            isNull(children.deletedAt)
        )
    )
    .where(
        and(
            eq(incidents.organisationId, session.user.organisationId),
            eq(incidents.centreId, centreId)
        )
    )
    .orderBy(desc(incidents.date));

    const results = await query;

    // Filter safeguarding incidents — only ORG_OWNER and MANAGER can see them.
    // FRONT_DESK (Milestone 3K Option C decision) sees accident/incident/medication only.
    // 'MANAGER' also passes ORG_OWNER (see requirePermission in permissions.ts) —
    // this is the ORG_OWNER/MANAGER safeguarding pairing used throughout the app
    // (canUserAccessSafeguardingRecords). Previously called with the non-existent
    // role literal 'MANAGE_ORG', which requirePermission silently treated as "no
    // restriction" instead of throwing, since it doesn't match either of the
    // function's two explicit branches — every authenticated user, including
    // TUTOR, could read and create 'safeguarding'-type incident records. Fixed
    // as part of Milestone 1 Workstream 2 (see architecture-decisions.md).
    try {
        await requirePermission('MANAGER');
        return results;
    } catch {
        return results.filter(i => i.type !== 'safeguarding');
    }
}

export async function createIncident(data: {
    centreId: string;
    childId: string;
    type: 'accident' | 'incident' | 'medication' | 'safeguarding';
    date: Date;
    description: string;
    treatment?: string;
    witnesses?: string;
    // Points marking injury locations on a body diagram (see incidents.bodyMapCoordinates
    // schema comment). No current UI populates this field; the shape is not constrained by
    // any existing contract, so this is the minimal real type implied by the column's intent.
    bodyMapCoordinates?: { x: number; y: number }[];
    staffSignature?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    if (data.type === 'safeguarding') {
        // 'MANAGER' also passes ORG_OWNER (see requirePermission in permissions.ts) —
        // this is the ORG_OWNER/MANAGER safeguarding pairing used throughout the app
        // (canUserAccessSafeguardingRecords). FRONT_DESK may NOT create safeguarding
        // records (Milestone 3K Option C — orchestrator decision 2026-08-24).
        await requirePermission('MANAGER');
    }

    // D5: Verify the caller-supplied centreId belongs to the authenticated
    // organisation before inserting. Prevents cross-org centre injection.
    const centre = await db.query.centres.findFirst({
        where: and(
            eq(centres.id, data.centreId),
            eq(centres.organisationId, session.user.organisationId)
        ),
        columns: { id: true },
    });
    if (!centre) {
        throw new Error('Centre not found or access denied');
    }

    // D5: Verify the caller-supplied childId belongs to the authenticated
    // organisation before inserting. Prevents cross-org child injection.
    const child = await db.query.children.findFirst({
        where: and(
            eq(children.id, data.childId),
            eq(children.organisationId, session.user.organisationId),
            // Also verify the child has not been soft-deleted (D4)
            isNull(children.deletedAt)
        ),
        columns: { id: true },
    });
    if (!child) {
        throw new Error('Child not found or access denied');
    }

    const [newIncident] = await db.insert(incidents).values({
        organisationId: session.user.organisationId,
        centreId: data.centreId,
        childId: data.childId,
        type: data.type,
        date: data.date,
        description: data.description,
        treatment: data.treatment || null,
        witnesses: data.witnesses || null,
        bodyMapCoordinates: data.bodyMapCoordinates || null,
        staffSignature: data.staffSignature || null,
    }).returning();

    revalidatePath('/dashboard/incidents');
    return newIncident;
}

export async function getCentreChildren(centreId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    // D3: Previously this query ignored the centreId parameter entirely,
    // returning all children in the organisation. Now correctly scoped to
    // the supplied centreId so the incident form only shows children at the
    // active centre.
    //
    // D4: Soft-deleted children (deletedAt IS NOT NULL) are excluded.
    //
    // isRegistered: only formally registered children are selectable as
    // incident subjects — assessment/lead children are not yet enrolled.
    return db.select({
        id: children.id,
        firstName: children.firstName,
        lastName: children.lastName,
    })
    .from(children)
    .where(
        and(
            eq(children.organisationId, session.user.organisationId),
            eq(children.centreId, centreId),
            eq(children.isRegistered, true),
            isNull(children.deletedAt)
        )
    )
    .orderBy(children.firstName, children.lastName);
}
