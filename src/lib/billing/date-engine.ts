/**
 * date-engine.ts
 *
 * Category B — Billing Scheduler Date Engine.
 * Pure, side-effect-free, deterministic business logic for anchored monthly billing periods,
 * calendar-month lead times, expected payment dates, and stable cycle identification.
 *
 * Governing Principles:
 * - P1: Scheduler decides WHEN. Manager decides WHAT.
 * - P2: Semantic correctness.
 * - Invariant 1: nextPeriod.start = monthly anniversary of original anchor (clamped for 29-31 without permanent mutation).
 * - Invariant 2: currentPeriod.end = nextPeriod.start - 1 calendar day.
 *   Therefore: nextPeriod.start = currentPeriod.end + 1 day (NO gaps, NO overlaps, NO skipped months).
 * - Invariant 3: Draft preparation date defaults to 1 calendar month before period start (calendar arithmetic, not 30 days).
 * - Invariant 4: Timezone safe — pure date-only UTC midnight normalization across BST/GMT/local runtimes.
 */

export type LeadTimeUnit = 'DAYS' | 'CALENDAR_MONTHS';

export interface BillingPeriod {
    periodStart: Date;
    periodEnd:   Date;
    invoiceDate: Date;
    dueDate:     Date;
    periodLabel: string;
}

export interface BillingScheduleInput {
    id?: string;
    billingAnchorDate: Date | string;
    invoiceLeadDays?: number;
    leadTimeUnit?: LeadTimeUnit | null;
    leadTimeValue?: number | null;
    paymentDayOfMonth?: number | null;
    lastBilledPeriodStart?: Date | string | null;
}

export interface BillingSchedule {
    periodStart: Date;
    periodEnd: Date;
    draftCreationDate: Date;
    expectedPaymentDate: Date;
    dueDate: Date;
    periodLabel: string;
    cycleKey: string;
}

export interface BillingPeriodPreviewItem {
    periodStart: Date;
    periodEnd: Date;
    draftDate: Date;
    periodSpan: string;
    label: string;
    displayText: string;
}

// ─── Primitive Date Utilities ────────────────────────────────────────────────

/**
 * Returns number of days in the specified month (1-indexed month, e.g. 1 = Jan, 12 = Dec).
 */
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Clamp a day-of-month to the last valid day of the specified month.
 */
export function clampToMonthEnd(year: number, month: number, day: number): number {
    const maxDays = daysInMonth(year, month);
    return Math.max(1, Math.min(day, maxDays));
}

/**
 * Checks if a given UTC date is the last day of its calendar month.
 */
export function isLastDayOfMonth(date: Date): boolean {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return date.getUTCDate() === daysInMonth(year, month);
}

/**
 * Creates a UTC midnight Date.
 */
export function createUtcDate(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Normalises an input (Date or 'YYYY-MM-DD' string) to a UTC midnight Date.
 * Immune to BST/GMT/local timezone artifacts.
 */
export function toUtcDate(input: Date | string): Date {
    if (typeof input === 'string') {
        const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [, y, m, d] = match;
            return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0));
        }
    }
    if (input instanceof Date) {
        // If it has 23:00 UTC (BST midnight artifact from local date parsing), adjust by 2 hours
        const d = input.getUTCHours() === 23
            ? new Date(input.getTime() + 2 * 3600 * 1000)
            : input;
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    }
    throw new Error(`Invalid date input: ${input}`);
}

/**
 * Formats a Date as 'YYYY-MM-DD'.
 */
export function formatIsoDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Format a date in British style, e.g. "1 Sep 2026".
 */
export function formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

// ─── Calendar Month Arithmetic ───────────────────────────────────────────────

/**
 * Subtracts N calendar months from a date:
 * - Deterministic calendar-month arithmetic (NOT fixed 30 days).
 * - If the date is the last day of its month, the result is the last day of the target month.
 * - Otherwise, day is min(day, daysInTargetMonth).
 * - Handles year wrapping cleanly across multi-month spans.
 */
