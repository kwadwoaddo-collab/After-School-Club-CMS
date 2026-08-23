/**
 * Milestone 3B — Parents module authorisation regression tests.
 *
 * Companion to src/features/students/authorization.test.ts and
 * src/lib/security-p6.test.ts. Before this milestone, Parents had almost no
 * server-side role enforcement (see project-notes/milestone-3-people-audit.md
 * §3 and project-notes/milestone-3b-parents-audit.md §4) — only
 * `PATCH /api/parents/[id]` had a role check. This file covers the gaps
 * closed this milestone: the three page-level gates (list, detail, bin) and
 * the four bin.actions.ts mutations (softDeleteParent, restoreParent,
 * hardDeleteParent, purgeStaleBinItems), all now enforcing the same rule
 * already established across the People module: ORG_OWNER, MANAGER, and
 * FRONT_DESK are allowed; TUTOR is not. It also adds regression coverage for
 * the previously-untested PATCH endpoint.
 *
 * Milestone 3E update: GET /api/parents/[id] — left deliberately
 * unrestricted in 3B pending a cross-module Bookings audit (it is also
 * consumed by BookingForm) — now uses the same role tuple, per the
 * completed audit in project-notes/milestone-3e-bookings-audit.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

// Every protected page/action transitively imports @/db — without
// DATABASE_URL set, importing the real module throws at evaluation time, so
// it must be mocked even though the denial-path tests never reach a query.
// Same rationale as security-p6.test.ts / authorization.test.ts (Students).
vi.mock('@/db', () => ({
  db: {
    query: {
      parents: { findFirst: vi.fn(), findMany: vi.fn() },
      children: { findFirst: vi.fn(), findMany: vi.fn() },
      invoices: { findMany: vi.fn() },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
    insert: vi.fn(),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  },
}));

function sessionFor(role: string, overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'u1',
      organisationId: 'org-1',
      role,
      name: 'Test User',
      ...overrides,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Page-level denial paths
// ─────────────────────────────────────────────────────────────────────────────

describe('Parents page authorisation — denial paths', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('/dashboard/parents denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: ParentsPage } = await import('@/app/dashboard/parents/page');

    await expect(
      ParentsPage({ searchParams: Promise.resolve({}) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/parents denies an unauthenticated request', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { default: ParentsPage } = await import('@/app/dashboard/parents/page');

    await expect(
      ParentsPage({ searchParams: Promise.resolve({}) } as any)
    ).rejects.toThrow('REDIRECT:/login');
  });

  it('/dashboard/parents/[id] denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: ParentDetailPage } = await import('@/app/dashboard/parents/[id]/page');

    await expect(
      ParentDetailPage({ params: Promise.resolve({ id: 'p1' }) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/parents/bin denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: BinPage } = await import('@/app/dashboard/parents/bin/page');

    await expect(BinPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    '/dashboard/parents/bin does not short-circuit on role for %s (passes the auth gate)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { db } = await import('@/db');
      (db.execute as any).mockResolvedValueOnce([]);
      const { default: BinPage } = await import('@/app/dashboard/parents/bin/page');

      // Should render (not throw a REDIRECT) — proves the role gate passed.
      await expect(BinPage()).resolves.toBeTruthy();
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. bin.actions.ts — role enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe('Parents bin actions — role enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const actionNames = ['softDeleteParent', 'restoreParent', 'hardDeleteParent'] as const;

  it.each(actionNames)('%s denies TUTOR before touching the database', async (actionName) => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const actions = await import('@/app/dashboard/parents/bin.actions');

    await expect((actions as any)[actionName]('parent-1')).rejects.toThrow('Unauthorized');
  });

  it.each(actionNames)('%s denies an unauthenticated caller', async (actionName) => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const actions = await import('@/app/dashboard/parents/bin.actions');

    await expect((actions as any)[actionName]('parent-1')).rejects.toThrow('Unauthorized');
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    'softDeleteParent does not short-circuit on role for %s (passes the auth gate)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { db } = await import('@/db');
      // No matching parent — proves we got past the auth gate and reached
      // the (separately-tested) parent lookup, not that the mutation succeeds.
      (db.query.parents.findFirst as any).mockResolvedValueOnce(undefined);
      const { softDeleteParent } = await import('@/app/dashboard/parents/bin.actions');

      await expect(softDeleteParent('parent-1')).rejects.toThrow('Parent not found');
    }
  );

  it('purgeStaleBinItems silently no-ops for TUTOR rather than deleting anything', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { db } = await import('@/db');
    const { purgeStaleBinItems } = await import('@/app/dashboard/parents/bin.actions');

    await purgeStaleBinItems();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('purgeStaleBinItems proceeds for ORG_OWNER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { db } = await import('@/db');
    const { purgeStaleBinItems } = await import('@/app/dashboard/parents/bin.actions');

    await purgeStaleBinItems();
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /api/parents/[id] — regression coverage for the pre-existing gate
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/parents/[id] — role enforcement (pre-existing, now covered)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('denies TUTOR with 403 before touching the request body', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { PATCH } = await import('@/app/api/parents/[id]/route');

    const req = new Request('http://localhost/api/parents/p1', { method: 'PATCH', body: 'not json' });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('denies an unauthenticated request with 401', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { PATCH } = await import('@/app/api/parents/[id]/route');

    const req = new Request('http://localhost/api/parents/p1', { method: 'PATCH', body: 'not json' });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    'does not short-circuit on role for %s (passes the auth gate)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { PATCH } = await import('@/app/api/parents/[id]/route');

      const req = new Request('http://localhost/api/parents/p1', { method: 'PATCH', body: '{}' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'p1' }) });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/parents/[id] — role gate closed in Milestone 3E
// ─────────────────────────────────────────────────────────────────────────────
//
// This endpoint was deliberately left role-unrestricted in Milestone 3B,
// pending "a future, properly-scoped Bookings/cross-module authorization
// pass" (see project-notes/milestone-3b-parents-audit.md §4) — restricting
// it then risked breaking booking creation for a role that milestone hadn't
// audited. Milestone 3E performed that audit: this route's own PATCH
// handler already restricts to ['ORG_OWNER','MANAGER','FRONT_DESK'], the
// Parents detail page requires the same tuple, and BookingForm's only
// authenticated host page (/dashboard/bookings/new) also requires the same
// tuple — so GET now uses it too. See
// project-notes/milestone-3e-bookings-audit.md §H (Parents API finding).

describe('GET /api/parents/[id] — role enforcement (closed in Milestone 3E)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('denies TUTOR with 403 before touching the database', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { db } = await import('@/db');
    const { GET } = await import('@/app/api/parents/[id]/route');

    const req = new Request('http://localhost/api/parents/p1');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
    expect(db.query.parents.findFirst).not.toHaveBeenCalled();
  });

  it('denies an unauthenticated request with 401', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/parents/[id]/route');

    const req = new Request('http://localhost/api/parents/p1');
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    'does not short-circuit on role for %s (passes the auth gate)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { db } = await import('@/db');
      (db.query.parents.findFirst as any).mockResolvedValueOnce(undefined);
      const { GET } = await import('@/app/api/parents/[id]/route');

      const req = new Request('http://localhost/api/parents/p1');
      const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });
      // 404 (not found, since the mock returns nothing) proves the caller
      // reached the DB lookup rather than being denied for their role.
      expect(res.status).toBe(404);
    }
  );
});
