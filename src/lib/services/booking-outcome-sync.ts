/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/db';
import {
    bookings,
    bookingAttendees,
    children,
    centres,
    registrations,
    registrationChildren,
    registrationParents,
    auditEvents,
} from '@/db/schema';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

export type BookingEnrolmentOutcome = 'awaiting_outcome' | 'signed_up' | 'did_not_sign_up';

export interface ResolveBookingParams {
    organisationId: string;
    centreId?: string | null;
    parentId?: string | null;
    childIds?: string[];
    childNames?: Array<{ firstName: string; lastName: string }>;
    explicitBookingId?: string | null;
}

export interface SyncBookingOutcomeParams {
    registrationId?: string | null;
    childId?: string | null;
    centreId?: string | null;
    organisationId?: string | null;
    status: 'signed_up' | 'not_interested' | 'awaiting_confirmation' | 'pending';
    actorUserId?: string | null;
    reason?: string | null;
}

export interface RecordBookingEnrolmentOutcomeParams {
    bookingId: string;
    organisationId: string;
    enrolmentOutcome: BookingEnrolmentOutcome;
    reason?: string | null;
    actorUserId: string;
}

/**
 * Resolves the most relevant non-cancelled booking in the centre/org using 3-tier matching:
 *  - Tier 1: Explicit bookingId
 *  - Tier 2: Attendee childId matching any of childIds
 *  - Tier 3: Booking parentId + attendee child first/last name matching childNames
 */
export async function resolveBookingForRegistration(
    txOrDb: any,
    params: ResolveBookingParams
): Promise<string | null> {
    if (!txOrDb || typeof txOrDb.select !== 'function') return null;

    const {
        organisationId,
        centreId,
        parentId,
        childIds = [],
        childNames = [],
        explicitBookingId,
    } = params;

    try {
        // Tier 1: Explicit bookingId
        if (explicitBookingId) {
            const rows = await txOrDb
                .select({ id: bookings.id })
                .from(bookings)
                .innerJoin(centres, eq(bookings.centreId, centres.id))
                .where(
                    and(
                        eq(bookings.id, explicitBookingId),
                        eq(centres.organisationId, organisationId),
                        centreId ? eq(bookings.centreId, centreId) : undefined,
                        ne(bookings.status, 'cancelled')
                    )
                )
                .limit(1);
            if (rows[0]?.id) return rows[0].id;
        }

        // Tier 2: booking_attendees.childId matching childIds
        const validChildIds = childIds.filter((id): id is string => Boolean(id));
        if (validChildIds.length > 0) {
            const rows = await txOrDb
                .select({ id: bookings.id })
                .from(bookings)
                .innerJoin(centres, eq(bookings.centreId, centres.id))
                .innerJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
                .where(
                    and(
                        eq(centres.organisationId, organisationId),
                        centreId ? eq(bookings.centreId, centreId) : undefined,
                        inArray(bookingAttendees.childId, validChildIds),
                        ne(bookings.status, 'cancelled')
                    )
                )
                .orderBy(
                    sql`CASE WHEN ${bookings.status} = 'completed' THEN 0 WHEN ${bookings.status} IN ('confirmed', 'pending', 'signed_up') THEN 1 ELSE 2 END`,
                    desc(bookings.startAt)
                )
                .limit(1);
            if (rows[0]?.id) return rows[0].id;
        }

        // Tier 3: bookings.parentId + attendee child name (or parentId in same centre)
        if (parentId) {
            const candidateRows = await txOrDb
                .select({
                    bookingId: bookings.id,
                    childFirstName: children.firstName,
                    childLastName: children.lastName,
                })
                .from(bookings)
                .innerJoin(centres, eq(bookings.centreId, centres.id))
                .leftJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
                .leftJoin(children, eq(bookingAttendees.childId, children.id))
                .where(
                    and(
                        eq(centres.organisationId, organisationId),
                        centreId ? eq(bookings.centreId, centreId) : undefined,
                        eq(bookings.parentId, parentId),
                        ne(bookings.status, 'cancelled')
                    )
                )
                .orderBy(desc(bookings.startAt));

            if (candidateRows.length > 0) {
                if (childNames.length > 0) {
                    const normalizedTargets = new Set(
                        childNames.map(
                            (n) => `${(n.firstName || '').trim().toLowerCase()} ${(n.lastName || '').trim().toLowerCase()}`
                        )
                    );
                    const nameMatch = candidateRows.find((r: any) => {
                        const full = `${(r.childFirstName || '').trim().toLowerCase()} ${(r.childLastName || '').trim().toLowerCase()}`;
                        return normalizedTargets.has(full);
                    });
                    if (nameMatch?.bookingId) return nameMatch.bookingId;
                }
                return candidateRows[0].bookingId;
            }
        }
    } catch {
        // Safely ignore if txOrDb is a partial unit-test mock
    }

    return null;
}

