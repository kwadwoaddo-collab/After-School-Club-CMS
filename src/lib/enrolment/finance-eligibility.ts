import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { children } from '@/db/schema';

/** Form receipt is not enrolment. A stale isRegistered flag cannot override a
 * linked registration awaiting confirmation. Unlinked, explicitly registered
 * records need a staff confirmation audit as proof of manual enrolment. */
export function financeEligibleChildSql() {
    return sql`(
        (SELECT r.status FROM registration_children rc
            JOIN registrations r ON r.id = rc.registration_id
            WHERE rc.child_id = ${children.id}
              AND r.organisation_id = ${children.organisationId}
              AND (r.centre_id IS NULL OR r.centre_id = ${children.centreId})
            ORDER BY r.created_at DESC, r.id DESC LIMIT 1) = 'signed_up'
        OR (
            ${children.isRegistered} = true
            AND NOT EXISTS (SELECT 1 FROM registration_children rc WHERE rc.child_id = ${children.id})
            AND EXISTS (
                SELECT 1 FROM audit_events ae
                WHERE ae.organisation_id = ${children.organisationId}
                  AND ae.event_type = 'manual_student_enrolment_confirmed'
                  AND ae.user_id IS NOT NULL
                  AND ae.event_data::jsonb ->> 'childId' = ${children.id}::text
            )
        )
    )`;
}

export async function getFinanceEligibleChildIds(orgId: string, childIds?: string[], reader: Pick<typeof db, 'select'> = db, scope?: { parentId: string; centreId: string }) {
    if (childIds && childIds.length === 0) return new Set<string>();
    const rows = await reader.select({ id: children.id }).from(children).where(and(
        eq(children.organisationId, orgId),
        isNull(children.deletedAt),
        scope ? eq(children.parentId, scope.parentId) : undefined,
        scope ? eq(children.centreId, scope.centreId) : undefined,
        childIds ? inArray(children.id, childIds) : undefined,
        financeEligibleChildSql(),
    ));
    return new Set(rows.map(child => child.id));
}

export function assertEligibleBillingCoverage(childIds: string[], eligibleIds: ReadonlySet<string>) {
    if (childIds.length === 0 || childIds.some(id => !eligibleIds.has(id))) {
        throw new Error('Billing requires confirmed signed-up students. Review registration confirmation and billing coverage first.');
    }
}


/** Shared with registration status transitions: serialize admission against a
 * simultaneous confirmation withdrawal, then re-read eligibility in the tx. */
export async function lockEnrolmentForBilling(writer: Pick<typeof db, 'execute'>, childIds: string[]) {
    for (const id of [...new Set(childIds)].sort()) {
        await writer.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'enrolment:' + id}))`);
    }
}
