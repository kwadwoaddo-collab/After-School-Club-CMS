/**
 * Unified Notification Service
 * 
 * Orchestrates email and SMS notifications for bookings.
 * Sends both email AND SMS based on parent preferences and available contact info.
 */

import { emailService } from './email';
import { smsService } from './sms';

interface BookingNotificationData {
  // Parent info
  parentFirstName: string;
  parentEmail?: string;
  parentPhone?: string;
  preferredContact: 'email' | 'phone';
  // Child info
  children: { firstName: string; lastName: string; subjects: string[] }[];
  // Booking info
  centreName?: string;
  centreAddress?: string;
  modality: 'in_person' | 'online';
  startAt: Date;
  duration: number;
  confirmationCode: string;
  magicLink: string;
}

interface NotificationResult {
  emailSent: boolean;
  smsSent: boolean;
  emailError?: string;
  smsError?: string;
}

/**
 * Notification Service - Orchestrates all booking notifications
 */
export class NotificationService {
  /**
   * Send booking confirmation notifications (email AND/OR SMS)
   */
  async sendBookingConfirmation(data: BookingNotificationData): Promise<NotificationResult> {
    const result: NotificationResult = {
      emailSent: false,
      smsSent: false,
    };

    // Send email if email is available
    if (data.parentEmail) {
      const emailResult = await emailService.sendBookingConfirmation({
        parentFirstName: data.parentFirstName,
        parentEmail: data.parentEmail,
        children: data.children,
        centreName: data.centreName,
        centreAddress: data.centreAddress,
        modality: data.modality,
        startAt: data.startAt,
        duration: data.duration,
        confirmationCode: data.confirmationCode,
        magicLink: data.magicLink,
      });

      result.emailSent = emailResult.success;
      if (!emailResult.success) {
        result.emailError = emailResult.error;
      }
    }

    // Send SMS if phone is available
    if (data.parentPhone) {
      const childrenNames = data.children.map(c => `${c.firstName} ${c.lastName}`).join(', ');

      const smsResult = await smsService.sendBookingConfirmation({
        parentPhone: data.parentPhone,
        parentFirstName: data.parentFirstName,
        childrenNames,
        centreName: data.centreName,
        modality: data.modality,
        startAt: data.startAt,
        confirmationCode: data.confirmationCode,
      });

      result.smsSent = smsResult.success;
      if (!smsResult.success) {
        result.smsError = smsResult.error;
      }
    }

    // Log result
    console.log(`[NotificationService] Booking confirmation sent - Email: ${result.emailSent}, SMS: ${result.smsSent}`);

    return result;
  }

  /**
   * Send booking cancellation notifications
   */
  async sendBookingCancellation(data: {
    parentFirstName: string;
    parentEmail?: string;
    parentPhone?: string;
    childrenNames: string;
    startAt: Date;
    confirmationCode: string;
  }): Promise<NotificationResult> {
    const result: NotificationResult = {
      emailSent: false,
      smsSent: false,
    };

    // Send email
    if (data.parentEmail) {
      const emailResult = await emailService.sendBookingCancellation({
        parentFirstName: data.parentFirstName,
        parentEmail: data.parentEmail,
        childrenNames: data.childrenNames,
        startAt: data.startAt,
        confirmationCode: data.confirmationCode,
      });

      result.emailSent = emailResult.success;
      if (!emailResult.success) result.emailError = emailResult.error;
    }

    // Send SMS
    if (data.parentPhone) {
      const smsResult = await smsService.sendBookingCancellation({
        parentPhone: data.parentPhone,
        parentFirstName: data.parentFirstName,
        childrenNames: data.childrenNames,
        startAt: data.startAt,
        confirmationCode: data.confirmationCode,
      });

      result.smsSent = smsResult.success;
      if (!smsResult.success) result.smsError = smsResult.error;
    }

    console.log(`[NotificationService] Cancellation sent - Email: ${result.emailSent}, SMS: ${result.smsSent}`);

    return result;
  }

  /**
   * Send booking reschedule notifications (email + SMS)
   */
  async sendBookingReschedule(data: {
    parentFirstName: string;
    parentEmail?: string;
    parentPhone?: string;
    childrenNames: string;
    centreName: string;
    oldStartAt: Date;
    newStartAt: Date;
    confirmationCode: string;
  }): Promise<NotificationResult> {
    const result: NotificationResult = { emailSent: false, smsSent: false };

    if (data.parentEmail) {
      const emailResult = await emailService.sendBookingReschedule({
        parentFirstName: data.parentFirstName,
        parentEmail: data.parentEmail,
        childrenNames: data.childrenNames,
        centreName: data.centreName,
        oldStartAt: data.oldStartAt,
        newStartAt: data.newStartAt,
        confirmationCode: data.confirmationCode,
      });
      result.emailSent = emailResult.success;
      if (!emailResult.success) result.emailError = emailResult.error;
    }

    if (data.parentPhone) {
      // Reuse cancellation SMS template for reschedule (new date as startAt)
      const smsResult = await smsService.sendBookingCancellation({
        parentPhone: data.parentPhone,
        parentFirstName: data.parentFirstName,
        childrenNames: data.childrenNames,
        startAt: data.newStartAt,
        confirmationCode: data.confirmationCode,
      }).catch(() => ({ success: false }));
      result.smsSent = (smsResult as any).success ?? false;
    }

    console.log(`[NotificationService] Reschedule sent - Email: ${result.emailSent}, SMS: ${result.smsSent}`);
    return result;
  }

  /**
   * Send reminder notifications (typically 24h and 1h before)
   */
  async sendReminder(data: {
    parentFirstName: string;
    parentPhone?: string;
    childFirstName: string; // Legacy or primary child
    childrenNames?: string; // New support
    centreName?: string;
    startAt: Date;
    hoursUntil: number;
  }): Promise<{ smsSent: boolean; error?: string }> {
    // Reminders are SMS only
    if (!data.parentPhone) {
      return { smsSent: false, error: 'No phone number' };
    }

    const childrenNames = data.childrenNames || data.childFirstName;

    const smsResult = await smsService.sendReminder({
      parentPhone: data.parentPhone,
      parentFirstName: data.parentFirstName,
      childrenNames,
      centreName: data.centreName,
      startAt: data.startAt,
      hoursUntil: data.hoursUntil,
    });

    return { smsSent: smsResult.success, error: smsResult.error };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
