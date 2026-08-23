/**
 * Milestone 3I — Reports export security regression tests.
 *
 * Covers the confirmed defects fixed during the Reports Stage-A/B audit
 * (see project-notes/milestone-3i-reports-audit.md, §L "Export findings"):
 *
 * O.1/O.2 — getExportData() (src/features/bookings/actions.ts), Reports'
 *           bookings-CSV-export data source, blocked only TUTOR (not
 *           FRONT_DESK, unlike the Reports page itself) and had no centre
 *           scoping at all.
 * O.3/O.4/O.5 — getStudentExportData() (src/features/students/actions.ts),
 *           Reports' student-CSV-export data source, had the identical
 *           role gap plus no centre scoping and no soft-delete filtering.
 * O.6/O.7 — GET /api/reports/students, unlike its own sibling routes in the
 *           same directory, had no centre scoping and no soft-delete
 *           filtering.
 *
 * These functions live in bookings/actions.ts and students/actions.ts
 * (frozen-module files) because Reports is their only caller — grep
 * verified — but the fix is narrow and this file exists specifically so
 * the frozen modules' own test suites don't have to carry Reports-specific
 * regression coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: vi.fn(),
}));

// Chainable select() mock: .from().innerJoin()...innerJoin().where().orderBy()
// resolves to `rows`. Every intermediate call returns `this` so any chain
// length/shape works, matching the pattern used across this rebuild's other
// Drizzle-mocking test files (e.g. milestone-3h's actions.test.ts).
function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

function sessionFor(role: string, overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      organisationId: 'org-1',
      role,
      ...overrides,
    },
  };
}

describe('getExportData (bookings CSV export) — Milestone 3I O.1/O.2', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects an unauthenticated caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { getExportData } = await import('./../bookings/actions');

    await expect(getExportData()).rejects.toThrow('Unauthorized');
  });

  it('rejects TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { getExportData } = await import('./../bookings/actions');

    await expect(getExportData()).rejects.toThrow(/only Owner\/Manager/);
  });

  it('rejects FRONT_DESK (O.1 — previously not blocked)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { getExportData } = await import('./../bookings/actions');

    await expect(getExportData()).rejects.toThrow(/only Owner\/Manager/);
  });

  it('scopes results to the caller\'s accessible centres (O.2 — previously org-wide)', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-a']);
    const chain = makeSelectChain([{ bookingId: 'b1' }]);
    (db.select as any).mockReturnValueOnce(chain);

    const { getExportData } = await import('./../bookings/actions');
    const result = await getExportData();

    expect(getUserAccessibleCentreIds).toHaveBeenCalledWith('user-1');
    expect(chain.where).toHaveBeenCalled();
    expect(result).toEqual([{ bookingId: 'b1' }]);
  });

  it('returns an empty array without querying when the caller has zero accessible centres', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([]);

    const { getExportData } = await import('./../bookings/actions');
    const result = await getExportData();

    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('allows ORG_OWNER and MANAGER through the role gate', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');

    for (const role of ['ORG_OWNER', 'MANAGER']) {
      vi.clearAllMocks();
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-a']);
      (db.select as any).mockReturnValueOnce(makeSelectChain([]));

      const { getExportData } = await import('./../bookings/actions');
      await expect(getExportData()).resolves.toEqual([]);
    }
  });
});

describe('getStudentExportData (student CSV export) — Milestone 3I O.3/O.4/O.5', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects an unauthenticated caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { getStudentExportData } = await import('./../students/actions');

    await expect(getStudentExportData()).rejects.toThrow('Unauthorized');
  });

  it('rejects TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { getStudentExportData } = await import('./../students/actions');

    await expect(getStudentExportData()).rejects.toThrow(/only Owner\/Manager/);
  });

  it('rejects FRONT_DESK (O.3 — previously not blocked)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { getStudentExportData } = await import('./../students/actions');

    await expect(getStudentExportData()).rejects.toThrow(/only Owner\/Manager/);
  });

  it('scopes results to accessible centres, including centre-less children (O.4 — previously org-wide)', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-a']);
    const chain = makeSelectChain([{ studentId: 's1' }]);
    (db.select as any).mockReturnValueOnce(chain);

    const { getStudentExportData } = await import('./../students/actions');
    const result = await getStudentExportData();

    expect(getUserAccessibleCentreIds).toHaveBeenCalledWith('user-1');
    expect(chain.where).toHaveBeenCalled();
    expect(result).toEqual([{ studentId: 's1' }]);
  });

  it('returns an empty array without querying when the caller has zero accessible centres', async () => {
    const { auth } = await import('@/lib/auth');
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    const { db } = await import('@/db');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([]);

    const { getStudentExportData } = await import('./../students/actions');
    const result = await getStudentExportData();

    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });
});
