import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

interface RouteContext {
    params: Promise<{ bookingId: string }>;
}

/**
 * DELETE /api/bookings/[bookingId]
 * Permanently removes a booking record (and its attendees via cascade).
 * Only accessible by users who belong to the same organisation as the booking's centre.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const { bookingId } = await params;

        // UUID format guard
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(bookingId)) {
            return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
        }

        // Verify the booking belongs to this organisation before deleting
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

        // Centre membership check for non-ORG_OWNER users — matches the check
        // already applied by the sibling bulk-delete endpoint
        // (POST /api/bookings/bulk-delete) for this identical action; this
        // single-booking DELETE was missing it.
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Hard delete — booking_attendees are removed via ON DELETE CASCADE
        await db.delete(bookings).where(eq(bookings.id, bookingId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[DELETE /api/bookings/[bookingId]]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
