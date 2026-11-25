import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canUserAccessSafeguardingRecords } from './permissions';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      centres: { findFirst: vi.fn() },
      orgMemberships: { findFirst: vi.fn() },
      centreMemberships: { findFirst: vi.fn() },
    },
  },
}));

describe('Safeguarding Records Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ORG_OWNER can read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'owner', role: 'ORG_OWNER', organisationId: 'org-1' });
    (db.query.orgMemberships.findFirst as any).mockResolvedValueOnce({ role: 'ORG_OWNER', organisationId: 'org-1' });
    (db.query.centres.findFirst as any).mockResolvedValueOnce({ id: 'centre', organisationId: 'org-1' });
    const canAccess = await canUserAccessSafeguardingRecords('owner', 'centre');
    expect(canAccess).toBe(true);
  });

  it('MANAGER can read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'manager', role: 'MANAGER', organisationId: 'org-1' });
    (db.query.orgMemberships.findFirst as any).mockResolvedValueOnce({ role: 'MANAGER', organisationId: 'org-1' });
    (db.query.centreMemberships.findFirst as any).mockResolvedValueOnce({
      role: 'MANAGER',
      centre: { id: 'centre', organisationId: 'org-1' },
    });
    const canAccess = await canUserAccessSafeguardingRecords('manager', 'centre');
    expect(canAccess).toBe(true);
  });

  it('FRONT_DESK cannot read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'frontdesk', role: 'FRONT_DESK', organisationId: 'org-1' });
    (db.query.orgMemberships.findFirst as any).mockResolvedValueOnce({ role: 'FRONT_DESK', organisationId: 'org-1' });
    (db.query.centreMemberships.findFirst as any).mockResolvedValueOnce({
      role: 'FRONT_DESK',
      centre: { id: 'centre', organisationId: 'org-1' },
    });
    const canAccess = await canUserAccessSafeguardingRecords('frontdesk', 'centre');
    expect(canAccess).toBe(false);
  });

  it('TUTOR cannot read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'tutor', role: 'TUTOR', organisationId: 'org-1' });
    (db.query.orgMemberships.findFirst as any).mockResolvedValueOnce({ role: 'TUTOR', organisationId: 'org-1' });
    (db.query.centreMemberships.findFirst as any).mockResolvedValueOnce({
      role: 'TUTOR',
      centre: { id: 'centre', organisationId: 'org-1' },
    });
    const canAccess = await canUserAccessSafeguardingRecords('tutor', 'centre');
    expect(canAccess).toBe(false);
  });

  it('Unassigned user cannot read safeguarding records', async () => {
    (db.query.users.findFirst as any).mockResolvedValueOnce(null);
    const canAccess = await canUserAccessSafeguardingRecords('noaccess', 'centre');
    expect(canAccess).toBe(false);
  });
});
