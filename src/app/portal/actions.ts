'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
    captureEntryBudget,
    registerFastPathAfterCommit,
    transitionBookingAndEnqueue,
    OUTBOX_PAYLOAD_VERSION,
    type BookingCancelledPayload,
} from '@/lib/services/email-outbox';

export async function cancelBookingByParent(bookingId: string) {
    const budget = captureEntryBudget('action');
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        const booking = await db.query.bookings.findFirst({
            where: and(
                eq(bookings.id, bookingId),
                eq(bookings.parentId, parent.id)
            ),
            with: {
                centre: true,
                attendees: { with: { child: true } }
            }
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

        const childrenNamesArray = (booking.attendees || [])
            .map((a: any) => `${a.child?.firstName || ''} ${a.child?.lastName || ''}`.trim())
            .filter(Boolean);
        const childrenNames = childrenNamesArray.join(', ') || 'your child';
        const confirmationCode = booking.confirmationCode || bookingId.slice(0, 8).toUpperCase();

        let outboxId: string | null = null;
        try {
            const txResult = await db.transaction(async (tx) => {
                return await transitionBookingAndEnqueue(tx, {
                    bookingId,
                    organisationId: parent.organisationId,
                    centreId: booking.centreId,
                    type: 'BOOKING_CANCELLED',
                    recipientEmail: parent.email || null,
                    applyBookingChange: async (innerTx) => {
                        await innerTx
                            .update(bookings)
                            .set({ status: 'cancelled', updatedAt: new Date() })
                            .where(eq(bookings.id, bookingId));
                    },
                    buildPayload: (): BookingCancelledPayload => ({
                        payloadVersion: OUTBOX_PAYLOAD_VERSION,
                        parentFirstName: parent.firstName,
                        parentEmail: parent.email || '',
                        childrenNames: childrenNamesArray.length > 0 ? childrenNamesArray : ['your child'],
                        startAt: bookingDate.toISOString(),
                        confirmationCode,
                    }),
                });
            });
            outboxId = txResult.outboxId;
        } catch (err) {
            logger.error('[portal/cancel] Failed to transition booking:', {
                bookingId,
                errorName: err instanceof Error ? err.name : 'UnknownError',
            });
            return { success: false, error: 'An error occurred while attempting to cancel the booking' };
        }

        // Register after() fast path (action origin: own-row-first)
        if (outboxId) {
            registerFastPathAfterCommit(after, {
                origin: 'action',
                outboxId,
                budget,
            });
        }

        revalidatePath('/portal');
        return { success: true };
    } catch (e) {
        logger.error('Failed to cancel booking:', e);
        return { success: false, error: 'An error occurred while attempting to cancel the booking' };
    }
}
