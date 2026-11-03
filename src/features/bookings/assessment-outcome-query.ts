import { sql } from 'drizzle-orm';
import { bookings } from '@/db/schema';
/** Matches requiresAssessmentOutcome without loading every appointment into memory. */
export function assessmentOutcomeRequiredSql(now: Date | string = new Date()) {
    const nowIso = now instanceof Date ? now.toISOString() : String(now);
    return sql`${bookings.status} IN ('confirmed', 'pending') AND ${bookings.startAt} < ${nowIso}::timestamptz
        AND (${bookings.enrolmentOutcome} IS NULL OR ${bookings.enrolmentOutcome} = 'awaiting_outcome')
        AND (NOT EXISTS (SELECT 1 FROM booking_attendees outcome_attendee WHERE outcome_attendee.booking_id = ${bookings.id})
        OR EXISTS (SELECT 1 FROM booking_attendees outcome_attendee WHERE outcome_attendee.booking_id = ${bookings.id} AND outcome_attendee.attendance_status IS NULL))`;
}

/** Matches bookings in the Did Not Attend · Follow Up queue (not yet resolved to Signed Up or Not Interested). */
export function bookingDidNotAttendFollowUpSql() {
    return sql`(
        ${bookings.status} = 'did_not_attend'
        OR (
            ${bookings.status} IN ('confirmed', 'pending')
            AND EXISTS (SELECT 1 FROM booking_attendees ba WHERE ba.booking_id = ${bookings.id})
            AND NOT EXISTS (SELECT 1 FROM booking_attendees ba WHERE ba.booking_id = ${bookings.id} AND (ba.attendance_status IS NULL OR ba.attendance_status IN ('present', 'late')))
        )
    ) AND (${bookings.enrolmentOutcome} IS NULL OR ${bookings.enrolmentOutcome} = 'awaiting_outcome')`;
}
