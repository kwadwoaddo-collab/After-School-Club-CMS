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

vi.mock('@/lib/rate-limit', () => ({
  strictRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendStaffInvitation: vi.fn().mockResolvedValue({ success: true }),
  },
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
      orgMemberships: { findFirst: vi.fn() },
      centreMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
        innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        orderBy: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
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

  it('/dashboard/staff/invite denies a non-manager/owner role (FRONT_DESK)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
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

  it('denies a non-ORG_OWNER / non-MANAGER (FRONT_DESK) with 403', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK', { id: CALLER_ID }));
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

  it('rejects a non-permitted caller (FRONT_DESK)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK', { id: 'u1' }));
    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'FRONT_DESK' }]) }) }),
    });
    const { updateStaffRole } = await import('@/features/staff/staff-actions');

    await expect(updateStaffRole('target-1', 'TUTOR')).rejects.toThrow(
      'Unauthorized to change staff roles'
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

  it('Manager caller: allows promoting eligible staff in authorised centre to MANAGER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: 'm1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'MANAGER' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: 'target-1', role: 'FRONT_DESK', organisationId: 'org-1' }]),
          }),
        }),
      })
      // Centre memberships of target
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ centreId: 'centre-1' }]),
        }),
      });
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: 'm1',
      role: 'MANAGER',
      memberships: [{ centre: { id: 'centre-1' } }],
    });

    const { updateStaffRole } = await import('@/features/staff/staff-actions');
    await expect(updateStaffRole('target-1', 'MANAGER')).resolves.toBeUndefined();
    expect(db.update).toHaveBeenCalled();
  });

  it('Manager caller: DENIED from promoting any staff to ORG_OWNER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: 'm1' }));
    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'MANAGER' }]) }) }),
    });

    const { updateStaffRole } = await import('@/features/staff/staff-actions');
    await expect(updateStaffRole('target-1', 'ORG_OWNER')).rejects.toThrow(
      'Forbidden: Managers cannot assign the Organisation Owner role'
    );
  });

  it('Manager caller: DENIED from modifying an ORG_OWNER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: 'm1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'MANAGER' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: 'target-owner', role: 'ORG_OWNER', organisationId: 'org-1' }]),
          }),
        }),
      });

    const { updateStaffRole } = await import('@/features/staff/staff-actions');
    await expect(updateStaffRole('target-owner', 'TUTOR')).rejects.toThrow(
      'Forbidden: Managers cannot modify Organisation Owners'
    );
  });

  it('Manager caller: DENIED from modifying staff belonging only to an unauthorised centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: 'm1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'MANAGER' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: 'target-1', role: 'FRONT_DESK', organisationId: 'org-1' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ centreId: 'unauthorised-centre' }]),
        }),
      });
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: 'm1',
      role: 'MANAGER',
      memberships: [{ centre: { id: 'authorised-centre' } }],
    });

    const { updateStaffRole } = await import('@/features/staff/staff-actions');
    await expect(updateStaffRole('target-1', 'TUTOR')).rejects.toThrow(
      'Forbidden: Staff member does not belong to your assigned centres'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Staff Removal Semantics & Scope Isolation (POST /api/staff/remove)
// ─────────────────────────────────────────────────────────────────────────────

describe('Staff Removal Semantics & Scope Isolation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const CALLER_MANAGER_ID = '11111111-1111-4111-8111-111111111111';
  const TARGET_STAFF_ID = '22222222-2222-4222-8222-222222222222';
  const CENTRE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const CENTRE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function req(userId: string) {
    return new Request('http://localhost/api/staff/remove', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  it('removes membership from Centre A, PRESERVES Centre B, PRESERVES user account and org membership', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: CALLER_MANAGER_ID,
      role: 'MANAGER',
      memberships: [{ centre: { id: CENTRE_A } }], // Manager only has Centre A
    });

    (db.select as any)
      .mockReset()
      // Target user in org
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { id: TARGET_STAFF_ID, role: 'FRONT_DESK', organisationId: 'org-1' },
            ]),
          }),
        }),
      })
      // Target memberships: Centre A and Centre B
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([
            { centreId: CENTRE_A },
            { centreId: CENTRE_B },
          ]),
        }),
      });

    const { POST } = await import('@/app/api/staff/remove/route');
    const res = await POST(req(TARGET_STAFF_ID) as any);

    expect(res.status).toBe(200);
    // Centre membership delete called
    expect(db.delete).toHaveBeenCalled();
    // User account organisationId NOT cleared (no db.update called)
    expect(db.update).not.toHaveBeenCalled();
  });

  it('even when target belongs ONLY to Centre A, user account and org membership are PRESERVED', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: CALLER_MANAGER_ID,
      role: 'MANAGER',
      memberships: [{ centre: { id: CENTRE_A } }],
    });

    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { id: TARGET_STAFF_ID, role: 'TUTOR', organisationId: 'org-1' },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ centreId: CENTRE_A }]),
        }),
      });

    const { POST } = await import('@/app/api/staff/remove/route');
    const res = await POST(req(TARGET_STAFF_ID) as any);

    expect(res.status).toBe(200);
    // User account organisationId NOT cleared!
    expect(db.update).not.toHaveBeenCalled();
  });

  it('denies Manager from removing staff belonging only to unauthorised Centre B with 403', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: CALLER_MANAGER_ID,
      role: 'MANAGER',
      memberships: [{ centre: { id: CENTRE_A } }],
    });

    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { id: TARGET_STAFF_ID, role: 'TUTOR', organisationId: 'org-1' },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ centreId: CENTRE_B }]),
        }),
      });

    const { POST } = await import('@/app/api/staff/remove/route');
    const res = await POST(req(TARGET_STAFF_ID) as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden: Staff member does not belong to your assigned centres');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Manager Inviting Staff / Another Manager (POST /api/staff/invite)
// ─────────────────────────────────────────────────────────────────────────────

describe('Manager Inviting Staff & Centre Scoping', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const CALLER_MANAGER_ID = '11111111-1111-4111-8111-111111111111';
  const CENTRE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const CENTRE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function inviteReq(payload: Record<string, unknown>) {
    return new Request('http://localhost/api/staff/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  it('allows Manager to invite a new MANAGER to authorised Centre A', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: CALLER_MANAGER_ID, role: 'MANAGER', organisationId: 'org-1' },
          ]),
        }),
      }),
    });

    (db.query.users.findFirst as any)
      // Manager accessible centres lookup
      .mockResolvedValueOnce({
        id: CALLER_MANAGER_ID,
        role: 'MANAGER',
        memberships: [{ centre: { id: CENTRE_A } }],
      })
      // Check existing user by email
      .mockResolvedValueOnce(null);

    // Validate centre in org
    (db.query.centres.findFirst as any).mockResolvedValueOnce({ id: CENTRE_A, name: 'Centre A' });

    const { POST } = await import('@/app/api/staff/invite/route');
    const res = await POST(inviteReq({
      email: 'newmanager@example.com',
      role: 'MANAGER',
      firstName: 'Jane',
      lastName: 'Manager',
      centreId: CENTRE_A,
    }) as any);

    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
  });

  it('denies Manager from inviting a MANAGER to unauthorised Centre B with 403', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: CALLER_MANAGER_ID, role: 'MANAGER', organisationId: 'org-1' },
          ]),
        }),
      }),
    });

    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: CALLER_MANAGER_ID,
      role: 'MANAGER',
      memberships: [{ centre: { id: CENTRE_A } }], // Caller only manages Centre A
    });

    const { POST } = await import('@/app/api/staff/invite/route');
    const res = await POST(inviteReq({
      email: 'newmanager@example.com',
      role: 'MANAGER',
      firstName: 'Jane',
      lastName: 'Manager',
      centreId: CENTRE_B, // Unauthorised Centre B
    }) as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden: You can only invite staff for your assigned centres');
  });

  it('denies Manager from inviting staff without a centreId with 403', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: CALLER_MANAGER_ID, role: 'MANAGER', organisationId: 'org-1' },
          ]),
        }),
      }),
    });

    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: CALLER_MANAGER_ID,
      role: 'MANAGER',
      memberships: [{ centre: { id: CENTRE_A } }],
    });

    const { POST } = await import('@/app/api/staff/invite/route');
    const res = await POST(inviteReq({
      email: 'newmanager@example.com',
      role: 'MANAGER',
      firstName: 'Jane',
      lastName: 'Manager',
      // centreId omitted
    }) as any);

    expect(res.status).toBe(403);
  });

  it('denies inviting with role ORG_OWNER with 400', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.select as any).mockReset().mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: CALLER_MANAGER_ID, role: 'MANAGER', organisationId: 'org-1' },
          ]),
        }),
      }),
    });

    const { POST } = await import('@/app/api/staff/invite/route');
    const res = await POST(inviteReq({
      email: 'newowner@example.com',
      role: 'ORG_OWNER',
      firstName: 'Boss',
      lastName: 'Owner',
      centreId: CENTRE_A,
    }) as any);

    expect(res.status).toBe(400); // Schema rejection
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Direct API Centre Assignment Bypass Checks (POST /api/staff/assign-centres)
// ─────────────────────────────────────────────────────────────────────────────

