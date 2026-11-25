// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { buildCashReceiptsLedger } from '@/features/finance/domain/cash-receipts-ledger';

vi.stubGlobal('React', React);

const mocks = vi.hoisted(() => ({
    requireTenantSession: vi.fn(),
    isOrgOwner: vi.fn(),
    getUserAccessibleCentres: vi.fn(),
    resolveActiveCentreId: vi.fn(),
    findManyInvoices: vi.fn(),
    fetchBillingCycles: vi.fn(),
    fetchOwnerCashReceiptsLedger: vi.fn(),
    routerRefresh: vi.fn(),
    routerReplace: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => mocks.requireTenantSession(...args),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
    useRouter: () => ({
        refresh: mocks.routerRefresh,
        replace: mocks.routerReplace,
    }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        children,
        ...props
    }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
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
    fetchOwnerCashReceiptsLedger: (...args: unknown[]) =>
        mocks.fetchOwnerCashReceiptsLedger(...args),
}));

vi.mock('@/features/finance/expense-actions', () => ({
    createFinanceExpense: vi.fn(),
    updateFinanceExpense: vi.fn(),
    deleteFinanceExpense: vi.fn(),
}));

vi.mock('@/features/finance/components/FinanceDashboardFilters', () => ({
    default: () => <div data-testid="finance-filters" />,
}));

vi.mock('@/features/billing/components/BillingCyclesTab', () => ({
    default: () => <div data-testid="billing-cycles-tab" />,
}));

