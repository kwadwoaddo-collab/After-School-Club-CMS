import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Milestone 3G, L2a/L2b regression coverage.
 *
 * L2a (createInvoice / createLegacyFamilyAndInvoice / createAdHocInvoice):
 * these functions previously checked only that the caller belonged to an
 * organisation — never that the supplied parentId/childIds/centreId
 * actually belonged to that organisation, and had no role restriction at
 * all unlike every sibling mutation in this file. A direct call with a
 * parentId/childIds from a different org could create an invoice under the
 * caller's own org that references another org's parent/child records.
 *
 * L2b (getInvoiceDetails): correctly org-scoped, but had no role or centre
 * check — a non-owner could read cross-centre invoice + payment detail
 * within the same org via a direct call, bypassing the ORG_OWNER-only page
 * that's currently the only UI surface reaching it.
 *
 * See project-notes/milestone-3g-finance-audit.md, L2a/L2b.
 */

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
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

const centresFindFirst = vi.fn();
const parentsFindFirst = vi.fn();
const invoicesFindFirst = vi.fn();
const dbSelectWhere = vi.fn();
const dbTransaction = vi.fn();

const billingConfigsFindFirst = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            centres: { findFirst: (...args: unknown[]) => centresFindFirst(...args) },
            parents: { findFirst: (...args: unknown[]) => parentsFindFirst(...args) },
            invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) },
            billingConfigs: { findFirst: (...args: unknown[]) => billingConfigsFindFirst(...args) },
        },
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: (...args: unknown[]) => dbSelectWhere(...args),
            })),
        })),
        transaction: (...args: unknown[]) => dbTransaction(...args),
    },
}));

