'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { requireTenantSession } from '@/lib/session';
import { db } from '@/db';
import { registrations, registrationChildren, registrationParents, parents, children, organisations, centres, auditEvents } from '@/db/schema';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { emailService } from '@/lib/services/email';
import { createRegistrationNotification } from '@/app/portal/notifications/actions';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

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
        columns: { id: true, centreId: true },
    });
    if (!existing) throw new Error('Registration not found');

    // Non-owner managers must have access to the registration's current centre (if set) and target centre
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if ((existing as { centreId?: string | null }).centreId && !accessibleCentreIds.includes((existing as { centreId?: string | null }).centreId!)) {
            throw new Error('Forbidden: No access to this centre');
        }
        if (!centreId || !accessibleCentreIds.includes(centreId)) {
            throw new Error('Forbidden: No access to target centre');
        }
    }

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
        revalidatePath(`/dashboard/registrations/${registrationId}`);
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
    // to the session org and registration links to prevent cross-org/cross-centre PII mutation.
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
        columns: { id: true, centreId: true },
    });
    if (!reg) throw new Error('Registration not found');

    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if ('centreId' in reg && (!reg.centreId || !accessibleCentreIds.includes(reg.centreId))) {
            throw new Error('Forbidden: No access to this centre');
        }
    }

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
    }).where(and(eq(registrations.id, payload.registrationId), eq(registrations.organisationId, orgId)));

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

        // Also update linked canonical parent record — strictly verified against registrationParents
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
                sql`${parents.id} IN (SELECT ${registrationParents.parentId} FROM ${registrationParents} WHERE ${registrationParents.id} = ${p.id} AND ${registrationParents.registrationId} = ${reg.id})`,
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

        // Also update linked canonical children record — strictly verified against registrationChildren
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
                sql`${children.id} IN (SELECT ${registrationChildren.childId} FROM ${registrationChildren} WHERE ${registrationChildren.id} = ${c.id} AND ${registrationChildren.registrationId} = ${reg.id})`,
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
    const userRole = (session.user as any).role as string;

    if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
        throw new Error('Forbidden');
    }

    // Enforce centre-level boundaries: non-owners must only generate links for centres they can access
    let targetCentreId = centreId;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
        if (accessibleCentreIds.length === 0) {
            throw new Error('Forbidden: You are not assigned to any centre');
        }
        if (!targetCentreId) {
            targetCentreId = accessibleCentreIds[0];
        } else if (!accessibleCentreIds.includes(targetCentreId)) {
            throw new Error('Forbidden: No access to this centre');
        }
    }

    if (parentId && db.query?.parents?.findFirst) {
        const parentRecord = await db.query.parents.findFirst({
            where: and(eq(parents.id, parentId), eq(parents.organisationId, orgId)),
            columns: { id: true },
        });
        if (!parentRecord) throw new Error('Parent not found');
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



    // PM-2E2.B4.F: Build the registration URL with trusted canonical origin
    const baseUrl = getTrustedApplicationUrl();
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
        .select({ id: registrations.id, organisationId: registrations.organisationId, centreId: registrations.centreId, status: registrations.status, startDate: registrations.startDate })
        .from(registrations)
        .where(eq(registrations.id, registrationId))
        .limit(1);

    if (!existing || existing.organisationId !== orgId) {
        throw new Error('Registration not found');
    }

    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!existing.centreId || !accessibleCentreIds.includes(existing.centreId)) {
            throw new Error('Forbidden: No access to this centre');
        }
    }

    await db.transaction(async tx => {
        const enrolmentChildren = await tx.select({ childId: registrationChildren.childId }).from(registrationChildren).where(eq(registrationChildren.registrationId, registrationId));
        const lockedIds = [...new Set(enrolmentChildren.map(c => c.childId).filter((childId): childId is string => Boolean(childId)))].sort();
        for (const childId of lockedIds) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`enrolment:${childId}`}))`);
    await tx
        .update(registrations)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(registrations.id, registrationId));

    if (newStatus === 'signed_up') {
        const regChildren = await tx
            .select({ childId: registrationChildren.childId })
            .from(registrationChildren)
            .where(eq(registrationChildren.registrationId, registrationId));

        const childIds = regChildren.map(c => c.childId).filter((cid): cid is string => Boolean(cid));
        if (childIds.length > 0) {
            await tx
                .update(children)
                .set({
                    isRegistered: true,
                    registeredAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(and(inArray(children.id, childIds), eq(children.organisationId, orgId)));
        }
    }

        await tx.insert(auditEvents).values({ organisationId: orgId, userId: session.user.id,
            eventType: 'registration_status_changed', eventData: JSON.stringify({ registrationId, previousStatus: existing.status, status: newStatus, startDate: existing.startDate, confirmedAt: new Date().toISOString() }) });
    });
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/registrations');
    revalidatePath(`/dashboard/registrations/${registrationId}`);
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
