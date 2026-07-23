import { logger } from '@/lib/logger';
/**
 * Google Calendar Service
 * 
 * Handles calendar availability checks and event creation for bookings.
 * Uses Google Calendar API with service account authentication.
 */

import { google, calendar_v3 } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { addMinutes } from 'date-fns';

// Environment configuration
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PATH || './credentials/google-service-account.json';

interface CalendarEventDetails {
  summary: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail?: string;
  location?: string;
  calendarId?: string;
  timezone?: string;
}

interface FreeBusyResult {
  busy: { start: Date; end: Date }[];
  isAvailable: boolean;
}

/**
 * GoogleCalendarService - Manages booking-related calendar operations
 */
export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar | null = null;
  private initialized = false;

  /**
   * Initialize the Google Calendar client with service account credentials
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Check if credentials file exists
      if (!existsSync(SERVICE_ACCOUNT_PATH)) {
        logger.warn(
          `[GoogleCalendarService] Service account file not found at ${SERVICE_ACCOUNT_PATH}. ` +
          `Calendar integration disabled.`
        );
        return false;
      }

      // Load service account credentials
      const credentialsJson = readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8');
      const credentials = JSON.parse(credentialsJson);

      // Create JWT auth client
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ],
      });

      // Create calendar client
      this.calendar = google.calendar({ version: 'v3', auth });
      this.initialized = true;

      logger.info('[GoogleCalendarService] Initialized successfully');
      return true;
    } catch (error) {
      logger.error('[GoogleCalendarService] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Check if a time slot is available on the calendar
   */
  async checkCalendarAvailability(
    startTime: Date,
    endTime: Date,
    calendarId: string = process.env.GOOGLE_CALENDAR_ID || 'primary'
  ): Promise<FreeBusyResult> {
    const isReady = await this.initialize();

    if (!isReady || !this.calendar) {
      // If calendar not configured, assume available
      return { busy: [], isAvailable: true };
    }

    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          items: [{ id: calendarId }],
        },
      });

      const busyPeriods = response.data.calendars?.[calendarId]?.busy || [];
      const busy = busyPeriods.map(period => ({
        start: new Date(period.start!),
        end: new Date(period.end!),
      }));

      return {
        busy,
        isAvailable: busy.length === 0,
      };
    } catch (error) {
      logger.error('[GoogleCalendarService] FreeBusy check failed:', error);
      return { busy: [], isAvailable: true };
    }
  }

  /**
   * Create a calendar event for a confirmed booking
   */
  async createCalendarEvent(
    details: CalendarEventDetails
  ): Promise<string | null> {
    const isReady = await this.initialize();

    if (!isReady || !this.calendar) {
      logger.warn('[GoogleCalendarService] Cannot create event - not initialized');
      return null;
    }

    try {
      const calendarId = details.calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary';
      const timezone = details.timezone || 'Europe/London';

      const event: calendar_v3.Schema$Event = {
        summary: details.summary,
        description: details.description,
        start: {
          dateTime: details.startTime.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: details.endTime.toISOString(),
          timeZone: timezone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 },
          ],
        },
      };

      if (details.location) {
        event.location = details.location;
      }

      if (details.attendeeEmail) {
        event.attendees = [{ email: details.attendeeEmail }];
      }

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: details.attendeeEmail ? 'all' : 'none',
      });

      const eventId = response.data.id || null;
      if (eventId) {
        logger.info(`[GoogleCalendarService] Created event: ${eventId}`);
      }

      return eventId;
    } catch (error) {
      logger.error('[GoogleCalendarService] Failed to create event:', error);
      return null;
    }
  }

  /**
   * Delete a calendar event (for cancellations)
   */
  async deleteCalendarEvent(
    eventId: string,
    calendarId: string = process.env.GOOGLE_CALENDAR_ID || 'primary'
  ): Promise<boolean> {
    const isReady = await this.initialize();

    if (!isReady || !this.calendar) {
      return false;
    }

    try {
      await this.calendar.events.delete({ calendarId, eventId });
      logger.info(`[GoogleCalendarService] Deleted event: ${eventId}`);
      return true;
    } catch (error) {
      logger.error('[GoogleCalendarService] Failed to delete event:', error);
      return false;
    }
  }

  /**
   * Update a calendar event (for rescheduling)
   */
  async updateCalendarEvent(
    eventId: string,
    updates: Partial<CalendarEventDetails>,
    calendarId: string = process.env.GOOGLE_CALENDAR_ID || 'primary'
  ): Promise<boolean> {
    const isReady = await this.initialize();

    if (!isReady || !this.calendar) {
      return false;
    }

    try {
      const timezone = updates.timezone || 'Europe/London';
      const event: calendar_v3.Schema$Event = {};

      if (updates.summary) event.summary = updates.summary;
      if (updates.description) event.description = updates.description;
      if (updates.location) event.location = updates.location;

      if (updates.startTime) {
        event.start = { dateTime: updates.startTime.toISOString(), timeZone: timezone };
      }

      if (updates.endTime) {
        event.end = { dateTime: updates.endTime.toISOString(), timeZone: timezone };
      }

      await this.calendar.events.patch({ calendarId, eventId, requestBody: event });
      logger.info(`[GoogleCalendarService] Updated event: ${eventId}`);
      return true;
    } catch (error) {
      logger.error('[GoogleCalendarService] Failed to update event:', error);
      return false;
    }
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();

/**
 * Helper function to build booking event details
 */
export function buildBookingEventDetails(booking: {
  children: { firstName: string; lastName: string; subjects?: string[] }[];
  parentEmail?: string;
  parentPhone?: string;
  modality: string;
  startAt: Date;
  duration: number;
  centreName?: string;
  centreAddress?: string;
}): CalendarEventDetails {
  const endTime = addMinutes(booking.startAt, booking.duration);

  const childrenSummary = booking.children.map(c => `${c.firstName} ${c.lastName}`).join(', ');

  const childrenDetails = booking.children.map(child => {
    const subjectList = child.subjects?.join(', ') || 'Assessment';
    return `Child: ${child.firstName} ${child.lastName}\nSubjects: ${subjectList}`;
  }).join('\n\n');

  const description = [
    childrenDetails,
    `Duration: ${booking.duration} minutes`,
    `Type: ${booking.modality === 'in_person' ? 'In-Person' : 'Online'}`,
    '',
    booking.parentEmail ? `Parent Email: ${booking.parentEmail}` : '',
    booking.parentPhone ? `Parent Phone: ${booking.parentPhone}` : '',
  ].filter(Boolean).join('\n---\n');

  return {
    summary: `Assessment: ${childrenSummary}`,
    description,
    startTime: booking.startAt,
    endTime,
    attendeeEmail: booking.parentEmail,
    location: booking.modality === 'in_person' && booking.centreAddress
      ? booking.centreAddress
      : undefined,
    timezone: 'Europe/London',
  };
}
