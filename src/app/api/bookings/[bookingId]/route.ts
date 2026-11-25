import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { isValidUuid } from '@/lib/uuid';

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

        // UUID format guard (supports UUIDv4/v7)
        if (!isValidUuid(bookingId)) {
            return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
        }

        const userRole = (session.user as any).role as string | undefined;
        if (!['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole ?? '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Hard delete — booking_attendees are removed via ON DELETE CASCADE
        await db.delete(bookings).where(eq(bookings.id, bookingId));

        revalidatePath('/dashboard/bookings');
        revalidatePath('/dashboard/attendance');
        if (booking.centreId) {
            revalidatePath(`/dashboard/centres/${booking.centreId}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[DELETE /api/bookings/[bookingId]]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
