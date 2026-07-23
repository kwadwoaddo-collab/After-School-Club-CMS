import { describe, it, expect, vi, beforeEach } from 'vitest';
import { creditService } from './credit';
import { db } from '@/db';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  }
}));

describe('CreditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBalance', () => {
    it('sums credits and subtracts debits', async () => {
      // Mock db.select().from().where() chain
      const mockWhere = vi.fn().mockResolvedValue([
        { type: 'credit', amount: '50.00' },
        { type: 'refund', amount: '25.50' },
        { type: 'debit', amount: '30.00' },
      ]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const balance = await creditService.getBalance('parent-1');
      expect(balance).toBe(45.50); // 50 + 25.50 - 30
    });

    it('returns 0 instead of negative if debits exceed credits', async () => {
      const mockWhere = vi.fn().mockResolvedValue([
        { type: 'credit', amount: '10.00' },
        { type: 'debit', amount: '50.00' },
      ]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const balance = await creditService.getBalance('parent-1');
      expect(balance).toBe(0);
    });
  });

  describe('applyCreditToInvoice', () => {
    it('applies credit idempotently', async () => {
      // We will mock the transaction callback directly
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

      // Mock returns for the tx steps:
      // 1. Invoice
      txMock.where.mockResolvedValueOnce([{ id: 'inv-1', amount: '100.00', status: 'sent' }]);
      // 2. Existing payments
      txMock.where.mockResolvedValueOnce([{ amount: '20.00' }]); // remaining = 80
      // 3. Idempotency check
      txMock.where.mockResolvedValueOnce([]); // no existing debit
      // 4. Ledger balances
      txMock.where.mockResolvedValueOnce([
        { type: 'credit', amount: '150.00' }
      ]); // available = 150

      const result = await creditService.applyCreditToInvoice('org-1', 'parent-1', 'inv-1');
      
      expect(result.success).toBe(true);
      expect(result.appliedAmount).toBe(80); // Capped at remaining invoice balance

      // Should have inserted a debit of 80
      expect(txMock.insert).toHaveBeenCalledTimes(2); // One debit, one payment
      
      // Should have updated invoice to paid
      expect(txMock.update).toHaveBeenCalled();
    });

    it('skips if already idempotently applied', async () => {
      const txMock = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn(),
      };
      (db.transaction as any).mockImplementation(async (cb: any) => cb(txMock));

      txMock.where.mockResolvedValueOnce([{ id: 'inv-1', amount: '100.00', status: 'sent' }]);
      txMock.where.mockResolvedValueOnce([]); 
      txMock.where.mockResolvedValueOnce([{ id: 'existing-debit' }]); // Existing debit found

      const result = await creditService.applyCreditToInvoice('org-1', 'parent-1', 'inv-1');
      
      expect(result.success).toBe(true);
      expect(result.appliedAmount).toBe(0); // Safely skipped
    });
  });
});
