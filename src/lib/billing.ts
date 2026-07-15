/**
 * billing.ts
 * Pure, side-effect-free business logic for billing calculations.
 * No DB access — all inputs are plain values.
 *
 * Simplified model: one agreed monthly fee per family per centre.
 * A billing period is simply the calendar month anchored on the first invoice date.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillingPeriod {
    periodStart: Date;
    periodEnd:   Date;
    invoiceDate: Date;
    dueDate:     Date;
    periodLabel: string;   // e.g. "August 2025"
}

export interface BillingConfig {
    billingAnchorDate: Date;  // date of the first invoice / first period start
    invoiceLeadDays:   number;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Clamp a day number to the last valid day of the given month.
 * Handles Feb 28/29 (leap year), 30-day months, etc.
 */
export function clampToMonthEnd(year: number, month: number, day: number): number {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-indexed here
    return Math.min(day, lastDay);
}

/** Create a UTC midnight Date from year/month/day (month is 1-indexed) */
function utcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
}

/** Format a date as "1 Aug 2025" */
function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
}

// ─── Core billing period calculation ─────────────────────────────────────────

/**
 * Compute the next billing period for a family billing config.
 *
 * Logic:
 * - Period start = the anchor date if in the future (or the next month's anchor day if already past)
 * - Period end = last day of the anchor month (always a full calendar month)
 * - Invoice date = period start - invoiceLeadDays
 * - Due date = period start (invoice due on the first of the period)
 *
 * Example: anchorDate = 2025-08-01, invoiceLeadDays = 7
 *   → Period: 1 Aug – 31 Aug
 *   → Invoice issued: 25 Jul
 *   → Due: 1 Aug
 */
export function computeNextBillingPeriod(
    config: BillingConfig,
    now: Date = new Date(),
): BillingPeriod {
    const anchorDay = config.billingAnchorDate.getUTCDate();

    let year  = now.getUTCFullYear();
    let month = now.getUTCMonth() + 1; // 1-indexed

    // Compute invoice issue date for this month's anchor
    const thisMonthAnchor  = utcDate(year, month, clampToMonthEnd(year, month, anchorDay));
    const thisMonthInvoice = new Date(thisMonthAnchor.getTime() - config.invoiceLeadDays * 86_400_000);

    // If the invoice date for this month is still in the future, use this month
    // Otherwise advance to next month
    let periodStart: Date;
    if (thisMonthInvoice > now) {
        periodStart = thisMonthAnchor;
    } else {
        // Move to next month
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        periodStart = utcDate(year, month, clampToMonthEnd(year, month, anchorDay));
    }

    // Period end = last day of the period month
    const periodMonth = periodStart.getUTCMonth() + 1; // 1-indexed
    const periodYear  = periodStart.getUTCFullYear();
    const lastDay     = new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
    const periodEnd   = utcDate(periodYear, periodMonth, lastDay);

    const dueDate     = periodStart;
    const invoiceDate = new Date(dueDate.getTime() - config.invoiceLeadDays * 86_400_000);

    const periodLabel = periodStart.toLocaleDateString('en-GB', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
    });

    return { periodStart, periodEnd, invoiceDate, dueDate, periodLabel };
}

/**
 * Generate a human-readable preview of upcoming billing periods.
 * Used in the BillingSettingsCard UI live preview.
 */
export function previewBillingPeriods(anchorDate: Date, count = 3): string[] {
    const results: string[] = [];
    let ref = new Date();
    for (let i = 0; i < count; i++) {
        const period = computeNextBillingPeriod({ billingAnchorDate: anchorDate, invoiceLeadDays: 7 }, ref);
        results.push(
            `${fmtDate(period.periodStart)} – ${fmtDate(period.periodEnd)}` +
            ` (invoice by ${fmtDate(period.invoiceDate)})`
        );
        // Advance ref past this period to compute the next
        ref = new Date(period.periodEnd.getTime() + 86_400_000);
    }
    return results;
}

/** Format pence as a £ string, e.g. 42000 → "£420.00" */
export function penceToPounds(pence: number): string {
    return `£${(pence / 100).toFixed(2)}`;
}

/** Parse a £ string to pence, e.g. "420.00" → 42000 */
export function poundsToPence(pounds: string): number {
    return Math.round(parseFloat(pounds.replace(/[^0-9.]/g, '')) * 100);
}
