import { describe, it, expect } from 'vitest';
import { calculateDiscount } from './discount';
import type { DiscountRule } from '@/db/schema';

describe('DiscountService', () => {
  it('applies sibling discount only when siblingCount >= 2', () => {
    const rules: DiscountRule[] = [
      { id: '1', active: true, type: 'sibling', valueType: 'percent', value: 10, name: 'Sibling 10%', organisationId: 'org-1', createdAt: new Date(), updatedAt: new Date() }
    ];

    expect(calculateDiscount(rules, 100, 1)).toBe(0);
    expect(calculateDiscount(rules, 100, 2)).toBe(10);
  });

  it('stacks early-bird and sibling discounts correctly', () => {
    const rules: DiscountRule[] = [
      { id: '1', active: true, type: 'sibling', valueType: 'percent', value: 10, name: 'Sibling 10%', organisationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
      { id: '2', active: true, type: 'early_bird', valueType: 'fixed', value: 15, name: 'Early Bird £15', organisationId: 'org-1', createdAt: new Date(), updatedAt: new Date() }
    ];

    // For 2 siblings on a £100 invoice:
    // Sibling: 10% of 100 = 10
    // Early Bird: fixed 15
    // Total = 25
    expect(calculateDiscount(rules, 100, 2)).toBe(25);
  });

  it('caps discount at baseAmount', () => {
    const rules: DiscountRule[] = [
      { id: '1', active: true, type: 'sibling', valueType: 'percent', value: 50, name: 'Sibling 50%', organisationId: 'org-1', createdAt: new Date(), updatedAt: new Date() },
      { id: '2', active: true, type: 'early_bird', valueType: 'fixed', value: 60, name: 'Early Bird £60', organisationId: 'org-1', createdAt: new Date(), updatedAt: new Date() }
    ];

    // Base = 100. Sibling = 50. EB = 60. Total = 110. Cap = 100.
    expect(calculateDiscount(rules, 100, 2)).toBe(100);
  });
});
