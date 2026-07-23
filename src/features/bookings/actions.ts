'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { db } from '@/db';
import { bookings, centreAvailabilityRules, bookingAttendees, slotHolds, calendarBusy, children, parents, centres, organisations } from '@/db/schema';
import { eq, and, gt, gte, lte, or, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import type { AttendanceStatus } from '@/lib/attendance';
import { emailService } from '@/lib/services/email';
import { resolveOrCreateParent, resolveOrCreateChild } from '@/lib/services/crm';

export async function updateBookingStatus(bookingId: string, status: 'completed' | 'cancelled' | 'confirmed' | 'rescheduled') {
    const session = await auth();

    if (!session?.user?.organisationId) {
        throw new Error('Unauthorized');
    }

    // Verify booking belongs to user's organisation
    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
            centre: true
        }
    });

    if (!booking) {
        throw new Error('Booking not found');
    }

    if (!booking.centre || booking.centre.organisationId !== session.user.organisationId) {
        throw new Error('Unauthorized access to this booking');
    }

    await db.update(bookings)
        .set({
            status: status,
            updatedAt: new Date()
        })
        .where(eq(bookings.id, bookingId));

    revalidatePath('/dashboard/bookings');
    revalidatePath(`/dashboard/bookings/${bookingId}`); // Revalidate specific booking page
    revalidatePath('/dashboard'); // Revalidate dashboard for Recent Students table
}

export async function rescheduleBooking(bookingId: string, newStartAt: string) {
    const session = await auth();

    if (!session?.user?.organisationId) {
        throw new Error('Unauthorized');
    }

    const startAtDate = new Date(newStartAt);
    if (isNaN(startAtDate.getTime())) {
        throw new Error('Invalid date');
    }

    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
            centre: true,
            attendees: true
        }
    });

    if (!booking) {
        throw new Error('Booking not found');
    }

    if (!booking.centre || booking.centre.organisationId !== session.user.organisationId) {
        throw new Error('Unauthorized access to this booking');
    }

    // Check availability (basic check - could reuse more robust logic from API but simple overlapping check is good here)
    // For now, assuming the client side fetched availability correctly, we just check for double bookings in the DB?
    // Actually, bookings has a unique constraint `unique_time_slot` on (centreId, modality, startAt).
    // So if we update, define modality as same.

    // We update startAt, status back to 'confirmed' (so it shows as scheduled), and maybe updatedAt.
    try {
        await db.update(bookings)
            .set({
                startAt: startAtDate,
                status: 'confirmed', // Set to confirmed so it appears as upcoming
                updatedAt: new Date()
            })
            .where(eq(bookings.id, bookingId));
    } catch (e) {
        if (e.code === '23505') { // Postgres unique violation (double booking)
            throw new Error('This slot is already booked.');
        }
        throw e;
    }

    revalidatePath('/dashboard/bookings');
    revalidatePath(`/dashboard/bookings/${bookingId}`);
    revalidatePath('/dashboard');
}

export async function saveAssessmentFeedback(attendeeId: string, data: { notes?: string; score?: string; base64?: string; mime?: string }) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Security check: verify attendee belongs to org
    const attendee = await db.query.bookingAttendees.findFirst({
        where: eq(bookingAttendees.id, attendeeId),
        with: {
            booking: {
                with: {
                    centre: true
                }
            }
        }
    });

    if (!attendee || !attendee.booking.centre || attendee.booking.centre.organisationId !== session.user.organisationId) {
        throw new Error('Unauthorized access');
    }

    await db.update(bookingAttendees)
        .set({
            feedbackNotes: data.notes || null,
            feedbackScore: data.score || null,
            feedbackAttachmentBase64: data.base64 || null,
            feedbackAttachmentMime: data.mime || null,
            // If already SENT, keep SENT, otherwise DRAFT
            feedbackStatus: attendee.feedbackStatus === 'SENT' ? 'SENT' : 'DRAFT',
            updatedAt: new Date(),
        })
        .where(eq(bookingAttendees.id, attendeeId));

    revalidatePath(`/dashboard/bookings/${attendee.bookingId}`);
}

