import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
import { sql } from 'drizzle-orm';
import { children } from '@/db/schema';

export function studentLifecycleStatusSql(onDate = enrolmentBusinessDate()) {
    return sql<string>`COALESCE((SELECT e.status FROM student_enrolment_events e WHERE e.child_id = ${children.id} AND e.organisation_id = ${children.organisationId} AND e.effective_date <= ${onDate}::date ORDER BY e.effective_date DESC, e.created_at DESC, e.id DESC LIMIT 1), 'active')`;
}
export function studentLastContactSql() {
    return sql<Date | null>`(SELECT max(c.contacted_at) FROM student_follow_up_contacts c WHERE c.child_id = ${children.id} AND c.organisation_id = ${children.organisationId})`;
}
export function studentNextContactSql() {
    return sql<string | null>`(SELECT follow_up.next_contact_date::text FROM (
        SELECT e.next_contact_date, e.created_at, e.id FROM student_enrolment_events e WHERE e.child_id = ${children.id} AND e.organisation_id = ${children.organisationId}
        UNION ALL
        SELECT c.next_contact_date, c.created_at, c.id FROM student_follow_up_contacts c WHERE c.child_id = ${children.id} AND c.organisation_id = ${children.organisationId}
    ) follow_up ORDER BY follow_up.created_at DESC, follow_up.id DESC LIMIT 1)`;
}
