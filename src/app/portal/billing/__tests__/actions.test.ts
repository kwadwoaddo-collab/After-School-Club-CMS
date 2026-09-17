import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitVoucherPayment } from '../actions';

const getCurrentParent = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: () => getCurrentParent(),
}));

const invoicesFindFirst = vi.fn();
const dbInsert = vi.fn().mockReturnValue({ values: vi.fn() });
const dbTransaction = vi.fn(async (cb) => cb({ insert: dbInsert }));

vi.mock('@/db', () => ({
    db: {
        query: { invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) } },
        transaction: (...args: unknown[]) => dbTransaction(...args)
    }
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('portal/billing/actions — submitVoucherPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentParent.mockResolvedValue({ id: 'parent-1' });
    });

    it('rejects a draft invoiceId (§7)', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: 'inv-1',
            parentId: 'parent-1',
            status: 'draft',
            amount: '100.00',
            payments: []
        });

        const res = await submitVoucherPayment('inv-1', 10, 'REF');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Invoice cannot be paid in its current status/);
    });

    it('accepts partially_paid invoice for remaining balance (regression check)', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: 'inv-1',
            parentId: 'parent-1',
            status: 'partially_paid',
            amount: '100.00',
            payments: [{ amount: '50.00', status: 'verified' }]
        });

        const res = await submitVoucherPayment('inv-1', 40, 'REF');
        expect(res.success).toBe(true);
    });
});
