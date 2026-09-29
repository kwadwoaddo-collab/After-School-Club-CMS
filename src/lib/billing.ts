/**
 * billing.ts
 * Pure, side-effect-free business logic for billing calculations.
 * Backed by the canonical date-engine (date-engine.ts).
 */

import {
    BillingPeriod,
    clampToMonthEnd as engineClampToMonthEnd,
    computeNextBillingPeriod as engineComputeNextBillingPeriod,
    previewBillingPeriods as enginePreviewBillingPeriods,
    LeadTimeUnit,
    formatDisplayDate,
} from '@/lib/billing/date-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { BillingPeriod };

export interface BillingConfig {
    billingAnchorDate: Date | string;
    invoiceLeadDays:   number;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export const clampToMonthEnd = engineClampToMonthEnd;

// ─── Core billing period calculation ─────────────────────────────────────────

/**
 * Compute the next billing period with canonical anniversary recurrence.
 */
export function computeNextBillingPeriod(
    config: BillingConfig,
    now: Date = new Date(),
): BillingPeriod {
    return engineComputeNextBillingPeriod(config, now);
}

/**
 * Generate human-readable preview strings for upcoming billing periods.
 * Used in BillingSettingsCard UI live preview.
 */
export function previewBillingPeriods(
    anchorDate: Date | string,
    count = 4,
    options?: {
        leadTimeUnit?: LeadTimeUnit | null;
        leadTimeValue?: number | null;
        invoiceLeadDays?: number;
        paymentDayOfMonth?: number | null;
    }
): string[] {
    const items = enginePreviewBillingPeriods(anchorDate, count, options);
    return items.map(p => `${p.periodSpan} (draft prepared ${formatDisplayDate(p.draftDate)})`);
}

/** Format pence as a £ string, e.g. 42000 → "£420.00" */
export function penceToPounds(pence: number): string {
    return `£${(pence / 100).toFixed(2)}`;
}

/** Parse a £ string to pence, e.g. "420.00" → 42000 */
export function poundsToPence(pounds: string): number {
    return Math.round(parseFloat(pounds.replace(/[^0-9.]/g, '')) * 100);
}
