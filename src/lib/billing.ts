/**
 * billing.ts
 * Pure, side-effect-free business logic for billing calculations.
 * Backed by the canonical date-engine (date-engine.ts).
 */

import {
    BillingPeriod,
    computeNextBillingPeriod as engineComputeNextBillingPeriod,
} from '@/lib/billing/date-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { BillingPeriod };

// ─── Core billing period calculation ─────────────────────────────────────────

/**
 * Compute the next billing period with canonical anniversary recurrence.
 */
export function computeNextBillingPeriod(
    config: { billingAnchorDate: Date | string; invoiceLeadDays: number },
    now: Date = new Date(),
): BillingPeriod {
    return engineComputeNextBillingPeriod(config, now);
}

/** Format pence as a £ string, e.g. 42000 → "£420.00" */
export function penceToPounds(pence: number): string {
    return `£${(pence / 100).toFixed(2)}`;
}

/** Parse a £ string to pence, e.g. "420.00" → 42000 */
export function poundsToPence(pounds: string): number {
    return Math.round(parseFloat(pounds.replace(/[^0-9.]/g, '')) * 100);
}
