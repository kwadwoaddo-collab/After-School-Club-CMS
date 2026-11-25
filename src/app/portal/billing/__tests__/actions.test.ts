import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitVoucherPayment } from '../actions';

const getCurrentParent = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: () => getCurrentParent(),
}));

const invoicesFindFirst = vi.fn();
const dbInsertValues = vi.fn();
const dbInsert = vi.fn(() => ({ values: (...args: unknown[]) => dbInsertValues(...args) }));
const dbTransaction = vi.fn(async (cb) => cb({ insert: dbInsert }));

vi.mock('@/db', () => ({
    db: {
        query: { invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) } },
        transaction: (...args: Parameters<typeof dbTransaction>) => dbTransaction(...args),
    },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const VALID_INVOICE_ID = '11111111-1111-4111-8111-111111111111';

describe('portal/billing/actions — submitVoucherPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentParent.mockResolvedValue({ id: 'parent-1' });
        dbInsertValues.mockResolvedValue(undefined);
    });

    it('rejects non-UUID invoiceId before opening a transaction', async () => {
        const res = await submitVoucherPayment('not-a-uuid', 10, 'REF');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Invalid invoice');
        expect(dbTransaction).not.toHaveBeenCalled();
    });

    it('rejects NaN, Infinity, negative, or sub-penny amounts cleanly', async () => {
        for (const badAmount of [Number.NaN, Number.POSITIVE_INFINITY, 0, -5, 10.123]) {
            const res = await submitVoucherPayment(VALID_INVOICE_ID, badAmount, 'REF-1');
            expect(res.success).toBe(false);
            expect(res.error).toBe('Invalid payment amount or reference');
        }
        expect(dbTransaction).not.toHaveBeenCalled();
    });

    it('rejects a draft invoiceId (§7)', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            parentId: 'parent-1',
            status: 'draft',
            amount: '100.00',
            payments: [],
        });

        const res = await submitVoucherPayment(VALID_INVOICE_ID, 10, 'REF');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Invoice cannot be paid in its current status/);
    });

    it('accepts partially_paid invoice for remaining balance (regression check)', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            parentId: 'parent-1',
            status: 'partially_paid',
            amount: '100.00',
            payments: [{ amount: '50.00', status: 'verified', reversedAt: null }],
        });

        const res = await submitVoucherPayment(VALID_INVOICE_ID, 40, 'REF');
        expect(res.success).toBe(true);
        expect(dbInsertValues).toHaveBeenCalledWith({
            invoiceId: VALID_INVOICE_ID,
            amount: '40.00',
            method: 'voucher',
            status: 'pending',
            transactionReference: 'REF',
        });
    });

    it('accepts exact £0.10 remaining balance on £10.00 - £9.90 without IEEE-754 float rejection', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            parentId: 'parent-1',
            status: 'partially_paid',
            amount: '10.00',
            payments: [{ amount: '9.90', status: 'verified', reversedAt: null }],
        });

        const res = await submitVoucherPayment(VALID_INVOICE_ID, 0.1, 'VOUCHER-EXACT');
        expect(res.success).toBe(true);
        expect(dbInsertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: '0.10',
                transactionReference: 'VOUCHER-EXACT',
            })
        );
    });

    it('ignores reversed payments when computing balance and permits re-submitting a reversed reference', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            parentId: 'parent-1',
            status: 'sent',
            amount: '50.00',
            payments: [
                {
                    amount: '50.00',
                    status: 'verified',
                    reversedAt: new Date('2026-11-01T10:00:00Z'),
                    transactionReference: 'TFC-RETRY-1',
                },
            ],
        });

        const res = await submitVoucherPayment(VALID_INVOICE_ID, 50, 'TFC-RETRY-1');
        expect(res.success).toBe(true);
        // Must NOT set idempotencyKey so reversed references never collide with payments_invoice_idempotency_uniq
        expect(dbInsertValues.mock.calls[0][0]).not.toHaveProperty('idempotencyKey');
    });

    it('rejects duplicate active voucher reference on the same invoice', async () => {
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            parentId: 'parent-1',
            status: 'sent',
            amount: '100.00',
            payments: [
                {
                    amount: '25.00',
                    status: 'pending',
                    reversedAt: null,
                    transactionReference: 'DUP-REF',
                },
            ],
        });

        const res = await submitVoucherPayment(VALID_INVOICE_ID, 25, '  DUP-REF  ');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/already been submitted/i);
        expect(dbInsertValues).not.toHaveBeenCalled();
    });
});
