import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/features/billing/actions', () => ({ generateEligibleDraftFromConfig: vi.fn(), skipBillingCycle: vi.fn(), unskipBillingCycle: vi.fn() }));
vi.mock('./GenerateInvoiceModal', () => ({ default: () => null }));
vi.mock('./BulkInvoiceConfirmModal', () => ({ default: () => null }));
import BillingCyclesTab from './BillingCyclesTab';
import type { BillingCycleRow } from '../queries';
const row = (id: string, cycleStatus: BillingCycleRow['cycleStatus']): BillingCycleRow => ({ config: { id, parentId: id, centreId: 'centre', agreedMonthlyPence: 190000, billingAnchorDate: '2026-10-06', invoiceLeadDays: 7, status: 'active', notes: null }, familyName: `Family ${id}`, parentEmail: 'dummy@example.test', centreName: 'Test centre', coveredChildren: [], amountDisplay: '£1,900.00', periodLabel: '6 Jan–5 Feb 2027', nextInvoiceDateStr: '2026-12-30', dueDateStr: '2027-01-06', lastRunAt: '2026-10-22', lastRunPeriodStart: '2026-12-06', cycleStatus });
describe('billing preparation clarity', () => {
    it('counts only genuinely due preparation and explains scheduled cycles without implying an issue date', () => {
        const html = renderToStaticMarkup(<BillingCyclesTab cycles={[row('due', 'draft_due'), row('future', 'scheduled'), row('draft', 'draft_review')]} centreId="centre" />);
        expect(html).toContain('Prepare eligible drafts (1)');
        expect(html).toContain('Draft preparation date for this schedule: 30 Dec 2026');
        expect(html).toContain('No action is needed for this future cycle.');
        expect(html).toContain('A draft already exists.');
        expect(html).toContain('not an invoice issuance deadline');
        expect(html).toContain('Next billing schedule');
        expect(html).not.toContain('Last invoice');
        expect(html).not.toContain('Invoice Sent');
        expect(html).not.toContain('Generate All');
        expect(html).toContain('Preparing drafts and issuing them are separate actions.');
    });
    it('exposes review and paused family filters when needed', () => {
        const html = renderToStaticMarkup(<BillingCyclesTab cycles={[row('review', 'data_review_required'), row('paused', 'paused')]} centreId="centre" />);
        expect(html).toContain('Needs review');
        expect(html).toContain('Paused');
    });
    it('offers no bulk preparation when every family is scheduled', () => {
        const html = renderToStaticMarkup(<BillingCyclesTab cycles={[row('future', 'scheduled')]} centreId="centre" />);
        expect(html).not.toContain('Prepare eligible drafts (');
    });
});
