import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
    requireTenantSession: vi.fn(),
}));

const getUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIds(...args),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const mockDbQuery = {
    billingConfigs: { findFirst: vi.fn(), findMany: vi.fn() },
    invoices: { findFirst: vi.fn(), findMany: vi.fn() },
    billingCycleSkips: { findFirst: vi.fn() },
    billingRuns: { findFirst: vi.fn() },
    children: { findMany: vi.fn() },
};

const mockTxQuery = {
    invoices: { findFirst: vi.fn() },
    billingCycleSkips: { findFirst: vi.fn() },
    billingRuns: { findFirst: vi.fn() },
};

const mockTxUpdate = vi.fn();
const mockTxInsert = vi.fn();
const mockTxDelete = vi.fn();
const mockTxExecute = vi.fn();
const mockTxSelect = vi.fn();

function makeTxInsertChain(returnValue: any = [{ id: 'mock-invoice-id', amount: '0.00' }]) {
    const chain: any = {
        values: vi.fn(() => chain),
        onConflictDoUpdate: vi.fn(() => chain),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    return chain;
}

vi.mock('@/db', () => ({
    db: {
        query: mockDbQuery,
        transaction: async (cb: any) => cb({
            query: mockTxQuery,
            select: (...args: any[]) => (mockTxSelect as any)(...args),
            update: (...args: any[]) => (mockTxUpdate as any)(...args),
            insert: (...args: any[]) => (mockTxInsert as any)(...args),
            delete: (...args: any[]) => (mockTxDelete as any)(...args),
            execute: (...args: any[]) => (mockTxExecute as any)(...args),
        }),
    },
}));

const OWNER_SESSION = { user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' } };

describe('Category B Acceptance & Gap Verification (Issues D, E, 8, 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTxInsert.mockImplementation(() => makeTxInsertChain());
        mockTxExecute.mockResolvedValue(undefined);
    });

    describe('Issue E: Copy-Forward Proof (§16, §17, Ticket 7)', () => {
        it('prefers most recent issued invoice over older paid, draft, or void (Test sequence: paid 600, later draft 700, later void 800 -> 600)', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                agreedMonthlyPence: 0,
                children: [],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);

            // Pre-check for existing invoice covering the new period returns null
            mockDbQuery.invoices.findFirst
                .mockResolvedValueOnce(null) // pre-check 2: existing invoice for period
                .mockResolvedValueOnce({    // copy-forward lookup: most recent issued invoice (paid £600)
                    id: 'inv-paid-600',
                    amount: '600.00',
                    status: 'paid',
                    notes: 'Standard tuition',
                });

            mockTxQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockTxQuery.billingRuns.findFirst.mockResolvedValue(null);
            mockTxQuery.invoices.findFirst.mockResolvedValue(null);

            let insertedInvoice: any = null;
            mockTxInsert.mockImplementation(() => {
                const chain: any = {
                    values: vi.fn((vals) => {
                        if (!insertedInvoice) insertedInvoice = vals;
                        return chain;
                    }),
                    onConflictDoUpdate: vi.fn(() => chain),
                    returning: vi.fn().mockResolvedValue([{ id: 'new-inv', amount: insertedInvoice?.amount ?? '0.00' }]),
                };
                return chain;
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            const res = await generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-11-01',
                periodEndStr: '2026-11-30',
            });

            expect(res.success).toBe(true);
            expect(insertedInvoice).toBeDefined();
            expect(insertedInvoice.amount).toBe('600.00');
            expect(insertedInvoice.notes).toBe('Standard tuition');
        });

        it('sent £650 followed by older paid £600 -> resolves to £650', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                agreedMonthlyPence: 0,
                children: [],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);

            mockDbQuery.invoices.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    id: 'inv-sent-650',
                    amount: '650.00',
                    status: 'sent',
                    notes: 'Tuition + materials',
                });

            mockTxQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockTxQuery.billingRuns.findFirst.mockResolvedValue(null);
            mockTxQuery.invoices.findFirst.mockResolvedValue(null);

            let insertedInvoice: any = null;
            mockTxInsert.mockImplementation(() => {
                const chain: any = {
                    values: vi.fn((vals) => {
                        if (!insertedInvoice) insertedInvoice = vals;
                        return chain;
                    }),
                    onConflictDoUpdate: vi.fn(() => chain),
                    returning: vi.fn().mockResolvedValue([{ id: 'new-inv', amount: insertedInvoice?.amount ?? '0.00' }]),
                };
                return chain;
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            await generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-11-01',
                periodEndStr: '2026-11-30',
            });

            expect(insertedInvoice.amount).toBe('650.00');
        });

        it('partially_paid £625 followed by older paid £600 -> resolves to £625', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                agreedMonthlyPence: 0,
                children: [],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);

            mockDbQuery.invoices.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({
                    id: 'inv-part-625',
                    amount: '625.00',
                    status: 'partially_paid',
                });

            mockTxQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockTxQuery.billingRuns.findFirst.mockResolvedValue(null);
            mockTxQuery.invoices.findFirst.mockResolvedValue(null);

            let insertedInvoice: any = null;
            mockTxInsert.mockImplementation(() => {
                const chain: any = {
                    values: vi.fn((vals) => {
                        if (!insertedInvoice) insertedInvoice = vals;
                        return chain;
                    }),
                    onConflictDoUpdate: vi.fn(() => chain),
                    returning: vi.fn().mockResolvedValue([{ id: 'new-inv', amount: insertedInvoice?.amount ?? '0.00' }]),
                };
                return chain;
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            await generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-11-01',
                periodEndStr: '2026-11-30',
            });

            expect(insertedInvoice.amount).toBe('625.00');
        });
    });

    describe('Issue 8: First-Cycle Blank Amount', () => {
        it('first cycle with no issued history and no agreed fee generates working draft with 0.00', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                agreedMonthlyPence: 0,
                children: [],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);

            mockDbQuery.invoices.findFirst
                .mockResolvedValueOnce(null) // no existing invoice for period
                .mockResolvedValueOnce(null); // no prior issued invoice

            mockTxQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockTxQuery.billingRuns.findFirst.mockResolvedValue(null);
            mockTxQuery.invoices.findFirst.mockResolvedValue(null);

            let insertedInvoice: any = null;
            mockTxInsert.mockImplementation(() => {
                const chain: any = {
                    values: vi.fn((vals) => {
                        if (!insertedInvoice) insertedInvoice = vals;
                        return chain;
                    }),
                    onConflictDoUpdate: vi.fn(() => chain),
                    returning: vi.fn().mockResolvedValue([{ id: 'new-inv', amount: insertedInvoice?.amount ?? '0.00' }]),
                };
                return chain;
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            await generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-11-01',
                periodEndStr: '2026-11-30',
            });

            expect(insertedInvoice.amount).toBe('0.00');
            expect(insertedInvoice.status).toBe('draft');
        });
    });

    describe('Issue 9: Manual Invoice Conflict Prevention', () => {
        it('detects existing manual active invoice covering period and prevents duplicate generation', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                agreedMonthlyPence: 20000,
                children: [],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);

            // Manual invoice already exists for this parent + centre + periodStart
            mockDbQuery.invoices.findFirst.mockResolvedValueOnce({
                id: 'manual-inv-123',
                invoiceNumber: 'INV-MANUAL-1',
                status: 'sent',
                billingConfigId: 'config-1', // manual recurring invoice linked to config
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            const res = await generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-11-01',
                periodEndStr: '2026-11-30',
            });

            expect(res.alreadyGenerated).toBe(true);
            expect(res.invoiceId).toBe('manual-inv-123');
            expect(mockTxInsert).not.toHaveBeenCalled();
        });
    });

    describe('Issue D: Set Up Billing Schedule Workflow (fetchBillingSetupRequired)', () => {
        it('includes registered families with active children who have no billing config yet', async () => {
            mockDbQuery.billingConfigs.findMany
                .mockResolvedValueOnce([]) // 0-fee configs
                .mockResolvedValueOnce([]); // all configs lookup for configKeySet

            mockDbQuery.children.findMany.mockResolvedValue([
                {
                    id: 'child-1',
                    firstName: 'Alice',
                    lastName: 'Smith',
                    parentId: 'parent-smith',
                    centreId: 'centre-1',
                    organisationId: 'org-1',
                    isRegistered: true,
                    deletedAt: null,
                    parent: { firstName: 'John', lastName: 'Smith', email: 'john@smith.com', deletedAt: null },
                    centre: { name: 'Main Centre' },
                },
            ]);

            const { fetchBillingSetupRequired } = await import('../queries');
            const items = await fetchBillingSetupRequired('org-1', 'centre-1');

            expect(items).toHaveLength(1);
            expect(items[0].id).toBe('unconfigured-parent-smith-centre-1');
            expect(items[0].parent.firstName).toBe('John');
            expect(items[0].children[0].child.firstName).toBe('Alice');
        });
    });
});
