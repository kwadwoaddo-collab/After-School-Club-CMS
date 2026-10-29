import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditEvents } from '@/db/schema';
import { isValidEnrolmentStartDate } from '@/lib/enrolment/start-date';

/** Original attendance start is separate from registration receipt and later status dates.
 * Corrections append history rather than rewriting the original confirmation evidence. */
export async function readEnrolmentStart(orgId: string, childId: string, reader: Pick<typeof db, 'select'> = db) {
    const rows = await reader.select({ id: auditEvents.id, eventData: auditEvents.eventData }).from(auditEvents).where(and(
        eq(auditEvents.organisationId, orgId),
        inArray(auditEvents.eventType, ['manual_student_enrolment_confirmed', 'student_enrolment_start_date_corrected']),
        sql`${auditEvents.eventData}::jsonb->>'childId' = ${childId}`,
    )).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
    for (const row of rows) {
        const data = JSON.parse(row.eventData ?? '{}');
        if (typeof data.startDate === 'string' && isValidEnrolmentStartDate(data.startDate)) return { date: data.startDate, version: row.id };
    }
    return { date: null, version: null };
}
