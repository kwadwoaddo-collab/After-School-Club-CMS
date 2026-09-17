import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Milestone 3G, L4 regression coverage.
 *
 * Root cause (see project-notes/milestone-3g-finance-audit.md, L4): this
 * webhook handler inserted a payment row on every
 * 'checkout.session.completed' event with no guard against a duplicate
 * delivery — unlike reconcilePayment's own transactionReference uniqueness
 * check. Stripe redelivers webhooks on retry as a normal part of its
 * delivery model, so a retried delivery would previously insert a second
 * payment row for the same session, inflating the invoice's derived paid
 * total.
 */

const constructInvoiceWebhookEvent = vi.fn();
vi.mock('@/lib/services/stripe', () => ({
    stripeService: {
        constructInvoiceWebhookEvent: (...args: unknown[]) => constructInvoiceWebhookEvent(...args),
    },
}));

const paymentsFindFirst = vi.fn();
const dbInsertValues = vi.fn().mockResolvedValue([{ id: 'new-payment-id' }]);

vi.mock('@/db', () => {
    const makeInvoicesFindFirst = () => ({ id: 'invoice-1', status: 'sent', amount: '50.00' });
    const makePaymentsFindMany = () => [];

    const txMock = {
        query: {
            payments: {
                findFirst: (...args: unknown[]) => paymentsFindFirst(...args),
                findMany: async () => makePaymentsFindMany(),
            },
            invoices: {
                findFirst: async () => makeInvoicesFindFirst(),
            },
        },
        insert: vi.fn(() => ({ values: (...args: unknown[]) => dbInsertValues(...args) })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        })),
    };

    return {
        db: {
            query: {
                payments: { findFirst: (...args: unknown[]) => paymentsFindFirst(...args) },
            },
            insert: vi.fn(() => ({ values: (...args: unknown[]) => dbInsertValues(...args) })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
            })),
            transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
        },
    };
});

function makeSessionEvent(overrides: Partial<{ id: string; payment_status: string; amount_total: number | null; metadata: Record<string, string> }> = {}) {
    return {
        type: 'checkout.session.completed',
        data: {
            object: {
                id: 'cs_test_123',
                payment_status: 'paid',
                amount_total: 5000,
                metadata: { source: 'portal_invoice_payment', invoiceId: 'invoice-1', invoiceNumber: 'INV-ABC123' },
                ...overrides,
            },
        },
    };
}

describe('POST /api/webhooks/stripe-invoice — idempotency (Milestone 3G, L4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbInsertValues.mockResolvedValue([{ id: 'new-payment-id' }]);
    });

    it('inserts a payment and recalculates invoice status on first delivery', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined); // no existing payment

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
            invoiceId: 'invoice-1',
            transactionReference: 'cs_test_123',
            status: 'verified',
        });
        // Category C fix: invoice status is now set via recalculateInvoiceStatus,
        // NOT by a direct hard-coded update(invoices).set({ status: 'paid' }).
        // The recalculation happens inside the tx via the shared helper.
    });


    it('skips the insert and does not touch the invoice again on a redelivered webhook', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue({ id: 'existing-payment-1' }); // already recorded

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
        // Category C: no invoice status update should occur on duplicate delivery
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