export function subtractCalendarMonths(date: Date, months: number = 1): Date {
    const origYear = date.getUTCFullYear();
    const origMonth = date.getUTCMonth() + 1; // 1-indexed
    const isEnd = isLastDayOfMonth(date);

    let targetMonth = origMonth - months;
    let targetYear = origYear;

    while (targetMonth < 1) {
        targetMonth += 12;
        targetYear -= 1;
    }

    const maxTargetDays = daysInMonth(targetYear, targetMonth);
    const targetDay = isEnd ? maxTargetDays : Math.min(date.getUTCDate(), maxTargetDays);

    return createUtcDate(targetYear, targetMonth, targetDay);
}

/**
 * Adds N calendar months to a date with end-of-month preservation:
 * - If the date is the last day of its month, the result is the last day of the target month.
 * - Otherwise, day is min(day, daysInTargetMonth).
 */
export function addCalendarMonths(date: Date, months: number = 1): Date {
    const origYear = date.getUTCFullYear();
    const origMonth = date.getUTCMonth() + 1;
    const isEnd = isLastDayOfMonth(date);

    let targetMonth = origMonth + months;
    let targetYear = origYear;

    while (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
    }

    const maxTargetDays = daysInMonth(targetYear, targetMonth);
    const targetDay = isEnd ? maxTargetDays : Math.min(date.getUTCDate(), maxTargetDays);

    return createUtcDate(targetYear, targetMonth, targetDay);
}

// ─── Canonical Period Recurrence Engine ──────────────────────────────────────

/**
 * Computes the k-th billing period (0-indexed) anchored at anchorDate.
 * k = 0: Initial period starting on anchorDate.
 * k = 1: Next monthly period.
 *
 * Invariant:
 * nextPeriod.start = currentPeriod.end + 1 day
 * currentPeriod.end = nextPeriod.start - 1 day
 * Clamping for 29, 30, 31 never mutates the original anchor day.
 */
export function getBillingPeriodByIndex(
    anchorDateInput: Date | string,
    periodIndex: number,
): { periodStart: Date; periodEnd: Date; periodLabel: string } {
    const anchor = toUtcDate(anchorDateInput);
    const originalAnchorDay = anchor.getUTCDate();
    const startYear = anchor.getUTCFullYear();
    const startMonth = anchor.getUTCMonth() + 1; // 1-indexed

    // Calculate start date for this period (index k)
    const monthOffsetK = (startMonth - 1) + periodIndex;
    const yearK = startYear + Math.floor(monthOffsetK / 12);
    const monthK = ((monthOffsetK % 12) + 12) % 12 + 1;
    const dayK = periodIndex === 0 ? originalAnchorDay : clampToMonthEnd(yearK, monthK, originalAnchorDay);
    const periodStart = createUtcDate(yearK, monthK, dayK);

    // Calculate start date for next period (index k + 1)
    const monthOffsetNext = (startMonth - 1) + periodIndex + 1;
    const yearNext = startYear + Math.floor(monthOffsetNext / 12);
    const monthNext = ((monthOffsetNext % 12) + 12) % 12 + 1;
    const dayNext = clampToMonthEnd(yearNext, monthNext, originalAnchorDay);
    const nextStart = createUtcDate(yearNext, monthNext, dayNext);

    // periodEnd is exactly 1 calendar day before nextStart
    const periodEnd = new Date(nextStart.getTime() - 86_400_000);
    const periodLabel = formatPeriodLabel(periodStart, periodEnd);

    return { periodStart, periodEnd, periodLabel };
}

/**
 * Resolves the billing period covering a specific target date (e.g. today).
 * If targetDate is before anchorDate, returns Period 0 (the initial period).
 */
