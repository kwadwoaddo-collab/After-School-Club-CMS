export const DEFAULT_TIMEZONE = 'Europe/London';

/**
 * Parses a date string and time string in a specific timezone into a standard Date object.
 * e.g., parseInTimezone("2026-07-22", "15:47", "Europe/London") -> Date
 */
export function parseInTimezone(dateStr: string, timeStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const pad = (n: number) => String(n).padStart(2, '0');
  
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

  // Start with UTC guess and adjust
  let utcTime = Date.UTC(year, month - 1, day, hours, minutes, 0);
  
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(utcTime));
    const partVal = (type: string) => parts.find(p => p.type === type)!.value;
    const pYear = parseInt(partVal('year'));
    const pMonth = parseInt(partVal('month'));
    const pDay = parseInt(partVal('day'));
    const pHour = parseInt(partVal('hour')) === 24 ? 0 : parseInt(partVal('hour')); // handle 24 representation in formatting
    const pMinute = parseInt(partVal('minute'));

    const targetLocalTime = Date.UTC(year, month - 1, day, hours, minutes, 0);
    const formattedLocalTime = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, 0);
    const diffMs = targetLocalTime - formattedLocalTime;
    if (diffMs === 0) break;
    utcTime += diffMs;
  }
  
  return new Date(utcTime);
}

/**
 * Formats a Date object as "HH:mm" in a specific timezone.
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
 * Formats a Date object as a full readable date string in a specific timezone.
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
