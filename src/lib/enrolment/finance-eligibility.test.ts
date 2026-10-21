import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ db: {} }));
import { assertEligibleBillingCoverage } from './finance-eligibility';

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