export function getBillingPeriodForDate(
    anchorDateInput: Date | string,
    targetDateInput: Date | string,
): { periodStart: Date; periodEnd: Date; periodLabel: string; periodIndex: number } {
    const anchor = toUtcDate(anchorDateInput);
    const target = toUtcDate(targetDateInput);

    if (target < anchor) {
        const period0 = getBillingPeriodByIndex(anchor, 0);
        return { ...period0, periodIndex: 0 };
    }

    const anchorYear = anchor.getUTCFullYear();
    const anchorMonth = anchor.getUTCMonth() + 1;
    const targetYear = target.getUTCFullYear();
    const targetMonth = target.getUTCMonth() + 1;

    let k = (targetYear - anchorYear) * 12 + (targetMonth - anchorMonth);
    if (k < 0) k = 0;

    let period = getBillingPeriodByIndex(anchor, k);
    if (target < period.periodStart && k > 0) {
        k--;
        period = getBillingPeriodByIndex(anchor, k);
    } else if (target > period.periodEnd) {
        k++;
        period = getBillingPeriodByIndex(anchor, k);
    }

    return { ...period, periodIndex: k };
}

/**
 * Calculates the start of the next assessment period given the current period start and original anchorDay.
 * originalAnchorDay (1–31) is the intended day-of-month and re-asserts after shorter months (e.g. Feb 28 -> Mar 31).
 */
export function nextPeriodStart(currentStart: Date, originalAnchorDay: number): Date {
    let nextMonth = currentStart.getUTCMonth() + 2; // +1 for 1-index, +1 for next month
    let nextYear = currentStart.getUTCFullYear();

    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
    }

    const clampedDay = clampToMonthEnd(nextYear, nextMonth, originalAnchorDay);
    return createUtcDate(nextYear, nextMonth, clampedDay);
}

/**
 * Calculates period end as one day before next period start.
 * periodEnd(n) = periodStart(n+1) - 1 day.
 */
export function computePeriodEnd(periodStart: Date, originalAnchorDay: number): Date {
    const nextStart = nextPeriodStart(periodStart, originalAnchorDay);
    return new Date(nextStart.getTime() - 86_400_000);
}

// ─── Expected Payment Date ───────────────────────────────────────────────────

/**
 * Calculates the expected payment date.
 * When paymentDayOfMonth is specified (1–31):
 *   Returns the Nth day of the month containing periodStart, clamped to month end.
 * When paymentDayOfMonth is null/undefined:
 *   Defaults to periodStart (standard recurring fee model).
 */
export function computeExpectedPaymentDate(
    periodStart: Date,
    paymentDayOfMonth?: number | null,
): Date {
    if (paymentDayOfMonth && paymentDayOfMonth >= 1 && paymentDayOfMonth <= 31) {
        const year = periodStart.getUTCFullYear();
        const month = periodStart.getUTCMonth() + 1;
        const clampedDay = clampToMonthEnd(year, month, paymentDayOfMonth);
        return createUtcDate(year, month, clampedDay);
    }
    return periodStart;
}

// ─── Draft Creation / Invoice Eligibility Date ────────────────────────────────

/**
 * Calculates draft generation eligibility date by subtracting lead time from expected payment date (or periodStart).
 * Supports:
 * - CALENDAR_MONTHS (default for new configs, 1 calendar month before)
 * - DAYS (e.g. 7 days or custom day count)
 * - Legacy fallback to invoiceLeadDays (preserving existing production configs without migration)
 */
