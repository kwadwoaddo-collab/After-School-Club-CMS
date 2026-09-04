'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { requireTenantSession } from '@/lib/session';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents, parents, children, organisations, centres } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { emailService } from '@/lib/services/email';
import { createRegistrationNotification } from '@/app/portal/notifications/actions';

export async function deleteRegistrations(ids: string[]) {
    const session = await requireTenantSession();
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
    // Milestone 3L D1: role check + org ownership verification of registrationId and centreId.
    // Previously callable by any authenticated session with no role check and no org boundary.
    const session = await requireTenantSession();
    if (!session?.user) throw new Error('Unauthorized');

    const userRole = (session.user as any).role as string;
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
        throw new Error('Forbidden: only ORG_OWNER or MANAGER may assign centres');
    }

    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');

    // Verify the registration belongs to this org before mutating it
    const existing = await db.query.registrations.findFirst({
        where: and(eq(registrations.id, registrationId), eq(registrations.organisationId, orgId)),
        columns: { id: true },
    });
    if (!existing) throw new Error('Registration not found');

    // If assigning a centre, verify it belongs to this org (prevents cross-org centreId injection)
    if (centreId) {
        const centre = await db.query.centres.findFirst({
            where: and(eq(centres.id, centreId), eq(centres.organisationId, orgId)),
            columns: { id: true },
        });
        if (!centre) throw new Error('Centre not found');
    }

    try {
        await db
            .update(registrations)
            .set({ centreId })
            // Double-anchor WHERE with organisationId so the update is never cross-org
            .where(and(eq(registrations.id, registrationId), eq(registrations.organisationId, orgId)));

        revalidatePath('/dashboard/registrations');
        return { success: true };
    } catch (error) {
        logger.error('Failed to assign centre:', error);
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
    // Milestone 3L D2: add role check; also scope parent/child canonical record updates
    // to the session org to prevent cross-org PII mutation via foreign parentId/childId.
    const session = await requireTenantSession();
    if (!session?.user) throw new Error('Unauthorized');

    const userRole = (session.user as any).role as string;
    if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
        throw new Error('Forbidden');
    }

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
        // Scope update to the verified registration to prevent cross-registration row tampering
        await db.update(registrationParents).set({
            submittedFirstName: p.firstName,
            submittedLastName: p.lastName,
            submittedRelationship: p.relationship || null,
            submittedPhone: p.phone || null,
            submittedEmail: p.email || null,
        }).where(and(
            eq(registrationParents.id, p.id),
            eq(registrationParents.registrationId, reg.id), // D2: must belong to verified registration
        ));

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
            }).where(and(
                eq(parents.id, p.parentId),
                eq(parents.organisationId, orgId), // D2: reject cross-org parentId injection
            ));
        }
    }

    // 3. Update each child snapshot + linked child record
    for (const c of payload.childrenData) {
        // Scope update to the verified registration to prevent cross-registration row tampering
        await db.update(registrationChildren).set({
            submittedFirstName: c.firstName,
            submittedLastName: c.lastName,
            submittedDateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
            submittedSchoolYear: c.schoolYear || null,
            submittedSessions: c.sessions,
        }).where(and(
            eq(registrationChildren.id, c.id),
            eq(registrationChildren.registrationId, reg.id), // D2: must belong to verified registration
        ));

        // Also update linked canonical children record
        if (c.childId) {
            await db.update(children).set({
                firstName: c.firstName,
                lastName: c.lastName,
                dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
                schoolYear: c.schoolYear || 'Y1',
                registeredSessions: c.sessions,
                updatedAt: new Date(),
            }).where(and(
                eq(children.id, c.childId),
                eq(children.organisationId, orgId), // D2: reject cross-org childId injection
            ));
        }
    }

    revalidatePath(`/dashboard/registrations/${payload.registrationId}`);
    revalidatePath('/dashboard/registrations');
    return { success: true };
}

export async function generateRegistrationLink(parentId: string, centreId: string, childIds?: string[]) {
    const session = await requireTenantSession();
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

// NOTE (Milestone 3L AD-2): This server action is not currently called from any UI component
// (StatusUpdater uses the API route PATCH /api/register/[id]/status). It is kept for reference
// but a role check has been added as a security precaution given the action remains exported.
export async function updateRegistrationStatus(
    registrationId: string,
    newStatus: 'signed_up' | 'not_interested' | 'awaiting_confirmation'
) {
    const session = await requireTenantSession();
    if (!session?.user) throw new Error('Unauthorized');

    // Milestone 3L D3: role gate (previously absent — any authenticated user could call this)
    const userRole = (session.user as any).role as string;
    if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
        throw new Error('Forbidden');
    }

    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');

    // Verify the registration belongs to this org
    const [existing] = await db
        .select({ id: registrations.id, organisationId: registrations.organisationId, centreId: registrations.centreId })
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

    // ── Fire status email for approve / reject (not for revert-to-pending) ──
    if (newStatus === 'signed_up' || newStatus === 'not_interested') {
        try {
            // Fetch registration parent contact
            const [regParent] = await db
                .select({ parentId: registrationParents.parentId })
                .from(registrationParents)
                .where(eq(registrationParents.registrationId, registrationId))
                .limit(1);

            // Fetch registered children names
            const regChildren = await db
                .select({ childId: registrationChildren.childId })
                .from(registrationChildren)
                .where(eq(registrationChildren.registrationId, registrationId));

            // Fetch org name
            const [org] = await db
                .select({ name: organisations.name })
                .from(organisations)
                .where(eq(organisations.id, orgId))
                .limit(1);

            // Fetch centre name (optional)
            let centreName: string | null = null;
            if (existing.centreId) {
                const [centre] = await db
                    .select({ name: centres.name })
                    .from(centres)
                    .where(eq(centres.id, existing.centreId))
                    .limit(1);
                centreName = centre?.name ?? null;
            }

            if (regParent?.parentId) {
                // Milestone 3L D6: filter soft-deleted parent records
                const [parent] = await db
                    .select({ firstName: parents.firstName, email: parents.email })
                    .from(parents)
                    .where(and(eq(parents.id, regParent.parentId), isNull(parents.deletedAt)))
                    .limit(1);

                // Resolve child names — D6: filter soft-deleted child records
                const childNames: string[] = [];
                if (regChildren.length > 0) {
                    const childIds = regChildren.map(c => c.childId).filter(Boolean) as string[];
                    if (childIds.length > 0) {
                        const childRecords = await db
                            .select({ firstName: children.firstName, lastName: children.lastName })
                            .from(children)
                            .where(and(inArray(children.id, childIds), isNull(children.deletedAt)));
                        childRecords.forEach(c => childNames.push(`${c.firstName} ${c.lastName}`));
                    }
                }

                if (parent?.email) {
                    await emailService.sendRegistrationStatusUpdate({
                        orgName: org?.name ?? 'The Club',
                        centreName,
                        parentFirstName: parent.firstName ?? 'there',
                        parentEmail: parent.email,
                        childNames: childNames.length > 0 ? childNames : ['Your child'],
                        newStatus,
                    });
                }

                await createRegistrationNotification({
                    parentId: regParent.parentId,
                    organisationId: orgId,
                    status: newStatus === 'signed_up' ? 'approved' : 'rejected',
                    childName: childNames.length > 0 ? childNames.join(', ') : 'Your child',
                    registrationId,
                });
            }
        } catch (emailErr) {
            // Non-fatal — log but don't block the status update
            logger.error('[updateRegistrationStatus] Email send failed:', emailErr);
        }
    }

    return { success: true };
}
