import { sql } from 'drizzle-orm';
import { bookings } from '@/db/schema';
/** Matches requiresAssessmentOutcome without loading every appointment into memory. */
export function assessmentOutcomeRequiredSql(now = new Date()) {
    return sql`${bookings.status} IN ('confirmed', 'pending') AND ${bookings.startAt} < ${now}
        AND (NOT EXISTS (SELECT 1 FROM booking_attendees outcome_attendee WHERE outcome_attendee.booking_id = ${bookings.id})
        OR EXISTS (SELECT 1 FROM booking_attendees outcome_attendee WHERE outcome_attendee.booking_id = ${bookings.id} AND outcome_attendee.attendance_status IS NULL))`;
}
