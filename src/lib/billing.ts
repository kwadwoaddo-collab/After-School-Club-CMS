/**
 * billing.ts
 * Pure, side-effect-free business logic for billing calculations.
 * No DB access — all inputs are plain values.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillingType = 'non_uc' | 'uc';

export interface RateRow {
    sessionsPerWeek: number;
    monthlyRatePence: number;
    extraSessionRatePence: number | null;
}

export interface BillingPeriod {
    periodStart: Date;
    periodEnd: Date;
    invoiceDate: Date;
    dueDate: Date;
    periodLabel: string;     // e.g. "June 2025" or "29 May – 28 Jun 2025"
}

export interface NonUcBillingConfig {
    billingAnchorDate: Date;
    invoiceLeadDays: number;
    sessionsPerWeek: number;
    agreedRatePence: number | null;
}

export interface UcBillingConfig {
    ucPeriodStartDay: number;
    invoiceLeadDays: number;
    ucAgreedAmountPence: number;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Clamp a day number to the last valid day of the given month.
 * Handles Feb 28/29 (leap year), 30-day months, 31 in short months.
 */
export function clampToMonthEnd(year: number, month: number, day: number): number {
    const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
    return Math.min(day, lastDay);
}

/** Return a date at midnight UTC for a given year/month/day */
function utcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
}

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDate(d: Date): string {
    return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── Non-UC rate computation ──────────────────────────────────────────────────

/**
 * Compute the monthly rate in pence for a Non-UC student.
 * Priority: agreedRatePence (override) → rate table lookup → throw.
 */
export function computeNonUcRate(
    sessionsPerWeek: number,
    agreedRatePence: number | null,
    rateTable: RateRow[],
): { ratePence: number; source: 'agreed_override' | 'standard_table' } {
    if (agreedRatePence !== null && agreedRatePence > 0) {
        return { ratePence: agreedRatePence, source: 'agreed_override' };
    }

    // Sort ascending so we can find the right tier
    const sorted = [...rateTable].sort((a, b) => a.sessionsPerWeek - b.sessionsPerWeek);
    const maxRow = sorted[sorted.length - 1];

    // Exact match
    const exact = sorted.find(r => r.sessionsPerWeek === sessionsPerWeek);
    if (exact) {
        return { ratePence: exact.monthlyRatePence, source: 'standard_table' };
    }

    // Over the max tier — apply extra-session surcharge
    if (sessionsPerWeek > maxRow.sessionsPerWeek && maxRow.extraSessionRatePence !== null) {
        const extra = (sessionsPerWeek - maxRow.sessionsPerWeek) * maxRow.extraSessionRatePence;
        return { ratePence: maxRow.monthlyRatePence + extra, source: 'standard_table' };
    }

    throw new Error(`No rate table entry covers ${sessionsPerWeek} sessions/week`);
}

/** Default Non-UC rate table (Sydenham After School Club defaults) */
export const DEFAULT_NON_UC_RATES: RateRow[] = [
    { sessionsPerWeek: 1, monthlyRatePence:  8000, extraSessionRatePence: null },
    { sessionsPerWeek: 2, monthlyRatePence: 14000, extraSessionRatePence: null },
    { sessionsPerWeek: 3, monthlyRatePence: 20000, extraSessionRatePence: null },
    { sessionsPerWeek: 4, monthlyRatePence: 24000, extraSessionRatePence: null },
    { sessionsPerWeek: 5, monthlyRatePence: 28000, extraSessionRatePence: 4000 },
];

// ─── Non-UC billing dates ─────────────────────────────────────────────────────

/**
 * Compute the NEXT Non-UC billing period starting from today (or a reference date).
 * The anchor day is the day-of-month the student's billing recurs on.
 * Assessment period = full billing month (e.g. 1 Aug – 31 Aug).
 */
export function computeNextNonUcBillingDates(
    config: NonUcBillingConfig,
    referenceDate: Date = new Date(),
): BillingPeriod {
    const anchorDay = config.billingAnchorDate.getUTCDate();
    const today = new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
    ));

    // Find the next occurrence of anchorDay at or after today
    let year  = today.getUTCFullYear();
    let month = today.getUTCMonth() + 1; // 1-indexed

    // Try current month first
    const clampedThisMonth = clampToMonthEnd(year, month, anchorDay);
    const candidateThisMonth = utcDate(year, month, clampedThisMonth);

    let dueDate: Date;
    if (candidateThisMonth >= today) {
        dueDate = candidateThisMonth;
    } else {
        // Move to next month
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        const clampedNextMonth = clampToMonthEnd(year, month, anchorDay);
        dueDate = utcDate(year, month, clampedNextMonth);
    }

    // Period: from dueDate to (anchorDay - 1) next month
    const periodStart = dueDate;
    let pEndMonth = month + 1;
    let pEndYear  = year;
    if (pEndMonth > 12) { pEndMonth = 1; pEndYear += 1; }
    const periodEndDay = clampToMonthEnd(pEndYear, pEndMonth, anchorDay - 1);
    const periodEnd    = utcDate(pEndYear, pEndMonth, periodEndDay);

    const invoiceDate = new Date(dueDate.getTime() - config.invoiceLeadDays * 86400000);

    return {
        periodStart,
        periodEnd,
        invoiceDate,
        dueDate,
        periodLabel: `${MONTH_NAMES[periodStart.getUTCMonth()]} ${periodStart.getUTCFullYear()}`,
    };
}

