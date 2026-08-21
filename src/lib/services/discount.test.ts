import { describe, it, expect } from 'vitest';
import { calculateDiscount } from './discount';
import type { DiscountRule } from '@/db/schema';

describe('DiscountService', () => {
  it('applies sibling discount only when siblingCount >= 2', () => {
    const rules: DiscountRule[] = [
      { id: '1', active: true, type: 'sibling', valueType: 'percent', value: 10, label: 'Sibling 10%' }
    ];

    expect(calculateDiscount(rules, 100, 1)).toBe(0);
    expect(calculateDiscount(rules, 100, 2)).toBe(10);
  });

  it('stacks early-bird and sibling discounts correctly', () => {
    const rules: DiscountRule[] = [
      { id: '1', active: true, type: 'sibling', valueType: 'percent', value: 10, label: 'Sibling 10%' },
      { id: '2', active: true, type: 'fixed', valueType: 'fixed', value: 15, label: 'Early Bird £15' }
    ];

    // For 2 siblings on a £100 invoice:
    // Sibling: 10% of 100 = 10
    // Early Bird: fixed 15
    // Total = 25
    expect(calculateDiscount(rules, 100, 2)).toBe(25);
  });

  it('caps discount at baseAmount', () => {
    const rules: DiscountRule[] = [
      { id: '1', active: true, type: 'sibling', valueType: 'percent', value: 50, label: 'Sibling 50%' },
      { id: '2', active: true, type: 'fixed', valueType: 'fixed', value: 60, label: 'Early Bird £60' }
    ];

    // Base = 100. Sibling = 50. EB = 60. Total = 110. Cap = 100.
    expect(calculateDiscount(rules, 100, 2)).toBe(100);
  });
});
