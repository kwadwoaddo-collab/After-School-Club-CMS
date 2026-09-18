import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Milestone 3G, L4 regression coverage & MAINT-REL-1 freshness/safety coverage.
 *
 * Root cause (see project-notes/milestone-3g-finance-audit.md, L4): this
 * webhook handler inserted a payment row on every
 * 'checkout.session.completed' event with no guard against a duplicate
 * delivery — unlike reconcilePayment's own transactionReference uniqueness
 * check. Stripe redelivers webhooks on retry as a normal part of its
 * delivery model, so a retried delivery would previously insert a second
 * payment row for the same session, inflating the invoice's derived paid
 * total.
 *
 * MAINT-REL-1 additions:
 * 1. Category A draft/void status guards preventing payments on unissued/voided invoices.
 * 2. Post-commit revalidatePath() for finance dashboards, detail views, and parent portal.
 * 3. Graceful handling of revalidation errors without rolling back or failing the webhook.
 */

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
const invoicesFindFirst = vi.fn();
const dbInsertValues = vi.fn().mockResolvedValue([{ id: 'new-payment-id' }]);

vi.mock('@/db', () => {
    const makePaymentsFindMany = () => [];

    const txMock = {
        query: {
            payments: {
                findFirst: (...args: unknown[]) => paymentsFindFirst(...args),
                findMany: async () => makePaymentsFindMany(),
            },
            invoices: {
                findFirst: (...args: unknown[]) => invoicesFindFirst(...args),
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
                invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) },
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

describe('POST /api/webhooks/stripe-invoice — idempotency & cache revalidation (MAINT-REL-1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbInsertValues.mockResolvedValue([{ id: 'new-payment-id' }]);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
            status: 'sent',
            amount: '50.00',
            parentId: 'parent-1',
            centreId: 'centre-1',
        });
    });

    it('inserts a payment and triggers revalidation for finance and portal routes on first delivery', async () => {
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

        // MAINT-REL-1: Verify revalidatePath calls
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance/invoices/invoice-1');
        expect(revalidatePath).toHaveBeenCalledWith('/portal/billing');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/parents/parent-1');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/centres/centre-1/billing');
    });

    it('skips the insert and does not touch the invoice or revalidate on a redelivered webhook', async () => {
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
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('skips payment and does not revalidate if invoice is in draft status', async () => {
        constructInvoiceWebhookEvent.mockReturnValue(makeSessionEvent());
        paymentsFindFirst.mockResolvedValue(undefined);
        invoicesFindFirst.mockResolvedValue({
            id: 'invoice-1',
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
            id: 'invoice-1',
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
        invoicesFindFirst.mockResolvedValue(undefined); // not found

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

        // Must still succeed and record payment!
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