const OWNER_SESSION = { user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' } };
const FRONT_DESK_SESSION = { user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' } };

describe('finance/actions — createInvoice authorization (Milestone 3G, L2a)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a non-owner with no access to the target centre before touching the DB', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);

        const { createInvoice } = await import('./actions');
        await expect(createInvoice({
            parentId: 'parent-1',
            childIds: ['child-1'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/Unauthorized/);

        expect(centresFindFirst).not.toHaveBeenCalled();
    });

    it('rejects when the supplied centreId does not belong to the caller\'s organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue(null); // not found under this org

        const { createInvoice } = await import('./actions');
        await expect(createInvoice({
            parentId: 'parent-1',
            childIds: ['child-1'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-foreign-org',
        })).rejects.toThrow(/Centre not found/);
    });

    it('rejects when the supplied parentId does not belong to the caller\'s organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue({ id: 'centre-target' });
        parentsFindFirst.mockResolvedValue(null); // not found under this org

        const { createInvoice } = await import('./actions');
        await expect(createInvoice({
            parentId: 'parent-foreign-org',
            childIds: ['child-1'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/Parent not found/);
    });

    it('rejects when a supplied childId does not belong to the caller\'s organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue({ id: 'centre-target' });
        parentsFindFirst.mockResolvedValue({ id: 'parent-1' });
        dbSelectWhere.mockResolvedValue([]); // no children matched the org-scoped filter

        const { createInvoice } = await import('./actions');
        await expect(createInvoice({
            parentId: 'parent-1',
            childIds: ['child-foreign-org'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/children not found/);
    });

    it('rejects when a supplied child is deleted', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue({ id: 'centre-target' });
        parentsFindFirst.mockResolvedValue({ id: 'parent-1' });
        dbSelectWhere.mockResolvedValue([]); // deleted child won't match isNull(deletedAt)

        const { createInvoice } = await import('./actions');
        await expect(createInvoice({
            parentId: 'parent-1',
            childIds: ['child-deleted'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/children not found/);
    });

    it('rejects when child does not belong to the parent (wrong parent)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue({ id: 'centre-target' });
        parentsFindFirst.mockResolvedValue({ id: 'parent-1' });
        dbSelectWhere.mockResolvedValue([]); // will fail to find children

        const { createInvoice } = await import('./actions');
        await expect(createInvoice({
            parentId: 'parent-1',
            childIds: ['child-wrong-parent'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/children not found/);
    });

    it('allows ORG_OWNER with a valid centre/parent/children combination', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue({ id: 'centre-target', name: 'Main Campus' });
        parentsFindFirst.mockResolvedValue({ id: 'parent-1', firstName: 'Mark', email: 'mark@example.com' });
        dbSelectWhere.mockResolvedValue([{ id: 'child-1', firstName: 'Ava', lastName: 'Brown' }]);
        dbTransaction.mockImplementation(async (cb: any) => cb({
            insert: () => ({
                values: () => ({
                    returning: () => Promise.resolve([{ id: 'inv-1', invoiceNumber: 'INV-ABC123', amount: '100.00', dueDate: new Date() }]),
                }),
            }),
        }));

        const { createInvoice } = await import('./actions');
        const result = await createInvoice({
            parentId: 'parent-1',
            childIds: ['child-1'],
            amount: '100.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        });

        expect(result.id).toBe('inv-1');
    });
});

describe('finance/actions — createAdHocInvoice authorization (Milestone 3G, L2a)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a non-owner with no access to the target centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);

        const { createAdHocInvoice } = await import('./actions');
        await expect(createAdHocInvoice({
            newParent: { firstName: 'Jane', lastName: 'Doe' },
            childName: 'Jamie Doe',
            amount: '50.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/Unauthorized/);
    });

    it('rejects when an existing parentId does not belong to the caller\'s organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue({ id: 'centre-target' });
        parentsFindFirst.mockResolvedValue(null);

        const { createAdHocInvoice } = await import('./actions');
        await expect(createAdHocInvoice({
            parentId: 'parent-foreign-org',
            childName: 'Jamie Doe',
            amount: '50.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-target',
        })).rejects.toThrow(/Parent not found/);
    });
});

describe('finance/actions — createLegacyFamilyAndInvoice authorization (Milestone 3G, L2a)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a non-owner with no access to the target centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);

        const { createLegacyFamilyAndInvoice } = await import('./actions');
        await expect(createLegacyFamilyAndInvoice({
            parent: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '0700000000' },
            children: [{ firstName: 'Jamie', lastName: 'Doe', schoolYear: 'Y3' }],
            invoice: {
                amount: '50.00',
                invoiceDate: new Date(),
                dueDate: new Date(),
                centreId: 'centre-target',
            },
        })).rejects.toThrow(/Unauthorized/);
    });

    it('rejects when the supplied centreId does not belong to the caller\'s organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        centresFindFirst.mockResolvedValue(null);

        const { createLegacyFamilyAndInvoice } = await import('./actions');
        await expect(createLegacyFamilyAndInvoice({
            parent: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '0700000000' },
            children: [{ firstName: 'Jamie', lastName: 'Doe', schoolYear: 'Y3' }],
            invoice: {
                amount: '50.00',
                invoiceDate: new Date(),
                dueDate: new Date(),
                centreId: 'centre-foreign-org',
            },
        })).rejects.toThrow(/Centre not found/);
    });
});

describe('finance/actions — getInvoiceDetails authorization (Milestone 3G, L2b)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a non-owner with no access to the invoice\'s centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
        invoicesFindFirst.mockResolvedValue({ centreId: 'centre-target' });

        const { getInvoiceDetails } = await import('./actions');
        await expect(getInvoiceDetails('invoice-1')).rejects.toThrow(/Unauthorized/);
    });

    it('allows ORG_OWNER regardless of centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
            centreId: 'centre-target',
            child: null,
            coveredChildrenJson: null,
            notes: null,
        });

        const { getInvoiceDetails } = await import('./actions');
        const result = await getInvoiceDetails('invoice-1');
        expect(result?.id).toBe('invoice-1');
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });

    it('allows a non-owner with access to the invoice\'s centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-target']);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
            centreId: 'centre-target',
            child: null,
            coveredChildrenJson: null,
            notes: null,
        });

        const { getInvoiceDetails } = await import('./actions');
        const result = await getInvoiceDetails('invoice-1');
        expect(result?.id).toBe('invoice-1');
    });
});

