import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { after, NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { registrations, registrationChildren, organisations, centres, children, auditEvents } from '@/db/schema';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { emailService } from '@/lib/services/email';
import { createRegistrationNotification } from '@/lib/parent-notifications';
import { revalidatePath } from 'next/cache';
import { syncBookingOutcomeFromRegistration } from '@/lib/services/booking-outcome-sync';
import { isValidUuid } from '@/lib/uuid';

const VALID_STATUSES = ['awaiting_confirmation', 'signed_up', 'not_interested'] as const;
type RegistrationStatus = typeof VALID_STATUSES[number];

function scheduleAfterResponse(task: () => Promise<void>): void {
    try {
        after(task);
    } catch {
        void task();
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // ── 1. Authentication ───────────────────────────────────────────────────
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid registration ID' }, { status: 400 });
        }

        // ── 2. Validate incoming status value ───────────────────────────────────
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { status } = body as { status?: unknown };
        if (!status || typeof status !== 'string' || !VALID_STATUSES.includes(status as RegistrationStatus)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const orgId = session.user.organisationId;

        // ── 3. Ownership check — fetch reg scoped to this user's org ───────────
        const reg = await db.query.registrations.findFirst({
            where: and(
                eq(registrations.id, id),
                eq(registrations.organisationId, orgId)
            ),
            with: {
                registrationParents: true,
                registrationChildren: true,
            },
        });

        if (!reg) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }

        // ── 4. Centre-level access check for non-ORG_OWNER users ───────────────
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!reg.centreId || !accessibleCentreIds.includes(reg.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        await db.transaction(async tx => {
            const lockedIds = [...new Set(
                (reg.registrationChildren ?? [])
                    .map(c => c.childId)
                    .filter((childId): childId is string => Boolean(childId))
            )].sort();
            for (const childId of lockedIds) {
                await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`enrolment:${childId}`}))`);
            }

            // ── 5. Perform the update ───────────────────────────────────────────────
            await tx
                .update(registrations)
                .set({ status: status as RegistrationStatus, updatedAt: new Date() })
                .where(and(eq(registrations.id, id), eq(registrations.organisationId, orgId)));

            // If status is 'signed_up', activate all associated children as registered students
            if (status === 'signed_up' && reg.registrationChildren?.length) {
                const childIds = reg.registrationChildren
                    .map(c => c.childId)
                    .filter((cid): cid is string => Boolean(cid));
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
            } else if (status !== 'signed_up' && reg.registrationChildren?.length && typeof (tx as any).select === 'function') {
                const childIds = [...new Set(
                    reg.registrationChildren
                        .map(c => c.childId)
                        .filter((cid): cid is string => Boolean(cid))
                )];
                if (childIds.length > 0) {
                    // Batch check existing children and any remaining signed_up registrations in 2 queries (no per-child N+1)
                    const existingChildren = await tx
                        .select({ id: children.id })
                        .from(children)
                        .where(and(inArray(children.id, childIds), eq(children.organisationId, orgId)));
                    const existingChildIds = (existingChildren ?? []).map(c => c.id);

                    if (existingChildIds.length > 0) {
                        const otherSignedUpRows = await tx
                            .select({ childId: registrationChildren.childId })
                            .from(registrationChildren)
                            .innerJoin(registrations, eq(registrationChildren.registrationId, registrations.id))
                            .where(
                                and(
                                    inArray(registrationChildren.childId, existingChildIds),
                                    ne(registrations.id, id),
                                    eq(registrations.organisationId, orgId),
                                    eq(registrations.status, 'signed_up')
                                )
                            );
                        const stillSignedUpSet = new Set(
                            (otherSignedUpRows ?? [])
                                .map(r => r.childId)
                                .filter((cid): cid is string => Boolean(cid))
                        );
                        const revertChildIds = existingChildIds.filter(cid => !stillSignedUpSet.has(cid));
                        if (revertChildIds.length > 0) {
                            await tx
                                .update(children)
                                .set({
                                    isRegistered: false,
                                    updatedAt: new Date(),
                                })
                                .where(and(inArray(children.id, revertChildIds), eq(children.organisationId, orgId)));
                        }
                    }
                }
            }

            if (typeof (tx as any).insert === 'function') {
                await tx.insert(auditEvents).values({
                    organisationId: orgId,
                    userId: session.user.id,
                    eventType: 'registration_status_changed',
                    eventData: JSON.stringify({
                        registrationId: id,
                        previousStatus: reg.status,
                        status,
                        startDate: reg.startDate,
                        confirmedAt: new Date().toISOString(),
                    }),
                });
            }

            await syncBookingOutcomeFromRegistration(tx, {
                registrationId: id,
                centreId: reg.centreId,
                organisationId: orgId,
                status: status as RegistrationStatus,
                actorUserId: session.user.id,
            });
        });

        // ── 6. Schedule post-commit email + parent notification via Next.js after() ──
        if (status !== reg.status) {
            scheduleAfterResponse(async () => {
                try {
                    const primaryParent = reg.registrationParents?.find(p => p.isPrimary) ?? reg.registrationParents?.[0];
                    const childNames = (reg.registrationChildren ?? [])
                        .map(c => `${c.submittedFirstName ?? ''} ${c.submittedLastName ?? ''}`.trim())
                        .filter(Boolean);

                    if (primaryParent?.submittedEmail && db.query?.organisations?.findFirst) {
                        const [org, centre] = await Promise.all([
                            db.query.organisations.findFirst({
                                where: eq(organisations.id, orgId),
                                columns: { name: true },
                            }),
                            reg.centreId && db.query?.centres?.findFirst
                                ? db.query.centres.findFirst({
                                    where: eq(centres.id, reg.centreId),
                                    columns: { name: true },
                                })
                                : Promise.resolve(null),
                        ]);

                        await emailService.sendRegistrationStatusUpdate({
                            orgName: org?.name || centre?.name || 'After School Club',
                            centreName: centre?.name ?? null,
                            parentFirstName: primaryParent.submittedFirstName,
                            parentEmail: primaryParent.submittedEmail,
                            childNames: childNames.length > 0 ? childNames : ['Your child'],
                            newStatus: status as RegistrationStatus,
                        });
                    }

                    if (
                        primaryParent?.parentId &&
                        (status === 'signed_up' || status === 'not_interested')
                    ) {
                        await createRegistrationNotification({
                            parentId: primaryParent.parentId,
                            organisationId: orgId,
                            status: status === 'signed_up' ? 'approved' : 'rejected',
                            childName: childNames.length > 0 ? childNames.join(', ') : 'Your child',
                            registrationId: id,
                        });
                    }
                } catch (err) {
                    logger.error('[Status Email] Failed to send status update email/notification:', err);
                }
            });
        }

        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/bookings');
        revalidatePath('/dashboard/registrations');
        revalidatePath(`/dashboard/registrations/${id}`);
        revalidatePath('/dashboard/students');

        return NextResponse.json({ success: true });
    } catch (error) {
        const pgCode =
            typeof error === 'object' && error !== null && 'code' in error
                ? (error as { code?: unknown }).code
                : undefined;
        if (pgCode === '22P02') {
            return NextResponse.json({ error: 'Invalid registration ID' }, { status: 400 });
        }
        logger.error('[PATCH /api/register/[id]/status] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
