import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

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

        // ── Ownership check — fetch booking with its centre ────────────────────
        // Previously the org check was missing entirely: any authenticated user
        // could cancel any booking in the system by guessing a booking ID.
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: { centre: true },
        });

        if (!booking || !booking.centre) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Org-level check: booking must belong to the user's organisation
        if (booking.centre.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // ── Centre membership check for non-ORG_OWNER users ───────────────────
        // ORG_OWNER has implicit access to all centres within their org.
        // MANAGER / FRONT_DESK / TUTOR must be explicitly assigned to the
        // booking's centre — knowing a bookingId is not sufficient.
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Update the booking status to 'cancelled'
        await db
            .update(bookings)
            .set({
                status: 'cancelled',
                updatedAt: new Date(),
            })
            .where(eq(bookings.id, bookingId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        return NextResponse.json(
            { error: 'Failed to cancel booking' },
            { status: 500 }
        );
    }
}
