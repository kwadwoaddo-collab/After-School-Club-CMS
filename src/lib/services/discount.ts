import type { DiscountRule } from '@/db/schema';

/**
 * Calculate the total discount amount for a given set of rules.
 *
 * @param rules        - Active discount rules configured by the org
 * @param baseAmount   - Gross invoice amount in £ (before discount)
 * @param siblingCount - Number of children on the same invoice / same family billing period
 * @returns Discount amount in £ (capped at baseAmount, never negative)
 */
export function calculateDiscount(
  rules: DiscountRule[],
  baseAmount: number,
  siblingCount: number
): number {
  const activeRules = rules.filter((r) => r.active);

  let totalDiscount = 0;

  for (const rule of activeRules) {
    // Sibling discount only applies when 2+ children are on the invoice
    if (rule.type === 'sibling' && siblingCount < 2) continue;

    // We assume early_bird rule logic is pre-validated by the caller before being 
    // passed into this function (e.g., caller checks earlyBirdCutoffDate).
    // If it's passed here as active, we apply it.

    let ruleDiscount = 0;
    if (rule.valueType === 'percent') {
      ruleDiscount = (baseAmount * rule.value) / 100;
    } else {
      // fixed £ amount
      ruleDiscount = rule.value;
    }

    totalDiscount += ruleDiscount;
  }

  // Cap: total discount cannot exceed the base amount (invoice can't go below £0)
  return Math.min(totalDiscount, baseAmount);
}
