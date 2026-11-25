import type { DiscountRule } from '@/db/schema';

/**
 * Calculate the total discount amount for a given set of rules.
 *
 * @param rules        - Active discount rules configured by the org
 * @param baseAmount   - Gross invoice amount in £ (before discount)
 * @param siblingCount - Number of children on the same invoice / same family billing period
 * @returns Discount amount in £ (capped at baseAmount, never negative, 2-decimal precision)
 */
export function calculateDiscount(
  rules: DiscountRule[],
  baseAmount: number,
  siblingCount: number
): number {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0 || !Array.isArray(rules)) {
    return 0;
  }

  const activeRules = rules.filter((r) => Boolean(r && r.active));

  let totalDiscount = 0;

  for (const rule of activeRules) {
    if (!Number.isFinite(rule.value) || rule.value <= 0) continue;

    // Sibling discount only applies when 2+ children are on the invoice
    if (rule.type === 'sibling' && siblingCount < 2) continue;

    // We assume early_bird rule logic is pre-validated by the caller before being
    // passed into this function (e.g., caller checks earlyBirdCutoffDate).
    // If it's passed here as active, we apply it.

    let ruleDiscount = 0;
    if (rule.valueType === 'percent') {
      const clampedPercent = Math.min(rule.value, 100);
      ruleDiscount = (baseAmount * clampedPercent) / 100;
    } else {
      // fixed £ amount
      ruleDiscount = rule.value;
    }

    totalDiscount += ruleDiscount;
  }

  const roundedDiscount = Math.round(totalDiscount * 100) / 100;
  // Cap: total discount cannot exceed the base amount (invoice can't go below £0)
  return Math.max(0, Math.min(roundedDiscount, Math.max(0, baseAmount)));
}
