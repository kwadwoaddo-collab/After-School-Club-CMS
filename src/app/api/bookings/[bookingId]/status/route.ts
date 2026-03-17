import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings, centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Must match the bookingStatusEnum in schema.ts: confirmed | cancelled | rescheduled | completed
const statusSchema = z.object({
    status: z.enum(['confirmed', 'cancelled', 'rescheduled', 'completed']),
});

interface RouteContext {
    params: Promise<{ bookingId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const session = await auth();
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

        // Perform the update
        const [updated] = await db
            .update(bookings)
            .set({ status, updatedAt: new Date() })
            .where(eq(bookings.id, bookingId))
            .returning({ id: bookings.id, status: bookings.status });

        return NextResponse.json({ success: true, booking: updated });
    } catch (error) {
        console.error('[PATCH /api/bookings/[bookingId]/status]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
