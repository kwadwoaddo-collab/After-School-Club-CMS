import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FamilyBillingSummary from './FamilyBillingSummary';
import type { FamilyBillingSummary as Summary, FamilyInvoiceSummary } from '../queries';

const invoice = (id: string, overrides: Partial<FamilyInvoiceSummary> = {}): FamilyInvoiceSummary => ({ id, invoiceNumber: `INV-${id}`, periodStart: '2026-10-06', periodEnd: '2026-11-05', dueDate: '2026-10-06', createdAt: '2026-10-01', amountPence: 190000, paidPence: 0, balancePence: 190000, status: 'issued', paymentStatus: 'unpaid', overdue: false, needsReview: false, coveredChildren: [], ...overrides });
const current = invoice('oct', { paidPence: 190000, balancePence: 0, paymentStatus: 'paid' });
const next = invoice('nov', { periodStart: '2026-11-06', periodEnd: '2026-12-05', dueDate: '2026-11-06' });
const draft = invoice('dec', { periodStart: '2026-12-06', periodEnd: '2027-01-05', dueDate: '2026-12-06', paymentStatus: 'not_issued', status: 'draft' });
const summary: Summary = { currentPeriodStart: '2026-10-06', currentPeriodEnd: '2026-11-05', currentPeriodState: 'invoiced', previousInvoice: null, currentInvoices: [current], nextInvoice: next, drafts: [draft], outstandingInvoices: [next], outstandingPence: 190000, outstandingReliable: true, history: [draft, next, current], needsReview: false, reviewReasons: [], action: 'draft_review' };

describe('family invoice summary', () => {
    it('shows current paid, next issued unpaid and later draft together, without treating drafts as debt', () => {
        const html = renderToStaticMarkup(<FamilyBillingSummary summary={summary} />);
        expect(html).toContain('Current billing period');
        expect(html).toContain('6 Oct 2026');
        expect(html).toContain('Issued — unpaid');
        expect(html).toContain('Draft — not issued');
        expect(html).toContain('Total outstanding: £1,900.00');
        expect(html).toContain('Drafts excluded.');
        expect(html).not.toContain('£3,800.00');
        expect(html).toContain('/dashboard/finance/invoices/oct');
        expect(html).toContain('/dashboard/finance/invoices/nov');
        expect(html).toContain('/dashboard/finance/invoices/dec');
        expect(html).toContain('payment ledger, receipts and reversals');
    });
    it('collapses supporting records by default while keeping balances and overdue warnings outside the disclosure', () => {
        const overdue={...next,overdue:true};
        const html=renderToStaticMarkup(<FamilyBillingSummary summary={{...summary,outstandingInvoices:[overdue]}}><p>Supporting children and schedule</p></FamilyBillingSummary>);
        const disclosure=html.indexOf('Show billing details');
        expect(html.indexOf('Outstanding: £1,900.00')).toBeLessThan(disclosure);
        expect(html.indexOf('1 overdue invoice')).toBeLessThan(disclosure);
        expect(html.indexOf('Supporting children and schedule')).toBeGreaterThan(disclosure);
        expect(html).not.toMatch(/<details[^>]*\sopen/);
    });
    it('warns about historical drafts without calling them upcoming', () => {
        const historical = invoice('historical', {status:'draft', paymentStatus:'not_issued', historical:true});
        const html = renderToStaticMarkup(<FamilyBillingSummary summary={{...summary, drafts:[historical]}} />);
        expect(html).toContain('Historical billing period — review before issuing.');
        expect(html).toContain('Next invoice and unissued drafts');
        expect(html).not.toContain('Upcoming invoices');
    });
    it('describes future initial coverage as scheduled, not current or missing', () => {
        const html=renderToStaticMarkup(<FamilyBillingSummary summary={{...summary, currentPeriodState:'not_started', currentInvoices:[],currentPeriodStart:'2026-11-01',currentPeriodEnd:'2026-11-30'}}/>);
        expect(html).toContain('First scheduled billing period');
        expect(html).toContain('Recurring billing has not started yet.');
        expect(html).not.toContain('Current billing period');
        expect(html).not.toContain('No active invoice is recorded');
    });
    it('keeps several outstanding periods accessible, including older part-paid debt', () => {
        const older = invoice('older', { periodStart: '2026-08-06', periodEnd: '2026-09-05', paidPence: 100000, balancePence: 90000, paymentStatus: 'partially_paid', overdue: true });
        const html = renderToStaticMarkup(<FamilyBillingSummary summary={{ ...summary, outstandingInvoices: [older, next], outstandingPence: 280000, history: [older, ...summary.history] }} />);
        expect(html).toContain('All outstanding invoices (2)');
        expect(html).toContain('£2,800.00');
        expect(html).toContain('Remaining £900.00');
        expect(html).toContain('Overdue');
        expect(html).toContain('/dashboard/finance/invoices/older');
    });
    it('distinguishes skipped current coverage from old invoice history and labels invalid amounts honestly', () => {
        const invalid = invoice('invalid', { paymentStatus: 'needs_review', needsReview: true });
        const html = renderToStaticMarkup(<FamilyBillingSummary summary={{ ...summary, currentPeriodState: 'skipped', currentInvoices: [], history: [invalid], needsReview: true, outstandingReliable: false }} />);
        expect(html).toContain('This billing period was skipped.');
        expect(html).toContain('6 Oct 2026');
        expect(html).toContain('Invoice amounts or payment records need review.');
        expect(html).toContain('Outstanding total needs review');
    });
    it('shows missing periods and data review honestly and preserves void history', () => {
        const voided = invoice('void', { paymentStatus: 'void', status: 'void' });
        const html = renderToStaticMarkup(<FamilyBillingSummary summary={{ ...summary, currentInvoices: [], currentPeriodState: 'no_invoice', previousInvoice: voided, needsReview: true, reviewReasons: ['Missing billing dates.'], history: [voided] }} />);
        expect(html).toContain('No active invoice is recorded for this period.');
        expect(html).toContain('Missing billing dates.');
        expect(html).toContain('Void');
        expect(html).toContain('Previous billed period');
    });
});
