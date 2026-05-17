import { db } from '@/db';
import { bookings, bookingAttendees, parents, children, childSubjects, centres, studentNotes } from '@/db/schema';
import { BookingInput } from '@/lib/validations/booking';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { googleCalendarService, buildBookingEventDetails } from './google-calendar';
import { notificationService } from './notifications';
import { stripeService } from './stripe';
import { generateMagicLinkToken, hashToken } from '../magic-link';

interface BookingResult {
  bookingId: string;
  confirmationCode: string;
  magicLink: string;
  calendarEventId?: string | null;
  notificationsSent: {
    email: boolean;
    sms: boolean;
  };
}

export class BookingService {
  /**
   * Create a new booking with Calendar + Notifications
   */
  async createBooking(input: BookingInput): Promise<BookingResult> {
    // 1. Get centre/org details first for isolation
    if (!input.appointment.centreId) {
      throw new Error('Centre ID is required');
    }

    const centre = await db.query.centres.findFirst({
      where: eq(centres.id, input.appointment.centreId),
      columns: { organisationId: true },
    });

    if (!centre) {
      throw new Error('Centre not found');
    }

    // 2. Find or create parent within this organisation
    let parent = await db.query.parents.findFirst({
      where: and(
        eq(parents.email, input.parent.email || ''),
        eq(parents.organisationId, centre.organisationId)
      ),
    });

    if (!parent) {
      [parent] = await db.insert(parents).values({
        firstName: input.parent.firstName,
        lastName: input.parent.lastName,
        phone: input.parent.phone || undefined,
        email: input.parent.email || undefined,
        // Task 1: preferredContact is optional in Zod but notNull in DB — fall back to 'email'
        preferredContact: input.parent.preferredContact ?? 'email',
        organisationId: centre.organisationId,
      }).returning();
    }

    // Generate confirmation code and magic link token
    const confirmationCode = nanoid(10).toUpperCase();
    const rawMagicLinkToken = generateMagicLinkToken();
    const hashedMagicLinkToken = hashToken(rawMagicLinkToken);
    const magicLinkExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const magicLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/portal/verify?token=${rawMagicLinkToken}`;
    // If this is a reschedule, mark the old one as cancelled
    if (input.rescheduleId) {
      try {
        const oldBooking = await db.query.bookings.findFirst({
          where: eq(bookings.id, input.rescheduleId),
        });

        if (oldBooking?.googleCalendarEventId) {
          await googleCalendarService.deleteCalendarEvent(oldBooking.googleCalendarEventId);
        }

        await db.update(bookings)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(bookings.id, input.rescheduleId));

        console.log(`[BOOKING] Old booking ${input.rescheduleId} cancelled for rescheduling`);
      } catch (error) {
        console.error('[BOOKING] Failed to cancel old booking for reschedule:', error);
      }
    }

    // Update parent with the magic link token so they can log in
    await db.update(parents)
      .set({
        magicLinkToken: hashedMagicLinkToken,
        magicLinkExpiresAt
      })
      .where(eq(parents.id, parent.id));

    // Create Booking first (we need ID for attendees)
    const [booking] = await db.insert(bookings).values({
      centreId: input.appointment.centreId as any,
      parentId: parent.id,
      childId: undefined as any, // Deprecated, using attendees
      startAt: new Date(input.appointment.startAt),
      duration: input.appointment.duration,
      modality: input.appointment.modality as any,
      status: 'confirmed' as any,
      confirmationCode,
      magicLinkToken: hashedMagicLinkToken, // We'll keep this on the booking for now too
      communicationsConsent: input.consent.communications,
    } as any).returning();

    const createdChildren: { firstName: string; lastName: string; subjects: string[] }[] = [];

    // Process each child
    for (const childInput of input.children) {
      // Create child
      const [child] = await db.insert(children).values({
        parentId: parent.id,
        firstName: childInput.firstName,
        lastName: childInput.lastName,
        schoolYear: childInput.schoolYear,
        dateOfBirth: childInput.dateOfBirth ? new Date(childInput.dateOfBirth) : undefined,
        notes: childInput.notes || undefined,
      }).returning();

      // Add child subjects
      for (const subject of childInput.subjects) {
        await db.insert(childSubjects).values({
          childId: child.id,
          subject,
          customSubject: subject === 'Other' ? childInput.customSubject : undefined,
        });
      }

      // Link to booking
      await db.insert(bookingAttendees).values({
        bookingId: booking.id,
        childId: child.id,
      });

      // Task 31: If the parent provided notes during booking, create an initial 'System' internal note
      if (childInput.notes) {
        await db.insert(studentNotes).values({
          childId: child.id,
          content: childInput.notes,
          authorName: 'System',
          category: 'General',
        });
      }

      createdChildren.push({
        firstName: child.firstName,
        lastName: child.lastName,
        subjects: childInput.subjects,
      });
    }

    // Now update the booking with the first childId for backward compatibility (if needed by other systems)
    // We already inserted `childId: null` which matches the schema update, so we can skip this if we are confident.
    // But if we want to be safe for legacy queries:
    /*
    if (createdChildren.length > 0) {
       // logic to update childId if strictly required
    }
    */

    // Get centre details for calendar event
    let centreDetails: { name: string; address: string } | null = null;
    if (input.appointment.centreId) {
      const centre = await db.query.centres.findFirst({
        where: eq(centres.id, input.appointment.centreId),
      });
      if (centre) {
        centreDetails = { name: centre.name, address: centre.address || '' };
      }
    }

    // Ensure Stripe Customer exists for parent
    if (input.parent.email && !parent.stripeCustomerId) {
      try {
        const stripeId = await stripeService.createCustomer({
          email: input.parent.email,
          name: `${input.parent.firstName} ${input.parent.lastName}`,
          organisationId: input.appointment.centreId || '',
        });

        if (stripeId) {
          await db.update(parents)
            .set({ stripeCustomerId: stripeId })
            .where(eq(parents.id, parent.id));
          parent.stripeCustomerId = stripeId;
        }
      } catch (error) {
        console.error('[BookingService] Failed to create Stripe customer:', error);
        // Continue with booking even if Stripe fails
      }
    }



    // Create Google Calendar event
    let calendarEventId: string | null = null;
    try {
      const eventDetails = buildBookingEventDetails({
        children: createdChildren,
        parentEmail: input.parent.email,
        parentPhone: input.parent.phone,
        modality: input.appointment.modality,
        startAt: new Date(input.appointment.startAt),
        duration: input.appointment.duration,
        centreName: centreDetails?.name,
        centreAddress: centreDetails?.address,
      });

      calendarEventId = await googleCalendarService.createCalendarEvent(eventDetails);

      if (calendarEventId) {
        await db.update(bookings)
          .set({ googleCalendarEventId: calendarEventId })
          .where(eq(bookings.id, booking.id));
      }
    } catch (error) {
      console.error('[BookingService] Failed to create calendar event:', error);
    }

    // Send notifications (email + SMS)
    let notificationResult = { emailSent: false, smsSent: false };
    try {
      notificationResult = await notificationService.sendBookingConfirmation({
        parentFirstName: input.parent.firstName,
        parentEmail: input.parent.email,
        parentPhone: input.parent.phone,
        preferredContact: input.parent.preferredContact ?? 'email',
        children: createdChildren,
        centreName: centreDetails?.name,
        centreAddress: centreDetails?.address,
        modality: input.appointment.modality,
        startAt: new Date(input.appointment.startAt),
        duration: input.appointment.duration,
        confirmationCode,
        magicLink,
      });
    } catch (error) {
      console.error('[BookingService] Failed to send notifications:', error);
    }

    return {
      bookingId: booking.id,
      confirmationCode,
      magicLink,
      calendarEventId,
      notificationsSent: {
        email: notificationResult.emailSent,
        sms: notificationResult.smsSent,
      },
    };
  }

  /**
   * Cancel a booking (with calendar + notification cleanup)
   */
  async cancelBooking(bookingId: string, token: string): Promise<boolean> {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        parent: true,
        attendees: {
          with: {
            child: true,
          }
        },
      },
    });

    if (!booking || (booking.magicLinkToken !== token && booking.magicLinkToken !== hashToken(token))) {
      return false;
    }

    // Delete calendar event
    if (booking.googleCalendarEventId) {
      try {
        await googleCalendarService.deleteCalendarEvent(booking.googleCalendarEventId);
      } catch (error) {
        console.error('[BookingService] Failed to delete calendar event:', error);
      }
    }

    // Send cancellation notifications
    try {
      const childrenNames = booking.attendees
        .map(a => `${a.child.firstName} ${a.child.lastName}`)
        .join(', ');

      await notificationService.sendBookingCancellation({
        parentFirstName: booking.parent?.firstName || 'Parent',
        parentEmail: booking.parent?.email || undefined,
        parentPhone: booking.parent?.phone || undefined,
        childrenNames: childrenNames || 'Children',
        startAt: booking.startAt,
        confirmationCode: booking.confirmationCode || '',
      });
    } catch (error) {
      console.error('[BookingService] Failed to send cancellation notifications:', error);
    }

    // Update booking status
    await db.update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));

    return true;
  }
}

export const bookingService = new BookingService();
