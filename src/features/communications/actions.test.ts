import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendBroadcast } from './actions';
import { db } from '@/db';
import { sendEmail } from '@/lib/services/email';

vi.mock('@/db', () => ({
  db: {
    query: {
      parents: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-broadcast-id' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

describe('Communications Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter out parents without communicationsConsent', async () => {
    (db.query.parents.findMany as any).mockResolvedValue([
      { id: 'p1', email: 'consented@test.com', firstName: 'Alice', communicationsConsent: true },
      { id: 'p2', email: 'unconsented@test.com', firstName: 'Bob', communicationsConsent: false },
    ]);

    const result = await sendBroadcast({
      organisationId: 'org-1',
      audienceParentIds: ['p1', 'p2'],
      subject: 'Test Broadcast',
      message: 'Hello World',
    });

    expect(result.count).toBe(1); // Only 1 consented
    expect(result.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'consented@test.com',
    }));
  });

  it('should handle email sending failures gracefully', async () => {
    (db.query.parents.findMany as any).mockResolvedValue([
      { id: 'p1', email: 'fail@test.com', firstName: 'Alice', communicationsConsent: true },
    ]);

    (sendEmail as any).mockRejectedValueOnce(new Error('Send failed'));

    const result = await sendBroadcast({
      organisationId: 'org-1',
      audienceParentIds: ['p1'],
      subject: 'Fail Broadcast',
      message: 'Should Fail',
    });

    expect(result.count).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });
});