/**
 * Automatically synchronizes booking enrolment outcome when a registration's status changes
 * (or when a student's enrolment is manually confirmed).
 */
export async function syncBookingOutcomeFromRegistration(
    txOrDb: any,
    params: SyncBookingOutcomeParams
): Promise<{ updatedBookingIds: string[] }> {
    if (!txOrDb || typeof txOrDb.select !== 'function' || typeof txOrDb.update !== 'function') {
        return { updatedBookingIds: [] };
    }

    const { registrationId, childId, centreId, organisationId, status, actorUserId, reason } = params;

    try {
        let effectiveCentreId = centreId ?? null;
        let effectiveOrgId = organisationId ?? null;
        let directBookingId: string | null = null;
        const targetChildIds = new Set<string>();
        const targetParentIds = new Set<string>();
        const targetChildNames: Array<{ firstName: string; lastName: string }> = [];

        if (childId) {
            targetChildIds.add(childId);
        }

        if (registrationId) {
            const regRows = await txOrDb
                .select({
                    id: registrations.id,
                    organisationId: registrations.organisationId,
                    centreId: registrations.centreId,
                    bookingId: registrations.bookingId,
                })
                .from(registrations)
                .where(eq(registrations.id, registrationId))
                .limit(1);

            const regRow = regRows?.[0];
            if (regRow) {
                effectiveOrgId = effectiveOrgId || regRow.organisationId;
                effectiveCentreId = effectiveCentreId || regRow.centreId;
                directBookingId = regRow.bookingId || null;
            }

            const regChildRows = await txOrDb
                .select({
                    childId: registrationChildren.childId,
                    submittedFirstName: registrationChildren.submittedFirstName,
                    submittedLastName: registrationChildren.submittedLastName,
                })
                .from(registrationChildren)
                .where(eq(registrationChildren.registrationId, registrationId));

            for (const rc of regChildRows ?? []) {
                if (rc.childId) targetChildIds.add(rc.childId);
                if (rc.submittedFirstName && rc.submittedLastName) {
                    targetChildNames.push({
                        firstName: rc.submittedFirstName,
                        lastName: rc.submittedLastName,
                    });
                }
            }

            const regParentRows = await txOrDb
                .select({ parentId: registrationParents.parentId })
                .from(registrationParents)
                .where(eq(registrationParents.registrationId, registrationId));

            for (const rp of regParentRows ?? []) {
                if (rp.parentId) targetParentIds.add(rp.parentId);
            }
        }

        const matchedBookingMap = new Map<string, { id: string; status: string; startAt: Date | null }>();

        // Tier 1: Direct registrations.bookingId or bookings.linkedRegistrationId
        if (directBookingId) {
            const tier1Rows = await txOrDb
                .select({ id: bookings.id, status: bookings.status, startAt: bookings.startAt })
                .from(bookings)
                .where(and(eq(bookings.id, directBookingId), ne(bookings.status, 'cancelled')));
            for (const b of tier1Rows ?? []) {
                matchedBookingMap.set(b.id, b);
            }
        }
        if (registrationId) {
            const linkedRows = await txOrDb
                .select({ id: bookings.id, status: bookings.status, startAt: bookings.startAt })
                .from(bookings)
                .where(and(eq(bookings.linkedRegistrationId, registrationId), ne(bookings.status, 'cancelled')));
            for (const b of linkedRows ?? []) {
                matchedBookingMap.set(b.id, b);
            }
        }

        const rankBookingStatus = (st: string) =>
            st === 'completed' ? 0 : ['confirmed', 'pending', 'signed_up'].includes(st) ? 1 : 2;

        // Tier 2: booking_attendees.childId matching registration_children.childId
        const childIdList = Array.from(targetChildIds);
        if (matchedBookingMap.size === 0 && childIdList.length > 0) {
            const tier2Query = txOrDb
                .select({ id: bookings.id, status: bookings.status, startAt: bookings.startAt })
                .from(bookings)
                .innerJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
                .where(
                    and(
                        inArray(bookingAttendees.childId, childIdList),
                        effectiveCentreId ? eq(bookings.centreId, effectiveCentreId) : undefined,
                        ne(bookings.status, 'cancelled')
                    )
                );
            const tier2Rows: Array<{ id: string; status: string; startAt: Date | null }> =
                typeof tier2Query?.orderBy === 'function'
                    ? await tier2Query.orderBy(
                          sql`CASE WHEN ${bookings.status} = 'completed' THEN 0 WHEN ${bookings.status} IN ('confirmed', 'pending', 'signed_up') THEN 1 ELSE 2 END`,
                          desc(bookings.startAt)
                      )
                    : await tier2Query;

            const sortedTier2 = [...(tier2Rows ?? [])].sort((a, b) => {
                const rankDiff = rankBookingStatus(a.status) - rankBookingStatus(b.status);
                if (rankDiff !== 0) return rankDiff;
                const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
                const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
                return bTime - aTime;
            });

            const eligibleTier2 =
                status === 'signed_up'
                    ? sortedTier2.filter((b) => !['did_not_attend', 'rescheduled'].includes(b.status))
                    : sortedTier2;

            const mostRelevant = eligibleTier2[0];
            if (mostRelevant) {
                matchedBookingMap.set(mostRelevant.id, mostRelevant);
            }
        }

        // Tier 3: bookings.parentId matching registration_parents.parentId + attendee child name
        const parentIdList = Array.from(targetParentIds);
        if (matchedBookingMap.size === 0 && parentIdList.length > 0 && targetChildNames.length > 0) {
            const tier3Candidates = await txOrDb
                .select({
                    id: bookings.id,
                    status: bookings.status,
                    startAt: bookings.startAt,
                    firstName: children.firstName,
                    lastName: children.lastName,
                })
                .from(bookings)
                .innerJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
                .innerJoin(children, eq(bookingAttendees.childId, children.id))
                .where(
                    and(
                        inArray(bookings.parentId, parentIdList),
                        effectiveCentreId ? eq(bookings.centreId, effectiveCentreId) : undefined,
                        ne(bookings.status, 'cancelled')
                    )
                );

            const normalizedNames = new Set(
                targetChildNames.map(
                    (n) => `${n.firstName.trim().toLowerCase()} ${n.lastName.trim().toLowerCase()}`
                )
            );
            const matchingTier3 = (tier3Candidates ?? [])
                .filter((cand: any) => {
                    const candidateFull = `${(cand.firstName || '').trim().toLowerCase()} ${(cand.lastName || '').trim().toLowerCase()}`;
                    return normalizedNames.has(candidateFull);
                })
                .sort((a: any, b: any) => {
                    const rankDiff = rankBookingStatus(a.status) - rankBookingStatus(b.status);
                    if (rankDiff !== 0) return rankDiff;
                    const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
                    const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
                    return bTime - aTime;
                });

            const eligibleTier3 =
                status === 'signed_up'
                    ? matchingTier3.filter((b: any) => !['did_not_attend', 'rescheduled'].includes(b.status))
                    : matchingTier3;

            const bestCand = eligibleTier3[0];
            if (bestCand) {
                matchedBookingMap.set(bestCand.id, {
                    id: bestCand.id,
                    status: bestCand.status,
                    startAt: bestCand.startAt,
                });
            }
        }

        const matchedBookings = Array.from(matchedBookingMap.values());
        if (matchedBookings.length === 0) {
            return { updatedBookingIds: [] };
        }

        const now = new Date();
        const updatedBookingIds: string[] = [];

        for (const booking of matchedBookings) {
            if (status === 'signed_up') {
                const startAtDate = booking.startAt ? new Date(booking.startAt) : null;
                const shouldMarkCompleted =
                    ['confirmed', 'pending', 'signed_up'].includes(booking.status) &&
                    startAtDate !== null &&
                    startAtDate.getTime() <= now.getTime();

                await txOrDb
                    .update(bookings)
                    .set({
                        ...(shouldMarkCompleted ? { status: 'completed' as const } : {}),
                        enrolmentOutcome: 'signed_up',
                        enrolmentOutcomeAt: now,
                        enrolmentOutcomeBy: actorUserId ?? null,
                        enrolmentOutcomeReason: reason || 'Confirmed via registration form',
                        ...(registrationId ? { linkedRegistrationId: registrationId } : {}),
                        updatedAt: now,
                    })
                    .where(eq(bookings.id, booking.id));

                updatedBookingIds.push(booking.id);
            } else if (status === 'not_interested') {
                await txOrDb
                    .update(bookings)
                    .set({
                        enrolmentOutcome: 'did_not_sign_up',
                        enrolmentOutcomeAt: now,
                        enrolmentOutcomeBy: actorUserId ?? null,
                        enrolmentOutcomeReason: reason || 'Marked Not Interested on registration form',
                        ...(registrationId ? { linkedRegistrationId: registrationId } : {}),
                        updatedAt: now,
                    })
                    .where(eq(bookings.id, booking.id));

                updatedBookingIds.push(booking.id);
            } else if (status === 'awaiting_confirmation' && registrationId) {
                await txOrDb
                    .update(bookings)
                    .set({
                        linkedRegistrationId: registrationId,
                        ...(booking.status === 'completed' ? { enrolmentOutcome: 'awaiting_outcome' as const } : {}),
                        updatedAt: now,
                    })
                    .where(eq(bookings.id, booking.id));

                updatedBookingIds.push(booking.id);
            }
        }

        // Back-link registration.bookingId if it was null
        if (registrationId && !directBookingId && matchedBookings[0]?.id) {
            await txOrDb
                .update(registrations)
                .set({ bookingId: matchedBookings[0].id, updatedAt: now })
                .where(eq(registrations.id, registrationId));
        }

        return { updatedBookingIds };
    } catch {
        return { updatedBookingIds: [] };
    }
}

