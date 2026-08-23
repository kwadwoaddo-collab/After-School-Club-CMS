import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcilePayment } from './reconcile-payment';
import { db } from '@/db';

/**
 * Milestone 3G, L1 regression coverage.
 *
 * Root cause (see project-notes/milestone-3g-finance-audit.md, L1):
 * reconcilePayment previously took `organisationId` and `staffId` as
 * caller-supplied arguments and never called auth() at all — any request
 * reaching this server action could reconcile a payment against an
 * arbitrary organisation, with the audit trail recording the literal
 * string 'staff-user' rather than a real user id.
 *
 * The fix removes both caller-supplied arguments; organisationId and
 * staffId are now derived from the authenticated session, and a non-owner
 * caller must have centre access to the invoice's centre — matching the
 * pattern already established in src/features/finance/actions.ts's
 * recordPayment.
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const getUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIds(...args),
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
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: any) => cb(txMock));

    // 1. Idempotency check -> no existing
    txMock.where.mockResolvedValueOnce([]);
    // 2. Invoice fetch — scoped to the session's own organisationId, not a caller-supplied one
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'sent' }]);
    // 3. Existing payments fetch
    txMock.where.mockResolvedValueOnce([{ amount: '20.00' }]);

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(true);
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(1); // update invoice to paid
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
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: any) => cb(txMock));

    txMock.where.mockResolvedValueOnce([]);
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'sent' }]);
    txMock.where.mockResolvedValueOnce([{ amount: '20.00' }]);

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(true);
    expect(txMock.insert).toHaveBeenCalledTimes(1);
  });

  it('skips double-clicks using idempotency reference', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' },
    });

    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (cb: any) => cb(txMock));

    // 1. Idempotency check -> already exists
    txMock.where.mockResolvedValueOnce([{ id: 'pay-1', transactionReference: 'TFC-123' }]);

    const result = await reconcilePayment({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    // Success true, but no inserts/updates because it returned early
    expect(result.success).toBe(true);
    expect(txMock.select).toHaveBeenCalledTimes(1); // only the first select
  });
});
