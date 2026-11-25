import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

// Note: keep empty array [] valid (idempotent 200 { count: 0 }), cap upper bound at 200
const bulkUpdateSchema = z.object({
    bookingIds: z.array(z.string().uuid()).max(200),
    status: z.enum(['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up', 'did_not_attend']),
});

export async function PATCH(request: NextRequest) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const userRole = (session.user as any).role as string | undefined;
        if (!userRole || !['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

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
        // MANAGER / FRONT_DESK must have an explicit centreMembership;
        // submitting booking IDs from another centre is rejected here.
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

        revalidatePath('/dashboard/bookings');
        revalidatePath('/dashboard/attendance');
        if (validBookingIds.length <= 25) {
            for (const id of validBookingIds) {
                revalidatePath(`/dashboard/bookings/${id}`);
            }
        }

        return NextResponse.json({ success: true, count: validBookingIds.length });
    } catch (error) {
        logger.error('[PATCH /api/bookings/bulk-update]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
