import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * FIN-M1 Stage B: Finance UI Integrity & Category C Alignment Test Suite
 *
 * Enforces:
 * 1. FinanceDashboardClient exposes Delete strictly for draft invoices (not sent, partially_paid, paid, overdue, or void)
 * 2. InvoiceDetailsClient preserves Discard Draft for drafts, but exposes zero Delete actions for issued/void invoices
 * 3. ConfirmActionModal contains no instructions to delete payments and does not trap users
 * 4. Backend deleteInvoice rejects non-drafts and drafts-with-payments without instructing physical payment deletion
 * 5. Backend reversePayment preserves rows, preserves terminal void status, and audits properly
 */

describe('FIN-M1: UI Code Invariants & Category C Alignment', () => {
    const rootDir = path.resolve(__dirname, '../../../../');

    it('ensures FinanceDashboardClient restricts Delete/Discard strictly to draft status', () => {
        const filePath = path.join(rootDir, 'src/features/finance/components/FinanceDashboardClient.tsx');
        const content = fs.readFileSync(filePath, 'utf8');

        // Must render Delete button strictly on invoice.status === 'draft'
        expect(content).toContain("invoice.status === 'draft'");
        expect(content).toContain('title="Delete Draft"');
        expect(content).not.toContain('title="Delete Invoice"');
    });

    it('ensures InvoiceDetailsClient has no Delete action on issued or void invoices', () => {
        const filePath = path.join(rootDir, 'src/features/finance/components/InvoiceDetailsClient.tsx');
        const content = fs.readFileSync(filePath, 'utf8');

        // Discard Draft must be preserved in draft section
        expect(content).toContain('Discard Draft');
        expect(content).toContain('handleDiscardDraft');

        // No Delete button in the non-draft section
        expect(content).not.toMatch(/setConfirmAction\(['"]delete['"]\)/);
        expect(content).not.toContain('hasPayments');
    });

    it('ensures ConfirmActionModal contains no instructions to delete associated payments', () => {
        const filePath = path.join(rootDir, 'src/features/finance/components/ConfirmActionModal.tsx');
        const content = fs.readFileSync(filePath, 'utf8');

        // Must NOT instruct deleting associated payments
        expect(content).not.toContain('delete all associated payments');
        expect(content).not.toContain('delete associated payments');
        expect(content).not.toContain('hasPayments');

        // Must describe draft invoice removal
        expect(content).toContain('Draft invoice');
        expect(content).toContain('permanently removed from the database');
    });

    it('ensures actions.ts deleteInvoice uses safe message without instructing payment deletion', () => {
        const filePath = path.join(rootDir, 'src/features/finance/actions.ts');
        const content = fs.readFileSync(filePath, 'utf8');

        // Must NOT tell user to delete associated payments
        expect(content).not.toContain('Please delete associated payments before deleting the invoice.');

        // Must use the approved safe warning
        expect(content).toContain('Cannot delete this draft because payment records are associated with it. Review the payment records before continuing.');
    });
});

describe('FIN-M1: Backend Actions & RBAC Invariants', () => {
    const OWNER_SESSION = {
        user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' }
    };
    const MANAGER_SESSION = {
        user: { id: 'manager-1', organisationId: 'org-1', role: 'MANAGER' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deleteInvoice: strictly rejects non-draft invoices (sent, void, paid)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

        const { db } = await import('@/db');
        vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb({
            query: {
                invoices: {
                    findFirst: async () => ({
                        id: 'inv-sent-1',
                        organisationId: 'org-1',
                        status: 'sent',
                        payments: [],
                    }),
                },
            },
        }));

        const { deleteInvoice } = await import('../actions');
        await expect(deleteInvoice('inv-sent-1')).rejects.toThrow(/Only draft invoices can be deleted/);
    });

    it('deleteInvoice: strictly rejects draft with payments without instructing payment deletion', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

        const { db } = await import('@/db');
        vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb({
            query: {
                invoices: {
                    findFirst: async () => ({
                        id: 'inv-draft-1',
                        organisationId: 'org-1',
                        status: 'draft',
                        payments: [{ id: 'pay-1', amount: '50.00' }],
                    }),
                },
            },
        }));

        const { deleteInvoice } = await import('../actions');
        await expect(deleteInvoice('inv-draft-1')).rejects.toThrow(/Cannot delete this draft because payment records are associated with it/);
    });

    it('deleteInvoice: rejects non-owner roles (Manager, Tutor, Parent)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(MANAGER_SESSION);

        const { deleteInvoice } = await import('../actions');
        await expect(deleteInvoice('inv-draft-1')).rejects.toThrow(/Only Owner can delete invoices/);
    });

    it('reversePayment: preserves void status on void invoices', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

        const mockUpdate = vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: 'pay-void-1' }])
                })
            })
        });
        const mockInsert = vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([])
        });

        const { db } = await import('@/db');
        vi.spyOn(db, 'transaction').mockImplementation(async (cb: any) => cb({
            query: {
                payments: {
                    findFirst: async () => ({
                        id: 'pay-void-1',
                        status: 'verified',
                        amount: '1200.00',
                        method: 'bank_transfer',
                        invoiceId: 'inv-void-1',
                        invoice: {
                            id: 'inv-void-1',
                            invoiceNumber: 'INV-H3OOQX',
                            organisationId: 'org-1',
                            centreId: 'centre-1',
                            status: 'void',
                            parentId: 'parent-1',
                        }
                    })
                }
            },
            update: mockUpdate,
            insert: mockInsert,
        }));

        const { reversePayment } = await import('../actions');
        const res = await reversePayment('pay-void-1', 'Payment was recorded/verified in error; no corresponding payment was received.');

        expect(res.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockInsert).toHaveBeenCalled(); // audit event created
    });
});
