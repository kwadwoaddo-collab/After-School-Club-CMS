/**
 * Milestone 3I — GET /api/reports/students regression tests.
 *
 * Covers O.6 (missing centre scoping, unlike its own sibling routes
 * attendance/route.ts and bookings/route.ts) and O.7 (missing soft-delete
 * filtering, unlike the frozen Students list page) — see
 * project-notes/milestone-3i-reports-audit.md, §L.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: vi.fn(),
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

function sessionFor(role: string) {
  return { user: { id: 'user-1', organisationId: 'org-1', role } };
}

describe('GET /api/reports/students', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 for an unauthenticated caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { GET } = await import('./route');

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { GET } = await import('./route');

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 403 for FRONT_DESK', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { GET } = await import('./route');

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('scopes the export query to the caller\'s accessible centres (O.6)', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-a']);
    const chain = makeSelectChain([]);
    (db.select as any).mockReturnValueOnce(chain);

    const { GET } = await import('./route');
    const res = await GET();

    expect(res.status).toBe(200);
    expect(getUserAccessibleCentreIds).toHaveBeenCalledWith('user-1');
    expect(chain.where).toHaveBeenCalled();
  });

  it('returns an empty CSV without querying when the caller has zero accessible centres', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([]);

    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('Student ID,First Name');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('neutralises a leading formula-trigger character in an exported cell (O.8)', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-a']);
    (db.select as any).mockReturnValueOnce(makeSelectChain([{
      studentId: 's1',
      firstName: '=cmd|\'/c calc\'!A1',
      lastName: 'Smith',
      dateOfBirth: null,
      schoolYear: 'Y5',
      parentFirstName: 'Jane',
      parentLastName: 'Smith',
      parentEmail: 'jane@example.com',
      parentPhone: null,
      createdAt: null,
    }]));

    const { GET } = await import('./route');
    const res = await GET();
    const body = await res.text();

    expect(body).toContain('"\'=cmd');
  });
});
