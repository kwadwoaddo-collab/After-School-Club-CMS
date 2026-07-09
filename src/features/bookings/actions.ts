'use server';

import { db } from '@/db';
import { bookings, centreAvailabilityRules, bookingAttendees, slotHolds, calendarBusy, children, parents, centres, organisations } from '@/db/schema';
import { eq, and, gt, gte, lte, or, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import type { AttendanceStatus } from '@/lib/attendance';
import { emailService } from '@/lib/services/email';

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
    } catch (e: any) {
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
    bookingId: string;
    attendeeId: string;
    status: AttendanceStatus | null;
    note?: string | null;
    lateMinutes?: number | null;
}) {
    const session = await auth();
    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    const { bookingId, attendeeId, status, note, lateMinutes } = params;

    // Verify booking belongs to user's organisation
    const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
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
        .where(eq(bookingAttendees.id, attendeeId));
    // Per user instructions: Do not update legacy booking.status automatically yet.
    // Keep legacy booking.status unchanged for backwards compatibility.

    revalidatePath(`/dashboard/bookings/${bookingId}`);
    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard');
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
