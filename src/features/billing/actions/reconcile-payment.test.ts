import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcilePayment } from './reconcile-payment';
import { db } from '@/db';
import { auditEvents, payments } from '@/db/schema';

/**
 * Milestone 3G, L1 & JC-05 regression coverage.
 *
 * Covers:
 * - Session-derived organisationId/staffId and non-owner centre access checks.
 * - Tenant & invoice status guard FIRST before inspecting payments by reference.
 * - True idempotency hit ONLY when a non-reversed matching payment has status === 'verified'.
 * - In-place promotion of non-reversed status === 'pending' voucher/TFC payment when amount matches.
 * - Clean rejection with zero ledger mutations when pending amount mismatches reconciled amount.
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const getUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIds(...args),
}));

const recalculateInvoiceStatus = vi.fn();
vi.mock('@/lib/finance/recalculate-invoice-status', () => ({
  recalculateInvoiceStatus: (...args: unknown[]) => recalculateInvoiceStatus(...args),
}));

const invoicesFindFirst = vi.fn();
vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
    query: {
      invoices: { findFirst: (...args: unknown[]) => invoicesFindFirst(...args) },
    },
  },
}));

describe('reconcilePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when there is no authenticated session', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects a non-owner with no access to the invoice centre, without ever passing a caller-supplied org id', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-front-desk', organisationId: 'org-1', role: 'FRONT_DESK' },
    });
    getUserAccessibleCentreIds.mockResolvedValue(['centre-other']);
    invoicesFindFirst.mockResolvedValue({ centreId: 'centre-target' });

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unauthorized/);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('rejects missing/cross-tenant or void invoice BEFORE inspecting payments by reference', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' },
    });

    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

    // Cross-tenant / missing invoice
    txMock.where.mockResolvedValueOnce([]);
    const notFoundResult = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-SECRET',
    });
    expect(notFoundResult).toEqual({ success: false, error: 'Invoice not found' });
    expect(txMock.select).toHaveBeenCalledTimes(1);

    // Void invoice
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'void' }]);
    const voidResult = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-SECRET',
    });
    expect(voidResult).toEqual({ success: false, error: 'Invoice is already paid or void' });
    expect(txMock.select).toHaveBeenCalledTimes(2);
  });

  it('applies payment and updates invoice status for ORG_OWNER, deriving organisationId/staffId from the session', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' },
    });

    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

    // 1. Invoice fetch & lock FIRST — scoped to session's organisationId
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'sent', parentId: 'parent-1' }]);
    // 2. Existing non-reversed payments check -> none
    txMock.where.mockResolvedValueOnce([]);
    // 3. Verified payments query for recalculation
    txMock.where.mockResolvedValueOnce([{ amount: '80.00', status: 'verified', transactionReference: 'TFC-123' }]);
    // 4. Invoice status update where()
    txMock.where.mockResolvedValueOnce({});

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(true);
    expect(txMock.insert).toHaveBeenCalledWith(payments);
    expect(txMock.insert).toHaveBeenCalledWith(auditEvents);
    expect(txMock.insert).toHaveBeenCalledTimes(2);
    expect(recalculateInvoiceStatus).toHaveBeenCalledTimes(1);
    expect(recalculateInvoiceStatus).toHaveBeenCalledWith(txMock, '550e8400-e29b-41d4-a716-446655440000');
    // ORG_OWNER bypasses the centre-membership lookup entirely
    expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
  });

  it('allows a non-owner with centre access', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-front-desk', organisationId: 'org-1', role: 'FRONT_DESK' },
    });
    getUserAccessibleCentreIds.mockResolvedValue(['centre-target']);
    invoicesFindFirst.mockResolvedValue({ centreId: 'centre-target' });

    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', centreId: 'centre-target', amount: '100.00', status: 'sent', parentId: 'parent-1' }]);
    txMock.where.mockResolvedValueOnce([]);
    txMock.where.mockResolvedValueOnce([{ amount: '80.00', status: 'verified', transactionReference: 'TFC-123' }]);
    txMock.where.mockResolvedValueOnce({});

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(true);
    expect(txMock.insert).toHaveBeenCalledWith(payments);
    expect(recalculateInvoiceStatus).toHaveBeenCalledTimes(1);
    expect(recalculateInvoiceStatus).toHaveBeenCalledWith(txMock, '550e8400-e29b-41d4-a716-446655440000');
  });

  it('skips double-clicks using idempotency reference ONLY when existing payment has status === verified', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' },
    });

    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

    // 1. Invoice check (even if already transitioned to paid by first click)
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '80.00', status: 'paid', parentId: 'parent-1' }]);
    // 2. Existing non-reversed verified payment on (invoiceId, reference)
    txMock.where.mockResolvedValueOnce([{ id: 'pay-1', amount: '80.00', status: 'verified', transactionReference: 'TFC-123', reversedAt: null }]);

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(true);
    expect(txMock.select).toHaveBeenCalledTimes(2);
    expect(txMock.insert).not.toHaveBeenCalled();
    expect(txMock.update).not.toHaveBeenCalled();
  });

  it('promotes existing pending voucher payment in-place when amount matches and rejects amount mismatch', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' },
    });

    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

    // Case A: Mismatched amount (£80.00 pending vs £75.00 reconciled) -> rejected with 0 mutations
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'sent', parentId: 'parent-1' }]);
    txMock.where.mockResolvedValueOnce([{ id: 'pay-pending', amount: '80.00', status: 'pending', transactionReference: 'EDENRED-1', reversedAt: null }]);

    const mismatch = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 75,
      method: 'voucher',
      reference: 'EDENRED-1',
    });

    expect(mismatch.success).toBe(false);
    expect(mismatch.error).toBe(
      'Pending payment reference "EDENRED-1" was logged for £80.00, which does not match reconciled amount £75.00. Review or adjust on the invoice first.'
    );
    expect(txMock.insert).not.toHaveBeenCalled();
    expect(txMock.update).not.toHaveBeenCalled();

    // Case B: Exact amount match (£80.00 pending vs £80.00 reconciled) -> promotes in-place (no duplicate payments insert)
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'sent', parentId: 'parent-1' }]);
    txMock.where.mockResolvedValueOnce([{ id: 'pay-pending', amount: '80.00', status: 'pending', transactionReference: 'EDENRED-1', reversedAt: null }]);
    txMock.where.mockResolvedValueOnce({}); // update payments where()
    txMock.where.mockResolvedValueOnce([{ id: 'pay-pending', amount: '80.00', status: 'verified', transactionReference: 'EDENRED-1', reversedAt: null }]); // verifiedPayments select
    txMock.where.mockResolvedValueOnce({}); // update invoices where()

    const promoted = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'voucher',
      reference: 'EDENRED-1',
    });

    expect(promoted.success).toBe(true);
    expect(txMock.update).toHaveBeenCalledWith(payments);
    expect(txMock.insert).not.toHaveBeenCalledWith(payments);
    expect(txMock.insert).toHaveBeenCalledWith(auditEvents);
    expect(recalculateInvoiceStatus).toHaveBeenCalledTimes(1);
  });
});
