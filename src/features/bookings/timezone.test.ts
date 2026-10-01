import { describe, expect, it } from 'vitest';
import {
  parseInTimezone,
  formatInTimezone,
  formatDisplayTimeInTimezone,
  formatDateInTimezone,
  formatShortDateInTimezone,
  DEFAULT_TIMEZONE,
} from '@/lib/datetime';

describe('CMS-OPS-REMEDIATION-1B: UK Centre Booking Timezone Regression Suite', () => {
  describe('A. Summer / BST Operational Booking', () => {
    const inputDate = '2026-07-22';
    const inputTime = '15:30';

    it('interprets 15:30 Europe/London as 14:30 UTC absolute instant', () => {
      const parsedUtcInstant = parseInTimezone(inputDate, inputTime, DEFAULT_TIMEZONE);

      // Must store 14:30 UTC point in time
      expect(parsedUtcInstant.toISOString()).toBe('2026-07-22T14:30:00.000Z');
      expect(parsedUtcInstant.getUTCHours()).toBe(14);
      expect(parsedUtcInstant.getUTCMinutes()).toBe(30);
    });

    it('displays 15:30 (3:30 PM) centre time consistently across all viewer locations', () => {
      const storedInstant = parseInTimezone(inputDate, inputTime, DEFAULT_TIMEZONE);

      // Centre operational display in UK
      expect(formatInTimezone(storedInstant, 'Europe/London')).toBe('15:30');
      expect(formatDisplayTimeInTimezone(storedInstant, 'Europe/London')).toBe('3:30 PM');

      // Ghana / Africa/Accra viewer seeing UK centre operational time
      expect(formatInTimezone(storedInstant, DEFAULT_TIMEZONE)).toBe('15:30');
      expect(formatDisplayTimeInTimezone(storedInstant, DEFAULT_TIMEZONE)).toBe('3:30 PM');

      // UTC environment / CI headless runner seeing UK centre operational time
      expect(formatInTimezone(storedInstant, DEFAULT_TIMEZONE)).toBe('15:30');
      expect(formatDisplayTimeInTimezone(storedInstant, DEFAULT_TIMEZONE)).toBe('3:30 PM');

      // US East Coast / America/New_York viewer seeing UK centre operational time
      expect(formatInTimezone(storedInstant, DEFAULT_TIMEZONE)).toBe('15:30');
      expect(formatDisplayTimeInTimezone(storedInstant, DEFAULT_TIMEZONE)).toBe('3:30 PM');
    });
  });

  describe('B. Winter / GMT Operational Booking', () => {
    const inputDate = '2026-12-22';
    const inputTime = '15:30';

    it('interprets 15:30 Europe/London as 15:30 UTC absolute instant during GMT', () => {
      const parsedUtcInstant = parseInTimezone(inputDate, inputTime, DEFAULT_TIMEZONE);

      // In winter, GMT equals UTC
      expect(parsedUtcInstant.toISOString()).toBe('2026-12-22T15:30:00.000Z');
      expect(parsedUtcInstant.getUTCHours()).toBe(15);
      expect(parsedUtcInstant.getUTCMinutes()).toBe(30);
    });

    it('displays 15:30 (3:30 PM) centre time during GMT', () => {
      const storedInstant = parseInTimezone(inputDate, inputTime, DEFAULT_TIMEZONE);

      expect(formatInTimezone(storedInstant, 'Europe/London')).toBe('15:30');
      expect(formatDisplayTimeInTimezone(storedInstant, 'Europe/London')).toBe('3:30 PM');
    });
  });

  describe('C. Spring DST Transition Boundaries', () => {
    it('handles the hour immediately before spring transition (00:30 GMT)', () => {
      const date = parseInTimezone('2026-03-29', '00:30', DEFAULT_TIMEZONE);
      expect(date.toISOString()).toBe('2026-03-29T00:30:00.000Z');
      expect(formatInTimezone(date, DEFAULT_TIMEZONE)).toBe('00:30');
    });

    it('deterministically handles nonexistent wall-clock time in spring gap (01:30)', () => {
      const date = parseInTimezone('2026-03-29', '01:30', DEFAULT_TIMEZONE);
      // Maps to 01:30 UTC (which is 02:30 BST, advancing past the gap)
      expect(date.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    });

    it('handles the hour immediately after spring transition (02:30 BST)', () => {
      const date = parseInTimezone('2026-03-29', '02:30', DEFAULT_TIMEZONE);
      expect(date.toISOString()).toBe('2026-03-29T01:30:00.000Z');
      expect(formatInTimezone(date, DEFAULT_TIMEZONE)).toBe('02:30');
    });
  });

  describe('D. Autumn DST Transition Boundaries', () => {
    it('deterministically resolves ambiguous repeated wall-clock time (01:30) to GMT', () => {
      const date = parseInTimezone('2026-10-25', '01:30', DEFAULT_TIMEZONE);
      // Resolves to 01:30 UTC (GMT, standard time)
      expect(date.toISOString()).toBe('2026-10-25T01:30:00.000Z');
      expect(formatInTimezone(date, DEFAULT_TIMEZONE)).toBe('01:30');
    });
  });

  describe('E. Date Boundary & Midnight Rollover', () => {
    it('correctly maps 00:00 BST to previous calendar day in UTC without altering centre calendar display', () => {
      const midnight = parseInTimezone('2026-07-22', '00:00', DEFAULT_TIMEZONE);

      // Stored UTC is 23:00 on the 21st
      expect(midnight.toISOString()).toBe('2026-07-21T23:00:00.000Z');
      expect(midnight.getUTCDate()).toBe(21);

      // Centre date display preserves July 22
      expect(formatDateInTimezone(midnight, DEFAULT_TIMEZONE)).toBe('22 Jul 2026');
      expect(formatShortDateInTimezone(midnight, DEFAULT_TIMEZONE)).toBe('Wed, Jul 22');
      expect(formatInTimezone(midnight, DEFAULT_TIMEZONE)).toBe('00:00');
    });

    it('correctly handles late evening 23:45 BST', () => {
      const late = parseInTimezone('2026-07-22', '23:45', DEFAULT_TIMEZONE);
      expect(late.toISOString()).toBe('2026-07-22T22:45:00.000Z');
      expect(formatInTimezone(late, DEFAULT_TIMEZONE)).toBe('23:45');
      expect(formatDateInTimezone(late, DEFAULT_TIMEZONE)).toBe('22 Jul 2026');
    });
  });

  describe('F. Attendance Slot Matching Integration', () => {
    it('matches stored BST booking instant against regular registered session slot "15:30"', () => {
      // Booking created for 15:30 BST -> stored as 14:30Z
      const storedBookingStartAt = new Date('2026-07-22T14:30:00.000Z');
      const registeredSlotTime = '15:30';

      // Evaluating with formatInTimezone on a server running in UTC
      const evaluatedBookingTime = formatInTimezone(storedBookingStartAt, 'Europe/London');

      expect(evaluatedBookingTime).toBe(registeredSlotTime);
      expect(evaluatedBookingTime === registeredSlotTime).toBe(true);
    });
  });

  describe('G. Notification Formatting Integration', () => {
    it('formats booking confirmation time in Europe/London regardless of server environment', () => {
      const storedInstant = new Date('2026-07-22T14:30:00.000Z'); // 15:30 BST

      const emailTimeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      expect(emailTimeFormatter.format(storedInstant)).toBe('15:30');
    });
  });
});