/**
 * Records a booking's enrolment outcome directly from the Bookings UI / API
 * and closes the loop across children, registrations, and finance audit_events.
 */
export async function recordBookingEnrolmentOutcome(
    txOrDb: any,
    params: RecordBookingEnrolmentOutcomeParams
) {
    const { bookingId, organisationId, enrolmentOutcome, reason, actorUserId } = params;
    const now = new Date();
    const effectiveReason =
        reason?.trim() ||
        (enrolmentOutcome === 'signed_up'
            ? 'Confirmed Signed Up from assessment booking'
            : enrolmentOutcome === 'did_not_sign_up'
            ? 'Marked Did Not Sign Up from assessment booking'
            : null);

    const runInTx = async (tx: any) => {
        const booking = await tx.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: {
                centre: true,
                attendees: {
                    with: {
                        child: true,
                    },
                },
            },
        });

        if (!booking || !booking.centre || booking.centre.organisationId !== organisationId) {
            throw new Error('Booking not found');
        }

        const shouldCompleteStatus =
            (enrolmentOutcome === 'signed_up' &&
                ['confirmed', 'pending', 'signed_up', 'did_not_attend'].includes(booking.status)) ||
            (enrolmentOutcome === 'did_not_sign_up' &&
                ['confirmed', 'pending', 'signed_up'].includes(booking.status));
        const nextStatus = shouldCompleteStatus ? 'completed' : booking.status;

        const attendeeChildIds: string[] = (booking.attendees ?? [])
            .map((a: any) => a.childId as string)
            .filter((cid: string): cid is string => Boolean(cid));
        const sortedChildIds = [...new Set(attendeeChildIds)].sort();

        for (const cid of sortedChildIds) {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`enrolment:${cid}`}))`);
        }

        let linkedRegId: string | null = booking.linkedRegistrationId ?? null;

        if (enrolmentOutcome === 'signed_up') {
            if (sortedChildIds.length > 0) {
                await tx
                    .update(children)
                    .set({
                        isRegistered: true,
                        registeredAt: sql`COALESCE(${children.registeredAt}, ${now.toISOString()}::timestamptz)`,
                        source: sql`CASE WHEN ${children.source} = 'assessment' THEN 'both'::student_source ELSE ${children.source} END`,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            inArray(children.id, sortedChildIds),
                            eq(children.organisationId, organisationId)
                        )
                    );

                // Ensure any unassigned attendees (or previous no-shows if now signed up) on this completed booking have attendance marked present
                for (const att of booking.attendees ?? []) {
                    if (!att.attendanceStatus || booking.status === 'did_not_attend') {
                        await tx
                            .update(bookingAttendees)
                            .set({
                                attendanceStatus: 'present',
                                attendanceMarkedAt: now,
                                attendanceMarkedBy: actorUserId,
                                updatedAt: now,
                            })
                            .where(eq(bookingAttendees.id, att.id));
                    }
                }

                // Look up any matching registrations first so we can preserve an agreed startDate if present
                const matchingRegs = await tx
                    .select({
                        id: registrations.id,
                        status: registrations.status,
                        startDate: registrations.startDate,
                        childId: registrationChildren.childId,
                    })
                    .from(registrations)
                    .innerJoin(registrationChildren, eq(registrationChildren.registrationId, registrations.id))
                    .where(
                        and(
                            eq(registrations.organisationId, organisationId),
                            booking.centreId ? eq(registrations.centreId, booking.centreId) : undefined,
                            inArray(registrationChildren.childId, sortedChildIds),
                            inArray(registrations.status, ['awaiting_confirmation', 'pending', 'signed_up'])
                        )
                    );

                const fallbackStartDate = (booking.startAt ? new Date(booking.startAt) : now)
                    .toISOString()
                    .slice(0, 10);

                for (const cid of sortedChildIds) {
                    const regWithStartDate =
                        (matchingRegs ?? []).find((r: any) => r.childId === cid && r.startDate) ||
                        (matchingRegs ?? []).find((r: any) => Boolean(r.startDate));
                    const regStartDateObj = regWithStartDate?.startDate
                        ? new Date(regWithStartDate.startDate)
                        : null;
                    const agreedStartDate =
                        regStartDateObj && !isNaN(regStartDateObj.getTime())
                            ? regStartDateObj.toISOString().slice(0, 10)
                            : fallbackStartDate;

                    await tx.insert(auditEvents).values({
                        organisationId,
                        userId: actorUserId,
                        eventType: 'manual_student_enrolment_confirmed',
                        eventData: JSON.stringify({
                            childId: cid,
                            entityType: 'child',
                            entityId: cid,
                            action: 'manual_student_enrolment_confirmed',
                            bookingId,
                            reason: effectiveReason,
                            startDate: agreedStartDate,
                            confirmedAt: now.toISOString(),
                        }),
                    });
                }

                // Also update any 'awaiting_confirmation' or 'pending' registration for these children in this centre to 'signed_up'
                const seenRegIds = new Set<string>();
                for (const reg of matchingRegs ?? []) {
                    if (seenRegIds.has(reg.id)) continue;
                    seenRegIds.add(reg.id);

                    if (reg.status === 'awaiting_confirmation' || reg.status === 'pending') {
                        await tx
                            .update(registrations)
                            .set({
                                status: 'signed_up',
                                bookingId,
                                updatedAt: now,
                            })
                            .where(eq(registrations.id, reg.id));
                    }

                    if (!linkedRegId) {
                        linkedRegId = reg.id;
                    }
                }
            }
        } else if (enrolmentOutcome === 'did_not_sign_up') {
            if (linkedRegId) {
                await tx
                    .update(registrations)
                    .set({
                        status: 'not_interested',
                        bookingId,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(registrations.id, linkedRegId),
                            eq(registrations.organisationId, organisationId),
                            inArray(registrations.status, ['awaiting_confirmation', 'pending'])
                        )
                    );
            }

            if (sortedChildIds.length > 0) {
                const pendingRegs = await tx
                    .select({ id: registrations.id })
                    .from(registrations)
                    .innerJoin(registrationChildren, eq(registrationChildren.registrationId, registrations.id))
                    .where(
                        and(
                            eq(registrations.organisationId, organisationId),
                            booking.centreId ? eq(registrations.centreId, booking.centreId) : undefined,
                            inArray(registrationChildren.childId, sortedChildIds),
                            inArray(registrations.status, ['awaiting_confirmation', 'pending'])
                        )
                    );

                const seenPendingIds = new Set<string>();
                for (const reg of pendingRegs ?? []) {
                    if (seenPendingIds.has(reg.id)) continue;
                    seenPendingIds.add(reg.id);

                    await tx
                        .update(registrations)
                        .set({
                            status: 'not_interested',
                            bookingId,
                            updatedAt: now,
                        })
                        .where(eq(registrations.id, reg.id));

                    if (!linkedRegId) {
                        linkedRegId = reg.id;
                    }
                }
            }
        }

        const [updatedBooking] = await tx
            .update(bookings)
            .set({
                status: nextStatus,
                enrolmentOutcome,
                enrolmentOutcomeReason: effectiveReason,
                enrolmentOutcomeAt: now,
                enrolmentOutcomeBy: actorUserId,
                ...(linkedRegId ? { linkedRegistrationId: linkedRegId } : {}),
                updatedAt: now,
            })
            .where(eq(bookings.id, bookingId))
            .returning({
                id: bookings.id,
                status: bookings.status,
                enrolmentOutcome: bookings.enrolmentOutcome,
                enrolmentOutcomeReason: bookings.enrolmentOutcomeReason,
                enrolmentOutcomeAt: bookings.enrolmentOutcomeAt,
                linkedRegistrationId: bookings.linkedRegistrationId,
            });

        await tx.insert(auditEvents).values({
            organisationId,
            userId: actorUserId,
            eventType: 'booking_enrolment_outcome_changed',
            eventData: JSON.stringify({
                bookingId,
                entityType: 'booking',
                entityId: bookingId,
                action: 'booking_enrolment_outcome_changed',
                previousOutcome: booking.enrolmentOutcome ?? null,
                enrolmentOutcome,
                reason: effectiveReason,
                childIds: sortedChildIds,
                updatedAt: now.toISOString(),
            }),
        });

        return updatedBooking;
    };

    if (typeof txOrDb.transaction === 'function') {
        return await txOrDb.transaction(runInTx);
    }
    return await runInTx(txOrDb);
}

/**
 * When a booking transitions to 'completed' (or all attendees have attendance recorded
 * with at least one 'present'/'late'), initializes `enrolmentOutcome` to:
 *  - 'signed_up' if an attendee child is already registered, else
 *  - 'awaiting_outcome'
 */
export async function initializeBookingEnrolmentOutcomeOnCompletion(
    txOrDb: any = db,
    bookingId: string,
    options?: { checkAllAttendeesMarked?: boolean; actorUserId?: string | null }
): Promise<{ status?: string; enrolmentOutcome?: BookingEnrolmentOutcome | null }> {
    if (!txOrDb || typeof txOrDb.select !== 'function' || typeof txOrDb.update !== 'function') {
        return {};
    }

    try {
        const bookingRows = await txOrDb
            .select({
                id: bookings.id,
                centreId: bookings.centreId,
                status: bookings.status,
                enrolmentOutcome: bookings.enrolmentOutcome,
                linkedRegistrationId: bookings.linkedRegistrationId,
            })
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .limit(1);

        const booking = bookingRows?.[0];
        if (!booking || booking.status === 'cancelled') return {};

        const attendees = await txOrDb
            .select({
                childId: bookingAttendees.childId,
                attendanceStatus: bookingAttendees.attendanceStatus,
                isRegistered: children.isRegistered,
            })
            .from(bookingAttendees)
            .innerJoin(children, eq(bookingAttendees.childId, children.id))
            .where(and(eq(bookingAttendees.bookingId, bookingId), isNull(children.deletedAt)));

        if (options?.checkAllAttendeesMarked) {
            if (attendees.length === 0) return {};
            const allMarked = attendees.every((a: any) => Boolean(a.attendanceStatus));
            if (!allMarked) {
                return {};
            }
            const anyAttended = attendees.some(
                (a: any) => a.attendanceStatus === 'present' || a.attendanceStatus === 'late'
            );
            const allDidNotAttend = attendees.every((a: any) =>
                ['no_show', 'absent', 'excused'].includes(a.attendanceStatus)
            );
            if (!anyAttended) {
                if (allDidNotAttend && ['confirmed', 'pending', 'completed'].includes(booking.status)) {
                    const isTerminal =
                        booking.enrolmentOutcome === 'signed_up' ||
                        booking.enrolmentOutcome === 'did_not_sign_up';
                    const nextOutcomeOnNoShow = isTerminal ? booking.enrolmentOutcome : null;
                    await txOrDb
                        .update(bookings)
                        .set({
                            status: 'did_not_attend',
                            ...(!isTerminal ? { enrolmentOutcome: null } : {}),
                            updatedAt: new Date(),
                        })
                        .where(eq(bookings.id, bookingId));
                    return { status: 'did_not_attend', enrolmentOutcome: nextOutcomeOnNoShow };
                }
                return {};
            }
        }

        // Preserve already-decided terminal outcomes
        if (booking.enrolmentOutcome === 'signed_up' || booking.enrolmentOutcome === 'did_not_sign_up') {
            if (options?.checkAllAttendeesMarked && ['confirmed', 'pending', 'did_not_attend'].includes(booking.status)) {
                await txOrDb
                    .update(bookings)
                    .set({ status: 'completed', updatedAt: new Date() })
                    .where(eq(bookings.id, bookingId));
                return { status: 'completed', enrolmentOutcome: booking.enrolmentOutcome };
            }
            return { status: booking.status, enrolmentOutcome: booking.enrolmentOutcome };
        }

        const childIds = attendees.map((a: any) => a.childId).filter(Boolean);
        let alreadyRegistered = attendees.some((a: any) => a.isRegistered === true);
        let matchedRegId: string | null = booking.linkedRegistrationId ?? null;

        if (childIds.length > 0) {
            const signedUpRegs = await txOrDb
                .select({ id: registrations.id })
                .from(registrations)
                .innerJoin(registrationChildren, eq(registrationChildren.registrationId, registrations.id))
                .where(
                    and(
                        inArray(registrationChildren.childId, childIds),
                        booking.centreId ? eq(registrations.centreId, booking.centreId) : undefined,
                        eq(registrations.status, 'signed_up')
                    )
                )
                .limit(1);

            if (signedUpRegs?.[0]?.id) {
                alreadyRegistered = true;
                matchedRegId = matchedRegId || signedUpRegs[0].id;
            }
        }

        const nextOutcome: BookingEnrolmentOutcome = alreadyRegistered ? 'signed_up' : 'awaiting_outcome';
        const nextStatus = ['confirmed', 'pending', 'did_not_attend'].includes(booking.status) ? 'completed' : booking.status;
        const now = new Date();

        await txOrDb
            .update(bookings)
            .set({
                status: nextStatus,
                enrolmentOutcome: nextOutcome,
                ...(alreadyRegistered
                    ? {
                          enrolmentOutcomeAt: now,
                          enrolmentOutcomeBy: options?.actorUserId ?? null,
                          enrolmentOutcomeReason: 'Student already registered',
                      }
                    : {}),
                ...(matchedRegId ? { linkedRegistrationId: matchedRegId } : {}),
                updatedAt: now,
            })
            .where(eq(bookings.id, bookingId));

        return { status: nextStatus, enrolmentOutcome: nextOutcome };
    } catch {
        return {};
    }
}
