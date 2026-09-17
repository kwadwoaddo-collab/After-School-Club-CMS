import { describe, it, expect } from 'vitest';
import { computeNextBillingPeriod } from './billing';

describe('billing.ts — computeNextBillingPeriod (§10)', () => {
    // invoiceLeadDays = 7, anchorDay = 15
    const config = {
        id: 'conf-1',
        organisationId: 'org-1',
        parentId: 'parent-1',
        centreId: 'centre-1',
        agreedMonthlyPence: 10000,
        billingAnchorDate: new Date('2026-01-15T00:00:00Z'),
        invoiceLeadDays: 7,
        status: 'active' as const,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    it('When now < scheduledInvoiceDate: returns CURRENT month period if before invoice date', () => {
        const now = new Date('2026-02-01T00:00:00Z');
        const period = computeNextBillingPeriod(config, now);
        
        expect(period.periodStart.toISOString()).toBe('2026-02-15T00:00:00.000Z');
        expect(period.invoiceDate.toISOString()).toBe('2026-02-08T00:00:00.000Z');
    });

    it('When now === scheduledInvoiceDate: CURRENT month period is returned', () => {
        const now = new Date('2026-02-08T00:00:00Z');
        const period = computeNextBillingPeriod(config, now);
        
        expect(period.periodStart.toISOString()).toBe('2026-02-15T00:00:00.000Z');
        expect(period.invoiceDate.toISOString()).toBe('2026-02-08T00:00:00.000Z');
    });

    it('When now > scheduledInvoiceDate: next period returned', () => {
        const now = new Date('2026-02-09T00:00:00Z');
        const period = computeNextBillingPeriod(config, now);
        
        expect(period.periodStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
        expect(period.invoiceDate.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    });
});
