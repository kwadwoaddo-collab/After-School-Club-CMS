import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { and, eq, gte, lte, inArray, isNull, sql } from 'drizzle-orm';

export interface ReportFinanceSummary {
    cashCollected: string;
    invoiced: string;
    draftsPrepared: string;
}
/** Protected caller supplies its already-authorised tenant and narrowed centre IDs. */
export async function getReportFinanceSummary(orgId: string, centreIds: string[], start: Date, end: Date): Promise<ReportFinanceSummary> {
    if (!centreIds.length) throw new Error('No accessible centres');
    const scope = and(eq(invoices.organisationId, orgId), inArray(invoices.centreId, centreIds));
    const [cash, issued, drafts] = await Promise.all([
        db.select({ amount: sql<string>`coalesce(sum(${payments.amount}), 0)::text` }).from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(and(scope, eq(payments.status, 'verified'), isNull(payments.reversedAt),
                inArray(invoices.status, ['sent', 'partially_paid', 'paid']), gte(payments.recordedAt, start), lte(payments.recordedAt, end))),
        db.select({ amount: sql<string>`coalesce(sum(${invoices.amount}), 0)::text` }).from(invoices)
            .where(and(scope, inArray(invoices.status, ['sent', 'partially_paid', 'paid']), gte(invoices.invoiceDate, start), lte(invoices.invoiceDate, end))),
        db.select({ amount: sql<string>`coalesce(sum(${invoices.amount}), 0)::text` }).from(invoices)
            .where(and(scope, eq(invoices.status, 'draft'), gte(invoices.createdAt, start), lte(invoices.createdAt, end))),
    ]);
    return { cashCollected: cash[0]?.amount ?? '0', invoiced: issued[0]?.amount ?? '0', draftsPrepared: drafts[0]?.amount ?? '0' };
}
