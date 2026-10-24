// @vitest-environment jsdom
import React from 'react';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BulkInvoiceConfirmModal from './BulkInvoiceConfirmModal';
import type { BillingCycleRow } from '../queries';
vi.mock('next/link', () => ({ default: ({children, ...props}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
});
afterEach(cleanup);
const cycle = { config: { id:'config',parentId:'parent', agreedMonthlyPence:190000 }, familyName:'Demo family',centreName:'Demo Centre', periodLabel:'6 Nov 2026 to 5 Dec 2026',coveredChildren:[] } as unknown as BillingCycleRow;
describe('eligible draft preparation preview', () => {
    it('shows exact family, centre, billing period and amount before confirming', () => {
        render(<BulkInvoiceConfirmModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} cycles={[cycle]} />);
        expect(screen.getByRole('dialog', {name:'Prepare eligible drafts'})).toBeTruthy();
        expect(screen.getByRole('link', {name:'Demo family'}).getAttribute('href')).toBe('/dashboard/parents/parent');
        expect(screen.getByText(cycle.periodLabel)).toBeTruthy();
        expect(screen.getByText('Demo Centre')).toBeTruthy();
    });
    it('reports draft completion without claiming issuance or delivery', async () => {
        const confirm=vi.fn().mockResolvedValue(undefined);
        render(<BulkInvoiceConfirmModal isOpen onClose={vi.fn()} onConfirm={confirm} cycles={[cycle]} />);
        fireEvent.click(screen.getByRole('button',{name:'Prepare 1 draft'}));
        await waitFor(() => expect(screen.getByText('Draft preparation complete')).toBeTruthy());
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/No invoices were issued or sent by this action/)).toBeTruthy();
    });
    it('keeps partial failure visible and restores the controls', async () => {
        render(<BulkInvoiceConfirmModal isOpen onClose={vi.fn()} onConfirm={vi.fn().mockRejectedValue(new Error('Family changed; refresh required.'))} cycles={[cycle]} />);
        fireEvent.click(screen.getByRole('button',{name:'Prepare 1 draft'}));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Family changed; refresh required.'));
        expect(screen.getByRole('button',{name:'Prepare 1 draft'}).hasAttribute('disabled')).toBe(false);
        expect(screen.queryByText('Draft preparation complete')).toBeNull();
    });
    it('cannot confirm an empty eligible set', () => {
        render(<BulkInvoiceConfirmModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} cycles={[]} />);
        expect(screen.getByRole('button',{name:'Prepare 0 drafts'}).hasAttribute('disabled')).toBe(true);
    });
});