vi.mock('@/features/finance/components/FinanceDataGridClient', () => ({
    default: () => <div data-testid="finance-data-grid" />,
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import FinancePage from '../page';

function makeLedger(activeCentreId: string = 'all') {
    return buildCashReceiptsLedger({
        payments: [],
        expenses: [],
        centres: [
            { id: 'c-1', name: 'Oakridge After School Club' },
            { id: 'c-2', name: 'Maple After School Club' },
        ],
        selectedMonth: '2026-11',
        activeCentreId,
        today: '2026-11-24',
    });
}

describe('Finance navigation Option B: dedicated Outgoings view & Parent receipts separation', () => {
    afterEach(() => {
        cleanup();
        vi.resetAllMocks();
    });

    it('renders Cashflow & outgoings, Outgoings, and Parent receipts in Finance nav for ORG_OWNER', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        mocks.isOrgOwner.mockResolvedValue(true);
        mocks.getUserAccessibleCentres.mockResolvedValue([
            { id: 'c-1', name: 'Oakridge' },
            { id: 'c-2', name: 'Maple' },
        ]);
        mocks.resolveActiveCentreId.mockResolvedValue('c-1');
        mocks.findManyInvoices.mockResolvedValue([]);
        mocks.fetchBillingCycles.mockResolvedValue([]);

        const jsx = await FinancePage({ searchParams: Promise.resolve({ centre: 'c-1' }) });
        render(jsx);

        const nav = screen.getByRole('navigation', { name: 'Finance views' });
        const cashflowLink = within(nav).getByRole('link', { name: 'Cashflow & outgoings' });
        const outgoingsLink = within(nav).getByRole('link', { name: 'Outgoings' });
        const receiptsLink = within(nav).getByRole('link', { name: 'Parent receipts' });

        expect(cashflowLink.getAttribute('href')).toBe('/dashboard/finance?centre=c-1&view=cashflow');
        expect(outgoingsLink.getAttribute('href')).toBe(
            '/dashboard/finance?centre=c-1&view=outgoings#quick-add-outgoing-heading'
        );
        expect(receiptsLink.getAttribute('href')).toBe('/dashboard/finance/receipt');
        expect(within(nav).queryByRole('link', { name: 'Cash received' })).toBeNull();
        expect(within(nav).queryByRole('link', { name: 'Receipts' })).toBeNull();

        // FinanceWorkspace helper copy also names Parent receipts rather than Receipts
        expect(screen.getByText('Parent receipts', { selector: 'strong' })).toBeTruthy();
    });

    it('renders Parent receipts for MANAGER, hides owner cashflow/outgoings links, and redirects MANAGER off ?view=outgoings', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
        });
        mocks.getUserAccessibleCentres.mockResolvedValue([{ id: 'c-1', name: 'Oakridge' }]);
        mocks.resolveActiveCentreId.mockResolvedValue('c-1');
        mocks.findManyInvoices.mockResolvedValue([]);
        mocks.fetchBillingCycles.mockResolvedValue([]);

        const jsx = await FinancePage({ searchParams: Promise.resolve({ centre: 'c-1' }) });
        render(jsx);

        const nav = screen.getByRole('navigation', { name: 'Finance views' });
        expect(within(nav).getByRole('link', { name: 'Parent receipts' })).toBeTruthy();
        expect(within(nav).queryByRole('link', { name: 'Cashflow & outgoings' })).toBeNull();
        expect(within(nav).queryByRole('link', { name: 'Outgoings' })).toBeNull();

        cleanup();

        await expect(
            FinancePage({ searchParams: Promise.resolve({ view: 'outgoings' }) })
        ).rejects.toThrow('REDIRECT:/dashboard/finance');
    });

    it('loads fetchOwnerCashReceiptsLedger on ?view=outgoings, sets h1 to Outgoings & expenses, orders quick-add form before KPI summary, and preserves view=outgoings in links', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        mocks.isOrgOwner.mockResolvedValue(true);
        mocks.getUserAccessibleCentres.mockResolvedValue([
            { id: 'c-1', name: 'Oakridge After School Club' },
            { id: 'c-2', name: 'Maple After School Club' },
        ]);
        mocks.resolveActiveCentreId.mockResolvedValue('all');
        mocks.fetchOwnerCashReceiptsLedger.mockResolvedValue(makeLedger('all'));

        const jsx = await FinancePage({ searchParams: Promise.resolve({ view: 'outgoings' }) });
        render(jsx);

        expect(mocks.fetchOwnerCashReceiptsLedger).toHaveBeenCalledTimes(1);
        expect(mocks.findManyInvoices).not.toHaveBeenCalled();
        expect(mocks.fetchBillingCycles).not.toHaveBeenCalled();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Outgoings & expenses' })
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Record club outgoings and expenses across centres, and review weekly and yearly totals.'
            )
        ).toBeTruthy();

        const nav = screen.getByRole('navigation', { name: 'Finance views' });
        expect(within(nav).getByRole('link', { name: 'Outgoings' }).getAttribute('aria-current')).toBe(
            'page'
        );
        expect(
            within(nav).getByRole('link', { name: 'Cashflow & outgoings' }).getAttribute('aria-current')
        ).toBeNull();

        const quickAddHeading = await screen.findByRole('heading', {
            name: 'Record weekly outgoing or expense',
        });
        const kpiSummary = screen.getByLabelText('Executive cashflow and running totals summary');

        // In ?view=outgoings, quick-add outgoing section appears BEFORE KPI summary cards
        expect(
            Boolean(quickAddHeading.compareDocumentPosition(kpiSummary) & Node.DOCUMENT_POSITION_FOLLOWING)
        ).toBe(true);

        // Switching centre or month keeps view=outgoings
        const centreNav = screen.getByRole('navigation', { name: 'Centre cashflow filter' });
        const centreLink = within(centreNav).getByRole('link', {
            name: /Oakridge After School Club/,
        });
        expect(centreLink.getAttribute('href')).toContain('view=outgoings');
        expect(centreLink.getAttribute('href')).toContain('centre=c-1');

        const prevMonthLink = screen.getByRole('link', { name: /Previous month/ });
        expect(prevMonthLink.getAttribute('href')).toBe(
            '/dashboard/finance?view=outgoings&month=2026-10'
        );
    });

    it('keeps quick-add outgoing section after KPI summary cards on ?view=cashflow and sets h1 to Cashflow & outgoings', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        mocks.isOrgOwner.mockResolvedValue(true);
        mocks.getUserAccessibleCentres.mockResolvedValue([
            { id: 'c-1', name: 'Oakridge After School Club' },
        ]);
        mocks.resolveActiveCentreId.mockResolvedValue('all');
        mocks.fetchOwnerCashReceiptsLedger.mockResolvedValue(makeLedger('all'));

        const jsx = await FinancePage({ searchParams: Promise.resolve({ view: 'cashflow' }) });
        render(jsx);

        expect(
            screen.getByRole('heading', { level: 1, name: 'Cashflow & outgoings' })
        ).toBeTruthy();

        const quickAddHeading = await screen.findByRole('heading', {
            name: 'Record weekly outgoing or expense',
        });
        const kpiSummary = screen.getByLabelText('Executive cashflow and running totals summary');

        // In ?view=cashflow, KPI summary cards appear BEFORE quick-add outgoing section
        expect(
            Boolean(kpiSummary.compareDocumentPosition(quickAddHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
        ).toBe(true);

        const prevMonthLink = screen.getByRole('link', { name: /Previous month/ });
        expect(prevMonthLink.getAttribute('href')).toBe(
            '/dashboard/finance?view=cashflow&month=2026-10'
        );
    });
});