export function computeDraftCreationDate(params: {
    expectedPaymentDate: Date;
    leadTimeUnit?: LeadTimeUnit | null;
    leadTimeValue?: number | null;
    invoiceLeadDays?: number;
}): Date {
    const { expectedPaymentDate, leadTimeUnit, leadTimeValue, invoiceLeadDays } = params;

    if (leadTimeUnit === 'CALENDAR_MONTHS') {
        const months = leadTimeValue && leadTimeValue > 0 ? leadTimeValue : 1;
        return subtractCalendarMonths(expectedPaymentDate, months);
    }

    if (leadTimeUnit === 'DAYS') {
        const days = leadTimeValue !== undefined && leadTimeValue !== null ? leadTimeValue : (invoiceLeadDays ?? 7);
        return new Date(expectedPaymentDate.getTime() - days * 86_400_000);
    }

    // Existing configs where leadTimeUnit is null/undefined:
    // Retain exact persisted invoiceLeadDays (7, 30, etc.)
    if (invoiceLeadDays !== undefined && invoiceLeadDays !== null) {
        return new Date(expectedPaymentDate.getTime() - invoiceLeadDays * 86_400_000);
    }

    // Default for new configs: 1 calendar month
    return subtractCalendarMonths(expectedPaymentDate, 1);
}

// ─── Period Label Formatting ─────────────────────────────────────────────────

/**
 * Formats a period label cleanly.
 * If period spans exactly a full calendar month (1st to last day): "September 2026".
 * If arbitrary period (e.g. 6 Sep to 5 Oct): "6 Sep 2026 to 5 Oct 2026".
 */
export function formatPeriodLabel(periodStart: Date, periodEnd: Date): string {
    const isFirstDay = periodStart.getUTCDate() === 1;
    const isSameMonth = periodStart.getUTCMonth() === periodEnd.getUTCMonth() &&
                        periodStart.getUTCFullYear() === periodEnd.getUTCFullYear();
    const isLastDay = isLastDayOfMonth(periodEnd);

    if (isFirstDay && isSameMonth && isLastDay) {
        return periodStart.toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });
    }

    return `${formatDisplayDate(periodStart)} to ${formatDisplayDate(periodEnd)}`;
}

// ─── Cycle Key Generator ─────────────────────────────────────────────────────

/**
 * Stable, canonical cycle identifier: `${configId}:${YYYY-MM-DD}`.
 */
export function generateCycleKey(configId: string, periodStart: Date): string {
    return `${configId}:${formatIsoDate(periodStart)}`;
}

// ─── Live UI Preview Generator ───────────────────────────────────────────────

/**
 * Generate a sequence of upcoming billing periods for UI setup and inspection.
 * Shows:
 * First Period: 6 Sep 2026 – 5 Oct 2026
 * Next: 6 Oct 2026 – 5 Nov 2026 (draft prepared 6 Sep 2026)
 * Then: 6 Nov 2026 – 5 Dec 2026 (draft prepared 6 Oct 2026)
 * Later: 6 Dec 2026 – 5 Jan 2027 (draft prepared 6 Nov 2026)
 */
export function previewBillingPeriods(
    anchorDateInput: Date | string,
    count = 4,
    options?: {
        leadTimeUnit?: LeadTimeUnit | null;
        leadTimeValue?: number | null;
        invoiceLeadDays?: number;
        paymentDayOfMonth?: number | null;
    }
): BillingPeriodPreviewItem[] {
    const results: BillingPeriodPreviewItem[] = [];
    const labels = ['First Period', 'Next', 'Then', 'Later'];

    for (let i = 0; i < count; i++) {
        const period = getBillingPeriodByIndex(anchorDateInput, i);
        const expPay = computeExpectedPaymentDate(period.periodStart, options?.paymentDayOfMonth);
        const draftDate = computeDraftCreationDate({
            expectedPaymentDate: expPay,
            leadTimeUnit: options?.leadTimeUnit ?? 'CALENDAR_MONTHS',
            leadTimeValue: options?.leadTimeValue ?? 1,
            invoiceLeadDays: options?.invoiceLeadDays,
        });

        const periodSpan = `${formatDisplayDate(period.periodStart)} – ${formatDisplayDate(period.periodEnd)}`;
        const label = i < labels.length ? labels[i] : 'Later';
        const displayText = `${label}: ${periodSpan} (draft prepared ${formatDisplayDate(draftDate)})`;

        results.push({
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            draftDate,
            periodSpan,
            label,
            displayText,
        });
    }

    return results;
}

