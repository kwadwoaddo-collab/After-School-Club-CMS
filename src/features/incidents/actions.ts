'use server';

import { db } from '@/db';
import { incidents, children } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq, desc, and } from 'drizzle-orm';
import { requirePermission } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function getIncidents(centreId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    // Fetch all incidents for the centre
    let query = db.select({
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
    .innerJoin(children, eq(children.id, incidents.childId))
    .where(
        and(
            eq(incidents.organisationId, session.user.organisationId),
            eq(incidents.centreId, centreId)
        )
    )
    .orderBy(desc(incidents.date));

    const results = await query;

    // Filter safeguarding incidents - only ORG_OWNER and MANAGER can see them
    try {
        await requirePermission('MANAGE_ORG');
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
    bodyMapCoordinates?: any;
    staffSignature?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (!session.user.organisationId) throw new Error('No organisation context');

    if (data.type === 'safeguarding') {
        await requirePermission('MANAGE_ORG');
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

    return db.select({
        id: children.id,
        firstName: children.firstName,
        lastName: children.lastName,
    })
    .from(children)
    .where(eq(children.organisationId, session.user.organisationId))
    .orderBy(children.firstName, children.lastName);
}