describe('finance/actions — resendInvoiceEmail authorization (Manager Access Expansion)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const MANAGER_SESSION = { user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' } };
    const TUTOR_SESSION = { user: { id: 'user-tutor', organisationId: 'org-1', role: 'TUTOR' } };

    it('rejects lower roles like FRONT_DESK and TUTOR with Insufficient permissions', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);

        const { resendInvoiceEmail } = await import('./actions');
        const res = await resendInvoiceEmail('invoice-1');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Insufficient permissions/);
    });

    it('allows MANAGER when the invoice belongs to an accessible centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(MANAGER_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-mgr']);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
            centreId: 'centre-mgr',
            invoiceNumber: 'INV-001',
            amount: '100.00',
            status: 'sent',
            dueDate: new Date(),
            parent: { firstName: 'Jane', email: 'jane@example.com' },
            centre: { name: 'Main Centre' },
        });

        const { resendInvoiceEmail } = await import('./actions');
        const res = await resendInvoiceEmail('invoice-1');
        expect(res.success).toBe(true);
    });

    it('rejects MANAGER when the invoice belongs to an unassigned centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(MANAGER_SESSION);
        getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
            centreId: 'centre-unassigned',
            invoiceNumber: 'INV-001',
            amount: '100.00',
            status: 'sent',
            dueDate: new Date(),
            parent: { firstName: 'Jane', email: 'jane@example.com' },
            centre: { name: 'Other Centre' },
        });

        const { resendInvoiceEmail } = await import('./actions');
        const res = await resendInvoiceEmail('invoice-1');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Unauthorized: No access to this centre/);
    });

    it('allows ORG_OWNER regardless of centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
            centreId: 'centre-any',
            invoiceNumber: 'INV-001',
            amount: '100.00',
            status: 'sent',
            dueDate: new Date(),
            parent: { firstName: 'Jane', email: 'jane@example.com' },
            centre: { name: 'Any Centre' },
        });

        const { resendInvoiceEmail } = await import('./actions');
        const res = await resendInvoiceEmail('invoice-1');
        expect(res.success).toBe(true);
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });
});

describe('finance/actions — deleteInvoice privilege boundary (Manager Access Expansion)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const MANAGER_SESSION = { user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' } };

    it('strictly rejects MANAGER from deleting invoices', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(MANAGER_SESSION);

        const { deleteInvoice } = await import('./actions');
        await expect(deleteInvoice('invoice-1')).rejects.toThrow(/Only Owner can delete invoices/);
    });
});

describe('finance/actions — deleteInvoice safety rules (§11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockDelete = vi.fn().mockReturnValue({ where: vi.fn() });
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });

    it('ORG_OWNER CAN hard-delete a DRAFT invoice with zero payments -> succeeds + auditEvent written', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

        dbTransaction.mockImplementation(async (cb: any) => cb({
            query: { invoices: { findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'draft', payments: [] }) } },
            delete: mockDelete,
            insert: mockInsert
        }));

        const { deleteInvoice } = await import('./actions');
        await expect(deleteInvoice('inv-1')).resolves.toBeDefined();
        expect(mockDelete).toHaveBeenCalled();
        expect(mockInsert).toHaveBeenCalled(); // audit event
    });

    it('Sent invoice CANNOT be hard-deleted (returns error)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        dbTransaction.mockImplementation(async (cb: any) => cb({
            query: { invoices: { findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'sent', payments: [] }) } },
        }));

        const { deleteInvoice } = await import('./actions');
        await expect(deleteInvoice('inv-1')).rejects.toThrow(/Only draft invoices can be deleted/);
    });

    it('Partially-paid invoice CANNOT be hard-deleted', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        dbTransaction.mockImplementation(async (cb: any) => cb({
            query: { invoices: { findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'partially_paid', payments: [] }) } },
        }));

        const { deleteInvoice } = await import('./actions');
        await expect(deleteInvoice('inv-1')).rejects.toThrow(/Only draft invoices can be deleted/);
    });

    it('Paid invoice CANNOT be hard-deleted', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        dbTransaction.mockImplementation(async (cb: any) => cb({
            query: { invoices: { findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'paid', payments: [] }) } },
        }));

        const { deleteInvoice } = await import('./actions');
        await expect(deleteInvoice('inv-1')).rejects.toThrow(/Only draft invoices can be deleted/);
    });

    it('Invoice WITH a payment record CANNOT be hard-deleted (even if draft)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        dbTransaction.mockImplementation(async (cb: any) => cb({
            query: { invoices: { findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'draft', payments: [{ id: 'pay-1' }] }) } },
        }));

        const { deleteInvoice } = await import('./actions');
        await expect(deleteInvoice('inv-1')).rejects.toThrow(/Please delete associated payments before deleting the invoice/);
    });

    it('voidInvoice (Owner) still works for sent invoices (regression)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
        dbTransaction.mockImplementation(async (cb: any) => cb({
            query: { invoices: { findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'sent' }) } },
            update: mockUpdate,
            insert: mockInsert
        }));

        const { voidInvoice } = await import('./actions');
        await expect(voidInvoice('inv-1')).resolves.toBeDefined();
    });

    it('resendInvoiceEmail rejects draft', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
        invoicesFindFirst.mockResolvedValue({ id: 'inv-1', status: 'draft', centreId: 'centre-1' });

        const { resendInvoiceEmail } = await import('./actions');
        const res = await resendInvoiceEmail('inv-1');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Cannot resend a draft invoice/);
    });
});
