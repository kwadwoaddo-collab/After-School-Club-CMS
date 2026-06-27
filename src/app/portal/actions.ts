'use server';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function cancelBookingByParent(bookingId: string) {
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.id, bookingId),
                eq(bookings.parentId, parent.id)
            )
        });

        if (!booking) {
            return { success: false, error: 'Booking not found' };
        }

        if (booking.status === 'cancelled') {
            return { success: false, error: 'Booking is already cancelled' };
        }

        // 24 hour check
        const bookingDate = new Date(booking.startAt);
        const hoursUntilBooking = (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60);

        if (hoursUntilBooking < 24) {
            return { success: false, error: 'Bookings must be cancelled at least 24 hours in advance.' };
        }

        await db.update(bookings)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(bookings.id, bookingId));

        revalidatePath('/portal');
        return { success: true };
    } catch (e) {
        console.error('Failed to cancel booking:', e);
        return { success: false, error: 'An error occurred while attempting to cancel the booking' };
    }
}
