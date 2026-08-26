import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ name: 'Sydenham Centre' }]),
        })),
      })),
    })),
  },
}));

describe('POST /api/portal/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 Unauthorised when parent is unauthenticated', async () => {
    getCurrentParent.mockResolvedValue(null);
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'inv-123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 503 when Stripe is not configured (fail closed)', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(false);

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'inv-123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('Online payments not configured');
  });

  it('returns 404 when invoice is not found or owned by a different parent', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue(null);

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'inv-other-parent' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when invoice is already fully paid', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue({
      id: 'inv-123',
      invoiceNumber: 'INV-001',
      amount: '100.00',
      organisationId: 'org-1',
      payments: [{ amount: '100.00', status: 'verified' }],
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'inv-123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invoice is already fully paid');
  });

  it('creates checkout session for outstanding balance of valid invoice', async () => {
    getCurrentParent.mockResolvedValue({ id: 'parent-1', email: 'parent@example.com' });
    isConfigured.mockReturnValue(true);
    invoiceFindFirst.mockResolvedValue({
      id: 'inv-123',
      invoiceNumber: 'INV-001',
      amount: '100.00',
      organisationId: 'org-1',
      payments: [{ amount: '40.00', status: 'verified' }],
      centre: { name: 'Sydenham Main' },
    });
    createInvoicePaymentSession.mockResolvedValue({
      success: true,
      sessionUrl: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/portal/checkout', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: 'inv-123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sessionUrl).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(createInvoicePaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-123',
        amountPence: 6000, // £60.00 remaining
      })
    );
  });
});
