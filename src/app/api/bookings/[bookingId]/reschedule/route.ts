import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
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
