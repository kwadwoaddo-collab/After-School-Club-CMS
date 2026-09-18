/**
 * date-engine.ts
 *
 * Category B — Billing Scheduler Date Engine.
 * Pure, side-effect-free, deterministic business logic for billing periods,
 * arbitrary cycles, calendar-month lead times, expected payment dates,
 * and stable cycle identification.
 *
 * Governing Principles:
 * - P1: Scheduler decides WHEN. Manager decides WHAT.
 * - P2: Semantic correctness.
 * - Timezone invariant: All internal date calculations use UTC midnight.
 *   Never use local timezone offsets or naive string parsing without UTC.
 */

export type LeadTimeUnit = 'DAYS' | 'CALENDAR_MONTHS';

export interface BillingScheduleInput {
    id?: string;
    billingAnchorDate: Date;
    invoiceLeadDays?: number;
    leadTimeUnit?: LeadTimeUnit | null;
    leadTimeValue?: number | null;
    paymentDayOfMonth?: number | null;
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
    return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Normalises an input (Date or 'YYYY-MM-DD' string) to a UTC midnight Date.
 */
export function toUtcDate(input: Date | string): Date {
    if (input instanceof Date) {
        return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
    }
    const [y, m, d] = input.split('T')[0].split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
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

// ─── Calendar Month Arithmetic (§22) ─────────────────────────────────────────

/**
 * Subtracts N calendar months from a date according to the Stage B §22 specification:
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

// ─── Period Recurrence Algorithm (§20) ───────────────────────────────────────

/**
 * Calculates the start of the next assessment period given the current period start and intended anchorDay.
 * anchorDay (1–31) is the intended day-of-month and re-asserts after shorter months (e.g. Feb 28 -> Mar 31).
 */
export function nextPeriodStart(currentStart: Date, anchorDay: number): Date {
    let nextMonth = currentStart.getUTCMonth() + 2; // +1 for 1-index, +1 for next month
    let nextYear = currentStart.getUTCFullYear();

    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
    }

    const clampedDay = clampToMonthEnd(nextYear, nextMonth, anchorDay);
    return createUtcDate(nextYear, nextMonth, clampedDay);
}

/**
 * Calculates period end as one day before next period start (§20).
 * periodEnd(n) = periodStart(n+1) - 1 day.
 */
export function computePeriodEnd(periodStart: Date, anchorDay: number): Date {
    const nextStart = nextPeriodStart(periodStart, anchorDay);
    return new Date(nextStart.getTime() - 86_400_000);
}

// ─── Expected Payment Date (§21) ─────────────────────────────────────────────

/**
 * Calculates the expected payment date (§21).
 * When paymentDayOfMonth is specified (1–31):
 *   Returns the Nth day of the month containing nextPeriodStart, clamped to month end.
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

// ─── Draft Creation / Invoice Date Calculation (§22, §23) ────────────────────

/**
 * Calculates draft generation date by subtracting lead time from expected payment date (§23).
 * Supports:
 * - CALENDAR_MONTHS (default for new Category B configs, usually 1 month)
 * - DAYS (e.g. 7 days or custom day count)
 * - Legacy fallback to invoiceLeadDays (default 7 days)
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
        const days = leadTimeValue !== undefined && leadTimeValue !== null ? leadTimeValue : 7;
        return new Date(expectedPaymentDate.getTime() - days * 86_400_000);
    }

    const fallbackDays = invoiceLeadDays !== undefined && invoiceLeadDays !== null ? invoiceLeadDays : 7;
    return new Date(expectedPaymentDate.getTime() - fallbackDays * 86_400_000);
}

// ─── Period Label Formatting ─────────────────────────────────────────────────

/**
 * Formats a period label cleanly.
 * If period spans exactly a full calendar month (1st to last day): "September 2026".
 * If arbitrary period (e.g. 4 Sep to 3 Oct): "4 Sep 2026 to 3 Oct 2026".
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
 * Stable, canonical cycle identifier: `${configId}:${YYYY-MM-DD}` (§9, §26).
 */
export function generateCycleKey(configId: string, periodStart: Date): string {
    return `${configId}:${formatIsoDate(periodStart)}`;
}

// ─── Full Schedule Calculation (§20–§23) ─────────────────────────────────────

/**
 * Computes the complete next billing schedule for a config as of reference date `now`.
 *
 * Algorithm:
 * 1. Extract anchorDay from billingAnchorDate.
 * 2. Start from candidate period in reference month (or billingAnchorDate if future).
 * 3. Calculate candidate period dates and draft creation date.
 * 4. If draftCreationDate >= now, this is the current due period.
 * 5. If draftCreationDate < now, advance candidate period month by month until draftCreationDate >= now.
 */
export function computeBillingSchedule(
    config: BillingScheduleInput,
    now: Date = new Date(),
): BillingSchedule {
    const anchorDate = toUtcDate(config.billingAnchorDate);
    const anchorDay = anchorDate.getUTCDate();
    const refDate = toUtcDate(now);

    let year = refDate.getUTCFullYear();
    let month = refDate.getUTCMonth() + 1;

    // Check candidate starting in current month
    let candidateStart = createUtcDate(year, month, clampToMonthEnd(year, month, anchorDay));

    // If billingAnchorDate is in the future relative to candidateStart, start at anchorDate month
    if (candidateStart < anchorDate) {
        year = anchorDate.getUTCFullYear();
        month = anchorDate.getUTCMonth() + 1;
        candidateStart = createUtcDate(year, month, clampToMonthEnd(year, month, anchorDay));
    }

    const computeDraftForStart = (start: Date): { draftDate: Date; expectedPaymentDate: Date } => {
        const expPay = computeExpectedPaymentDate(start, config.paymentDayOfMonth);
        const draft = computeDraftCreationDate({
            expectedPaymentDate: expPay,
            leadTimeUnit: config.leadTimeUnit,
            leadTimeValue: config.leadTimeValue,
            invoiceLeadDays: config.invoiceLeadDays,
        });
        return { draftDate: draft, expectedPaymentDate: expPay };
    };

    let { draftDate, expectedPaymentDate } = computeDraftForStart(candidateStart);

    // If draftDate is in the past relative to refDate (and candidateStart < refDate), advance
    // Note: A15 rule: if draftDate >= refDate, keep candidateStart. If draftDate < refDate, advance.
    if (draftDate < refDate) {
        candidateStart = nextPeriodStart(candidateStart, anchorDay);
        const nextComputed = computeDraftForStart(candidateStart);
        draftDate = nextComputed.draftDate;
        expectedPaymentDate = nextComputed.expectedPaymentDate;
    }

    const periodStart = candidateStart;
    const periodEnd = computePeriodEnd(periodStart, anchorDay);
    const dueDate = expectedPaymentDate;
    const periodLabel = formatPeriodLabel(periodStart, periodEnd);
    const cycleKey = generateCycleKey(config.id ?? 'config', periodStart);

    return {
        periodStart,
        periodEnd,
        draftCreationDate: draftDate,
        expectedPaymentDate,
        dueDate,
        periodLabel,
        cycleKey,
    };
}
