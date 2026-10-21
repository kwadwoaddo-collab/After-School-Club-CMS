import { and, inArray, sql } from 'drizzle-orm';
import { invoices } from '@/db/schema';

/** A read-only chase view. Neither lifecycle changes nor this filter alter
 * invoices, payment allocations, receipts or the main history ledger. */
export function formerStudentOutstandingSql() {
    return and(
        inArray(invoices.status, ['sent', 'partially_paid']),
        sql`${invoices.amount}::numeric > COALESCE((
            SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = ${invoices.id}
              AND p.status = 'verified' AND p.reversed_at IS NULL
        ), 0)`,
        invoiceStudentLifecycleSql(false),
    );
}

export function activeStudentInvoiceSql() {
    return invoiceStudentLifecycleSql(true);
}

/** Existing drafts are preserved and visibly held for review when their
 * intended service period intersects a break or an unreviewed restart. */
export function draftLifecycleReviewSql() {
    const start = sql`COALESCE(${invoices.billingPeriodStart}::date, (now() AT TIME ZONE 'Europe/London')::date)`;
    const end = sql`COALESCE(${invoices.billingPeriodEnd}::date, ${start})`;
    return sql<boolean>`${invoices.status} = 'draft' AND (
        ((${invoices.billingPeriodStart} IS NULL) <> (${invoices.billingPeriodEnd} IS NULL))
        OR EXISTS (
            SELECT 1 FROM children draft_child
            WHERE draft_child.organisation_id = ${invoices.organisationId}
              AND draft_child.parent_id = ${invoices.parentId} AND draft_child.centre_id = ${invoices.centreId}
              AND (draft_child.id = ${invoices.childId}
                OR ${invoices.coveredChildrenJson} @> jsonb_build_array(jsonb_build_object('id', draft_child.id::text))
                OR (${invoices.childId} IS NULL AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${invoices.coveredChildrenJson}) = 'array'
                    THEN ${invoices.coveredChildrenJson} ELSE '[]'::jsonb END) covered WHERE covered ? 'id'
                )))
              AND (
                EXISTS (SELECT 1 FROM student_enrolment_events current_event
                    WHERE current_event.id = (SELECT e.id FROM student_enrolment_events e
                        WHERE e.child_id = draft_child.id AND e.organisation_id = draft_child.organisation_id
                          AND e.effective_date <= ${start}
                        ORDER BY e.effective_date DESC, e.created_at DESC, e.id DESC LIMIT 1)
                      AND (current_event.status <> 'active' OR NOT current_event.fee_review_confirmed
                        OR current_event.billing_reviewed_from IS NULL OR current_event.billing_reviewed_from > ${start}))
                OR EXISTS (SELECT 1 FROM student_enrolment_events break_event
                    WHERE break_event.child_id = draft_child.id AND break_event.organisation_id = draft_child.organisation_id
                      AND break_event.effective_date > ${start} AND break_event.effective_date <= ${end}
                      AND (break_event.status <> 'active' OR NOT break_event.fee_review_confirmed
                        OR break_event.billing_reviewed_from IS NULL OR break_event.billing_reviewed_from > ${start}))
              )
        )
    )`;
}

function invoiceStudentLifecycleSql(active: boolean) {
    return sql`EXISTS (
            SELECT 1 FROM children former_child
            WHERE former_child.organisation_id = ${invoices.organisationId}
              AND former_child.parent_id = ${invoices.parentId}
              AND former_child.centre_id = ${invoices.centreId}
              AND (
                former_child.id = ${invoices.childId}
                OR ${invoices.coveredChildrenJson} @> jsonb_build_array(jsonb_build_object('id', former_child.id::text))
                OR (${invoices.childId} IS NULL AND (
                    ${invoices.coveredChildrenJson} IS NULL
                    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(${invoices.coveredChildrenJson}) = 'array'
                        THEN ${invoices.coveredChildrenJson} ELSE '[]'::jsonb END
                    ) covered WHERE covered ? 'id')
                ))
              )
              AND COALESCE((SELECT e.status FROM student_enrolment_events e
                WHERE e.child_id = former_child.id AND e.organisation_id = former_child.organisation_id
                  AND e.effective_date <= (now() AT TIME ZONE 'Europe/London')::date
                ORDER BY e.effective_date DESC, e.created_at DESC, e.id DESC LIMIT 1
              ), 'active') ${active ? sql`= 'active'` : sql`IN ('paused', 'stopped')`}
        )`;
}
