import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const bulkDeleteSchema = z.object({
    bookingIds: z.array(z.string().uuid()),
});

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = bulkDeleteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
        }

        const { bookingIds } = parsed.data;

        if (bookingIds.length === 0) {
           return NextResponse.json({ success: true, count: 0 });
        }

        // Verify that the requested bookings belong to this organisation
        const bookingsToDelete = await db.query.bookings.findMany({
            where: inArray(bookings.id, bookingIds),
            with: { centre: true },
        });

        // ── Step 1: Filter to bookings that belong to this organisation ──────────
        let validBookingIds = bookingsToDelete
            .filter(b => b.centre?.organisationId === session.user.organisationId)
            .map(b => b.id);

        // ── Step 2: Further restrict to accessible centres for non-ORG_OWNER ──────
        // ORG_OWNER has implicit access to all centres in their org.
        // MANAGER / FRONT_DESK / TUTOR must be explicitly assigned to the
        // booking's centre; guessing booking IDs is not sufficient to delete.
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            validBookingIds = validBookingIds.filter(id => {
                const booking = bookingsToDelete.find(b => b.id === id);
                return booking?.centreId != null && accessibleCentreIds.includes(booking.centreId);
            });
        }

        if (validBookingIds.length === 0) {
            return NextResponse.json({ error: 'No valid bookings found to delete' }, { status: 403 });
        }

        // Perform bulk delete
        await db
            .delete(bookings)
            .where(inArray(bookings.id, validBookingIds));

        return NextResponse.json({ success: true, count: validBookingIds.length });
    } catch (error) {
        logger.error('[DELETE /api/bookings/bulk-delete]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
