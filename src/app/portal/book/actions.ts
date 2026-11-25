'use server';

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { getCurrentParent } from '@/lib/parent-auth';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import { db } from '@/db';
import { bookings, bookingAttendees, centres, children } from '@/db/schema';
import { eq, and, ne, isNull, desc } from 'drizzle-orm';
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

const ALLOWED_PORTAL_BOOKING_DURATIONS = new Set([30, 60, 90]);

const SAFE_PORTAL_BOOKING_ERRORS = new Set([
    'A booking for this child at this time already exists.',
    'You already have a booking at this time.',
    'Selected slot is full',
    'Booking slot is no longer available',
    'One or more children could not be verified',
    'Please select at least one child',
    'Booking is already cancelled',
    'Booking not found',
    'Failed to complete booking.',
    'Failed to reschedule booking.',
]);

function generateConfirmationCode(): string {
    return `BK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function generatePortalMagicLinkToken(confirmationCode: string): string {
    return `${confirmationCode}-${crypto.randomBytes(8).toString('hex')}`;
}

async function resolveParentCommunicationsConsent(
    parent: { id: string; bookings?: Array<{ communicationsConsent?: boolean; createdAt?: Date | string | null }> },
    fallbackConsent: boolean = false
): Promise<boolean> {
    if (Array.isArray(parent.bookings) && parent.bookings.length > 0) {
        const sorted = [...parent.bookings].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
        if (typeof sorted[0]?.communicationsConsent === 'boolean') {
            return sorted[0].communicationsConsent;
        }
    }

    if (typeof db.query?.bookings?.findFirst === 'function') {
        try {
            const latestBooking = await db.query.bookings.findFirst({
                where: eq(bookings.parentId, parent.id),
                orderBy: [desc(bookings.createdAt), desc(bookings.id)],
                columns: { communicationsConsent: true },
            });
            if (latestBooking && typeof latestBooking.communicationsConsent === 'boolean') {
                return latestBooking.communicationsConsent;
            }
        } catch {
            // Fall through safely to fallbackConsent if optional relation query is unmocked
        }
    }

    return fallbackConsent;
}

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

        if (!Number.isInteger(duration) || !ALLOWED_PORTAL_BOOKING_DURATIONS.has(duration)) {
            return { success: false, error: 'Invalid booking duration' };
        }

        const startDate = new Date(startAt);
        if (Number.isNaN(startDate.getTime())) return { success: false, error: 'Invalid date' };
        if (startDate <= new Date()) {
            return { success: false, error: 'Booking date must be in the future' };
        }

        // Verify active (non-soft-deleted) child belongs to this parent
        const child = await db.query.children.findFirst({
            where: and(
                eq(children.id, childId),
                eq(children.parentId, parent.id),
                isNull(children.deletedAt)
            ),
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

        const preservedConsent = await resolveParentCommunicationsConsent(parent, false);

        let confirmationCode: string;
        let outboxId: string | null = null;
        try {
            const txResult = await db.transaction(async (tx) => {
                // Check for active (non-cancelled) duplicate booking (same child, same startAt)
                const existingAttendee = await tx
                    .select({ id: bookingAttendees.id })
                    .from(bookingAttendees)
                    .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
                    .where(
                        and(
                            eq(bookingAttendees.childId, childId),
                            eq(bookings.centreId, centreId),
                            eq(bookings.startAt, startDate),
                            ne(bookings.status, 'cancelled')
                        )
                    )
                    .limit(1);

                if (existingAttendee.length > 0) {
                    throw new Error('A booking for this child at this time already exists.');
                }

                // Also check via bookings table directly (excluding cancelled bookings)
                const duplicateCheck = await tx.query.bookings.findFirst({
                    where: and(
                        eq(bookings.parentId, parent.id),
                        eq(bookings.centreId, centreId),
                        eq(bookings.startAt, startDate),
                        ne(bookings.status, 'cancelled')
                    ),
                });
                if (duplicateCheck) {
                    throw new Error('You already have a booking at this time.');
                }

                const code = generateConfirmationCode();
                const magicLinkToken = generatePortalMagicLinkToken(code);

                const [newBooking] = await tx
                    .insert(bookings)
                    .values({
                        parentId: parent.id,
                        centreId,
                        startAt: startDate,
                        duration,
                        modality: 'in_person',
                        status: 'confirmed',
                        confirmationCode: code,
                        magicLinkToken,
                        communicationsConsent: preservedConsent,
                    })
                    .returning();

                await tx.insert(bookingAttendees).values({
                    bookingId: newBooking.id,
                    childId,
                });

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
                            magicLink: `${getTrustedApplicationUrl()}/portal`,
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
            const rawMessage = e instanceof Error ? e.message : undefined;
            if (rawMessage && SAFE_PORTAL_BOOKING_ERRORS.has(rawMessage)) {
                return { success: false, error: rawMessage };
            }
            logger.error('[createPortalBooking] Unexpected transaction error:', e);
            return { success: false, error: 'Failed to create booking. Please try again.' };
        }

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

        if (!Number.isInteger(duration) || !ALLOWED_PORTAL_BOOKING_DURATIONS.has(duration)) {
            return { success: false, error: 'Invalid booking duration' };
        }

        const newStartDate = new Date(startAt);
        if (Number.isNaN(newStartDate.getTime())) return { success: false, error: 'Invalid date' };
        if (newStartDate <= new Date()) return { success: false, error: 'New date must be in the future' };

        // Verify the booking being rescheduled belongs to this parent
        const oldBooking = await db.query.bookings.findFirst({
            where: and(eq(bookings.id, oldBookingId), eq(bookings.parentId, parent.id)),
        });
        if (!oldBooking) return { success: false, error: 'Booking not found' };
        if (oldBooking.status === 'cancelled') return { success: false, error: 'Booking is already cancelled' };

        // Enforce 24-hour advance reschedule window (matching cancelBookingByParent & portal UI)
        const oldBookingDate = new Date(oldBooking.startAt);
        const hoursUntilBooking = (oldBookingDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilBooking < 24) {
            return { success: false, error: 'Bookings must be rescheduled at least 24 hours in advance.' };
        }

        // Verify active (non-soft-deleted) child belongs to this parent
        const child = await db.query.children.findFirst({
            where: and(
                eq(children.id, childId),
                eq(children.parentId, parent.id),
                isNull(children.deletedAt)
            ),
        });
        if (!child) return { success: false, error: 'Child not found' };

        // Verify centre
        const centre = await db.query.centres.findFirst({
            where: and(eq(centres.id, centreId), eq(centres.organisationId, parent.organisationId)),
        });
        if (!centre) return { success: false, error: 'Centre not found' };

        const preservedConsent = await resolveParentCommunicationsConsent(
            parent,
            Boolean(oldBooking.communicationsConsent)
        );

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
                    throw new Error(
                        outcome.rejectedReason === 'ALREADY_CANCELLED'
                            ? 'Booking is already cancelled'
                            : 'Booking not found'
                    );
                }

                // 2. Create new booking with collision-resistant confirmation code and preserved consent
                const code = generateConfirmationCode();
                const magicLinkToken = generatePortalMagicLinkToken(code);

                const [newBooking] = await tx
                    .insert(bookings)
                    .values({
                        parentId: parent.id,
                        centreId,
                        startAt: newStartDate,
                        duration,
                        modality: 'in_person',
                        status: 'confirmed',
                        confirmationCode: code,
                        magicLinkToken,
                        communicationsConsent: preservedConsent,
                    })
                    .returning();

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
            const rawMessage = e instanceof Error ? e.message : undefined;
            if (rawMessage && SAFE_PORTAL_BOOKING_ERRORS.has(rawMessage)) {
                return { success: false, error: rawMessage };
            }
            logger.error('[reschedulePortalBooking] Unexpected transaction error:', e);
            return { success: false, error: 'Failed to reschedule booking. Please try again.' };
        }

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