export async function sendAssessmentFeedback(attendeeId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const attendee = await db.query.bookingAttendees.findFirst({
        where: eq(bookingAttendees.id, attendeeId),
        with: {
            booking: {
                with: {
                    centre: true
                }
            },
            child: {
                with: {
                    parent: true
                }
            }
        }
    });

    if (!attendee || !attendee.booking.centre || attendee.booking.centre.organisationId !== session.user.organisationId) {
        throw new Error('Unauthorized access');
    }

    const parent = attendee.child?.parent;
    if (parent && parent.email) {
        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, session.user.organisationId)
        });

        await emailService.sendAssessmentFeedback({
            parentFirstName: parent.firstName,
            parentEmail: parent.email,
            childFirstName: attendee.child.firstName,
            childLastName: attendee.child.lastName,
            notes: attendee.feedbackNotes,
            score: attendee.feedbackScore,
            attachmentBase64: attendee.feedbackAttachmentBase64,
            attachmentMime: attendee.feedbackAttachmentMime,
            centreName: attendee.booking.centre.name,
            orgName: org?.name || 'SprintScale Club',
        });
    }

    await db.update(bookingAttendees)
        .set({
            feedbackStatus: 'SENT',
            feedbackSentAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(bookingAttendees.id, attendeeId));

    revalidatePath(`/dashboard/bookings/${attendee.bookingId}`);
}

