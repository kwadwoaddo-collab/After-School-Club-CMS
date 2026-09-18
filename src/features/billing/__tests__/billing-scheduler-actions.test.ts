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
    billingConfigs: { findFirst: vi.fn() },
    invoices: { findFirst: vi.fn() },
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
const mockTxSelect = vi.fn((..._args: any[]) => ({
    from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
    })),
}));

function makeTxUpdateChain() {
    const chain: any = {
        set: vi.fn(() => chain),
        where: vi.fn().mockResolvedValue(undefined),
    };
    return chain;
}

function makeTxInsertChain(returnValue: any = [{ id: 'mock-id' }]) {
    const chain: any = {
        values: vi.fn(() => chain),
        onConflictDoUpdate: vi.fn(() => chain),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    return chain;
}

function makeTxDeleteChain() {
    const chain: any = {
        where: vi.fn().mockResolvedValue(undefined),
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
const MANAGER_SESSION = { user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' } };

describe('Billing Scheduler Actions (§26, §27, B7, B8, B9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTxUpdate.mockImplementation(() => makeTxUpdateChain());
        mockTxInsert.mockImplementation(() => makeTxInsertChain());
        mockTxDelete.mockImplementation(() => makeTxDeleteChain());
        mockTxExecute.mockResolvedValue(undefined);
    });

    describe('skipBillingCycle', () => {
        it('rejects caller without centre access', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['other-centre']);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
            });

            const { skipBillingCycle } = await import('../actions');
            await expect(skipBillingCycle('config-1', '2026-10-01', 'Family holiday'))
                .rejects.toThrow(/Unauthorized: No access to this centre/);
        });

        it('rejects if an active issued invoice exists for the period', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
            });
            mockTxQuery.invoices.findFirst.mockResolvedValue({
                id: 'inv-1',
                status: 'sent',
                invoiceNumber: 'INV-001',
            });

            const { skipBillingCycle } = await import('../actions');
            await expect(skipBillingCycle('config-1', '2026-10-01', 'Family holiday'))
                .rejects.toThrow(/Cannot skip cycle: an issued invoice \(INV-001\) already exists/);
        });

        it('discards existing draft invoice, records skip and audits', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
            });
            mockTxQuery.invoices.findFirst.mockResolvedValue({
                id: 'draft-inv-1',
                status: 'draft',
                invoiceNumber: 'INV-DRAFT',
            });
            mockTxInsert.mockImplementation(() => makeTxInsertChain([{ id: 'skip-1' }]));

            const { skipBillingCycle } = await import('../actions');
            const res = await skipBillingCycle('config-1', '2026-10-01', 'Holiday absence');

            expect(res.success).toBe(true);
            expect(res.skipId).toBe('skip-1');
            expect(mockTxUpdate).toHaveBeenCalled(); // voids draft and sets billingRuns success = false
            expect(mockTxInsert).toHaveBeenCalled(); // inserts billingCycleSkips and audit events
        });
    });

    describe('unskipBillingCycle', () => {
        it('removes skip record and emits audit event', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
            });

            const { unskipBillingCycle } = await import('../actions');
            const res = await unskipBillingCycle('config-1', '2026-10-01');

            expect(res.success).toBe(true);
            expect(mockTxDelete).toHaveBeenCalled();
            expect(mockTxInsert).toHaveBeenCalled();
        });
    });

    describe('reopenBillingCycle', () => {
        it('strictly forbids non-Owner roles', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(MANAGER_SESSION);

            const { reopenBillingCycle } = await import('../actions');
            await expect(reopenBillingCycle('config-1', '2026-10-01'))
                .rejects.toThrow(/Only Org Owner can reopen a billing cycle/);
        });

        it('reopens cycle by deleting billingRuns entry when no active invoice exists', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
            });
            mockTxQuery.invoices.findFirst.mockResolvedValue(null);

            const { reopenBillingCycle } = await import('../actions');
            const res = await reopenBillingCycle('config-1', '2026-10-01');

            expect(res.success).toBe(true);
            expect(mockTxDelete).toHaveBeenCalled();
            expect(mockTxInsert).toHaveBeenCalled();
        });
    });

    describe('generateInvoiceFromConfig skip check', () => {
        it('throws descriptive error if cycle is skipped (§26)', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
                status: 'active',
                children: [],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue({
                id: 'skip-1',
                billingConfigId: 'config-1',
                periodStart: '2026-10-01',
                skipReason: 'Family vacation',
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            await expect(generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-10-01',
                periodEndStr: '2026-10-31',
            })).rejects.toThrow(/Cannot generate invoice: billing cycle 2026-10-01 is skipped \(Family vacation\)/);
        });
    });
});
