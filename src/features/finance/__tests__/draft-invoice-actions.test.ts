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

vi.mock('@/lib/services/email', () => ({
    emailService: {
        sendInvoiceCreated: vi.fn().mockResolvedValue({ success: true }),
    },
}));

vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

const mockDbQuery = {
    invoices: { findFirst: vi.fn() },
    children: { findMany: vi.fn() },
};

const mockTxSelect = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxInsert = vi.fn();

function makeTxSelectChain(returnValue: any = []) {
    const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        for: vi.fn().mockResolvedValue(returnValue),
    };
    // Also support when .for is not chained
    chain.then = (resolve: any) => resolve(returnValue);
    return chain;
}

function makeTxUpdateChain(returnValue: any = [{ id: 'mock-id' }]) {
    const chain: any = {
        set: vi.fn(() => chain),
        where: vi.fn(() => chain),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    chain.then = (resolve: any) => resolve(returnValue);
    return chain;
}

function makeTxInsertChain() {
    const chain: any = {
        values: vi.fn(() => chain),
        returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
    };
    chain.then = (resolve: any) => resolve([{ id: 'mock-id' }]);
    return chain;
}

vi.mock('@/db', () => ({
    db: {
        query: mockDbQuery,
        transaction: async (cb: any) => cb({
            select: (...args: any[]) => (mockTxSelect as any)(...args),
            update: (...args: any[]) => (mockTxUpdate as any)(...args),
            insert: (...args: any[]) => (mockTxInsert as any)(...args),
            query: mockDbQuery,
        }),
    },
}));

const OWNER_SESSION = { user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' } };
const MANAGER_SESSION = { user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' } };
const FRONT_DESK_SESSION = { user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' } };

describe('Draft Invoice Lifecycle Actions (§18, B1, B2, B3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTxSelect.mockImplementation(() => makeTxSelectChain([{ count: 0 }]));
        mockTxUpdate.mockImplementation(() => makeTxUpdateChain());
        mockTxInsert.mockImplementation(() => makeTxInsertChain());
    });

    describe('issueDraftInvoice (B1)', () => {
        it('returns idempotent success if invoice is already sent', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockTxSelect.mockReturnValue(makeTxSelectChain([{
                id: 'inv-1',
                organisationId: 'org-1',
                centreId: 'centre-1',
                status: 'sent',
                amount: '150.00',
                dueDate: new Date('2026-10-15'),
            }]));

            const { issueDraftInvoice } = await import('../actions');
            const res = await issueDraftInvoice('inv-1');
            expect(res.success).toBe(true);
            expect(res.alreadyIssued).toBe(true);
        });

        it('rejects if invoice is void', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockTxSelect.mockReturnValue(makeTxSelectChain([{
                id: 'inv-1',
                organisationId: 'org-1',
                centreId: 'centre-1',
                status: 'void',
                amount: '150.00',
                dueDate: new Date('2026-10-15'),
            }]));

            const { issueDraftInvoice } = await import('../actions');
            await expect(issueDraftInvoice('inv-1'))
                .rejects.toThrow(/Cannot issue invoice: Status is void/);
        });

        it('rejects if draft invoice amount is <= 0', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockTxSelect.mockReturnValue(makeTxSelectChain([{
                id: 'inv-1',
                organisationId: 'org-1',
                centreId: 'centre-1',
                status: 'draft',
                amount: '0.00',
                dueDate: new Date('2026-10-15'),
            }]));

            const { issueDraftInvoice } = await import('../actions');
            await expect(issueDraftInvoice('inv-1'))
                .rejects.toThrow(/Invoice cannot be issued without a valid amount greater than zero/);
        });

        it('successfully transitions draft to sent and audits', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockTxSelect.mockReturnValue(makeTxSelectChain([{
                id: 'inv-1',
                organisationId: 'org-1',
                centreId: 'centre-1',
                status: 'draft',
                amount: '150.00',
                dueDate: new Date('2026-10-15'),
                invoiceNumber: 'INV-100',
            }]));
            mockTxUpdate.mockReturnValue(makeTxUpdateChain([{
                id: 'inv-1',
                status: 'sent',
            }]));

            const { issueDraftInvoice } = await import('../actions');
            const res = await issueDraftInvoice('inv-1');

            expect(res.success).toBe(true);
            expect(mockTxUpdate).toHaveBeenCalled();
            expect(mockTxInsert).toHaveBeenCalled();
        });
    });

    describe('updateDraftInvoice (B2)', () => {
        it('strictly blocks updating non-draft invoices', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockTxSelect.mockReturnValue(makeTxSelectChain([{
                id: 'inv-1',
                organisationId: 'org-1',
                centreId: 'centre-1',
                status: 'sent',
            }]));

            const { updateDraftInvoice } = await import('../actions');
            await expect(updateDraftInvoice('inv-1', { amount: '200.00' }))
                .rejects.toThrow(/Invoice cannot be edited after issuance/);
        });

        it('updates draft fields and emits audit event', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(OWNER_SESSION);

            mockTxSelect.mockReturnValue(makeTxSelectChain([{
                id: 'inv-1',
                organisationId: 'org-1',
                centreId: 'centre-1',
                status: 'draft',
            }]));
            mockTxUpdate.mockReturnValue(makeTxUpdateChain([{
                id: 'inv-1',
                amount: '200.00',
            }]));

            const { updateDraftInvoice } = await import('../actions');
            const res = await updateDraftInvoice('inv-1', {
                amount: '200.00',
                notes: 'Adjusted fee',
            });

            expect(res.success).toBe(true);
            expect(mockTxUpdate).toHaveBeenCalled();
            expect(mockTxInsert).toHaveBeenCalled();
        });
    });

    describe('discardDraftInvoice (B3)', () => {
        it('rejects unauthorized roles (e.g. FRONT_DESK)', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(FRONT_DESK_SESSION);

            const { discardDraftInvoice } = await import('../actions');
            await expect(discardDraftInvoice('inv-1'))
                .rejects.toThrow(/Only Managers and Owners can discard draft invoices/);
        });

        it('discards draft by voiding invoice and failing billingRun', async () => {
            const { requireTenantSession } = await import('@/lib/session');
            (requireTenantSession as any).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

            let callCount = 0;
            mockTxSelect.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // Invoice lookup
                    return makeTxSelectChain([{
                        id: 'inv-1',
                        organisationId: 'org-1',
                        centreId: 'centre-1',
                        status: 'draft',
                        billingConfigId: 'config-1',
                    }]);
                }
                // Payments count check
                return makeTxSelectChain([{ count: 0 }]);
            });

            const { discardDraftInvoice } = await import('../actions');
            const res = await discardDraftInvoice('inv-1');

            expect(res.success).toBe(true);
            expect(mockTxUpdate).toHaveBeenCalled();
            expect(mockTxInsert).toHaveBeenCalled();
        });
    });
});
