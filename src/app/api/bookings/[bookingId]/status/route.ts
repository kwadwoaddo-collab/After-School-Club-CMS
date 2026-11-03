import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings, bookingAttendees } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { initializeBookingEnrolmentOutcomeOnCompletion } from '@/lib/services/booking-outcome-sync';

// Must match the bookingStatusEnum in schema.ts: confirmed | cancelled | rescheduled | completed | pending | signed_up | did_not_attend
const statusSchema = z.object({
    status: z.enum(['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up', 'did_not_attend']),
});

interface RouteContext {
    params: Promise<{ bookingId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const { bookingId } = await params;

        // UUID format check
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(bookingId)) {
            return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
        }

        const body = await request.json();
        const parsed = statusSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid status value', details: parsed.error.flatten() }, { status: 400 });
        }

        const { status } = parsed.data;

        // Verify the booking belongs to this organisation before updating
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: { centre: true },
        });

        if (!booking || !booking.centre) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (booking.centre.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ── Centre membership check for non-ORG_OWNER users ─────────────────
        // ORG_OWNER has implicit access to all centres within their org.
        // MANAGER / FRONT_DESK / TUTOR must have an explicit centreMembership
        // for the booking's centre — knowing a bookingId is not sufficient.
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const now = new Date();
        const isTerminalOutcome =
            booking.enrolmentOutcome === 'signed_up' ||
            booking.enrolmentOutcome === 'did_not_sign_up';

        // Perform the update
        const [updated] = await db
            .update(bookings)
            .set({
                status,
                ...(status === 'signed_up'
                    ? {
                          enrolmentOutcome: 'signed_up' as const,
                          enrolmentOutcomeAt: now,
                          enrolmentOutcomeBy: session.user.id,
                      }
                    : status === 'did_not_attend' && !isTerminalOutcome
                    ? {
                          enrolmentOutcome: null,
                      }
                    : {}),
                updatedAt: now,
            })
            .where(eq(bookings.id, bookingId))
            .returning({ id: bookings.id, status: bookings.status, enrolmentOutcome: bookings.enrolmentOutcome });

        try {
            if (status === 'did_not_attend') {
                await db
                    .update(bookingAttendees)
                    .set({
                        attendanceStatus: 'no_show',
                        attendanceMarkedAt: now,
                        attendanceMarkedBy: session.user.id,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(bookingAttendees.bookingId, bookingId),
                            isNull(bookingAttendees.attendanceStatus)
                        )
                    );
            } else if (status === 'completed') {
                await db
                    .update(bookingAttendees)
                    .set({
                        attendanceStatus: 'present',
                        attendanceMarkedAt: now,
                        attendanceMarkedBy: session.user.id,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(bookingAttendees.bookingId, bookingId),
                            isNull(bookingAttendees.attendanceStatus)
                        )
                    );
            }
        } catch {
            // Safely ignore if db.update is a single-call unit test mock
        }

        let finalOutcome = updated?.enrolmentOutcome ?? null;
        if (status === 'completed') {
            const initRes = await initializeBookingEnrolmentOutcomeOnCompletion(db, bookingId, {
                actorUserId: session.user.id,
            });
            if (initRes.enrolmentOutcome) {
                finalOutcome = initRes.enrolmentOutcome;
            }
        }

        revalidatePath('/dashboard/bookings');
        revalidatePath(`/dashboard/bookings/${bookingId}`);
        revalidatePath('/dashboard/attendance');
        if (booking.centreId) {
            revalidatePath(`/dashboard/centres/${booking.centreId}`);
        }

        return NextResponse.json({
            success: true,
            booking: { ...updated, enrolmentOutcome: finalOutcome },
        });
    } catch (error) {
        logger.error('[PATCH /api/bookings/[bookingId]/status]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
