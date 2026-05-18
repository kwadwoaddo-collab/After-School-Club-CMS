import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
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

        // ── Ownership check — fetch booking with its centre ────────────────────
        // Previously this was missing entirely: any authenticated user could
        // reschedule any booking in the system by guessing an ID.
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

        // Update the booking — always reset status to 'confirmed' (Booked) on reschedule
        // so the student appears in Upcoming with a blue Booked badge, even if they
        // previously had 'completed' (Attended) status on the old date.
        await db
            .update(bookings)
            .set({
                startAt: newStartDate,
                status: 'confirmed',
                updatedAt: new Date(),
            })
            .where(eq(bookings.id, bookingId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reschedule error:', error);
        return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 });
    }
}
