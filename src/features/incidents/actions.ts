'use server';

import { db } from '@/db';
import { incidents, children, centres } from '@/db/schema';
import { requireTenantSession } from '@/lib/session';
import { eq, desc, and, isNull } from 'drizzle-orm';
import * as permissions from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

const INCIDENTS_ALLOWED_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] as const;

async function assertIncidentCentreAccess(userId: string, userRole: string, centreId: string) {
    if (!INCIDENTS_ALLOWED_ROLES.includes(userRole as (typeof INCIDENTS_ALLOWED_ROLES)[number])) {
        throw new Error('Forbidden');
    }
    if (userRole !== 'ORG_OWNER' && 'getUserAccessibleCentreIds' in permissions && typeof permissions.getUserAccessibleCentreIds === 'function') {
        const accessibleCentreIds = await permissions.getUserAccessibleCentreIds(userId);
        if (Array.isArray(accessibleCentreIds) && !accessibleCentreIds.includes(centreId)) {
            throw new Error('Forbidden: No access to this centre');
        }
    }
}

export async function getIncidents(centreId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    await assertIncidentCentreAccess(session.user.id, String(session.user.role || ''), centreId);

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
    try {
        await permissions.requirePermission('MANAGER');
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
    bodyMapCoordinates?: { x: number; y: number }[];
    staffSignature?: string;
}) {
    const session = await requireTenantSession();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    if (data.type === 'safeguarding') {
        await permissions.requirePermission('MANAGER');
    }

    const userRole = String(session.user.role || '');
    if (!INCIDENTS_ALLOWED_ROLES.includes(userRole as (typeof INCIDENTS_ALLOWED_ROLES)[number])) {
        throw new Error('Forbidden');
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

    await assertIncidentCentreAccess(session.user.id, userRole, data.centreId);

    // D5: Verify the caller-supplied childId belongs to the authenticated
    // organisation and target centre before inserting. Prevents cross-org and cross-centre child injection.
    const child = await db.query.children.findFirst({
        where: and(
            eq(children.id, data.childId),
            eq(children.organisationId, session.user.organisationId),
            eq(children.centreId, data.centreId),
            // Also verify the child has not been soft-deleted (D4)
            isNull(children.deletedAt)
        ),
        columns: { id: true, centreId: true },
    });
    if (!child || ((child as { centreId?: string | null }).centreId && (child as { centreId?: string | null }).centreId !== data.centreId)) {
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
    const session = await requireTenantSession();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    await assertIncidentCentreAccess(session.user.id, String(session.user.role || ''), centreId);

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
