import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const bulkUpdateSchema = z.object({
    bookingIds: z.array(z.string().uuid()),
    status: z.enum(['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up']),
});

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = bulkUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
        }

        const { bookingIds, status } = parsed.data;

        if (bookingIds.length === 0) {
           return NextResponse.json({ success: true, count: 0 });
        }

        // Verify that the requested bookings belong to this organisation
        const bookingsToUpdate = await db.query.bookings.findMany({
            where: inArray(bookings.id, bookingIds),
            with: { centre: true },
        });

        // ── Step 1: Filter to bookings that belong to this organisation ──────────
        let validBookingIds = bookingsToUpdate
            .filter(b => b.centre?.organisationId === session.user.organisationId)
            .map(b => b.id);

        // ── Step 2: Further restrict to accessible centres for non-ORG_OWNER ──────
        // ORG_OWNER sees all centres in their org — no extra filter needed.
        // MANAGER / FRONT_DESK / TUTOR must have an explicit centreMembership;
        // submitting booking IDs from another centre is rejected here.
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            validBookingIds = validBookingIds.filter(id => {
                const booking = bookingsToUpdate.find(b => b.id === id);
                return booking?.centreId != null && accessibleCentreIds.includes(booking.centreId);
            });
        }

        if (validBookingIds.length === 0) {
            return NextResponse.json({ error: 'No valid bookings found to update' }, { status: 403 });
        }

        // Perform bulk update
        await db
            .update(bookings)
            .set({ status, updatedAt: new Date() })
            .where(inArray(bookings.id, validBookingIds));

        return NextResponse.json({ success: true, count: validBookingIds.length });
    } catch (error) {
        console.error('[PATCH /api/bookings/bulk-update]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
