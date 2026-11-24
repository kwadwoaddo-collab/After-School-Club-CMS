// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.stubGlobal('React', React);

const mocks = vi.hoisted(() => ({
    requireTenantSession: vi.fn(),
    isOrgOwner: vi.fn(),
    getUserAccessibleCentres: vi.fn(),
    resolveActiveCentreId: vi.fn(),
    findManyInvoices: vi.fn(),
    fetchBillingCycles: vi.fn(),
    fetchOwnerCashReceiptsLedger: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => mocks.requireTenantSession(...args),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
}));

vi.mock('next/link', () => ({
    default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock('@/lib/permissions', () => ({
    isOrgOwner: (...args: unknown[]) => mocks.isOrgOwner(...args),
    getUserAccessibleCentres: (...args: unknown[]) => mocks.getUserAccessibleCentres(...args),
}));

vi.mock('@/lib/centre-filter', () => ({
    resolveActiveCentreId: (...args: unknown[]) => mocks.resolveActiveCentreId(...args),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            invoices: {
                findMany: (...args: unknown[]) => mocks.findManyInvoices(...args),
            },
        },
        select: vi.fn(),
    },
}));

vi.mock('@/features/billing/queries', () => ({
    fetchBillingCycles: (...args: unknown[]) => mocks.fetchBillingCycles(...args),
}));

vi.mock('@/features/finance/cash-receipts-queries', () => ({
    fetchOwnerCashReceiptsLedger: (...args: unknown[]) => mocks.fetchOwnerCashReceiptsLedger(...args),
}));

vi.mock('@/features/finance/components/FinanceDashboardFilters', () => ({
    default: () => <div data-testid="finance-filters" />,
}));

vi.mock('@/features/finance/components/FinanceWorkspace', () => ({
    default: ({
        invoices,
        cycles,
        invoiceError,
        cycleError,
    }: {
        invoices: unknown[];
        cycles: unknown[];
        invoiceError: boolean;
        cycleError: boolean;
    }) => (
        <div
            data-testid="finance-workspace"
            data-invoices={invoices.length}
            data-cycles={cycles.length}
            data-invoice-error={String(invoiceError)}
            data-cycle-error={String(cycleError)}
        />
    ),
}));

vi.mock('@/features/finance/components/CashReceiptsOwnerView', () => ({
    default: () => <div data-testid="cash-receipts-owner-view" />,
}));

vi.mock('@/features/billing/components/BillingCyclesTab', () => ({
    default: () => <div data-testid="billing-cycles-tab" />,
}));

vi.mock('@/features/finance/components/FinanceDataGridClient', () => ({
    default: () => <div data-testid="finance-data-grid" />,
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import FinancePage from '../page';

describe('FinancePage parallel server queries & independent error isolation (PR-18b)', () => {
    afterEach(() => {
        cleanup();
        vi.resetAllMocks();
    });

    it('runs workspaceInvoices and fetchBillingCycles concurrently in Promise.all', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'u-1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        mocks.isOrgOwner.mockResolvedValue(true);
        mocks.getUserAccessibleCentres.mockResolvedValue([{ id: 'c-1', name: 'Centre 1' }]);
        mocks.resolveActiveCentreId.mockResolvedValue('all');

        const callOrder: string[] = [];
        let resolveInvoices!: (rows: unknown[]) => void;
        let resolveCycles!: (rows: unknown[]) => void;

        mocks.findManyInvoices.mockImplementation(() => {
            callOrder.push('invoices:start');
            return new Promise((res) => {
                resolveInvoices = res;
            });
        });
        mocks.fetchBillingCycles.mockImplementation(() => {
            callOrder.push('cycles:start');
            return new Promise((res) => {
                resolveCycles = res;
            });
        });

        const pagePromise = FinancePage({ searchParams: Promise.resolve({}) });

        // Wait a microtask tick so Stage 1 completes and Stage 2 kicks off both promises concurrently
        await new Promise((r) => setTimeout(r, 10));
        expect(callOrder).toEqual(['invoices:start', 'cycles:start']);

        resolveInvoices([{ id: 'inv-1' }]);
        resolveCycles([{ config: { id: 'cfg-1', centreId: 'c-1' } }]);

        const jsx = await pagePromise;
        render(jsx);

        const ws = screen.getByTestId('finance-workspace');
        expect(ws.getAttribute('data-invoices')).toBe('1');
        expect(ws.getAttribute('data-cycles')).toBe('1');
        expect(ws.getAttribute('data-invoice-error')).toBe('false');
        expect(ws.getAttribute('data-cycle-error')).toBe('false');
    });

    it('isolates fetchBillingCycles errors from workspaceInvoices and vice versa', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'u-1', organisationId: 'org-1', role: 'MANAGER' },
        });
        mocks.getUserAccessibleCentres.mockResolvedValue([{ id: 'c-1', name: 'Centre 1' }]);
        mocks.resolveActiveCentreId.mockResolvedValue('c-1');
        mocks.findManyInvoices.mockRejectedValueOnce(new Error('DB timeout on invoices'));
        mocks.fetchBillingCycles.mockResolvedValueOnce([{ config: { id: 'cfg-1', centreId: 'c-1' } }]);

        const jsx = await FinancePage({ searchParams: Promise.resolve({ centre: 'c-1' }) });
        render(jsx);

        expect(screen.getByText('Unable to load finance data — please refresh')).toBeTruthy();
        const ws = screen.getByTestId('finance-workspace');
        expect(ws.getAttribute('data-cycles')).toBe('1');
        expect(ws.getAttribute('data-invoice-error')).toBe('true');
        expect(ws.getAttribute('data-cycle-error')).toBe('false');
    });
});
