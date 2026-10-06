'use server';
import { logger } from '@/lib/logger';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { bookings, bookingAttendees, centres, children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
    captureEntryBudget,
    enqueueBookingEmail,
    registerFastPathAfterCommit,
    supersedeOldBookingForReplacement,
    OUTBOX_PAYLOAD_VERSION,
    type BookingConfirmationPayload,
    type BookingReschedulePayload,
} from '@/lib/services/email-outbox';

export async function createPortalBooking({
    childId,
    centreId,
    startAt,
    duration,
}: {
    childId: string;
    centreId: string;
    startAt: string;
    duration: number;
}): Promise<{ success: boolean; confirmationCode?: string; error?: string }> {
    const budget = captureEntryBudget('action');
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };
 
        // Verify child belongs to this parent
        const child = await db.query.children.findFirst({
            where: and(eq(children.id, childId), eq(children.parentId, parent.id)),
        });
        if (!child) return { success: false, error: 'Child not found' };
 
        // Verify centre exists and belongs to the same org as the parent
        const centre = await db.query.centres.findFirst({
            where: and(
                eq(centres.id, centreId),
                eq(centres.organisationId, parent.organisationId)
            ),
        });
        if (!centre) return { success: false, error: 'Centre not found' };
 
        const startDate = new Date(startAt);
        if (isNaN(startDate.getTime())) return { success: false, error: 'Invalid date' };
 
        let confirmationCode: string;
        let outboxId: string | null = null;
        try {
            const txResult = await db.transaction(async (tx) => {
                // Check for duplicate booking (same child, same startAt)
                const existingAttendee = await tx
                    .select({ id: bookingAttendees.id })
                    .from(bookingAttendees)
                    .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
                    .where(
                        and(
                            eq(bookingAttendees.childId, childId),
                            eq(bookings.centreId, centreId),
                            eq(bookings.startAt, startDate)
                        )
                    )
                    .limit(1);
 
                if (existingAttendee.length > 0) {
                    throw new Error('A booking for this child at this time already exists.');
                }
 
                // Also check via bookings table directly
                const duplicateCheck = await tx.query.bookings.findFirst({
                    where: and(
                        eq(bookings.parentId, parent.id),
                        eq(bookings.centreId, centreId),
                        eq(bookings.startAt, startDate)
                    ),
                });
                if (duplicateCheck) {
                    throw new Error('You already have a booking at this time.');
                }
 
                const code = Date.now().toString(36).toUpperCase();
                const magicLinkToken = `${code}-${Math.random().toString(36).slice(2)}`;
 
                // Create booking
                const [newBooking] = await tx.insert(bookings).values({
                    parentId: parent.id,
                    centreId,
                    startAt: startDate,
                    duration,
                    modality: 'in_person',
                    status: 'confirmed',
                    confirmationCode: code,
                    magicLinkToken,
                    communicationsConsent: false,
                }).returning();
 
                // Create bookingAttendee record
                await tx.insert(bookingAttendees).values({
                    bookingId: newBooking.id,
                    childId,
                });

                // Enqueue outbox row inside the same transaction
                let enqueuedId: string | null = null;
                if (parent.email) {
                    try {
                        const payload: BookingConfirmationPayload = {
                            payloadVersion: OUTBOX_PAYLOAD_VERSION,
                            parentFirstName: parent.firstName,
                            parentEmail: parent.email,
                            children: [{ firstName: child.firstName, lastName: child.lastName, subjects: [] }],
                            centreName: centre.name,
                            centreAddress: centre.address || undefined,
                            modality: 'in_person',
                            startAt: startDate.toISOString(),
                            duration,
                            confirmationCode: code,
                            magicLink: `${process.env.NEXTAUTH_URL || ''}/portal`,
                        };
                        const enq = await enqueueBookingEmail(tx, {
                            organisationId: parent.organisationId,
                            centreId,
                            bookingId: newBooking.id,
                            version: 1,
                            type: 'BOOKING_CONFIRMATION',
                            recipientEmail: parent.email,
                            payload,
                            linkMode: 'PORTAL_URL',
                        });
                        enqueuedId = enq.outboxId;
                    } catch (enqErr) {
                        logger.error('[createPortalBooking] Failed to enqueue outbox row:', {
                            errorName: enqErr instanceof Error ? enqErr.name : 'UnknownError',
                        });
                        throw new Error('Failed to complete booking.');
                    }
                }
 
                return { code, outboxId: enqueuedId };
            });
            confirmationCode = txResult.code;
            outboxId = txResult.outboxId;
        } catch (e) {
            const message = e instanceof Error ? e.message : undefined;
            return { success: false, error: message || 'Failed to complete booking.' };
        }

        // Post-commit: register after() fast path
        if (outboxId) {
            registerFastPathAfterCommit(after, {
                origin: 'action',
                outboxId,
                budget,
            });
        }
 
        try {
            revalidatePath('/portal');
        } catch (revErr) {
            logger.error('[createPortalBooking] revalidatePath failed:', {
                errorName: revErr instanceof Error ? revErr.name : 'UnknownError',
            });
        }
 
        return { success: true, confirmationCode };
    } catch (e) {
        logger.error('Failed to create portal booking:', e);
        return { success: false, error: 'An error occurred while creating the booking.' };
    }
}

