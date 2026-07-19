'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents, parents, children, organisations, centres } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function deleteRegistrations(ids: string[]) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owners can delete registrations');

    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');
    if (ids.length === 0) return { deleted: 0 };

    // Verify all registrations belong to this org before deleting
    const owned = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(and(inArray(registrations.id, ids), eq(registrations.organisationId, orgId)));

    const ownedIds = owned.map(r => r.id);
    if (ownedIds.length === 0) throw new Error('No matching registrations found');

    await db.delete(registrations).where(inArray(registrations.id, ownedIds));

    revalidatePath('/dashboard/registrations');
    return { deleted: ownedIds.length };
}


export async function assignRegistrationCentre(registrationId: string, centreId: string | null) {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized');
    }

    try {
        await db
            .update(registrations)
            .set({ centreId })
            .where(eq(registrations.id, registrationId));

        revalidatePath('/dashboard/registrations');
        return { success: true };
    } catch (error) {
        console.error('Failed to assign centre:', error);
        throw new Error('Failed to assign centre');
    }
}

export interface UpdateRegistrationPayload {
    registrationId: string;
    // Top-level registration fields
    startDate: string | null;
    fundingType: string;
    fundingOther: string;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
    hasSpecialNeeds: boolean;
    specialNeedsDetails: string;
    // Parents (keyed by registrationParent.id)
    parentsData: {
        id: string;
        parentId: string | null;
        firstName: string;
        lastName: string;
        relationship: string;
        phone: string;
        email: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        postcode: string;
    }[];
    // Children (keyed by registrationChild.id)
    childrenData: {
        id: string;
        childId: string | null;
        firstName: string;
        lastName: string;
        dateOfBirth: string;
        schoolYear: string;
        sessions: string[];
    }[];
}

export async function updateRegistrationDetails(payload: UpdateRegistrationPayload) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');

    // Verify the registration belongs to this org
    const reg = await db.query.registrations.findFirst({
        where: and(
            eq(registrations.id, payload.registrationId),
            eq(registrations.organisationId, orgId),
        ),
        columns: { id: true },
    });
    if (!reg) throw new Error('Registration not found');

    // 1. Update top-level registration
    await db.update(registrations).set({
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        fundingTypes: payload.fundingType ? [payload.fundingType] : [],
        fundingOther: payload.fundingOther || null,
        emergencyContactName: payload.emergencyContactName || null,
        emergencyContactRelationship: payload.emergencyContactRelationship || null,
        emergencyContactPhone: payload.emergencyContactPhone || null,
        hasSpecialNeeds: payload.hasSpecialNeeds,
        specialNeedsDetails: payload.specialNeedsDetails || null,
        updatedAt: new Date(),
    }).where(eq(registrations.id, payload.registrationId));

    // 2. Update each parent snapshot + linked parent record
    for (const p of payload.parentsData) {
        await db.update(registrationParents).set({
            submittedFirstName: p.firstName,
            submittedLastName: p.lastName,
            submittedRelationship: p.relationship || null,
            submittedPhone: p.phone || null,
            submittedEmail: p.email || null,
        }).where(eq(registrationParents.id, p.id));

        // Also update linked canonical parent record
        if (p.parentId) {
            await db.update(parents).set({
                firstName: p.firstName,
                lastName: p.lastName,
                phone: p.phone || null,
                email: p.email || null,
                addressLine1: p.addressLine1 || null,
                addressLine2: p.addressLine2 || null,
                city: p.city || null,
                postcode: p.postcode || null,
                updatedAt: new Date(),
            }).where(eq(parents.id, p.parentId));
        }
    }

    // 3. Update each child snapshot + linked child record
    for (const c of payload.childrenData) {
        await db.update(registrationChildren).set({
            submittedFirstName: c.firstName,
            submittedLastName: c.lastName,
            submittedDateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
            submittedSchoolYear: c.schoolYear || null,
            submittedSessions: c.sessions,
        }).where(eq(registrationChildren.id, c.id));

        // Also update linked canonical children record
        if (c.childId) {
            await db.update(children).set({
                firstName: c.firstName,
                lastName: c.lastName,
                dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
                schoolYear: c.schoolYear || 'Y1',
                registeredSessions: c.sessions,
                updatedAt: new Date(),
            }).where(eq(children.id, c.childId));
        }
    }

    revalidatePath(`/dashboard/registrations/${payload.registrationId}`);
    revalidatePath('/dashboard/registrations');
    return { success: true };
}

export async function generateRegistrationLink(parentId: string, centreId: string, childIds?: string[]) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;
    const userId = session.user.id;
    const userRole = (session.user as any).role;

    // Enforce centre-level boundaries: non-owners must only generate links for centres they can access
    let targetCentreId = centreId;
    if (userRole !== 'ORG_OWNER') {
        const { canUserAccessCentre, getUserAccessibleCentreIds } = await import('@/lib/permissions');
        const hasAccess = await canUserAccessCentre(userId, targetCentreId);
        if (!hasAccess) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
            if (accessibleCentreIds.length === 0) {
                throw new Error('Forbidden: You are not assigned to any centre');
            }
            targetCentreId = accessibleCentreIds[0];
        }
    }

    // Fetch org slug and centre slug
    const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, orgId),
        columns: { slug: true },
    });
    if (!org) throw new Error('Organisation not found');

    const centre = await db.query.centres.findFirst({
        where: and(eq(centres.id, targetCentreId), eq(centres.organisationId, orgId)),
        columns: { slug: true },
    });
    if (!centre) throw new Error('Centre not found');

    // Create secure prefill token
    const jose = await import('jose');
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-at-least-32-chars-long');
    const token = await new jose.SignJWT({ parentId, centreId: targetCentreId, childIds })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d') // prefill link expires in 30 days
        .sign(secret);



    // Build the absolute registration URL
    const { headers } = await import('next/headers');
    const host = (await headers()).get('host') || 'localhost:3000';
    const proto = (await headers()).get('x-forwarded-proto') || 'http';
    const baseUrl = `${proto}://${host}`;

    const link = `${baseUrl}/register/${org.slug}/${centre.slug}?token=${encodeURIComponent(token)}`;
    return { success: true, link };
}


// ─── Update a single registration status (approve / reject / revert) ──────────

export async function updateRegistrationStatus(
    registrationId: string,
    newStatus: 'signed_up' | 'not_interested' | 'awaiting_confirmation'
) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');

    // Verify the registration belongs to this org
    const [existing] = await db
        .select({ id: registrations.id, organisationId: registrations.organisationId })
        .from(registrations)
        .where(eq(registrations.id, registrationId))
        .limit(1);

    if (!existing || existing.organisationId !== orgId) {
        throw new Error('Registration not found');
    }

    await db
        .update(registrations)
        .set({ status: newStatus })
        .where(eq(registrations.id, registrationId));

    revalidatePath('/dashboard/registrations');
    revalidatePath('/dashboard/students');

    return { success: true };
}
