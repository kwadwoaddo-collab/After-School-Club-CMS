import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));
import { assertEligibleBillingCoverage, billingServicePeriod } from './finance-eligibility';

describe('confirmed billing coverage', () => {
    it('accepts only a nonempty fully confirmed child selection', () => {
        expect(() => assertEligibleBillingCoverage(['confirmed'], new Set(['confirmed']))).not.toThrow();
    });
    it('refuses mixed siblings instead of charging the unchanged full-family amount', () => {
        expect(() => assertEligibleBillingCoverage(['confirmed', 'prospect'], new Set(['confirmed'])))
            .toThrow(/confirmed signed-up/);
    });
    it('refuses parent-only coverage and wholly unconfirmed coverage', () => {
        expect(() => assertEligibleBillingCoverage([], new Set())).toThrow(/confirmed signed-up/);
        expect(() => assertEligibleBillingCoverage(['prospect'], new Set())).toThrow(/confirmed signed-up/);
    });
});

describe('explicit service periods', () => {
    it('retains exact dates for historical invoice review rather than substituting today', () => {
        expect(billingServicePeriod('2026-09-01', '2026-09-30')).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30' });
    });
    it('refuses one-sided and reversed periods instead of bypassing a scheduled pause', () => {
        expect(() => billingServicePeriod('2026-11-01', null)).toThrow(/both billing period/);
        expect(() => billingServicePeriod('2026-12-01', '2026-11-01')).toThrow(/must not precede/);
    });
    it('keeps undated legacy invoices on the current lifecycle review path', () => {
        expect(billingServicePeriod(null, null)).toBeUndefined();
    });
});