// ─── Full Schedule Calculation ───────────────────────────────────────────────

/**
 * Computes the complete next billing schedule for a config as of reference date `now`.
 *
 * Algorithm:
 * 1. If lastBilledPeriodStart is provided, advance to nextPeriodStart(lastBilledPeriodStart).
 * 2. If no prior billing, periodStart is Period 0 (billingAnchorDate).
 * 3. Period 0 is immediately available for initial/current period draft creation.
 * 4. draftCreationDate is computed via calendar month (default) or custom days.
 */
export function computeBillingSchedule(
    config: BillingScheduleInput,
    now: Date = new Date(),
): BillingSchedule {
    const anchor = toUtcDate(config.billingAnchorDate);
    const originalAnchorDay = anchor.getUTCDate();
    const refDate = toUtcDate(now);

    let periodStart: Date;

    if (config.lastBilledPeriodStart) {
        // A prior cycle has already been processed -> strictly advance to the next cycle
        const lastStart = toUtcDate(config.lastBilledPeriodStart);
        periodStart = nextPeriodStart(lastStart, originalAnchorDay);
    } else {
        // Unbilled / initial setup:
        // Period 0 starts at anchorDate
        periodStart = anchor;
    }

    const periodEnd = computePeriodEnd(periodStart, originalAnchorDay);
    const expectedPaymentDate = computeExpectedPaymentDate(periodStart, config.paymentDayOfMonth);
    const draftCreationDate = computeDraftCreationDate({
        expectedPaymentDate,
        leadTimeUnit: config.leadTimeUnit,
        leadTimeValue: config.leadTimeValue,
        invoiceLeadDays: config.invoiceLeadDays,
    });
    const dueDate = expectedPaymentDate;
    const periodLabel = formatPeriodLabel(periodStart, periodEnd);
    const cycleKey = generateCycleKey(config.id ?? 'config', periodStart);

    return {
        periodStart,
        periodEnd,
        draftCreationDate,
        expectedPaymentDate,
        dueDate,
        periodLabel,
        cycleKey,
    };
}

/**
 * Compute the next billing period with canonical anniversary recurrence.
 * Backwards compatible with legacy computeNextBillingPeriod caller interface.
 */
export function computeNextBillingPeriod(
    config: { billingAnchorDate: Date | string; invoiceLeadDays: number },
    now: Date = new Date(),
): BillingPeriod {
    const anchor = toUtcDate(config.billingAnchorDate);
    const anchorDay = anchor.getUTCDate();
    const refDate = toUtcDate(now);

    // Compute period for refDate month
    const candidateYear = refDate.getUTCFullYear();
    const candidateMonth = refDate.getUTCMonth() + 1;
    const candidateDay = clampToMonthEnd(candidateYear, candidateMonth, anchorDay);
    let candidateStart = createUtcDate(candidateYear, candidateMonth, candidateDay);

    // If anchor is in future, start at anchor
    if (candidateStart < anchor) {
        candidateStart = anchor;
    }

    let invoiceDate = new Date(candidateStart.getTime() - config.invoiceLeadDays * 86_400_000);

    // If scheduled invoice date is past, advance to next month
    if (invoiceDate < refDate) {
        candidateStart = nextPeriodStart(candidateStart, anchorDay);
        invoiceDate = new Date(candidateStart.getTime() - config.invoiceLeadDays * 86_400_000);
    }

    const periodStart = candidateStart;
    const periodEnd = computePeriodEnd(periodStart, anchorDay);
    const dueDate = periodStart;
    const periodLabel = formatPeriodLabel(periodStart, periodEnd);

    return { periodStart, periodEnd, invoiceDate, dueDate, periodLabel };
}
