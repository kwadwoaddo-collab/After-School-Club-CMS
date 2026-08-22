/**
 * Milestone 3C — Staff module authorisation regression tests.
 *
 * Companion to src/features/students/authorization.test.ts and
 * src/features/parents/authorization.test.ts. Unlike those two modules,
 * Staff's policy is NOT the People-module three-role tuple — every route and
 * mutation here is already ORG_OWNER only (see
 * project-notes/milestone-3c-staff-audit.md §5), corroborated independently
 * by the pre-existing `/dashboard/staff denies FRONT_DESK` case in
 * src/lib/security-p6.test.ts. This file covers what that pre-existing
 * coverage doesn't: the newly-gated invite page, the newly-fixed
 * owner-removal guard on POST /api/staff/remove, org isolation on that same
 * endpoint, and updateStaffRole's self-change/owner-safety behaviour.
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

// updateStaffRole's one success-path test runs revalidatePath() to
// completion, which throws "static generation store missing" outside a real
// Next.js request scope — mock it, same as any other Next-runtime API this
// test suite doesn't actually exercise.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Every protected page/action transitively imports @/db — without
// DATABASE_URL set, importing the real module throws at evaluation time, so
// it must be mocked even though the denial-path tests never reach a query.
// Same rationale as security-p6.test.ts / the Students/Parents authorization
// suites.
vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      centres: { findFirst: vi.fn(), findMany: vi.fn() },
      staffInvites: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
        innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        orderBy: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: vi.fn(),
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

describe('Staff page authorisation — denial paths', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('/dashboard/staff/invite denies a non-ORG_OWNER — the gap fixed this milestone', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { default: InviteStaffPage } = await import('@/app/dashboard/staff/invite/page');

    await expect(InviteStaffPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/staff/invite denies an unauthenticated request', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { default: InviteStaffPage } = await import('@/app/dashboard/staff/invite/page');

    await expect(InviteStaffPage()).rejects.toThrow('REDIRECT:/login');
  });

  it('/dashboard/staff/invite passes the auth gate for ORG_OWNER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { default: InviteStaffPage } = await import('@/app/dashboard/staff/invite/page');

    // Should render (not throw a REDIRECT) — proves the role gate passed.
    await expect(InviteStaffPage()).resolves.toBeTruthy();
  });

  it('/dashboard/staff/[userId] denies a non-ORG_OWNER (normalised to requireAuth this milestone)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { default: StaffDetailPage } = await import('@/app/dashboard/staff/[userId]/page');

    await expect(
      StaffDetailPage({ params: Promise.resolve({ userId: 'target-1' }) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/staff/[userId] denies an unauthenticated request', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { default: StaffDetailPage } = await import('@/app/dashboard/staff/[userId]/page');

    await expect(
      StaffDetailPage({ params: Promise.resolve({ userId: 'target-1' }) } as any)
    ).rejects.toThrow('REDIRECT:/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/staff/remove — role enforcement, self-protection, and the
//    newly-added owner-removal guard
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/staff/remove', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // UUID_RE in the real route requires a well-formed UUID — plain slugs like
  // 'target-manager' are rejected as "Invalid userId format" before the
  // handler ever reaches the DB, so every id used below is a valid UUID v4.
  const CALLER_ID = '11111111-1111-4111-8111-111111111111';
  const TARGET_OWNER_ID = '22222222-2222-4222-8222-222222222222';
  const TARGET_MANAGER_ID = '33333333-3333-4333-8333-333333333333';
  const OTHER_ORG_USER_ID = '44444444-4444-4444-8444-444444444444';

  function req(userId: string) {
    return new Request('http://localhost/api/staff/remove', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  it('denies a non-ORG_OWNER with 403', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_ID }));
    const { POST } = await import('@/app/api/staff/remove/route');

    const res = await POST(req(TARGET_MANAGER_ID) as any);
    expect(res.status).toBe(403);
  });

  it('denies an unauthenticated request with 401', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/staff/remove/route');

    const res = await POST(req(TARGET_MANAGER_ID) as any);
    expect(res.status).toBe(401);
  });

  it('blocks removing yourself with 400', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: CALLER_ID }));
    const { POST } = await import('@/app/api/staff/remove/route');

    const res = await POST(req(CALLER_ID) as any);
    expect(res.status).toBe(400);
  });

  it('blocks removing another ORG_OWNER with 400 — the fix added this milestone', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: CALLER_ID }));
    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: TARGET_OWNER_ID, role: 'ORG_OWNER', organisationId: 'org-1' },
          ]),
        }),
      }),
    });
    const { POST } = await import('@/app/api/staff/remove/route');

    const res = await POST(req(TARGET_OWNER_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/cannot remove another owner/i);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('allows removing a non-owner target belonging to the same org', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: CALLER_ID }));
    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: TARGET_MANAGER_ID, role: 'MANAGER', organisationId: 'org-1' },
          ]),
        }),
      }),
    });
    const { POST } = await import('@/app/api/staff/remove/route');

    const res = await POST(req(TARGET_MANAGER_ID) as any);
    expect(res.status).toBe(200);
    expect(db.delete).toHaveBeenCalled();
  });

  it('404s for a target outside the caller\'s organisation (org isolation)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: CALLER_ID }));
    const { db } = await import('@/db');
    // Mocked query mirrors the real `and(eq(id), eq(organisationId))` — a
    // cross-org target never matches, so the mock returns nothing, exactly
    // as the real WHERE clause would.
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }),
    });
    const { POST } = await import('@/app/api/staff/remove/route');

    const res = await POST(req(OTHER_ORG_USER_ID) as any);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. updateStaffRole server action
// ─────────────────────────────────────────────────────────────────────────────

describe('updateStaffRole', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects a non-ORG_OWNER caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: 'u1' }));
    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'MANAGER' }]) }) }),
    });
    const { updateStaffRole } = await import('@/features/staff/staff-actions');

    await expect(updateStaffRole('target-1', 'TUTOR')).rejects.toThrow(
      'Only Organisation Owners can change staff roles'
    );
  });

  it('blocks an ORG_OWNER from changing their own role — this is what makes the action ownerless-org-safe (see audit §5)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: 'u1' }));
    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'ORG_OWNER' }]) }) }),
    });
    const { updateStaffRole } = await import('@/features/staff/staff-actions');

    await expect(updateStaffRole('u1', 'MANAGER')).rejects.toThrow(
      'You cannot change your own role'
    );
  });

  it('allows an ORG_OWNER to demote a different staff member', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: 'u1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'ORG_OWNER' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: 'target-1', organisationId: 'org-1' }]),
          }),
        }),
      });
    const { updateStaffRole } = await import('@/features/staff/staff-actions');

    await expect(updateStaffRole('target-1', 'MANAGER')).resolves.toBeUndefined();
    expect(db.update).toHaveBeenCalled();
  });

  it('rejects a target outside the caller\'s organisation (org isolation)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { id: 'u1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'ORG_OWNER' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }),
      });
    const { updateStaffRole } = await import('@/features/staff/staff-actions');

    await expect(updateStaffRole('other-org-user', 'MANAGER')).rejects.toThrow(
      'Staff member not found or access denied'
    );
  });
});
