import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Grid, { type FinanceInvoice } from './FinanceDataGridClient';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
    default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
        <a {...props}>{children}</a>
    ),
}));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/finance/actions', () => ({ recordPayment: vi.fn() }));
vi.mock('./CreateInvoiceModal', () => ({ default: () => null }));

const invoice: FinanceInvoice = {
    id: 'nov',
    invoiceNumber: 'INV-NOV',
    organisationId: 'org',
    parentId: 'parent',
    parent: { id: 'parent', firstName: 'Demo', lastName: 'Family' },
    amount: '1900.00',
    status: 'sent',
    invoiceDate: '2026-10-16',
    createdAt: '2026-10-16',
    dueDate: '2026-11-06',
    billingPeriodStart: '2026-11-06',
    billingPeriodEnd: '2026-12-05',
    payments: [{ id: 'reversed', amount: '1900.00', status: 'reversed', recordedAt: '2026-10-15' }],
};

describe('compact invoice row', () => {
    it('uses the existing seven columns for coverage, creation, due date and remaining balance', () => {
        const html = renderToStaticMarkup(<Grid invoices={[invoice]} todayIso="2026-11-18" />);
        expect(html).toContain('Billing period / Due');
        expect(html).toContain('6 Nov – 5 Dec 2026');
        expect(html).toContain('Created ');
        expect(html).toContain('16 Oct 2026');
        expect(html).toContain('Remaining £1,900.00');
        expect(html).toContain('View invoice INV-NOV');
        expect(html.match(/<th class=/g)).toHaveLength(7);
    });

    it('makes review and issuance an explicit navigation step, not an automatic issuance action', () => {
        const html = renderToStaticMarkup(
            <Grid invoices={[{ ...invoice, id: 'dec', invoiceNumber: 'INV-DEC', status: 'draft' }]} todayIso="2026-11-18" />
        );
        expect(html).toContain('Review &amp; issue');
        expect(html).toContain('aria-label="Review and issue invoice INV-DEC"');
        expect(html).toContain('href="/dashboard/finance/invoices/dec"');
        expect(html).toContain('Not issued');
        expect(html).toContain('Draft');
    });

    it('distinguishes upcoming, in-period, overdue past assessment period, and paid in full across badges and KPI cards', () => {
        const upcomingInv: FinanceInvoice = {
            ...invoice,
            id: 'up',
            invoiceNumber: 'INV-UP',
            dueDate: '2026-12-06',
            billingPeriodStart: '2026-12-06',
            billingPeriodEnd: '2027-01-05',
            payments: [],
        };
        const inPeriodPartPaidInv: FinanceInvoice = {
            ...invoice,
            id: 'in-p',
            invoiceNumber: 'INV-INP',
            status: 'partially_paid',
            dueDate: '2026-11-06',
            billingPeriodStart: '2026-11-06',
            billingPeriodEnd: '2026-12-05',
            payments: [{ id: 'p1', amount: '500.00', status: 'verified', recordedAt: '2026-11-10' }],
        };
        const overdueInv: FinanceInvoice = {
            ...invoice,
            id: 'ovd',
            invoiceNumber: 'INV-OVD',
            dueDate: '2026-10-06',
            billingPeriodStart: '2026-10-06',
            billingPeriodEnd: '2026-11-05',
            payments: [],
        };
        const paidInv: FinanceInvoice = {
            ...invoice,
            id: 'paid',
            invoiceNumber: 'INV-PAID',
            status: 'paid',
            dueDate: '2026-09-06',
            billingPeriodStart: '2026-09-06',
            billingPeriodEnd: '2026-10-05',
            payments: [{ id: 'p2', amount: '1900.00', status: 'verified', recordedAt: '2026-09-07T10:00:00Z' }],
        };

        const html = renderToStaticMarkup(
            <Grid invoices={[upcomingInv, inPeriodPartPaidInv, overdueInv, paidInv]} todayIso="2026-11-18" />
        );

        // 4-state visual badges with explicit labels + Part-paid preservation
        expect(html).toContain('Upcoming');
        expect(html).toContain('In period · Part-paid');
        expect(html).toContain('Overdue · Past period');
        expect(html).toContain('Paid in full');

        // KPI cards count strictly past-assessment-period as Overdue (1), and summarize in-period & upcoming in Outstanding
        expect(html).toContain('1 in assessment period · 1 upcoming');
        expect(html).toContain('Past assessment period');
        // Filter buttons include Upcoming and In period
        expect(html).toContain('>In period</button>');
        expect(html).toContain('>Upcoming</button>');
    });

    it('never highlights in-period due dates in alarming rose and reserves rose due dates for overdue past-period invoices', () => {
        const inPeriodHtml = renderToStaticMarkup(
            <Grid invoices={[{ ...invoice, payments: [] }]} todayIso="2026-11-18" />
        );
        expect(inPeriodHtml).toContain('In period · Due');
        expect(inPeriodHtml).not.toContain('Overdue · Past period');
        expect(inPeriodHtml).toContain('text-amber-800 dark:text-amber-200 font-medium');
        expect(inPeriodHtml).not.toContain('text-rose-700 dark:text-rose-300 font-bold');

        const overdueHtml = renderToStaticMarkup(
            <Grid invoices={[{ ...invoice, payments: [] }]} todayIso="2026-12-06" />
        );
        expect(overdueHtml).toContain('Overdue · Past period');
        expect(overdueHtml).toContain('text-rose-700 dark:text-rose-300 font-bold');
    });
});
