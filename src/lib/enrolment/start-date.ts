import { isValidIsoCalendarDate } from '@/lib/billing/date-engine';

/** Accept a real calendar date, rejecting JavaScript's rollover of e.g. 31 February. */
export function isValidEnrolmentStartDate(value: string): boolean {
    return isValidIsoCalendarDate(value);
}

