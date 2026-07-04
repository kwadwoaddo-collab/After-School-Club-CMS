'use server';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { bookings, bookingAttendees, centres, children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { emailService } from '@/lib/services/email';

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
        try {
            confirmationCode = await db.transaction(async (tx) => {
                // Check for duplicate booking (same child, same startAt)
                const existingAttendee = await tx.query.bookingAttendees.findFirst({
                    where: eq(bookingAttendees.childId, childId),
                    with: {
                        booking: {
                            where: and(
                                eq(bookings.centreId, centreId),
                                eq(bookings.startAt, startDate)
                            ),
                        },
                    },
                });
 
                if (existingAttendee?.booking) {
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
                    childId, // deprecated but still present
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
 
                return code;
            });
        } catch (e: any) {
            return { success: false, error: e.message || 'Failed to complete booking.' };
        }
 
        revalidatePath('/portal');
 
        // Fire-and-forget email confirmation
        if (parent.email) {
            emailService.sendBookingConfirmation({
                parentFirstName: parent.firstName,
                parentEmail: parent.email,
                children: [{ firstName: child.firstName, lastName: child.lastName, subjects: [] }],
                centreName: centre.name,
                centreAddress: centre.address || undefined,
                modality: 'in_person',
                startAt: startDate,
                duration,
                confirmationCode,
                magicLink: `${process.env.NEXTAUTH_URL || ''}/portal`,
            }).catch((e: unknown) => console.error('[Email] Failed to send booking confirmation:', e));
        }
 
        return { success: true, confirmationCode };
    } catch (e) {
        console.error('Failed to create portal booking:', e);
        return { success: false, error: 'An error occurred while creating the booking.' };
    }
}
