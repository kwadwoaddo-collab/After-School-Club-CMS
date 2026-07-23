import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { notificationService } from '@/lib/services/notifications';
import { notifyOwners } from '@/lib/db-notifications';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { bookingId } = await params;
        const body = await request.json();
        const { newStartAt } = body;

        if (!newStartAt) {
            return NextResponse.json({ error: 'New start time is required' }, { status: 400 });
        }

        // Validate the new date is in the future
        const newStartDate = new Date(newStartAt);
        if (newStartDate < new Date()) {
            return NextResponse.json({ error: 'Cannot reschedule to a past date' }, { status: 400 });
        }

        // ── Ownership check — fetch booking with centre, parent & attendees ─────
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: {
                centre: true,
                parent: true,
                attendees: {
                    with: { child: true },
                },
            },
        });

        if (!booking || !booking.centre) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Org-level check
        if (booking.centre.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ── Centre membership check for non-ORG_OWNER users ───────────────────
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Capture old date before overwriting
        const oldStartAt = booking.startAt;

        // ── Update the booking ─────────────────────────────────────────────────
        // Always reset to 'confirmed' so the student appears in Upcoming with
        // a blue Booked badge, even if they previously had 'completed' status.
        await db
            .update(bookings)
            .set({
                startAt: newStartDate,
                status: 'confirmed',
                updatedAt: new Date(),
            })
            .where(eq(bookings.id, bookingId));

        // ── Fire-and-forget: parent reschedule email + in-app bell ────────────
        const orgId = session.user.organisationId;
        const childrenNames = (booking.attendees ?? [])
            .map((a: any) => `${a.child?.firstName || ''} ${a.child?.lastName || ''}`.trim())
            .filter(Boolean)
            .join(', ') || 'your child';

        void notificationService.sendBookingReschedule({
            parentFirstName: booking.parent?.firstName ?? 'Parent',
            parentEmail: booking.parent?.email ?? undefined,
            parentPhone: booking.parent?.phone ?? undefined,
            childrenNames,
            centreName: booking.centre.name,
            oldStartAt,
            newStartAt: newStartDate,
            confirmationCode: booking.confirmationCode ?? bookingId.slice(0, 8).toUpperCase(),
        }).catch(e => logger.error('[reschedule] notification error:', e));

        const newDateStr = newStartDate.toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
        });
        void notifyOwners({
            orgId,
            type: 'booking_rescheduled',
            title: 'Booking Rescheduled',
            message: `Booking for ${childrenNames} at ${booking.centre.name} moved to ${newDateStr}.`,
            bookingId,
        }).catch(e => logger.error('[reschedule] db-notify error:', e));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Reschedule error:', error);
        return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 });
    }
}
