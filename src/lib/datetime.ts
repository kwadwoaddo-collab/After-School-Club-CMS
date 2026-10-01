export const DEFAULT_TIMEZONE = 'Europe/London';

/**
 * Parses a date string (YYYY-MM-DD) and time string (HH:mm) in a specific timezone into a standard UTC Date object.
 * e.g., parseInTimezone("2026-07-22", "15:30", "Europe/London") -> Date (14:30:00.000Z)
 *
 * DST Boundary Policies:
 * 1. Nonexistent Spring Gap (e.g. 01:00-01:59 during spring-forward transition):
 *    Oscillation between offsets is detected; the wall-clock time is deterministically advanced
 *    by the transition gap offset into the new DST period (01:30 maps to 01:30 UTC = 02:30 BST).
 * 2. Ambiguous Autumn Fold (e.g. 01:00-01:59 during fall-back transition):
 *    The repeated hour resolves deterministically to the standard time (the second occurrence, GMT).
 */
export function parseInTimezone(dateStr: string, timeStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const targetLocalTime = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let utcTime = targetLocalTime;
  let lastDiff = 0;
  let isOscillating = false;

  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(utcTime));
    const partVal = (type: string) => parts.find(p => p.type === type)!.value;
    const pYear = parseInt(partVal('year'));
    const pMonth = parseInt(partVal('month'));
    const pDay = parseInt(partVal('day'));
    const pHour = parseInt(partVal('hour')) === 24 ? 0 : parseInt(partVal('hour'));
    const pMinute = parseInt(partVal('minute'));

    const formattedLocalTime = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, 0);
    const diffMs = targetLocalTime - formattedLocalTime;
    if (diffMs === 0) {
      break;
    }
    if (i > 0 && Math.abs(diffMs) === Math.abs(lastDiff) && diffMs === -lastDiff) {
      isOscillating = true;
      break;
    }
    lastDiff = diffMs;
    utcTime += diffMs;
  }

  // If local time fell in nonexistent spring-forward gap, map to new DST offset
  if (isOscillating) {
    utcTime = targetLocalTime;
  }

  return new Date(utcTime);
}

/**
 * Formats a Date object as "HH:mm" in a specific timezone (defaults to Europe/London).
 */
export function formatInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Formats a Date object as "h:mm a" (e.g. "3:30 PM") in a specific timezone.
 */
export function formatDisplayTimeInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

/**
 * Formats a Date object as a full readable date string in a specific timezone (e.g. "22 Jul 2026").
 */
export function formatDateInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return formatter.format(date);
}

/**
 * Formats a Date object as short date with weekday in a specific timezone (e.g. "Wed, Jul 22").
 */
export function formatShortDateInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return formatter.format(date);
}
