import { describe, expect, it } from 'vitest';
import {
    collectionStagePriority,
    evaluateInvoiceCollectionState,
    invoiceUtcDay,
    resolveCollectionWindow,
    resolveOpenAgingStage,
    toLondonBusinessDate,
    type InvoiceCollectionInput,
} from './invoice-collection-state';

const baseInvoice = (overrides: Partial<InvoiceCollectionInput> = {}): InvoiceCollectionInput => ({
    amount: '1600.00',
    status: 'sent',
    billingPeriodStart: '2026-11-01T00:00:00.000Z',
    billingPeriodEnd: '2026-11-30T00:00:00.000Z',
    dueDate: '2026-11-01T00:00:00.000Z',
    payments: [],
    ...overrides,
});

describe('invoice-collection-state (4-state assessment-period tracking)', () => {
    it('extracts UTC date slices reliably and formats Europe/London business date', () => {
        expect(invoiceUtcDay('2026-11-01T00:00:00.000Z')).toBe('2026-11-01');
        expect(invoiceUtcDay('2026-11-15')).toBe('2026-11-15');
        expect(invoiceUtcDay(null)).toBeNull();
        // 23:30 UTC during BST (June) is already the next day in London
        expect(toLondonBusinessDate(new Date('2026-06-15T23:30:00.000Z'))).toBe('2026-06-16');
    });

    it('classifies advance-issued invoice before period start as Upcoming (Blue/Sky)', () => {
        const state = evaluateInvoiceCollectionState(baseInvoice(), '2026-10-15');
        expect(state.stage).toBe('upcoming');
        expect(state.tone).toBe('info');
        expect(state.staffLabel).toBe('Upcoming · Issued in advance');
        expect(state.parentLabel).toBe('Upcoming');
    });

    it('classifies Day 1 through final day of assessment period as In Period (Yellow/Amber), NEVER Overdue', () => {
        const dayOne = evaluateInvoiceCollectionState(baseInvoice(), '2026-11-01');
        expect(dayOne.stage).toBe('in_period');
        expect(dayOne.tone).toBe('warning');
        expect(dayOne.staffLabel).toBe('In period · Due');
        expect(dayOne.parentLabel).toBe('Assessment period · Payment due');

        const midMonth = evaluateInvoiceCollectionState(baseInvoice(), '2026-11-17');
        expect(midMonth.stage).toBe('in_period');

        const finalDay = evaluateInvoiceCollectionState(baseInvoice(), '2026-11-30');
        expect(finalDay.stage).toBe('in_period');
    });

    it('classifies day after assessment period ends as Overdue (Red/Rose)', () => {
        const afterPeriod = evaluateInvoiceCollectionState(baseInvoice(), '2026-12-01');
        expect(afterPeriod.stage).toBe('overdue');
        expect(afterPeriod.tone).toBe('danger');
        expect(afterPeriod.staffLabel).toBe('Overdue · Past period');
        expect(afterPeriod.parentLabel).toBe('Overdue · Past assessment period');
    });

    it('classifies fully verified paid invoice as Paid in full (Green) regardless of dates', () => {
        const paid = evaluateInvoiceCollectionState(
            baseInvoice({
                status: 'paid',
                payments: [
                    { amount: '600.00', status: 'verified', recordedAt: '2026-11-05T10:00:00Z' },
                    { amount: '1000.00', status: 'verified', recordedAt: '2026-12-04T10:00:00Z' },
                ],
            }),
            '2026-12-10',
        );
        expect(paid.stage).toBe('paid');
        expect(paid.tone).toBe('success');
        expect(paid.remainingPence).toBe(0);
        expect(paid.staffLabel).toBe('Paid in full');
    });

    it('preserves Part-paid indicator across Upcoming, In Period, and Overdue transitions', () => {
        const partial = baseInvoice({
            status: 'partially_paid',
            payments: [{ amount: '1280.00', status: 'verified', recordedAt: '2026-10-20T09:00:00Z' }],
        });

        const pre = evaluateInvoiceCollectionState(partial, '2026-10-25');
        expect(pre.stage).toBe('upcoming');
        expect(pre.isPartPaid).toBe(true);
        expect(pre.remainingPence).toBe(32000);
        expect(pre.staffLabel).toBe('Upcoming · Part-paid');

        const mid = evaluateInvoiceCollectionState(partial, '2026-11-10');
        expect(mid.stage).toBe('in_period');
        expect(mid.staffLabel).toBe('In period · Part-paid');
        expect(mid.parentLabel).toBe('Assessment period · Part-paid');

        const post = evaluateInvoiceCollectionState(partial, '2026-12-05');
        expect(post.stage).toBe('overdue');
        expect(post.staffLabel).toBe('Overdue · Part-paid');
        expect(post.parentLabel).toBe('Overdue · Part-paid');
    });

    it('tracks pending TFC / voucher claims without prematurely reducing verified remaining balance', () => {
        const withPendingVoucher = baseInvoice({
            payments: [{ amount: '1600.00', status: 'pending', recordedAt: '2026-11-28T14:00:00Z' }],
        });
        const state = evaluateInvoiceCollectionState(withPendingVoucher, '2026-11-29');
        expect(state.stage).toBe('in_period');
        expect(state.remainingPence).toBe(160000);
        expect(state.hasPendingPayment).toBe(true);
        expect(state.pendingPence).toBe(160000);
    });

    it('respects custom paymentDayOfMonth inside period and extended dueDate past periodEnd', () => {
        const midMonthDue = resolveCollectionWindow({
            billingPeriodStart: '2026-11-01',
            billingPeriodEnd: '2026-11-30',
            dueDate: '2026-11-15',
        });
        expect(midMonthDue.yellowStart).toBe('2026-11-15');
        expect(midMonthDue.redCutoff).toBe('2026-11-30');
        expect(resolveOpenAgingStage(
            { billingPeriodStart: '2026-11-01', billingPeriodEnd: '2026-11-30', dueDate: '2026-11-15' },
            '2026-11-10',
        )).toBe('upcoming');

        const extendedDue = resolveCollectionWindow({
            billingPeriodStart: '2026-11-01',
            billingPeriodEnd: '2026-11-30',
            dueDate: '2026-12-10',
        });
        expect(extendedDue.yellowStart).toBe('2026-11-01');
        expect(extendedDue.redCutoff).toBe('2026-12-10');
        expect(resolveOpenAgingStage(
            { billingPeriodStart: '2026-11-01', billingPeriodEnd: '2026-11-30', dueDate: '2026-12-05' },
            '2026-12-03',
        )).toBe('in_period');
    });

    it('falls back cleanly to dueDate for ad-hoc / one-off invoices without assessment period', () => {
        const oneOff = baseInvoice({
            billingPeriodStart: null,
            billingPeriodEnd: null,
            dueDate: '2026-11-15',
        });
        expect(evaluateInvoiceCollectionState(oneOff, '2026-11-14').stage).toBe('upcoming');
        const onDue = evaluateInvoiceCollectionState(oneOff, '2026-11-15');
        expect(onDue.stage).toBe('in_period');
        expect(onDue.staffLabel).toBe('Due today');
        const afterDue = evaluateInvoiceCollectionState(oneOff, '2026-11-16');
        expect(afterDue.stage).toBe('overdue');
        expect(afterDue.staffLabel).toBe('Overdue');
    });

    it('routes overpayments, inverted periods, and corrupt totals to needs_checking', () => {
        const overpaid = evaluateInvoiceCollectionState(
            baseInvoice({
                status: 'paid',
                payments: [{ amount: '1700.00', status: 'verified' }],
            }),
            '2026-11-15',
        );
        expect(overpaid.stage).toBe('needs_checking');

        const invertedPeriod = evaluateInvoiceCollectionState(
            baseInvoice({
                billingPeriodStart: '2026-12-01',
                billingPeriodEnd: '2026-11-01',
            }),
            '2026-11-15',
        );
        expect(invertedPeriod.stage).toBe('needs_checking');
    });

    it('orders urgency priority: overdue < in_period < upcoming < needs_checking', () => {
        expect(collectionStagePriority('overdue')).toBeLessThan(collectionStagePriority('in_period'));
        expect(collectionStagePriority('in_period')).toBeLessThan(collectionStagePriority('upcoming'));
        expect(collectionStagePriority('upcoming')).toBeLessThan(collectionStagePriority('needs_checking'));
    });
});
