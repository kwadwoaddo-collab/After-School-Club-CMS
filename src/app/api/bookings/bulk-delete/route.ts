import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

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

        const validBookingIds = bookingsToDelete
            .filter(b => b.centre?.organisationId === session.user.organisationId)
            .map(b => b.id);

        if (validBookingIds.length === 0) {
            return NextResponse.json({ error: 'No valid bookings found to delete' }, { status: 403 });
        }

        // Perform bulk delete
        await db
            .delete(bookings)
            .where(inArray(bookings.id, validBookingIds));

        return NextResponse.json({ success: true, count: validBookingIds.length });
    } catch (error) {
        console.error('[DELETE /api/bookings/bulk-delete]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
