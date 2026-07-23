import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcilePayment } from './reconcile-payment';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
  }
}));

describe('Reconcile Payment Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies payment and updates invoice status', async () => {
    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    (db.transaction as any).mockImplementation(async (cb: any) => cb(txMock));

    // 1. Idempotency check -> no existing
    txMock.where.mockResolvedValueOnce([]);
    // 2. Invoice fetch
    txMock.where.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', amount: '100.00', status: 'sent' }]);
    // 3. Existing payments fetch
    txMock.where.mockResolvedValueOnce([{ amount: '20.00' }]); 

    const result = await reconcilePayment('org-1', 'staff-1', {
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'tax_free_childcare',
      reference: 'TFC-123',
    });

    expect(result.success).toBe(true);
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(1); // update invoice to paid
  });

  it('skips double-clicks using idempotency reference', async () => {
    const txMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };
    (db.transaction as any).mockImplementation(async (cb: any) => cb(txMock));

    // 1. Idempotency check -> already exists
    txMock.where.mockResolvedValueOnce([{ id: 'pay-1', transactionReference: 'TFC-123' }]);

    const result = await reconcilePayment('org-1', 'staff-1', {
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
