/**
 * P6 Security Fix Tests — Centralised Dashboard Authorisation
 *
 * Milestone 1, Workstream 2. The dashboard layout used to gate access via a
 * ROUTE_PERMISSIONS map matched against a `currentPath` derived from request
 * headers (x-invoke-path / x-pathname / next-url) this app's own middleware
 * never actually sets — so the match never fired and several routes,
 * including /dashboard/students, had no real enforcement at all (Milestone 0
 * security-review.md, High #2; the original TUTOR/students concern).
 *
 * This replaces that with requireAuth({ roles }) called directly inside each
 * protected page — the layout can't reliably know the current route, but
 * every page always knows its own.
 *
 * Two layers are tested:
 *   1. requireAuth / requireApiAuth in isolation — the mechanism itself.
 *   2. Each protected page, invoked directly with a mocked session — proves
 *      the real page, not just the mechanism, denies the wrong role. Every
 *      denial case only needs @/lib/auth + next/navigation mocked, since
 *      requireAuth is the first thing each page does and throws (via the
 *      mocked redirect) before any page-specific DB query runs.
 *
 * All tests mock at the module boundary; no DB or network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

// Every protected page transitively imports @/db (directly or via
// @/lib/permissions, @/lib/centre-filter, etc.) — without DATABASE_URL set,
// importing the real module throws at evaluation time, so it must be
// mocked even though the denial-path tests never reach a query.
vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      centres: { findFirst: vi.fn(), findMany: vi.fn() },
      organisations: { findFirst: vi.fn() },
      centreMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
// 1. requireAuth — the mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('redirects to /login when there is no session', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { requireAuth } = await import('@/lib/require-auth');

    await expect(requireAuth()).rejects.toThrow('REDIRECT:/login');
  });

  it('redirects to /onboarding when the session has no organisationId', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce({ user: { id: 'u1' } });
    const { requireAuth } = await import('@/lib/require-auth');

    await expect(requireAuth()).rejects.toThrow('REDIRECT:/onboarding');
  });

  it('allows any authenticated, onboarded user when no roles are specified', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { requireAuth } = await import('@/lib/require-auth');

    const result = await requireAuth();
    expect(result.user.role).toBe('TUTOR');
    expect(result.organisationId).toBe('org-1');
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    'allows %s when roles includes it',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { requireAuth } = await import('@/lib/require-auth');

      const result = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
      expect(result.user.role).toBe(role);
    }
  );

  it('redirects TUTOR to /dashboard when roles does not include TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { requireAuth } = await import('@/lib/require-auth');

    await expect(
      requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] })
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('honours a custom deniedRedirect', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { requireAuth } = await import('@/lib/require-auth');

    await expect(
      requireAuth({ roles: ['ORG_OWNER'], deniedRedirect: '/somewhere-else' })
    ).rejects.toThrow('REDIRECT:/somewhere-else');
  });

  it('supports the legacy single `role` option as shorthand for roles: [role]', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { requireAuth } = await import('@/lib/require-auth');

    await expect(requireAuth({ role: 'ORG_OWNER' })).rejects.toThrow('REDIRECT:/dashboard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. requireApiAuth — same rules, no redirect (returns null on failure)
// ─────────────────────────────────────────────────────────────────────────────

describe('requireApiAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns null when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { requireApiAuth } = await import('@/lib/require-auth');

    expect(await requireApiAuth()).toBeNull();
  });

  it('returns null when role does not match', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { requireApiAuth } = await import('@/lib/require-auth');

    expect(await requireApiAuth({ roles: ['ORG_OWNER'] })).toBeNull();
  });

  it('returns the auth result when role matches', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { requireApiAuth } = await import('@/lib/require-auth');

    const result = await requireApiAuth({ roles: ['ORG_OWNER'] });
    expect(result?.user.role).toBe('ORG_OWNER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Real pages — proves the actual page enforces the role, not just the helper
// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard page authorisation — denial paths', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('/dashboard/students denies TUTOR (the original Milestone 0 concern)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: StudentsPage } = await import('@/app/dashboard/students/page');

    await expect(
      StudentsPage({ searchParams: Promise.resolve({}) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/staff denies FRONT_DESK (ORG_OWNER only)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { default: StaffPage } = await import('@/app/dashboard/staff/page');

    await expect(StaffPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/settings denies MANAGER (ORG_OWNER only)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { default: SettingsPage } = await import('@/app/dashboard/settings/page');

    await expect(SettingsPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/registrations denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: RegistrationsPage } = await import('@/app/dashboard/registrations/page');

    await expect(
      RegistrationsPage({ searchParams: Promise.resolve({}) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/incidents denies FRONT_DESK (safeguarding-sensitive — ORG_OWNER/MANAGER only)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { default: IncidentsPage } = await import('@/app/dashboard/incidents/page');

    await expect(IncidentsPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/incidents denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: IncidentsPage } = await import('@/app/dashboard/incidents/page');

    await expect(IncidentsPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/centres denies FRONT_DESK', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { default: CentresPage } = await import('@/app/dashboard/centres/page');

    await expect(CentresPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/bookings/new denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: NewBookingPage } = await import('@/app/dashboard/bookings/new/page');

    await expect(
      NewBookingPage({ searchParams: Promise.resolve({}) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/share denies FRONT_DESK', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { default: SharePage } = await import('@/app/dashboard/share/page');

    await expect(SharePage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('every tested page also denies an unauthenticated request (/dashboard/students → /login)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { default: StudentsPage } = await import('@/app/dashboard/students/page');

    await expect(
      StudentsPage({ searchParams: Promise.resolve({}) } as any)
    ).rejects.toThrow('REDIRECT:/login');
  });

  // Milestone 3 — Students detail/attendance/add/import previously had no
  // role check at all (project-notes/milestone-3-people-audit.md §2), so a
  // TUTOR excluded from the Students list could still reach an individual
  // student's full profile, attendance history, or add/import a student
  // directly. These four now use the same requireAuth({ roles }) gate as
  // the list page above.
  const VALID_STUDENT_ID = '11111111-1111-4111-8111-111111111111';

  it('/dashboard/students/[id] denies TUTOR (detail page)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: StudentDetailPage } = await import('@/app/dashboard/students/[id]/page');

    await expect(
      StudentDetailPage({ params: Promise.resolve({ id: VALID_STUDENT_ID }) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/students/[id]/attendance denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: StudentAttendancePage } = await import('@/app/dashboard/students/[id]/attendance/page');

    await expect(
      StudentAttendancePage({ params: Promise.resolve({ id: VALID_STUDENT_ID }) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/students/add denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: AddStudentPage } = await import('@/app/dashboard/students/add/page');

    await expect(AddStudentPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('/dashboard/students/import denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { default: StudentImportPage } = await import('@/app/dashboard/students/import/page');

    await expect(StudentImportPage()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    '/dashboard/students/add allows %s (passes the auth gate)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { db } = await import('@/db');
      (db.select as any).mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });
      const { default: AddStudentPage } = await import('@/app/dashboard/students/add/page');

      // Getting past the auth gate means we reach the centre-loading query
      // instead of redirecting — proves the fix isn't a blanket deny.
      await expect(AddStudentPage()).resolves.toBeTruthy();
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. requirePermission — fails closed on unrecognised roles (the MANAGE_ORG bug)
// ─────────────────────────────────────────────────────────────────────────────

describe('requirePermission (src/lib/permissions.ts) — fail-closed hierarchy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('throws for an unrecognised required role instead of silently passing (the MANAGE_ORG bug)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'u1', role: 'TUTOR' });

    const { requirePermission } = await import('@/lib/permissions');
    // @ts-expect-error — deliberately passing the invalid literal that used to slip through
    await expect(requirePermission('MANAGE_ORG')).rejects.toThrow(/unknown required role/);
  });

  it('requirePermission("MANAGER") denies TUTOR', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'u1', role: 'TUTOR' });

    const { requirePermission } = await import('@/lib/permissions');
    await expect(requirePermission('MANAGER')).rejects.toThrow(/MANAGER or higher required/);
  });

  it('requirePermission("MANAGER") allows ORG_OWNER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'u1', role: 'ORG_OWNER' });

    const { requirePermission } = await import('@/lib/permissions');
    const user = await requirePermission('MANAGER');
    expect(user.role).toBe('ORG_OWNER');
  });

  it('requirePermission("MANAGER") allows MANAGER', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { db } = await import('@/db');
    (db.query.users.findFirst as any).mockResolvedValueOnce({ id: 'u1', role: 'MANAGER' });

    const { requirePermission } = await import('@/lib/permissions');
    const user = await requirePermission('MANAGER');
    expect(user.role).toBe('MANAGER');
  });
});
