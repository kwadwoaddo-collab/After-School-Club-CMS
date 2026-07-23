import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canUserAccessSafeguardingRecords } from './permissions';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      centreMemberships: { findFirst: vi.fn() },
    },
  },
}));

describe('Safeguarding Records Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ORG_OWNER can read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ role: 'ORG_OWNER' });
    const canAccess = await canUserAccessSafeguardingRecords('owner', 'centre');
    expect(canAccess).toBe(true);
  });

  it('MANAGER can read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ role: 'MANAGER' });
    (db.query.centreMemberships.findFirst as any).mockResolvedValueOnce({ role: 'MANAGER' });
    const canAccess = await canUserAccessSafeguardingRecords('manager', 'centre');
    expect(canAccess).toBe(true);
  });

  it('FRONT_DESK cannot read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ role: 'FRONT_DESK' });
    (db.query.centreMemberships.findFirst as any).mockResolvedValueOnce({ role: 'FRONT_DESK' });
    const canAccess = await canUserAccessSafeguardingRecords('frontdesk', 'centre');
    expect(canAccess).toBe(false);
  });

  it('TUTOR cannot read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ role: 'TUTOR' });
    (db.query.centreMemberships.findFirst as any).mockResolvedValueOnce({ role: 'TUTOR' });
    const canAccess = await canUserAccessSafeguardingRecords('tutor', 'centre');
    expect(canAccess).toBe(false);
  });

  it('Unassigned user cannot read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce(null);
    const canAccess = await canUserAccessSafeguardingRecords('noaccess', 'centre');
    expect(canAccess).toBe(false);
  });
});
