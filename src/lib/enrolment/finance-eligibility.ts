import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { children } from '@/db/schema';

/** Public form receipt neither grants nor revokes staff-confirmed enrolment.
 * A current signed-up registration or explicit manual confirmation audit is
 * required; the legacy isRegistered flag alone is never sufficient. */
export function confirmedEnrolmentChildSql() {
    return sql`(
        EXISTS (SELECT 1 FROM registration_children rc
            JOIN registrations r ON r.id = rc.registration_id
            WHERE rc.child_id = ${children.id}
              AND r.organisation_id = ${children.organisationId}
              AND (r.centre_id IS NULL OR r.centre_id = ${children.centreId})
              AND r.status = 'signed_up')
        OR (
            ${children.isRegistered} = true
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

/** Date-only lifecycle checks use the business timezone when no service period
 * is selected. A fixed family fee is never silently prorated across a break. */
export function lifecycleEligibleChildSql(startDate?: string, endDate?: string, requireFeeReview = true) {
    const start = startDate ? sql`${startDate}::date` : sql`(now() AT TIME ZONE 'Europe/London')::date`;
    const end = endDate ? sql`${endDate}::date` : start;
    const latest = sql`SELECT e.id FROM student_enrolment_events e
        WHERE e.child_id = ${children.id} AND e.organisation_id = ${children.organisationId}
          AND e.effective_date <= ${start}
        ORDER BY e.effective_date DESC, e.created_at DESC, e.id DESC LIMIT 1`;
    return sql`NOT EXISTS (
        SELECT 1 FROM student_enrolment_events current_event
        WHERE current_event.id = (${latest})
          AND (current_event.status <> 'active' ${requireFeeReview ? sql`OR NOT current_event.fee_review_confirmed
              OR current_event.billing_reviewed_from IS NULL OR current_event.billing_reviewed_from > ${start}` : sql``})
    ) AND NOT EXISTS (
        SELECT 1 FROM student_enrolment_events break_event
        WHERE break_event.child_id = ${children.id}
          AND break_event.organisation_id = ${children.organisationId}
          AND break_event.effective_date > ${start} AND break_event.effective_date <= ${end}
          AND (break_event.status <> 'active' ${requireFeeReview ? sql`OR NOT break_event.fee_review_confirmed
              OR break_event.billing_reviewed_from IS NULL OR break_event.billing_reviewed_from > ${start}` : sql``})
    )`;
}

export function financeEligibleChildSql(startDate?: string, endDate?: string) {
    return and(confirmedEnrolmentChildSql(), lifecycleEligibleChildSql(startDate, endDate))!;
}

export function billingServicePeriod(start?: Date | string | null, end?: Date | string | null) {
    if (!start && !end) return undefined;
    if (!start || !end) throw new Error('Select both billing period start and end for lifecycle review');
    const startDate = new Date(start).toISOString().slice(0, 10);
    const endDate = new Date(end).toISOString().slice(0, 10);
    if (endDate < startDate) throw new Error('Billing period end must not precede its start');
    return { startDate, endDate };
}

export async function getFinanceEligibleChildIds(orgId: string, childIds?: string[], reader: Pick<typeof db, 'select'> = db, scope?: {
    parentId: string; centreId: string;
    billingConfig?: { id: string; agreedMonthlyPence: number; billingAnchorDate: string };
}, period?: { startDate: string; endDate: string }) {
    if (childIds && childIds.length === 0) return new Set<string>();
    const rows = await reader.select({ id: children.id }).from(children).where(and(
        eq(children.organisationId, orgId),
        isNull(children.deletedAt),
        scope ? eq(children.parentId, scope.parentId) : undefined,
        scope ? eq(children.centreId, scope.centreId) : undefined,
        scope?.billingConfig ? sql`EXISTS (
            SELECT 1 FROM billing_configs current_config
            JOIN billing_config_children covered ON covered.config_id = current_config.id
            WHERE current_config.id = ${scope.billingConfig.id}
              AND current_config.organisation_id = ${orgId}
              AND current_config.parent_id = ${scope.parentId} AND current_config.centre_id = ${scope.centreId}
              AND current_config.status = 'active'
              AND current_config.agreed_monthly_pence = ${scope.billingConfig.agreedMonthlyPence}
              AND current_config.billing_anchor_date = ${scope.billingConfig.billingAnchorDate}::date
              AND covered.child_id = ${children.id}
              AND (SELECT COUNT(*) FROM billing_config_children exact_coverage
                  WHERE exact_coverage.config_id = current_config.id) = ${childIds?.length ?? 0}
        )` : undefined,
        childIds ? inArray(children.id, childIds) : undefined,
        financeEligibleChildSql(period?.startDate, period?.endDate),
    ));
    return new Set(rows.map(child => child.id));
}

export function assertEligibleBillingCoverage(childIds: string[], eligibleIds: ReadonlySet<string>) {
    if (childIds.length === 0 || childIds.some(id => !eligibleIds.has(id))) {
        throw new Error('Billing requires confirmed signed-up, active students with reviewed fees and dates for the whole billing period. Review registration, pause/restart dates and family coverage first.');
    }
}


/** Shared with registration status transitions: serialize admission against a
 * simultaneous confirmation withdrawal, then re-read eligibility in the tx. */
export async function lockEnrolmentForBilling(writer: Pick<typeof db, 'execute'>, childIds: string[]) {
    for (const id of [...new Set(childIds)].sort()) {
        await writer.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'enrolment:' + id}))`);
    }
}

export async function lockBillingConfiguration(writer: Pick<typeof db, 'execute'>, configId: string) {
    await writer.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'billing-config:' + configId}))`);
}
