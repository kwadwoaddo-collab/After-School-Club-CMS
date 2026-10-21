import { and, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { invoices } from '@/db/schema';

/** Existing recurring family obligations, or an invoice explicitly covering
 * one of these children. Unlinked free-text ad-hoc charges are not inferred. */
export function recurringInvoiceOverlapSql(childIds: string[], startDate: Date, endDate: Date) {
    const coveredSnapshotMatch = childIds.length > 0 ? sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${invoices.coveredChildrenJson}) = 'array'
            THEN ${invoices.coveredChildrenJson} ELSE '[]'::jsonb END) covered
        WHERE covered ->> 'id' IN (${sql.join(childIds.map(id => sql`${id}`), sql`, `)})
    )` : sql`false`;
    return and(
        lte(invoices.billingPeriodStart, endDate),
        gte(invoices.billingPeriodEnd, startDate),
        or(sql`${invoices.billingConfigId} IS NOT NULL`,
            childIds.length > 0 ? inArray(invoices.childId, childIds) : undefined,
            coveredSnapshotMatch),
    );
}
