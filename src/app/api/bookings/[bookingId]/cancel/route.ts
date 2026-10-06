import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse, after } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { notificationService } from '@/lib/services/notifications';
import { notifyOwners } from '@/lib/db-notifications';
import { revalidatePath } from 'next/cache';
import {
    captureEntryBudget,
    registerFastPathAfterCommit,
    transitionBookingAndEnqueue,
    OUTBOX_PAYLOAD_VERSION,
    type BookingCancelledPayload,
} from '@/lib/services/email-outbox';

export const maxDuration = 60;

export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    const budget = captureEntryBudget('route');
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { bookingId } = await params;

        // ── Ownership check — fetch booking with centre, parent & attendees ─────
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId),
            with: {
                centre: true,
                parent: true,
                attendees: {
                    with: { child: true },
                },
            },
        });

        if (!booking || !booking.centre) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Org-level check
        if (booking.centre.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Centre membership check for non-ORG_OWNER users
        const userRole = (session.user as any).role as string | undefined;
        if (userRole !== 'ORG_OWNER' && booking.centreId) {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(booking.centreId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Already cancelled — idempotent
        if (booking.status === 'cancelled') {
            return NextResponse.json({ success: true, alreadyCancelled: true });
        }

        const orgId = session.user.organisationId;
        const childrenNamesArray = (booking.attendees ?? [])
            .map((a: any) => `${a.child?.firstName || ''} ${a.child?.lastName || ''}`.trim())
            .filter(Boolean);
        const childrenNames = childrenNamesArray.join(', ') || 'your child';
        const confirmationCode = booking.confirmationCode ?? bookingId.slice(0, 8).toUpperCase();

        // ── Transition booking and enqueue outbox row atomically ───────────────
        let outboxId: string | null = null;
        try {
            const txResult = await db.transaction(async (tx) => {
                return await transitionBookingAndEnqueue(tx, {
                    bookingId,
                    organisationId: orgId,
                    centreId: booking.centreId,
                    type: 'BOOKING_CANCELLED',
                    recipientEmail: booking.parent?.email || null,
                    applyBookingChange: async (innerTx) => {
                        await innerTx
                            .update(bookings)
                            .set({ status: 'cancelled', updatedAt: new Date() })
                            .where(eq(bookings.id, bookingId));
                    },
                    buildPayload: (): BookingCancelledPayload => ({
                        payloadVersion: OUTBOX_PAYLOAD_VERSION,
                        parentFirstName: booking.parent?.firstName ?? 'Parent',
                        parentEmail: booking.parent?.email ?? '',
                        childrenNames: childrenNamesArray.length > 0 ? childrenNamesArray : ['your child'],
                        startAt: new Date(booking.startAt).toISOString(),
                        confirmationCode,
                    }),
                });
            });
            outboxId = txResult.outboxId;
        } catch (err) {
            logger.error('[cancel] Failed to transition booking:', {
                bookingId,
                errorName: err instanceof Error ? err.name : 'UnknownError',
            });
            throw new Error('Failed to cancel booking');
        }

        // Register after() fast path
        if (outboxId) {
            registerFastPathAfterCommit(after, {
                origin: 'route',
                outboxId,
                budget,
            });
        }

        // ── Post-commit best-effort SMS notification ──────────────────────────
        void notificationService.sendBookingCancellation({
            parentFirstName: booking.parent?.firstName ?? 'Parent',
            parentEmail: undefined, // Email handled via outbox
            parentPhone: booking.parent?.phone ?? undefined,
            childrenNames,
            startAt: booking.startAt,
            confirmationCode,
        }).catch(e => logger.error('[cancel] notification error:', e));

        // ── In-app bell for org owners ────────────────────────────────────────
        const dateStr = booking.startAt
            ? new Date(booking.startAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
            })
            : 'unknown date';
        void notifyOwners({
            orgId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: `Booking for ${childrenNames} at ${booking.centre.name} on ${dateStr} has been cancelled.`,
            bookingId,
        }).catch(e => logger.error('[cancel] db-notify error:', e));

        revalidatePath('/dashboard/bookings');
        revalidatePath(`/dashboard/bookings/${bookingId}`);
        revalidatePath('/dashboard/attendance');
        if (booking.centreId) {
            revalidatePath(`/dashboard/centres/${booking.centreId}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Error cancelling booking:', error);
        return NextResponse.json(
            { error: 'Failed to cancel booking' },
            { status: 500 }
        );
    }
}
