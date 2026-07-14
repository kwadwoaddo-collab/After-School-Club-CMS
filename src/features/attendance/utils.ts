import { format } from 'date-fns';

// ─── Academic year helpers ────────────────────────────────────────────────────

/** Returns the academic year string for a given date, e.g. "2025-26" */
export function getAcademicYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    // Academic year starts September (month 8)
    if (month >= 8) {
        return `${year}-${String(year + 1).slice(2)}`;
    }
    return `${year - 1}-${String(year).slice(2)}`;
}

/** Returns the start and end Date for an academic year string "2025-26" */
export function getAcademicYearRange(academicYear: string): { start: Date; end: Date } {
    const startYear = parseInt(academicYear.split('-')[0]);
    return {
        start: new Date(startYear, 8, 1),                  // Sep 1
        end: new Date(startYear + 1, 6, 31, 23, 59, 59),  // Jul 31
    };
}

// ─── Session type detection ───────────────────────────────────────────────────

/** Returns true if the given date falls within the child's registered schedule */
export function isScheduledDay(
    registeredSessions: string[] | null | undefined,
    date: Date,
): boolean {
    if (!registeredSessions || registeredSessions.length === 0) return false;
    const dayName = format(date, 'EEEE'); // "Monday", "Tuesday", etc.
    return registeredSessions.some(s => s.startsWith(dayName));
}

/** Auto-detects session type from the child's schedule and the date */
export function deriveSessionType(
    registeredSessions: string[] | null | undefined,
    date: Date,
): 'scheduled' | 'extra' {
    return isScheduledDay(registeredSessions, date) ? 'scheduled' : 'extra';
}

/** Derives lateness in minutes. Returns null if not late (within 10-min grace). */
export function deriveLateMinutes(checkInTime: string, slotTime: string): number | null {
    const [ih, im] = checkInTime.split(':').map(Number);
    const [sh, sm] = slotTime.split(':').map(Number);
    const inMins = ih * 60 + im;
    const slotMins = sh * 60 + sm;
    const diff = inMins - slotMins;
    return diff > 10 ? diff : null; // 10-minute grace period
}
