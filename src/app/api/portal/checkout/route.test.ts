import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { assertOrgActive, OrgNotActiveError } from '@/lib/org-approval-guard';

const getCurrentParent = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
  getCurrentParent: () => getCurrentParent(),
}));

const isConfigured = vi.fn();
const createInvoicePaymentSession = vi.fn();

vi.mock('@/lib/services/stripe', () => ({
  stripeService: {
    isConfigured: () => isConfigured(),
    createInvoicePaymentSession: (...args: unknown[]) => createInvoicePaymentSession(...args),
  },
}));

const invoiceFindFirst = vi.fn();
const dbSelect = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      invoices: { findFirst: (...args: unknown[]) => invoiceFindFirst(...args) },
    },
    select: (...args: unknown[]) => dbSelect(...args),
  },
}));

const VALID_INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PARENT_INVOICE_ID = '22222222-2222-4222-8222-222222222222';

describe('POST /api/portal/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertOrgActive).mockResolvedValue(undefined);
  });

  it('returns 401 Unauthorised when parent is unauthenticated', async () => {
    getCurrentParent.mockResolvedValue(null);
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns 503 when Stripe is not configured (fail closed)', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(false);

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('Online payments not configured');
  });

  it('returns 400 on null JSON body or non-UUID invoiceId without querying DB', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);

    const { POST } = await import('./route');

    const nullReq = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: 'null',
    });
    const nullRes = await POST(nullReq);
    expect(nullRes.status).toBe(400);

    const badUuidReq = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'not-a-uuid' }),
    });
    const badUuidRes = await POST(badUuidReq);
    expect(badUuidRes.status).toBe(400);
    expect(invoiceFindFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when invoice is not found or owned by a different parent', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue(null);

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: OTHER_PARENT_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 when invoice is draft (filtered by DB query) (§7)', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue(null);

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 when the invoice organisation is not ACTIVE', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue({
      id: VALID_INVOICE_ID,
      invoiceNumber: 'INV-001',
      amount: '100.00',
      organisationId: 'org-suspended',
      payments: [],
    });
    vi.mocked(assertOrgActive).mockRejectedValueOnce(new OrgNotActiveError('org-suspended', 'SUSPENDED'));

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(createInvoicePaymentSession).not.toHaveBeenCalled();
  });

  it('returns 400 when invoice is already fully paid', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue({
      id: VALID_INVOICE_ID,
      invoiceNumber: 'INV-001',
      amount: '100.00',
      organisationId: 'org-1',
      payments: [{ amount: '100.00', status: 'verified', reversedAt: null }],
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invoice is already fully paid');
  });

  it('creates checkout session using exact pence balance, ignores reversed payments, and skips dead db.select', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue({
      id: VALID_INVOICE_ID,
      invoiceNumber: 'INV-001',
      amount: '10.00',
      organisationId: 'org-1',
      payments: [
        { amount: '9.90', status: 'verified', reversedAt: null },
        { amount: '0.10', status: 'verified', reversedAt: new Date('2026-11-01T00:00:00Z') },
      ],
      centre: { name: 'Sydenham Main' },
    });
    createInvoicePaymentSession.mockResolvedValue({
      success: true,
      sessionUrl: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const json = await res.json();
    expect(json.sessionUrl).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(dbSelect).not.toHaveBeenCalled();
    expect(createInvoicePaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: VALID_INVOICE_ID,
        amountPence: 10, // £0.10 remaining without IEEE-754 float drift
      })
    );
  });

  it('sanitizes internal Stripe SDK errors on 500 responses', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue({
      id: VALID_INVOICE_ID,
      invoiceNumber: 'INV-001',
      amount: '50.00',
      organisationId: 'org-1',
      payments: [],
    });
    createInvoicePaymentSession.mockResolvedValue({
      success: false,
      error: 'StripeInvalidRequestError: secret api_key sk_live_xxx rejected',
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: VALID_INVOICE_ID }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to create payment session');
    expect(json.error).not.toContain('sk_live');
  });
});
