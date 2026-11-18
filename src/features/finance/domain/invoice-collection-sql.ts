import { and, inArray, sql, type SQL } from 'drizzle-orm';
import { invoices } from '@/db/schema';
import { toLondonBusinessDate } from './invoice-collection-state';

export type OpenCollectionFilterStage = 'upcoming' | 'in_period' | 'overdue';

/**
 * Builds a PostgreSQL Drizzle WHERE clause that matches `resolveOpenAgingStage()`
 * day-for-day in `Europe/London` business dates (`YYYY-MM-DD`).
 *
 * Mirrors `invoice-collection-state.ts`:
 * - Valid period (`start IS NOT NULL AND end IS NOT NULL AND end >= start`):
 *   `yellowStart = CASE WHEN due > start AND due <= end THEN due ELSE start END`
 *   `redCutoff   = GREATEST(end, COALESCE(due, end))`
 * - One-off / legacy invoice without period bounds (`start IS NULL AND end IS NULL AND due IS NOT NULL`):
 *   `yellowStart = due`, `redCutoff = due`
 */
export function buildInvoiceCollectionStageSql(
    stage: OpenCollectionFilterStage,
    todayLondonIso: string = toLondonBusinessDate(),
): SQL {
    const startUtcDate = sql`(${invoices.billingPeriodStart} AT TIME ZONE 'UTC')::date`;
    const endUtcDate = sql`(${invoices.billingPeriodEnd} AT TIME ZONE 'UTC')::date`;
    const dueUtcDate = sql`(${invoices.dueDate} AT TIME ZONE 'UTC')::date`;
    const todayDate = sql`${todayLondonIso}::date`;

    const validPeriod = sql`(${invoices.billingPeriodStart} IS NOT NULL AND ${invoices.billingPeriodEnd} IS NOT NULL AND ${endUtcDate} >= ${startUtcDate})`;
    const noPeriod = sql`(${invoices.billingPeriodStart} IS NULL AND ${invoices.billingPeriodEnd} IS NULL AND ${invoices.dueDate} IS NOT NULL)`;

    const yellowStartExpr = sql`(CASE
        WHEN ${validPeriod} THEN (
            CASE WHEN ${invoices.dueDate} IS NOT NULL AND ${dueUtcDate} > ${startUtcDate} AND ${dueUtcDate} <= ${endUtcDate}
                 THEN ${dueUtcDate}
                 ELSE ${startUtcDate}
            END
        )
        ELSE ${dueUtcDate}
    END)`;

    const redCutoffExpr = sql`(CASE
        WHEN ${validPeriod} THEN GREATEST(${endUtcDate}, COALESCE(${dueUtcDate}, ${endUtcDate}))
        ELSE ${dueUtcDate}
    END)`;

    const dateComparison =
        stage === 'overdue'
            ? sql`${todayDate} > ${redCutoffExpr}`
            : stage === 'in_period'
              ? sql`(${todayDate} >= ${yellowStartExpr} AND ${todayDate} <= ${redCutoffExpr})`
              : sql`${todayDate} < ${yellowStartExpr}`;

    return and(
        inArray(invoices.status, ['sent', 'partially_paid']),
        sql`(${validPeriod} OR ${noPeriod})`,
        dateComparison,
    )!;
}