export async function markAttendeeAttendance(params: {
    bookingId?: string | null;
    attendeeId?: string | null;
    status: AttendanceStatus | null;
    note?: string | null;
    lateMinutes?: number | null;
    childId?: string;
    dateStr?: string;
    sessionTime?: string;
    centreId?: string;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    const { bookingId, attendeeId, status, note, lateMinutes, childId, dateStr, sessionTime, centreId } = params;

    const hasBooking = bookingId && !bookingId.startsWith('temp-');

    if (hasBooking) {
        // Verify booking belongs to user's organisation
        const booking = await db.query.bookings.findFirst({
            where: eq(bookings.id, bookingId!),
            with: {
                centre: true,
                attendees: true
            }
        });

        if (!booking || !booking.centre || booking.centre.organisationId !== session.user.organisationId) {
            throw new Error('Unauthorized access to this booking');
        }

        const attendeeExists = booking.attendees.some(a => a.id === attendeeId);
        if (!attendeeExists) {
            throw new Error('Attendee not found in this booking');
        }

        // 1. Update the per-child attendance record with audit trail
        await db.update(bookingAttendees)
            .set({
                attendanceStatus: status,
                attendanceNote: note || null,
                lateMinutes: lateMinutes || null,
                attendanceMarkedAt: new Date(),
                attendanceMarkedBy: session.user.id,
                updatedAt: new Date()
            })
            .where(eq(bookingAttendees.id, attendeeId!));

        revalidatePath(`/dashboard/bookings/${bookingId}`);
        revalidatePath('/dashboard/bookings');
        revalidatePath('/dashboard/attendance');
        revalidatePath('/dashboard');
        
        return { bookingId, attendeeId };
    } else {
        // We need to create a new booking on demand
        if (!childId || !dateStr || !sessionTime || !centreId) {
            throw new Error('Missing parameters to create on-demand booking');
        }

        const orgId = session.user.organisationId;
        if (!orgId) {
            throw new Error('Unauthorized');
        }

        // Verify child belongs to organisation
        const child = await db.query.children.findFirst({
            where: eq(children.id, childId),
        });

        if (!child || child.organisationId !== orgId) {
            throw new Error('Child not found or unauthorized');
        }

        // Form startAt date
        const startAt = new Date(`${dateStr}T${sessionTime}:00`);

        const result = await db.transaction(async (tx) => {
            // Check if booking already exists for today/time slot for this specific parent/family
            const existingBooking = await tx.query.bookings.findFirst({
                where: and(
                    eq(bookings.centreId, centreId),
                    eq(bookings.startAt, startAt),
                    eq(bookings.parentId, child.parentId)
                ),
                with: {
                    attendees: true
                }
            });

            let finalBookingId: string;
            let finalAttendeeId: string;

            if (existingBooking) {
                finalBookingId = existingBooking.id;
                const existingAttendee = existingBooking.attendees.find(a => a.childId === childId);
                if (existingAttendee) {
                    finalAttendeeId = existingAttendee.id;
                    await tx.update(bookingAttendees)
                        .set({
                            attendanceStatus: status,
                            attendanceNote: note || null,
                            lateMinutes: lateMinutes || null,
                            attendanceMarkedAt: new Date(),
                            attendanceMarkedBy: session.user.id,
                            updatedAt: new Date()
                        })
                        .where(eq(bookingAttendees.id, finalAttendeeId));
                } else {
                    const [newAtt] = await tx.insert(bookingAttendees).values({
                        bookingId: finalBookingId,
                        childId: childId,
                        attendanceStatus: status,
                        attendanceNote: note || null,
                        lateMinutes: lateMinutes || null,
                        attendanceMarkedAt: new Date(),
                        attendanceMarkedBy: session.user.id,
                    }).returning();
                    finalAttendeeId = newAtt.id;
                }
            } else {
                const code = Date.now().toString(36).toUpperCase();
                const magicLinkToken = `${code}-${Math.random().toString(36).slice(2)}`;

                // Create Booking with atomic handling of concurrent check-ins
                const [newBooking] = await tx.insert(bookings).values({
                    centreId: centreId,
                    parentId: child.parentId,
                    startAt: startAt,
                    duration: 180, // Default 3 hours
                    status: 'confirmed',
                    modality: 'in_person',
                    confirmationCode: code,
                    magicLinkToken,
                    communicationsConsent: false,
                })
                .onConflictDoNothing({
                    target: [bookings.centreId, bookings.modality, bookings.startAt, bookings.parentId]
                })
                .returning();

                if (newBooking) {
                    finalBookingId = newBooking.id;
                } else {
                    // Conflicted! Query for the concurrently-inserted booking
                    const conflictedBooking = await tx.query.bookings.findFirst({
                        where: and(
                            eq(bookings.centreId, centreId),
                            eq(bookings.startAt, startAt),
                            eq(bookings.parentId, child.parentId)
                        )
                    });
                    if (!conflictedBooking) {
                        throw new Error('Failed to resolve or create booking due to concurrency conflict.');
                    }
                    finalBookingId = conflictedBooking.id;
                }

                // Check if the attendee record was also created concurrently
                const existingAtt = await tx.query.bookingAttendees.findFirst({
                    where: and(
                        eq(bookingAttendees.bookingId, finalBookingId),
                        eq(bookingAttendees.childId, childId)
                    )
                });

                if (existingAtt) {
                    finalAttendeeId = existingAtt.id;
                    await tx.update(bookingAttendees)
                        .set({
                            attendanceStatus: status,
                            attendanceNote: note || null,
                            lateMinutes: lateMinutes || null,
                            attendanceMarkedAt: new Date(),
                            attendanceMarkedBy: session.user.id,
                            updatedAt: new Date()
                        })
                        .where(eq(bookingAttendees.id, finalAttendeeId));
                } else {
                    // Create Booking Attendee
                    const [newAtt] = await tx.insert(bookingAttendees).values({
                        bookingId: finalBookingId,
                        childId: childId,
                        attendanceStatus: status,
                        attendanceNote: note || null,
                        lateMinutes: lateMinutes || null,
                        attendanceMarkedAt: new Date(),
                        attendanceMarkedBy: session.user.id,
                    }).returning();
                    finalAttendeeId = newAtt.id;
                }
            }

            return { bookingId: finalBookingId, attendeeId: finalAttendeeId };
        });

        revalidatePath('/dashboard/attendance');
        revalidatePath('/dashboard/bookings');
        revalidatePath('/dashboard');
        return result;
    }
}

export async function getExportData() {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Tutors are not allowed to export data
    if ((session.user as any).role === 'TUTOR') {
        throw new Error('Forbidden: Tutors cannot export reports');
    }

    return await db
        .select({
            bookingId: bookings.id,
            startAt: bookings.startAt,
            status: bookings.status,
            childFirstName: children.firstName,
            childLastName: children.lastName,
            parentEmail: parents.email,
            centreName: centres.name,
            feedbackStatus: bookingAttendees.feedbackStatus,
            feedbackScore: bookingAttendees.feedbackScore,
            attendanceStatus: bookingAttendees.attendanceStatus,
        })
        .from(bookings)
        .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
        .innerJoin(children, eq(bookingAttendees.childId, children.id))
        .innerJoin(parents, eq(children.parentId, parents.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(centres.organisationId, session.user.organisationId))
        .orderBy(desc(bookings.startAt));
}

export async function registerWalkInChild(params: {
    centreId: string;
    dateStr: string; // YYYY-MM-DD
    childFirstName: string;
    childLastName: string;
    schoolYear: string;
    dateOfBirth?: string; // YYYY-MM-DD, optional but captured if parent fills it in
    parentFirstName: string;
    parentLastName: string;
    parentEmail: string;
    parentPhone?: string;
    sessionTime: string; // e.g. "15:30"
}) {
    const session = await auth();
    const orgId = session?.user?.organisationId;
    if (!session?.user?.id || !orgId) {
        throw new Error('Unauthorized');
    }

    const {
        centreId,
        dateStr,
        childFirstName,
        childLastName,
        schoolYear,
        dateOfBirth,
        parentFirstName,
        parentLastName,
        parentEmail,
        parentPhone,
        sessionTime,
    } = params;

    // 1. Verify centre belongs to user's organisation
    const targetCentre = await db.query.centres.findFirst({
        where: and(eq(centres.id, centreId), eq(centres.organisationId, orgId)),
    });

    if (!targetCentre) {
        throw new Error('Centre not found or unauthorized');
    }

    // 2. Perform operations in a transaction for integrity
    await db.transaction(async (tx) => {
        // Resolve or create parent
        const resolvedParent = await resolveOrCreateParent(tx, {
            firstName: parentFirstName,
            lastName: parentLastName,
            email: parentEmail,
            phone: parentPhone || null,
        }, orgId);
        const pId = resolvedParent.id;

        // Resolve or create child
        const child = await resolveOrCreateChild(tx, {
            firstName: childFirstName,
            lastName: childLastName,
            parentId: pId,
            organisationId: orgId,
            centreId: centreId,
            schoolYear: schoolYear,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        });


        // Calculate booking start time
        // dateStr is YYYY-MM-DD, sessionTime is HH:MM
        const startAt = new Date(`${dateStr}T${sessionTime}:00`);

        const code = Date.now().toString(36).toUpperCase();
        const magicLinkToken = `${code}-${Math.random().toString(36).slice(2)}`;

        // Create Booking
        const [newBooking] = await tx.insert(bookings).values({
            centreId: centreId,
            parentId: pId,
            startAt: startAt,
            duration: 180, // Default duration 3 hours (after-school slot)
            status: 'confirmed',
            modality: 'in_person',
            confirmationCode: code,
            magicLinkToken,
            communicationsConsent: false,
        }).returning();

        // Create Booking Attendee & automatically check in
        await tx.insert(bookingAttendees).values({
            bookingId: newBooking.id,
            childId: child.id,
            attendanceStatus: 'present',
            attendanceMarkedAt: new Date(),
            attendanceMarkedBy: session.user.id,
        });
    });

    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/kiosk');
    revalidatePath('/dashboard');
}

export async function registerExistingChildWalkIn(params: {
    centreId: string;
    dateStr: string; // YYYY-MM-DD
    childId: string;
    sessionTime: string; // e.g. "15:30"
}) {
    const session = await auth();
    const orgId = session?.user?.organisationId;
    if (!session?.user?.id || !orgId) {
        throw new Error('Unauthorized');
    }

    const { centreId, dateStr, childId, sessionTime } = params;

    // 1. Verify centre belongs to user's organisation
    const targetCentre = await db.query.centres.findFirst({
        where: and(eq(centres.id, centreId), eq(centres.organisationId, orgId)),
    });

    if (!targetCentre) {
        throw new Error('Centre not found or unauthorized');
    }

    // 2. Verify child belongs to user's organisation
    const targetChild = await db.query.children.findFirst({
        where: and(eq(children.id, childId), eq(children.organisationId, orgId)),
    });

    if (!targetChild) {
        throw new Error('Child not found or unauthorized');
    }

    // Calculate booking start time
    const startAt = new Date(`${dateStr}T${sessionTime}:00`);

    // 3. Perform operations inside a transaction
    await db.transaction(async (tx) => {
        const code = Date.now().toString(36).toUpperCase();
        const magicLinkToken = `${code}-${Math.random().toString(36).slice(2)}`;

        // Create Booking
        const [newBooking] = await tx.insert(bookings).values({
            centreId: centreId,
            parentId: targetChild.parentId,
            startAt: startAt,
            duration: 180, // Default duration 3 hours (after-school slot)
            status: 'confirmed',
            modality: 'in_person',
            confirmationCode: code,
            magicLinkToken,
            communicationsConsent: false,
        }).returning();

        // Create Booking Attendee & automatically mark as present
        await tx.insert(bookingAttendees).values({
            bookingId: newBooking.id,
            childId: targetChild.id,
            attendanceStatus: 'present',
            attendanceMarkedAt: new Date(),
            attendanceMarkedBy: session.user.id,
        });
    });

    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/kiosk');
    revalidatePath('/dashboard');
}