// ─── UC billing dates ─────────────────────────────────────────────────────────

/**
 * Compute the current or next UC assessment period.
 * Pattern: period starts on ucPeriodStartDay, ends on (ucPeriodStartDay - 1) of next month.
 * Example: startDay=29 → 29 May – 28 Jun, 29 Jun – 28 Jul, …
 */
export function computeUcPeriodDates(
    config: UcBillingConfig,
    referenceDate: Date = new Date(),
): BillingPeriod {
    const startDay = config.ucPeriodStartDay;
    const today    = new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
    ));

    let year  = today.getUTCFullYear();
    let month = today.getUTCMonth() + 1; // 1-indexed

    // Compute period start for current month
    const clampedStart = clampToMonthEnd(year, month, startDay);
    const candidateStart = utcDate(year, month, clampedStart);

    let periodStart: Date;
    if (candidateStart >= today) {
        // We're before or on the period start — this period is upcoming
        periodStart = candidateStart;
    } else {
        // Period has already started — the NEXT period is next month
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        const clampedNext = clampToMonthEnd(year, month, startDay);
        periodStart = utcDate(year, month, clampedNext);
    }

    // Period end = (startDay - 1) of the month after period start
    let endMonth = month + 1;
    let endYear  = year;
    if (endMonth > 12) { endMonth = 1; endYear += 1; }
    const endDay  = clampToMonthEnd(endYear, endMonth, startDay - 1);
    const periodEnd = utcDate(endYear, endMonth, endDay);

    const dueDate     = periodStart; // UC: due on period start
    const invoiceDate = new Date(dueDate.getTime() - config.invoiceLeadDays * 86400000);

    const label = `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`;

    return { periodStart, periodEnd, invoiceDate, dueDate, periodLabel: label };
}

/**
 * Generate a human-readable live preview of 2 upcoming UC periods.
 * Used in the BillingSettingsCard UI.
 */
export function previewUcPeriods(startDay: number, count = 2): string {
    const results: string[] = [];
    const now = new Date();
    let ref = now;

    for (let i = 0; i < count; i++) {
        const period = computeUcPeriodDates(
            { ucPeriodStartDay: startDay, invoiceLeadDays: 7, ucAgreedAmountPence: 0 },
            ref,
        );
        results.push(`${fmtDate(period.periodStart)} → ${fmtDate(period.periodEnd)}`);
        // Advance ref past this period to compute the next one
        ref = new Date(period.periodEnd.getTime() + 86400000);
    }
    return results.join(' · ');
}

/** Format pence as a £ string */
export function penceToPounds(pence: number): string {
    return `£${(pence / 100).toFixed(2)}`;
}

/** Parse a £ string to pence */
export function poundsToPence(pounds: string): number {
    return Math.round(parseFloat(pounds.replace('£', '').trim()) * 100);
}
