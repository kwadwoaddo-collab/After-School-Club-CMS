import { describe, expect, it } from 'vitest';
import { buildFamilyBillingSummary, type FamilyInvoiceInput } from './family-summary';
const invoice = (id: string, start: string, end: string, status = 'sent', extra: Partial<FamilyInvoiceInput> = {}): FamilyInvoiceInput => ({
    id, invoiceNumber: id, organisationId: 'org', centreId: 'centre', parentId: 'parent', billingConfigId: 'config',
    billingPeriodStart: start, billingPeriodEnd: end, dueDate: start, createdAt: '2026-10-22', amount: '1900.00', status, payments: [], ...extra,
});
const summary = (invoices: FamilyInvoiceInput[], extra: Partial<Parameters<typeof buildFamilyBillingSummary>[0]> = {}) => buildFamilyBillingSummary({
    organisationId: 'org', centreId: 'centre', parentId: 'parent', billingConfigId: 'config', invoices,
    now: new Date('2026-10-24T12:00:00Z'), scheduleStart: '2027-01-06', draftCreationDate: '2026-12-30', baseStatus: 'ready', ...extra,
});
describe('family billing clarity', () => {
    it('keeps current paid coverage, future issued debt, later draft and next missing schedule distinct', () => {
        const result = summary([
            invoice('oct', '2026-10-06', '2026-11-05', 'paid', { payments: [{ amount: '1900.00', status: 'verified' }] }),
            invoice('nov', '2026-11-06', '2026-12-05'), invoice('dec', '2026-12-06', '2027-01-05', 'draft'),
        ]);
        expect(result.currentInvoices.map(i => i.id)).toEqual(['oct']);
        expect(result.nextInvoice?.id).toBe('nov');
        expect(result.drafts.map(i => i.id)).toEqual(['dec']);
        expect(result.outstandingPence).toBe(190000);
        expect(result.action).toBe('draft_review');
    });
    it('does not label a future first configured period as current coverage', () => {
        const result = summary([invoice('future', '2026-11-01', '2026-11-30', 'draft')], {currentPeriodStart:'2026-11-01', currentPeriodEnd:'2026-11-30'});
        expect(result.currentPeriodState).toBe('not_started');
        expect(result.currentInvoices).toEqual([]);
        expect(result.nextInvoice?.id).toBe('future');
    });
    it('orders previous invoice by coverage, never recent creation of a historical invoice', () => {
        const result = summary([invoice('old', '2025-01-06', '2025-02-05', 'sent', { createdAt: '2026-10-24' }), invoice('recent', '2026-09-06', '2026-10-05')]);
        expect(result.previousInvoice?.id).toBe('recent');
    });
    it('counts only verified allocations and preserves reversed/pending history without declaring payment', () => {
        const result = summary([invoice('bill', '2026-10-06', '2026-11-05', 'partially_paid', { payments: [
            { amount: '0.10', status: 'verified' }, { amount: '0.20', status: 'verified' },
            { amount: '1900.00', status: 'reversed' }, { amount: '1900.00', status: 'pending' },
        ] })]);
        expect(result.currentInvoices[0]).toMatchObject({ paidPence: 30, balancePence: 189970, paymentStatus: 'partially_paid' });
    });
    it('flags paid status inconsistent with verified ledger and missing coverage', () => {
        const result = summary([invoice('bad', '2026-10-06', '2026-11-05', 'paid'), invoice('missing', '2026-09-06', '2026-10-05', 'sent', { billingPeriodStart: null })]);
        expect(result.needsReview).toBe(true);
        expect(result.action).toBe('data_review_required');
        expect(result.history.find(i => i.id === 'missing')?.periodStart).toBeNull();
    });
    it('does not call a future preparation date ready and includes its exact UTC date', () => {
        expect(summary([]).action).toBe('scheduled');
        expect(summary([], { draftCreationDate: '2026-10-24T00:00:00.000Z' }).action).toBe('draft_due');
    });
    it('prefers replacement to void for the same previous period, retains void in history and excludes its balance', () => {
        const result = summary([invoice('a-void', '2026-09-06', '2026-10-05', 'void'), invoice('z-replacement', '2026-09-06', '2026-10-05')]);
        expect(result.previousInvoice?.id).toBe('z-replacement');
        expect(result.history).toHaveLength(2);
        expect(result.outstandingInvoices.map(i => i.id)).toEqual(['z-replacement']);
    });
    it('preserves outstanding debt but prevents preparation when paused or skipped', () => {
        for (const baseStatus of ['paused', 'skipped'] as const) {
            const result = summary([invoice('debt', '2026-09-06', '2026-10-05')], { baseStatus });
            expect(result.action).toBe(baseStatus);
            expect(result.outstandingPence).toBe(190000);
        }
    });
    it('isolates tenant, centre, family and other configuration while accepting legacy manual invoices', () => {
        const base = invoice('valid', '2026-09-06', '2026-10-05', 'sent', { billingConfigId: null });
        const result = summary([base, { ...base, id: 'wrong-centre', centreId: 'other' }, { ...base, id: 'wrong-org', organisationId: 'other' },
            { ...base, id: 'wrong-parent', parentId: 'other' }, { ...base, id: 'wrong-config', billingConfigId: 'other' }]);
        expect(result.history.map(i => i.id)).toEqual(['valid']);
    });
    it('distinguishes an explicit current-period skip from a missing invoice and voided coverage', () => {
        const result = summary([invoice('void', '2026-10-06', '2026-11-05', 'void')], {
            currentPeriodStart: '2026-10-06', currentPeriodEnd: '2026-11-05', currentPeriodSkipped: true,
        });
        expect(result.currentPeriodState).toBe('skipped');
        expect(result.currentPeriodStart).toBe('2026-10-06');
        expect(result.currentInvoices[0].status).toBe('void');
        expect(summary([], { currentPeriodSkipped: false }).currentPeriodState).toBe('no_invoice');
        expect(summary([], { baseStatus: 'paused', currentPeriodSkipped: true }).currentPeriodState).toBe('paused');
    });
    it.each(['garbage', '-10.00', '9007199254740992.00'])('flags invalid stored amount %s rather than silently showing paid', amount => {
        const result = summary([invoice('invalid', '2026-10-06', '2026-11-05', 'sent', { amount })]);
        expect(result.currentInvoices[0].paymentStatus).toBe('needs_review');
        expect(result.action).toBe('data_review_required');
    });
    it('flags invalid verified payments and overpayments rather than assuming paid', () => {
        for (const amount of ['-1.00', 'oops', '1901.00']) {
            const result = summary([invoice('invalid', '2026-10-06', '2026-11-05', 'sent', { payments: [{ amount, status: 'verified' }] })]);
            expect(result.currentInvoices[0].paymentStatus).toBe('needs_review');
            expect(result.needsReview).toBe(true);
            expect(result.outstandingReliable).toBe(false);
        }
    });
    it('refuses to present an unsafe aggregate outstanding total as a reliable balance', () => {
        const result = summary([
            invoice('large-one', '2026-07-06', '2026-08-05', 'sent', { amount: '45035996273704.95' }),
            invoice('large-two', '2026-08-06', '2026-09-05', 'sent', { amount: '45035996273704.95' }),
            invoice('large-three', '2026-09-06', '2026-10-05', 'sent', { amount: '10.00' }),
        ]);
        expect(result.outstandingReliable).toBe(false);
        expect(result.action).toBe('data_review_required');
    });
    it('flags overlapping active recurring invoices without flagging void replacements', () => {
        expect(summary([invoice('one', '2026-10-06', '2026-11-05'), invoice('two', '2026-10-20', '2026-11-19')]).needsReview).toBe(true);
        expect(summary([invoice('one', '2026-10-06', '2026-11-05'), invoice('two', '2026-10-06', '2026-11-05', 'void')]).needsReview).toBe(false);
    });
});