export async function reschedulePortalBooking({
    oldBookingId,
    childId,
    centreId,
    startAt,
    duration,
}: {
    oldBookingId: string;
    childId: string;
    centreId: string;
    startAt: string;
    duration: number;
}): Promise<{ success: boolean; confirmationCode?: string; error?: string }> {
    const budget = captureEntryBudget('action');
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        // Verify the booking being rescheduled belongs to this parent
        const oldBooking = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, oldBookingId), eq(bookings.parentId, parent.id)),
        });
        if (!oldBooking) return { success: false, error: 'Booking not found' };
        if (oldBooking.status === 'cancelled') return { success: false, error: 'Booking is already cancelled' };

        // Verify child belongs to this parent
        const child = await db.query.children.findFirst({
            where: and(eq(children.id, childId), eq(children.parentId, parent.id)),
        });
        if (!child) return { success: false, error: 'Child not found' };

        // Verify centre
        const centre = await db.query.centres.findFirst({
            where: and(eq(centres.id, centreId), eq(centres.organisationId, parent.organisationId)),
        });
        if (!centre) return { success: false, error: 'Centre not found' };

        const newStartDate = new Date(startAt);
        if (isNaN(newStartDate.getTime())) return { success: false, error: 'Invalid date' };

        // Must be in the future
        if (newStartDate <= new Date()) return { success: false, error: 'New date must be in the future' };

        let confirmationCode: string;
        let outboxId: string | null = null;

        try {
            const txResult = await db.transaction(async (tx) => {
                // 1. Supersede old booking via supersedeOldBookingForReplacement
                const outcome = await supersedeOldBookingForReplacement(tx, {
                    oldBookingId,
                    expectedParentId: parent.id,
                    expectedOrganisationId: parent.organisationId,
                });

                if (!outcome.replaced) {
                    throw new Error(outcome.rejectedReason === 'ALREADY_CANCELLED' ? 'Booking is already cancelled' : 'Booking not found');
                }

                // 2. Create new booking
                const code = Date.now().toString(36).toUpperCase();
                const magicLinkToken = `${code}-${Math.random().toString(36).slice(2)}`;

                const [newBooking] = await tx.insert(bookings).values({
                    parentId: parent.id,
                    centreId,
                    startAt: newStartDate,
                    duration,
                    modality: 'in_person',
                    status: 'confirmed',
                    confirmationCode: code,
                    magicLinkToken,
                    communicationsConsent: false,
                }).returning();

                // 3. Create attendee record
                await tx.insert(bookingAttendees).values({
                    bookingId: newBooking.id,
                    childId,
                });

                // 4. Enqueue BOOKING_RESCHEDULE outbox row in the same transaction
                let enqueuedId: string | null = null;
                if (parent.email) {
                    try {
                        const payload: BookingReschedulePayload = {
                            payloadVersion: OUTBOX_PAYLOAD_VERSION,
                            parentFirstName: parent.firstName,
                            parentEmail: parent.email,
                            childrenNames: [`${child.firstName} ${child.lastName}`],
                            centreName: centre.name,
                            oldStartAt: (outcome.oldStartAt ?? oldBooking.startAt).toISOString(),
                            newStartAt: newStartDate.toISOString(),
                            confirmationCode: code,
                            includePortalLoginGuidance: outcome.hadUnsentConfirmation,
                        };
                        const enq = await enqueueBookingEmail(tx, {
                            organisationId: parent.organisationId,
                            centreId,
                            bookingId: newBooking.id,
                            version: 1,
                            type: 'BOOKING_RESCHEDULE',
                            recipientEmail: parent.email,
                            payload,
                            linkMode: null,
                        });
                        enqueuedId = enq.outboxId;
                    } catch (enqErr) {
                        logger.error('[reschedulePortalBooking] Failed to enqueue outbox row:', {
                            errorName: enqErr instanceof Error ? enqErr.name : 'UnknownError',
                        });
                        throw new Error('Failed to reschedule booking.');
                    }
                }

                return { code, outboxId: enqueuedId };
            });
            confirmationCode = txResult.code;
            outboxId = txResult.outboxId;
        } catch (e) {
            const message = e instanceof Error ? e.message : undefined;
            return { success: false, error: message || 'Failed to reschedule booking.' };
        }

        // Post-commit: register after() fast path
        if (outboxId) {
            registerFastPathAfterCommit(after, {
                origin: 'action',
                outboxId,
                budget,
            });
        }

        try {
            revalidatePath('/portal');
        } catch (revErr) {
            logger.error('[reschedulePortalBooking] revalidatePath failed:', {
                errorName: revErr instanceof Error ? revErr.name : 'UnknownError',
            });
        }

        return { success: true, confirmationCode };
    } catch (e) {
        logger.error('Failed to reschedule portal booking:', e);
        return { success: false, error: 'An error occurred while rescheduling.' };
    }
}