describe('Staff Centre Assignment Bypass Checks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const CALLER_MANAGER_ID = '11111111-1111-4111-8111-111111111111';
  const TARGET_STAFF_ID = '22222222-2222-4222-8222-222222222222';
  const TARGET_OWNER_ID = '33333333-3333-4333-8333-333333333333';
  const CENTRE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const CENTRE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function assignReq(payload: Record<string, unknown>) {
    return new Request('http://localhost/api/staff/assign-centres', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  it('denies Manager from assigning staff to unauthorised Centre B with 403', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      // Caller check
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: CALLER_MANAGER_ID, role: 'MANAGER' }]),
          }),
        }),
      })
      // Target user lookup
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { id: TARGET_STAFF_ID, role: 'TUTOR', organisationId: 'org-1' },
            ]),
          }),
        }),
      })
      // Org centres validation
      .mockReturnValueOnce({
        from: () => ({
          where: vi.fn().mockResolvedValue([{ id: CENTRE_B }]),
        }),
      });

    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: CALLER_MANAGER_ID,
      role: 'MANAGER',
      memberships: [{ centre: { id: CENTRE_A } }], // Caller only manages Centre A
    });

    const { POST } = await import('@/app/api/staff/assign-centres/route');
    const res = await POST(assignReq({
      userId: TARGET_STAFF_ID,
      centreIds: [CENTRE_B],
    }) as any);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden: You can only assign staff to centres you manage');
  });

  it('denies assigning centres to an ORG_OWNER with 400', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', { id: CALLER_MANAGER_ID }));

    const { db } = await import('@/db');
    (db.select as any)
      .mockReset()
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: CALLER_MANAGER_ID, role: 'MANAGER' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([
              { id: TARGET_OWNER_ID, role: 'ORG_OWNER', organisationId: 'org-1' },
            ]),
          }),
        }),
      });

    const { POST } = await import('@/app/api/staff/assign-centres/route');
    const res = await POST(assignReq({
      userId: TARGET_OWNER_ID,
      centreIds: [CENTRE_A],
    }) as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ORG_OWNER users have automatic access to all centres');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Role vs Centre Scope Architecture (getUserAccessibleCentres)
// ─────────────────────────────────────────────────────────────────────────────

describe('Role vs Centre Scope Architecture (permissions.ts)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('ORG_OWNER role returns ALL centres in the organisation', async () => {
    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: 'owner-1',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
      memberships: [],
    });
    (db.query.centres.findMany as any).mockResolvedValueOnce([
      { id: 'centre-a', name: 'Centre A' },
      { id: 'centre-b', name: 'Centre B' },
      { id: 'centre-c', name: 'Centre C' },
    ]);

    const { getUserAccessibleCentres } = await import('@/lib/permissions');
    const centres = await getUserAccessibleCentres('owner-1');

    expect(centres).toHaveLength(3);
    expect(centres.map(c => c.id)).toEqual(['centre-a', 'centre-b', 'centre-c']);
  });

  it('MANAGER role returns ONLY assigned centres from centreMemberships (does NOT grant all centres)', async () => {
    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({
      id: 'manager-1',
      role: 'MANAGER',
      organisationId: 'org-1',
      memberships: [{ centre: { id: 'centre-a', name: 'Centre A' } }],
    });

    const { getUserAccessibleCentres } = await import('@/lib/permissions');
    const centres = await getUserAccessibleCentres('manager-1');

    expect(centres).toHaveLength(1);
    expect(centres[0].id).toBe('centre-a');
  });
});
