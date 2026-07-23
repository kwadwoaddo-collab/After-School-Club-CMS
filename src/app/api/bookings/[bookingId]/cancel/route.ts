import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

        // Centre membership check for non-ORG_OWNER users
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Already cancelled — idempotent
        if (booking.status === 'cancelled') {
            return NextResponse.json({ success: true, alreadyCancelled: true });
        }

        // ── Update the booking status to 'cancelled' ───────────────────────────
        await db
            .update(bookings)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(bookings.id, bookingId));

        // ── Fire-and-forget: parent cancellation email + in-app bell ──────────
        const orgId = session.user.organisationId;
        const childrenNames = (booking.attendees ?? [])
            .map((a: any) => `${a.child?.firstName || ''} ${a.child?.lastName || ''}`.trim())
            .filter(Boolean)
            .join(', ') || 'your child';

        // 1. Parent email / SMS notification
        void notificationService.sendBookingCancellation({
            parentFirstName: booking.parent?.firstName ?? 'Parent',
            parentEmail: booking.parent?.email ?? undefined,
            parentPhone: booking.parent?.phone ?? undefined,
            childrenNames,
            startAt: booking.startAt,
            confirmationCode: booking.confirmationCode ?? bookingId.slice(0, 8).toUpperCase(),
        }).catch(e => logger.error('[cancel] notification error:', e));

        // 2. In-app bell for org owners
        const dateStr = booking.startAt
            ? new Date(booking.startAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
            })
            : 'unknown date';
        void notifyOwners({
            orgId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: `Booking for ${childrenNames} at ${booking.centre.name} on ${dateStr} has been cancelled.`,
            bookingId,
        }).catch(e => logger.error('[cancel] db-notify error:', e));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error cancelling booking:', error);
        return NextResponse.json(
            { error: 'Failed to cancel booking' },
            { status: 500 }
        );
    }
}
