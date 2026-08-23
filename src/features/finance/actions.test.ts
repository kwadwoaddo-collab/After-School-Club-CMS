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

vi.mock('@/db', () => ({
    db: {
        query: {
            centres: { findFirst: (...args: unknown[]) => centresFindFirst(...args) },
            parents: { findFirst: (...args: unknown[]) => parentsFindFirst(...args) },
            invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) },
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
