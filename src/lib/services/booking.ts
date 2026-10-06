import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/db';
import { bookings, bookingAttendees, parents, children, childSubjects, centres, studentNotes } from '@/db/schema';
import { BookingInput } from '@/lib/validations/booking';
import { eq, and } from 'drizzle-orm';
import { resolveOrCreateParent, resolveOrCreateChild } from './crm';
import { nanoid } from 'nanoid';
import { googleCalendarService, buildBookingEventDetails } from './google-calendar';
import { notificationService } from './notifications';
import { notifyOwners } from '@/lib/db-notifications';
import { stripeService } from './stripe';
import { generateMagicLinkToken, hashToken } from '@/lib/magic-link';
import { getBaseUrl } from '@/lib/base-url';
import {
  enqueueBookingEmail,
  supersedeOldBookingForReplacement,
  OUTBOX_PAYLOAD_VERSION,
  type BookingConfirmationPayload,
  type ReplacementOutcome,
} from './email-outbox';

interface BookingResult {
  bookingId: string;
  confirmationCode: string;
  magicLink: string;
  calendarEventId?: string | null;
  outboxId?: string | null;
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
      columns: { organisationId: true, name: true, address: true },
    });

    if (!centre) {
      throw new Error('Centre not found');
    }

    // Wrap the entire database creation flow in a transaction to guarantee data integrity
    const txResult = await db.transaction(async (tx) => {
      // 2. Find or create parent within this organisation
      const parent = await resolveOrCreateParent(
        tx,
        {
          firstName: input.parent.firstName,
          lastName: input.parent.lastName,
          email: input.parent.email || '',
          phone: input.parent.phone,
        },
        centre.organisationId
      );

      // Generate confirmation code and magic link token
      const confirmationCode = nanoid(10).toUpperCase();
      const rawMagicLinkToken = generateMagicLinkToken();
      const hashedMagicLinkToken = hashToken(rawMagicLinkToken);
      const magicLinkExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const baseUrl = getBaseUrl();
      const magicLink = `${baseUrl}/portal/verify?token=${rawMagicLinkToken}`;
      
      // S-3 fix: If this is a reschedule, verify ownership before cancelling.
      //
      // The original code cancelled input.rescheduleId unconditionally —
      // any caller who knew a booking UUID could cancel it via a public
      // booking submission (unauthenticated cancellation via `rescheduleId`).
      //
      // Ownership check: the old booking MUST
      //   (a) belong to the same parent that was just resolved for this booking
      //   (b) belong to a centre within the same organisation as the new booking
      //
      // If either check fails the rescheduleId is silently ignored and the
      // caller receives a fresh booking without destroying the existing one.
      // This prevents denial-of-service attacks and protects bookings
      // belonging to a different parent or a different organisation.
      // S-3 fix: If this is a reschedule, verify ownership before cancelling.
      // Action 12: Nested savepoint (tx.transaction) calling supersedeOldBookingForReplacement.
      // Invalid/foreign/cancelled rescheduleId is logged (booking IDs only, no PII) and ignored.
      let replacementOutcome: ReplacementOutcome | null = null;
      if (input.rescheduleId) {
        try {
          replacementOutcome = await tx.transaction(async (innerTx) => {
            return await supersedeOldBookingForReplacement(innerTx, {
              oldBookingId: input.rescheduleId!,
              expectedParentId: parent.id,
              expectedOrganisationId: centre.organisationId,
            });
          });

          if (!replacementOutcome.replaced) {
            logger.warn(
              `[BOOKING] S-3: rescheduleId ${input.rescheduleId} failed replacement ` +
              `(reason=${replacementOutcome.rejectedReason}) — ignoring reschedule`
            );
          } else {
            logger.info(`[BOOKING] Old booking ${input.rescheduleId} superseded for replacement by parent ${parent.id}`);
          }
        } catch (error) {
          logger.error('[BOOKING] Failed to supersede old booking for reschedule:', {
            bookingId: input.rescheduleId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      }

      // Update parent with the magic link token so they can log in
      await tx.update(parents)
        .set({
          magicLinkToken: hashedMagicLinkToken,
          magicLinkExpiresAt
        })
        .where(eq(parents.id, parent.id));

      // Create Booking first (we need ID for attendees)
      const [booking] = await tx.insert(bookings).values({
        centreId: input.appointment.centreId as any,
        parentId: parent.id,
        childId: undefined as any,
        startAt: new Date(input.appointment.startAt),
        duration: input.appointment.duration,
        modality: input.appointment.modality as any,
        status: 'confirmed' as any,
        confirmationCode,
        magicLinkToken: hashedMagicLinkToken,
        communicationsConsent: input.consent.communications,
      } as any).returning();

      const createdChildren: { firstName: string; lastName: string; subjects: string[] }[] = [];

      // Process each child
      for (const childInput of input.children) {
        const child = await resolveOrCreateChild(tx, {
          id: childInput.id,
          firstName: childInput.firstName,
          lastName: childInput.lastName,
          parentId: parent.id,
          organisationId: centre.organisationId,
          centreId: input.appointment.centreId as string,
          dateOfBirth: childInput.dateOfBirth ? new Date(childInput.dateOfBirth) : null,
          schoolYear: childInput.schoolYear,
          notes: childInput.notes || null,
          systemNoteContent: childInput.notes || null,
          imageUrl: childInput.imageUrl || null,
        });

        // Add child subjects (only if the relation doesn't exist yet to prevent duplicates)
        for (const subject of childInput.subjects) {
          const dbSubject = ['Maths', 'English', 'Science', 'Other'].includes(subject)
            ? (subject as 'Maths' | 'English' | 'Science' | 'Other')
            : 'Other';
          const dbCustomSubject = dbSubject === 'Other' ? (childInput.customSubject || subject) : undefined;

          const existingSubject = await tx.query.childSubjects.findFirst({
            where: and(
              eq(childSubjects.childId, child.id),
              eq(childSubjects.subject, dbSubject),
              dbCustomSubject ? eq(childSubjects.customSubject, dbCustomSubject) : undefined
            ),
          });
          if (!existingSubject) {
            await tx.insert(childSubjects).values({
              childId: child.id,
              subject: dbSubject,
              customSubject: dbCustomSubject,
            });
          }
        }

        // Link to booking
        await tx.insert(bookingAttendees).values({
          bookingId: booking.id,
          childId: child.id,
        });

        createdChildren.push({
          firstName: child.firstName,
          lastName: child.lastName,
          subjects: childInput.subjects,
        });
      }

      // Enqueue outbox row in the same transaction (only if parent has email)
      let outboxId: string | null = null;
      if (input.parent.email) {
        const confirmationPayload: BookingConfirmationPayload = {
          payloadVersion: OUTBOX_PAYLOAD_VERSION,
          parentFirstName: input.parent.firstName,
          parentEmail: input.parent.email,
          children: createdChildren,
          centreName: centre.name,
          centreAddress: centre.address || undefined,
          modality: input.appointment.modality,
          startAt: new Date(input.appointment.startAt).toISOString(),
          duration: input.appointment.duration,
          confirmationCode,
          magicLink,
          ...(replacementOutcome?.replaced && replacementOutcome.oldStartAt
            ? {
                replacement: {
                  oldStartAt: replacementOutcome.oldStartAt.toISOString(),
                  supersededUnsentConfirmation: replacementOutcome.hadUnsentConfirmation,
                },
              }
            : {}),
        };

        const enq = await enqueueBookingEmail(tx, {
          organisationId: centre.organisationId,
          centreId: input.appointment.centreId ?? null,
          bookingId: booking.id,
          version: 1,
          type: 'BOOKING_CONFIRMATION',
          recipientEmail: input.parent.email,
          payload: confirmationPayload,
          linkMode: null,
        });
        outboxId = enq.outboxId;
      }
      
      return {
        parent,
        booking,
        createdChildren,
        confirmationCode,
        magicLink,
        centreDetails: { name: centre.name, address: centre.address || '' },
        outboxId,
        replacementOutcome,
      };
    });

    const { parent, booking, createdChildren, confirmationCode, magicLink, centreDetails, outboxId, replacementOutcome } = txResult;

    // Post-commit: delete old calendar event strictly AFTER outer commit and ONLY when replaced = true
    if (replacementOutcome?.replaced && replacementOutcome.oldGoogleCalendarEventId) {
      try {
        await googleCalendarService.deleteCalendarEvent(replacementOutcome.oldGoogleCalendarEventId);
      } catch (err) {
        logger.error('[BOOKING] Failed to delete calendar event for replaced booking:', {
          errorName: err instanceof Error ? err.name : 'UnknownError',
        });
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
        }
      } catch (error) {
        logger.error('[BookingService] Failed to create Stripe customer:', error);
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
      logger.error('[BookingService] Failed to create calendar event:', error);
    }

    // Send SMS-only notifications (email is enqueued in outbox)
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
      logger.error('[BookingService] Failed to send notifications:', error);
    }

    // Write in-app dashboard notification (fire-and-forget)
    const orgId = centre.organisationId;
    const childNames = createdChildren.map((c) => c.firstName).join(', ');
    notifyOwners({
      orgId,
      type: 'booking_created',
      title: 'New Booking',
      message: `Assessment booked for ${childNames} at ${centreDetails?.name ?? 'the centre'} on ${new Date(input.appointment.startAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}.`,
      bookingId: booking.id,
    }).catch(() => {});

    return {
      bookingId: booking.id,
      confirmationCode,
      magicLink,
      calendarEventId,
      outboxId,
      notificationsSent: {
        email: outboxId !== null,
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
        logger.error('[BookingService] Failed to delete calendar event:', error);
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
      logger.error('[BookingService] Failed to send cancellation notifications:', error);
    }

    // Update booking status
    await db.update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));

    return true;
  }
}

export const bookingService = new BookingService();
