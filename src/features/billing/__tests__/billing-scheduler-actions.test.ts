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
        where: vi.fn().mockResolvedValue([{ count: 0, id: 'child-1' }]),
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
        select: (...args: any[]) => (mockTxSelect as any)(...args),
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

describe('restart billing overlap protection', () => {
    it('refuses a changed anchor overlapping a preserved older issued family invoice', async () => {
        const { requireTenantSession } = await import('@/lib/session');
        (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);
        mockDbQuery.billingConfigs.findFirst.mockResolvedValue({ id: 'config-1', organisationId: 'org-1',
            parentId: 'parent-1', centreId: 'centre-1', status: 'active', billingAnchorDate: '2026-12-15',
            agreedMonthlyPence: 190000, children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
        });
        mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
        mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);
        mockDbQuery.invoices.findFirst.mockResolvedValue({ id: 'older-issued', status: 'sent',
            billingPeriodStart: new Date('2026-12-01'), billingPeriodEnd: new Date('2026-12-31'),
        });
        const { generateInvoiceFromConfig } = await import('../actions');
        await expect(generateInvoiceFromConfig({ configId: 'config-1', periodStartStr: '2026-12-15',
            periodEndStr: '2027-01-14',
        })).rejects.toThrow(/overlaps an existing family invoice/);
    });
});

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
            expect(mockTxUpdate).toHaveBeenCalled(); // nulls invoiceId and sets billingRuns success = false
            expect(mockTxDelete).toHaveBeenCalled(); // deletes unissued draft invoice (Issue A)
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
        it('strictly forbids unauthorized roles (e.g. FRONT_DESK)', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue({ user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' } });

            const { reopenBillingCycle } = await import('../actions');
            await expect(reopenBillingCycle('config-1', '2026-10-01'))
                .rejects.toThrow(/Only Org Owner and Centre Managers can reopen a billing cycle/);
        });

        it('rejects MANAGER without access to target centre', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['other-centre']);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
            });

            const { reopenBillingCycle } = await import('../actions');
            await expect(reopenBillingCycle('config-1', '2026-10-01'))
                .rejects.toThrow(/Unauthorized: No access to this centre/);
        });

        it('allows MANAGER with centre access to reopen cycle', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

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

        it('reopens cycle by deleting billingRuns entry when no active invoice exists for Owner', async () => {
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
                children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
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

        it('rejects FRONT_DESK role from calling generateInvoiceFromConfig even with centre access', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue({
                user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' },
            });
            getUserAccessibleCentreIds.mockResolvedValue(['centre-1']);
            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                organisationId: 'org-1',
                status: 'active',
                billingAnchorDate: '2026-09-01',
                children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            await expect(generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-10-01',
                periodEndStr: '2026-10-31',
            })).rejects.toThrow(/Only Org Owner and Centre Managers can generate invoices/);
        });

        it('rejects manual historical period draft generation without explicit confirmation and audit reason', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                billingAnchorDate: '2025-09-01',
                agreedMonthlyPence: 50000,
                children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);

            const { generateInvoiceFromConfig } = await import('../actions');
            await expect(generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2025-09-01',
                periodEndStr: '2025-09-30',
            })).rejects.toThrow(/Historical billing period warning/);
        });

        it('rejects unaligned or invalid period selections against billingAnchorDate', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                billingAnchorDate: '2026-09-06',
                agreedMonthlyPence: 50000,
                children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
            });

            const { generateInvoiceFromConfig } = await import('../actions');
            await expect(generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2026-09-01',
                periodEndStr: '2026-09-30',
                confirmHistorical: true,
                historicalReason: 'Backdated test',
            })).rejects.toThrow(/does not align with the family billing anchor date/);
        });

        it('allows Manager/Owner explicit historical draft generation with confirmation & reason, recording audit event and actual creation timestamp', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

            mockDbQuery.billingConfigs.findFirst.mockResolvedValue({
                id: 'config-1',
                centreId: 'centre-1',
                parentId: 'parent-1',
                organisationId: 'org-1',
                status: 'active',
                billingAnchorDate: '2025-09-01',
                agreedMonthlyPence: 45000,
                children: [{ child: { id: 'child-1', firstName: 'Child', lastName: 'One' } }],
            });
            mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);
            mockDbQuery.invoices.findFirst.mockResolvedValue(null);

            mockTxQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
            mockTxQuery.billingRuns.findFirst.mockResolvedValue(null);
            mockTxQuery.invoices.findFirst.mockResolvedValue(null);

            const insertedPayloads: any[] = [];
            mockTxInsert.mockImplementation(() => {
                const chain: any = {
                    values: vi.fn((vals) => {
                        insertedPayloads.push(vals);
                        return chain;
                    }),
                    onConflictDoUpdate: vi.fn(() => chain),
                    returning: vi.fn().mockResolvedValue([{ id: 'hist-draft-1', amount: '450.00' }]),
                };
                return chain;
            });

            const beforeCall = Date.now();
            const { generateInvoiceFromConfig } = await import('../actions');
            const res = await generateInvoiceFromConfig({
                configId: 'config-1',
                periodStartStr: '2025-09-01',
                periodEndStr: '2025-09-30',
                confirmHistorical: true,
                historicalReason: 'Approved manual historical billing for Sept 2025',
            });

            expect(res.success).toBe(true);
            expect(res.invoiceId).toBe('hist-draft-1');

            const invoicePayload = insertedPayloads.find(p => p.invoiceNumber);
            expect(invoicePayload).toBeDefined();
            expect(invoicePayload.status).toBe('draft');
            expect(invoicePayload.invoiceDate.getTime()).toBeGreaterThanOrEqual(beforeCall);

            const auditPayload = insertedPayloads.find(p => p.eventType === 'manual_historical_invoice_draft_created');
            expect(auditPayload).toBeDefined();
            expect(auditPayload.userId).toBe('user-mgr');
            const parsedAudit = JSON.parse(auditPayload.eventData);
            expect(parsedAudit.isHistorical).toBe(true);
            expect(parsedAudit.historicalReason).toBe('Approved manual historical billing for Sept 2025');
            expect(parsedAudit.actorRole).toBe('MANAGER');
            expect(parsedAudit.status).toBe('draft');
        });
    });
});
