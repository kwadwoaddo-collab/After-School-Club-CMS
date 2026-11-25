import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuditInsertValues = vi.fn().mockResolvedValue([]);

vi.mock('@/db', () => ({
  db: {
    query: {
      organisations: { findFirst: vi.fn() },
      parents: { findMany: vi.fn() },
      children: { findMany: vi.fn() },
      registrations: { findMany: vi.fn() },
      bookings: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockAuditInsertValues })),
  },
}));

vi.mock('@/lib/session', () => ({
  requireTenantSession: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentres: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { db } from '@/db';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentres } from '@/lib/permissions';
import * as gdprActionsModule from '../gdpr.actions';
import { exportOrganisationData } from '../gdpr.actions';
import { WHOLE_ORG_EXPORT_SAR_NOTICE } from '../gdpr.constants';

describe('exportOrganisationData (UK GDPR controller archive & audit logging)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports only async functions from the "use server" module for Next.js 16 Turbopack compatibility', () => {
    const entries = Object.entries(gdprActionsModule);
    expect(entries.length).toBeGreaterThan(0);
    for (const [, value] of entries) {
      expect(typeof value).toBe('function');
      expect(value.constructor.name).toBe('AsyncFunction');
    }
  });

  it('returns Unauthorised when session has no organisationId and writes no audit event', async () => {
    vi.mocked(requireTenantSession).mockResolvedValueOnce(null as never);

    const res = await exportOrganisationData();
    expect(res).toEqual({ ok: false, error: 'Unauthorised' });
    expect(mockAuditInsertValues).not.toHaveBeenCalled();
  });

  it.each(['MANAGER', 'FRONT_DESK', 'TUTOR'] as const)(
    'returns Forbidden when caller role is %s and writes no audit event',
    async (role) => {
      vi.mocked(requireTenantSession).mockResolvedValueOnce({
        user: { id: 'user-1', organisationId: 'org-1', role },
      } as never);

      const res = await exportOrganisationData();
      expect(res).toEqual({ ok: false, error: 'Forbidden' });
      expect(mockAuditInsertValues).not.toHaveBeenCalled();
    },
  );

  it('records immutable gdpr_org_export audit event and embeds UK GDPR Art. 15(4) controller notice for ORG_OWNER', async () => {
    vi.mocked(requireTenantSession).mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: 'org-1', role: 'ORG_OWNER' },
    } as never);
    vi.mocked(getUserAccessibleCentres).mockResolvedValueOnce([{ id: 'centre-1' }] as never);

    vi.mocked(db.query.organisations.findFirst).mockResolvedValueOnce({
      name: 'SprintScale Club',
      slug: 'sprintscale-club',
    } as never);
    vi.mocked(db.query.parents.findMany).mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }] as never);
    vi.mocked(db.query.children.findMany).mockResolvedValueOnce([{ id: 'c1' }] as never);
    vi.mocked(db.query.registrations.findMany).mockResolvedValueOnce([{ id: 'r1' }] as never);
    vi.mocked(db.query.bookings.findMany).mockResolvedValueOnce([{ id: 'b1' }] as never);

    const res = await exportOrganisationData();

    expect(res.ok).toBe(true);
    expect(mockAuditInsertValues).toHaveBeenCalledOnce();
    const auditArg = mockAuditInsertValues.mock.calls[0][0];
    expect(auditArg).toMatchObject({
      organisationId: 'org-1',
      userId: 'owner-1',
      eventType: 'gdpr_org_export',
    });

    const eventData = JSON.parse(auditArg.eventData);
    expect(eventData).toMatchObject({
      actorUserId: 'owner-1',
      totalParents: 2,
      totalStudents: 1,
      totalRegistrations: 1,
      totalBookings: 1,
    });

    const parsedArchive = JSON.parse(res.json!);
    expect(parsedArchive.dataProtectionNotice).toBe(WHOLE_ORG_EXPORT_SAR_NOTICE);
    expect(parsedArchive.dataProtectionNotice).toContain('UK GDPR Art. 15(4)');
    expect(parsedArchive.summary).toEqual({
      totalParents: 2,
      totalStudents: 1,
      totalRegistrations: 1,
      totalBookings: 1,
    });
  });
});
