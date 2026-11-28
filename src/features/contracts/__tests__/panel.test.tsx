// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const m = vi.hoisted(() => ({ archive: vi.fn().mockResolvedValue({ success: true, message: 'ok' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../actions', () => ({ sendContract: vi.fn(), revokeContract: vi.fn(), archiveContract: m.archive, saveContractCentreDetails: vi.fn() }));

import { ContractPanel } from '../ContractPanel';
import type { ContractStatusView } from '../status';

const view = (over: Partial<ContractStatusView> = {}): ContractStatusView => ({
    label: 'Signed', signed: { id: 's1', signedAt: '2026-11-02T10:00:00Z', amountPence: 24000, signerName: 'Ada' }, pending: null,
    archivable: { id: 's1', status: 'signed' }, amountChanged: false, childrenChanged: false, archived: [], ...over,
});
const details = { centreId: 'c', values: { providerName: 'P', address: 'A', phone: '1', website: '', ofstedRegNo: 'E', signatoryName: 'Jane', signatoryRole: '' }, missing: [] };

afterEach(cleanup);

describe('ContractPanel', () => {
    it('shows the children-changed flag without sending anything', () => {
        render(<ContractPanel configId="cfg" centreId="c" data={{ status: view({ label: 'Children changed — new contract needed', childrenChanged: true }), details }} />);
        expect(screen.getByTestId('contract-status').textContent).toBe('Children changed — new contract needed');
        expect(screen.getByRole('alert').textContent).toContain('children covered');
    });
    it('lists archived contracts in a collapsed section with a download link', () => {
        const archived = [{ id: 'a1', status: 'signed' as const, amountPence: 22000, signedAt: '2026-01-05T10:00:00Z', archivedAt: '2026-11-20T10:00:00Z', signerName: 'Ada', downloadable: true }];
        const { container } = render(<ContractPanel configId="cfg" centreId="c" data={{ status: view({ label: 'Not sent', signed: null, archivable: null, archived }), details }} />);
        const d = container.querySelector('details')!;
        expect(d.open).toBe(false);
        expect(d.textContent).toContain('Archived contracts (1)');
        expect(container.querySelector('a[href="/api/contracts/a1/pdf"]')).not.toBeNull();
    });
    it('archives after confirmation and has no delete control', () => {
        render(<ContractPanel configId="cfg" centreId="c" data={{ status: view(), details }} />);
        expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Archive contract' }));
        const dialog = screen.getByRole('dialog');
        const modalConfirm = within(dialog).getByRole('button', { name: 'Archive contract' });
        fireEvent.click(modalConfirm);
        expect(m.archive).toHaveBeenCalledWith({ contractId: 's1' });
    });
    it('still lists contracts when the billing plan is gone, and cannot send', () => {
        render(<ContractPanel configId={null} centreId="c" data={{ status: view({ archivable: null, archived: [{ id: 'a1', status: 'signed', amountPence: 1, signedAt: null, archivedAt: '2026-11-20T10:00:00Z', signerName: null, downloadable: true }] }), details }} />);
        expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
        expect(screen.getByText(/no billing plan/i)).toBeTruthy();
    });
    it('offers the signatory fields in the centre details form', () => {
        render(<ContractPanel configId="cfg" centreId="c" data={{ status: view(), details }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Centre contract details' }));
        expect(screen.getByLabelText(/Authorised signatory name/)).toBeTruthy();
        expect(screen.getByLabelText(/Signatory role/)).toBeTruthy();
    });
});
