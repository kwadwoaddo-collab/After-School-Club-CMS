import { and, gte, lte, type AnyColumn } from 'drizzle-orm';
export type SummaryRange = { from: Date; to: Date };
export function parseSummaryRange(from?: string | string[], to?: string | string[]): SummaryRange | null {
    if (typeof from !== 'string' || typeof to !== 'string') return null;
    const start = new Date(from), end = new Date(to);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.toISOString() !== from || end.toISOString() !== to || start > end) return null;
    return { from: start, to: end };
}
export function summaryRangeSql(column: AnyColumn, range: SummaryRange | null) {
    return range ? and(gte(column, range.from), lte(column, range.to)) : undefined;
}
export function summaryLinks(centre: string, from: Date, to: Date) {
    const period = new URLSearchParams({ centre, summaryFrom: from.toISOString(), summaryTo: to.toISOString() });
    return {
        students: `/dashboard/students?${period}`,
        bookings: `/dashboard/bookings?${period}`,
        registrations: `/dashboard/registrations?${period}`,
        pending: `/dashboard/registrations?${new URLSearchParams({centre,status:'awaiting_confirmation'})}`,
    };
}
