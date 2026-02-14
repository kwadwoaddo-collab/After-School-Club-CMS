/**
 * SMS Service using Twilio
 * 
 * Handles booking confirmation SMS and other text notifications.
 */

import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface BookingSMSData {
  parentPhone: string;
  parentFirstName: string;
  childrenNames: string; // Pre-formatted comma separated list
  centreName?: string;
  modality: 'in_person' | 'online';
  startAt: Date;
  confirmationCode: string;
}

/**
 * SMS Service class for sending text notifications
 */
export class SMSService {
  private client: twilio.Twilio | null = null;
  private initialized = false;

  /**
   * Initialize Twilio client
   */
  private initialize(): boolean {
    if (this.initialized) return this.client !== null;

    // Check if credentials are configured
    if (!accountSid || accountSid.startsWith('ACxxx') ||
      !authToken || authToken.startsWith('xxx') ||
      !fromNumber || fromNumber.startsWith('+44XXX')) {
      console.warn('[SMSService] Twilio credentials not configured. SMS disabled.');
      this.initialized = true;
      return false;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      console.log('[SMSService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[SMSService] Failed to initialize:', error);
      this.initialized = true;
      return false;
    }
  }

  /**
   * Send booking confirmation SMS
   */
  async sendBookingConfirmation(data: BookingSMSData): Promise<SMSResult> {
    if (!this.initialize() || !this.client) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const formattedDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(data.startAt);

      const location = data.modality === 'in_person'
        ? data.centreName || 'the centre'
        : 'Online';

      const message = `Hi ${data.parentFirstName}! Assessment for ${data.childrenNames} confirmed: ${formattedDate}, ${location}. Code: ${data.confirmationCode}`;

      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: data.parentPhone,
      });

      console.log(`[SMSService] Confirmation SMS sent: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SMSService] Error sending SMS:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send booking cancellation SMS
   */
  async sendBookingCancellation(data: {
    parentPhone: string;
    parentFirstName: string;
    childrenNames: string;
    startAt: Date;
    confirmationCode: string;
  }): Promise<SMSResult> {
    if (!this.initialize() || !this.client) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const formattedDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(data.startAt);

      const message = `Hi ${data.parentFirstName}, your assessment booking for ${data.childrenNames} on ${formattedDate} has been cancelled. Ref: ${data.confirmationCode}`;

      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: data.parentPhone,
      });

      console.log(`[SMSService] Cancellation SMS sent: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SMSService] Error sending SMS:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a reminder SMS
   */
  async sendReminder(data: {
    parentPhone: string;
    parentFirstName: string;
    childrenNames: string;
    centreName?: string;
    startAt: Date;
    hoursUntil: number;
  }): Promise<SMSResult> {
    if (!this.initialize() || !this.client) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const formattedTime = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(data.startAt);

      const timeLabel = data.hoursUntil === 24 ? 'tomorrow' : 'today';

      const message = `Reminder: Assessment for ${data.childrenNames} is ${timeLabel} at ${formattedTime}${data.centreName ? ` at ${data.centreName}` : ''}. See you soon!`;

      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: data.parentPhone,
      });

      console.log(`[SMSService] Reminder SMS sent: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SMSService] Error sending SMS:', error);
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const smsService = new SMSService();
