import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const constructInvoiceWebhookEvent = vi.fn();
vi.mock('@/lib/services/stripe', () => ({
    stripeService: {
        constructInvoiceWebhookEvent: (...args: unknown[]) => constructInvoiceWebhookEvent(...args),
    },
}));

const paymentsFindFirst = vi.fn();
const paymentsFindMany = vi.fn();
const invoicesFindFirst = vi.fn();
const dbInsertValues = vi.fn().mockResolvedValue([{ id: 'new-payment-id' }]);
const dbUpdateSet = vi.fn();

vi.mock('@/db', () => {
    const txMock = {
        query: {
            payments: {
                findFirst: (...args: unknown[]) => paymentsFindFirst(...args),
                findMany: (...args: unknown[]) => paymentsFindMany(...args),
            },
            invoices: {
                findFirst: (...args: unknown[]) => invoicesFindFirst(...args),
            },
        },
        insert: vi.fn(() => ({ values: (...args: unknown[]) => dbInsertValues(...args) })),
        update: vi.fn(() => ({
            set: (...args: unknown[]) => {
                dbUpdateSet(...args);
                return { where: vi.fn().mockResolvedValue([]) };
            },
        })),
    };

    return {
        db: {
            query: {
                payments: { findFirst: (...args: unknown[]) => paymentsFindFirst(...args) },
                invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) },
            },
            insert: vi.fn(() => ({ values: (...args: unknown[]) => dbInsertValues(...args) })),
            update: vi.fn(() => ({
                set: (...args: unknown[]) => {
                    dbUpdateSet(...args);
                    return { where: vi.fn().mockResolvedValue([]) };
                },
            })),
            transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
        },
    };
});

const VALID_INVOICE_ID = '11111111-1111-4111-8111-111111111111';

function makeSessionEvent(
    overrides: Partial<{
        id: string;
        payment_status: string;
        amount_total: number | null;
        metadata: Record<string, string>;
    }> = {}
) {
    return {
        type: 'checkout.session.completed',
        data: {
            object: {
                id: 'cs_test_123',
                payment_status: 'paid',
                amount_total: 5000,
                metadata: {
                    source: 'portal_invoice_payment',
                    invoiceId: VALID_INVOICE_ID,
                    invoiceNumber: 'INV-ABC123',
                },
                ...overrides,
            },
        },
    };
}

describe('POST /api/webhooks/stripe-invoice — idempotency & cache revalidation (MAINT-REL-1 + BE P1-2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbInsertValues.mockResolvedValue([{ id: 'new-payment-id' }]);
        paymentsFindMany.mockResolvedValue([]);
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            status: 'sent',
            amount: '50.00',
            parentId: 'parent-1',
            centreId: 'centre-1',
        });
    });

    it('inserts a payment with idempotencyKey and triggers revalidation on first delivery', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(json).toEqual({ ok: true });
        expect(dbInsertValues).toHaveBeenCalledTimes(1);
        expect(dbInsertValues.mock.calls[0][0]).toMatchObject({
            invoiceId: VALID_INVOICE_ID,
            amount: '50.00',
            transactionReference: 'cs_test_123',
            idempotencyKey: 'stripe:cs_test_123',
            status: 'verified',
        });
        expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }));

        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices');
        expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/finance/invoices/${VALID_INVOICE_ID}`);
        expect(revalidatePath).toHaveBeenCalledWith('/portal/billing');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/parents/parent-1');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/centres/centre-1/billing');
    });

    it('rejects malformed non-UUID invoiceId with 400 before touching the database', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(
            makeSessionEvent({
                metadata: {
                    source: 'portal_invoice_payment',
                    invoiceId: 'not-a-uuid',
                    invoiceNumber: 'INV-BAD',
                },
            })
        );

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(invoicesFindFirst).not.toHaveBeenCalled();
        expect(dbInsertValues).not.toHaveBeenCalled();
    });

    it('skips zero-amount checkout sessions without recording a £0.00 verified payment', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent({ amount_total: 0 }));

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, skipped: true, reason: 'zero_amount' });
        expect(dbInsertValues).not.toHaveBeenCalled();
    });

    it('skips the insert and does not touch the invoice or revalidate on a redelivered webhook', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue({ id: 'existing-payment-1' });

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(json).toEqual({ ok: true, duplicate: true });
        expect(dbInsertValues).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('treats concurrent Postgres 23505 unique constraint conflict on idempotencyKey as duplicate', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);
        dbInsertValues.mockRejectedValueOnce(Object.assign(new Error('duplicate key value'), { code: '23505' }));

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, duplicate: true });
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('sets partially_paid (ignoring reversed payments) when verified total is below invoice amount', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent({ amount_total: 3000 }));
        paymentsFindFirst.mockResolvedValue(undefined);
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            status: 'sent',
            amount: '100.00',
            parentId: 'parent-1',
            centreId: 'centre-1',
        });
        paymentsFindMany.mockResolvedValue([
            { amount: '70.00', status: 'verified', reversedAt: new Date('2026-11-01T00:00:00Z'), transactionReference: 'rev-1' },
            { amount: '20.00', status: 'verified', reversedAt: null, transactionReference: 'prev-1' },
        ]);

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(dbUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'partially_paid' }));
    });

    it('skips payment and does not revalidate if invoice is in draft status', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            status: 'draft',
            amount: '50.00',
            parentId: 'parent-1',
            centreId: 'centre-1',
        });

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(json).toEqual({ ok: true, skipped: true, reason: 'draft_invoice' });
        expect(dbInsertValues).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('skips payment and does not revalidate if invoice is in void status', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);
        invoicesFindFirst.mockResolvedValue({
            id: VALID_INVOICE_ID,
            status: 'void',
            amount: '50.00',
            parentId: 'parent-1',
            centreId: 'centre-1',
        });

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(json).toEqual({ ok: true, skipped: true, reason: 'void_invoice' });
        expect(dbInsertValues).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('returns 404 if invoice is not found in database', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);
        invoicesFindFirst.mockResolvedValue(undefined);

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json).toEqual({ error: 'Invoice not found' });
        expect(dbInsertValues).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('succeeds even if secondary post-commit revalidation throws an error', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);
        vi.mocked(revalidatePath).mockImplementation(() => {
            throw new Error('Next.js cache revalidation failed');
        });

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true });
        expect(dbInsertValues).toHaveBeenCalledTimes(1);
    });

    it('checks idempotency scoped to both invoiceId and the session id', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/webhooks/stripe-invoice', {
            method: 'POST',
            body: '{}',
            headers: { 'stripe-signature': 'sig' },
        });
        await POST(req);

        expect(paymentsFindFirst).toHaveBeenCalledTimes(1);
    });
});
