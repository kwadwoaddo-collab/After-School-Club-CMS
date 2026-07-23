import { describe, it, expect, vi, beforeEach } from 'vitest';
import { instalmentService } from './instalments';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn() }),
  }
}));

describe('InstalmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('splits invoice amount correctly handling remainders on first month', async () => {
    const insertValuesMock = vi.fn();
    (db.insert as any).mockReturnValue({ values: insertValuesMock });

    // £100 / 3 = 33.33 remainder 0.01
    // Month 1: 33.34
    // Month 2: 33.33
    // Month 3: 33.33
    await instalmentService.createInstalmentPlan(
      'org-1',
      'inv-1',
      100,
      3,
      new Date('2026-09-01T00:00:00Z')
    );

    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const instalmentsData = insertValuesMock.mock.calls[0][0];
    
    expect(instalmentsData).toHaveLength(3);
    expect(instalmentsData[0].amount).toBe('33.34');
    expect(instalmentsData[1].amount).toBe('33.33');
    expect(instalmentsData[2].amount).toBe('33.33');
    
    // Dates should be exactly 1 month apart
    expect(instalmentsData[0].dueDate.toISOString().split('T')[0]).toBe('2026-09-01');
    expect(instalmentsData[1].dueDate.toISOString().split('T')[0]).toBe('2026-10-01');
    expect(instalmentsData[2].dueDate.toISOString().split('T')[0]).toBe('2026-11-01');
  });

  it('handles exact splits', async () => {
    const insertValuesMock = vi.fn();
    (db.insert as any).mockReturnValue({ values: insertValuesMock });

    await instalmentService.createInstalmentPlan(
      'org-1',
      'inv-1',
      90,
      3,
      new Date('2026-09-01T00:00:00Z')
    );

    const instalmentsData = insertValuesMock.mock.calls[0][0];
    expect(instalmentsData[0].amount).toBe('30.00');
    expect(instalmentsData[1].amount).toBe('30.00');
    expect(instalmentsData[2].amount).toBe('30.00');
  });

  it('skips if months is 0', async () => {
    const insertValuesMock = vi.fn();
    (db.insert as any).mockReturnValue({ values: insertValuesMock });

    await instalmentService.createInstalmentPlan('org-1', 'inv-1', 100, 0, new Date());
    expect(db.insert).not.toHaveBeenCalled();
  });
});
