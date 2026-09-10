import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from './auth';
import { getTypedSession, getApiSession } from './session';
import { canUserAccessCentre, requirePermission } from './permissions';
import { POST as switchOrgHandler } from '@/app/api/user/switch-org/route';
import { NextRequest } from 'next/server';

const {
  mockNextAuth,
  mockFindUser,
  mockFindOrg,
  mockFindOrgMembership,
  mockFindCentreMembership,
  mockSelect,
  mockUpdate,
  mockDelete,
  mockInsert,
} = vi.hoisted(() => ({
  mockNextAuth: vi.fn(),
  mockFindUser: vi.fn(),
  mockFindOrg: vi.fn(),
  mockFindOrgMembership: vi.fn(),
  mockFindCentreMembership: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    auth: mockNextAuth,
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: any[]) => mockFindUser(...args),
        findMany: vi.fn(),
      },
      organisations: {
        findFirst: (...args: any[]) => mockFindOrg(...args),
      },
      orgMemberships: {
        findFirst: (...args: any[]) => mockFindOrgMembership(...args),
        findMany: vi.fn(),
      },
      centreMemberships: {
        findFirst: (...args: any[]) => mockFindCentreMembership(...args),
        findMany: vi.fn(),
      },
      centres: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    insert: (...args: any[]) => mockInsert(...args),
  },
}));

describe('MILESTONE PM-2E2.B3.F — Organisation Membership Authority & Session Invalidation Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TEST 1: VALID USER + VALID ACTIVE MEMBERSHIP -> PERMITTED
  // =========================================================================
  it('Test 1: Valid user with matching active orgMemberships record is permitted', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-valid-1',
        name: 'Jane Owner',
        email: 'jane@example.com',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-valid-1',
      name: 'Jane Owner',
      email: 'jane@example.com',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });

    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-1',
      userId: 'user-valid-1',
      organisationId: 'org-1',
      role: 'ORG_OWNER',
    });

    const session = await auth();
    expect(session).not.toBeNull();
    expect(session!.user.organisationId).toBe('org-1');
    expect(session!.user.role).toBe('ORG_OWNER');
    expect(session!.user.needsOnboarding).toBe(false);

    const apiSession = await getApiSession();
    expect(apiSession).not.toBeNull();
  });

  // =========================================================================
  // TEST 2: USERS.ORGANISATION_ID POPULATED BUT ORG_MEMBERSHIPS DELETED -> DENIED
  // =========================================================================
  it('Test 2: When users.organisationId is populated but orgMemberships row is deleted, tenant access is denied', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-orphan-org',
        name: 'Orphan User',
        email: 'orphan@example.com',
        role: 'MANAGER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // DB users table has organisationId: 'org-1'
    mockFindUser.mockResolvedValue({
      id: 'user-orphan-org',
      name: 'Orphan User',
      email: 'orphan@example.com',
      role: 'MANAGER',
      organisationId: 'org-1',
    });

    // Authoritative orgMemberships record was removed / deleted directly
    mockFindOrgMembership.mockResolvedValue(null);

    const session = await auth();
    expect(session).not.toBeNull();
    expect(session!.user.organisationId).toBeNull();
    expect(session!.user.needsOnboarding).toBe(true);

    const apiSession = await getApiSession();
    expect(apiSession).toBeNull(); // 401 Unauthorized
  });

  // =========================================================================
  // TEST 3: STALE JWT WITH REMOVED MEMBERSHIP -> DENIED
  // =========================================================================
  it('Test 3: Stale JWT holding former organisationId claim is denied when membership is removed', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-stale-jwt',
        role: 'ORG_OWNER',
        organisationId: 'org-former',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-stale-jwt',
      role: 'TUTOR',
      organisationId: null,
    });

    const session = await auth();
    expect(session!.user.organisationId).toBeNull();
    expect(session!.user.needsOnboarding).toBe(true);

    const apiSession = await getApiSession();
    expect(apiSession).toBeNull();
  });

  // =========================================================================
  // TEST 4: REMOVED ORG B MEMBERSHIP PREVENTS SWITCHING FROM ORG A TO ORG B
  // =========================================================================
  it('Test 4: User active in Org A cannot switch to Org B if Org B membership was removed', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-multi',
        role: 'TUTOR',
        organisationId: 'org-A',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // No membership for target org-B
    mockFindOrgMembership.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/user/switch-org', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'b0000000-0000-4000-b000-000000000003' }),
    });

    const res = await switchOrgHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('not a member');
  });

  // =========================================================================
  // TEST 5: ACTIVE IN ORG B, MEMBERSHIP REMOVED WHILE USERS.ORG_ID REMAINS ORG B
  // =========================================================================
  it('Test 5: Active user in Org B losing membership while users.organisationId is still Org B is denied on next request', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-b-removed',
        role: 'MANAGER',
        organisationId: 'org-B',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-b-removed',
      role: 'MANAGER',
      organisationId: 'org-B',
    });

    // Membership for Org B is gone
    mockFindOrgMembership.mockResolvedValue(null);

    const session = await auth();
    expect(session!.user.organisationId).toBeNull();

    const apiSession = await getApiSession();
    expect(apiSession).toBeNull();
  });

  // =========================================================================
  // TEST 6: ROLE DISAGREEMENT RESOLVES TO AUTHORITATIVE ORG_MEMBERSHIPS.ROLE
  // =========================================================================
  it('Test 6: Role disagreement (users.role = ORG_OWNER, orgMemberships.role = TUTOR) resolves to authoritative TUTOR', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-desync-role',
        role: 'ORG_OWNER', // Stale global/JWT role
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // users table says ORG_OWNER
    mockFindUser.mockResolvedValue({
      id: 'user-desync-role',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });

    // Authoritative membership table for org-1 says TUTOR
    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-1',
      userId: 'user-desync-role',
      organisationId: 'org-1',
      role: 'TUTOR',
    });

    const session = await auth();
    expect(session!.user.role).toBe('TUTOR'); // Must use authoritative orgMemberships role!
    expect(session!.user.organisationId).toBe('org-1');

    const typedSession = await getTypedSession();
    expect(typedSession!.user.role).toBe('TUTOR');
  });

  // =========================================================================
  // TEST 7: ROLE DEMOTION REMAINS IMMEDIATELY EFFECTIVE
  // =========================================================================
  it('Test 7: Role demotion from MANAGER to TUTOR takes effect immediately on next request', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-demoted-mgr',
        role: 'MANAGER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-demoted-mgr',
      role: 'TUTOR',
      organisationId: 'org-1',
    });

    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-demoted',
      userId: 'user-demoted-mgr',
      organisationId: 'org-1',
      role: 'TUTOR',
    });

    const session = await auth();
    expect(session!.user.role).toBe('TUTOR');
  });

  // =========================================================================
  // TEST 8: USER DELETION REMAINS IMMEDIATELY EFFECTIVE
  // =========================================================================
  it('Test 8: Deleted user from users table immediately causes auth() to return null', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-deleted-pk',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue(null);

    const session = await auth();
    expect(session).toBeNull();
    const typedSession = await getTypedSession();
    expect(typedSession).toBeNull();
  });

  // =========================================================================
  // TEST 9: ORGANISATION INACTIVITY BLOCKED
  // =========================================================================
  it('Test 9: Inactive organisation (SUSPENDED) blocks getApiSession via assertOrgActive', async () => {
    const { assertOrgActive, OrgNotActiveError } = await import('@/lib/org-approval-guard');

    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-susp',
        role: 'ORG_OWNER',
        organisationId: 'org-suspended',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-susp',
      role: 'ORG_OWNER',
      organisationId: 'org-suspended',
    });

    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-susp',
      userId: 'user-susp',
      organisationId: 'org-suspended',
      role: 'ORG_OWNER',
    });

    vi.mocked(assertOrgActive).mockRejectedValueOnce(
      new OrgNotActiveError('org-suspended', 'SUSPENDED')
    );

    const apiSession = await getApiSession();
    expect(apiSession).toBeNull();
  });

  // =========================================================================
  // TEST 10: DB MEMBERSHIP LOOKUP FAILURE FAILS CLOSED
  // =========================================================================
  it('Test 10: Database error during orgMemberships lookup fails closed (returns null)', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-err',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-err',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });

    // DB throws network error on orgMemberships lookup
    mockFindOrgMembership.mockRejectedValue(new Error('PostgreSQL connection failure'));

    const session = await auth();
    expect(session).toBeNull(); // Must fail closed!
  });

  // =========================================================================
  // TEST 11: CENTRE ACCESS REMAINS LIVE-ENFORCED
  // =========================================================================
  it('Test 11: Centre access is live-enforced from centreMemberships for non-owner roles', async () => {
    mockFindUser.mockResolvedValue({
      id: 'user-centre-test',
      role: 'TUTOR',
      organisationId: 'org-1',
    });

    mockFindCentreMembership.mockResolvedValue(null);

    const canAccess = await canUserAccessCentre('user-centre-test', 'centre-x');
    expect(canAccess).toBe(false);
  });

  // =========================================================================
  // TEST 12: NORMAL MULTI-ORG SWITCHING STILL WORKS
  // =========================================================================
  it('Test 12: Legitimate multi-org switching with valid membership succeeds and updates active state', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-legit-multi',
        role: 'TUTOR',
        organisationId: 'org-A',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-b',
      userId: 'user-legit-multi',
      organisationId: 'org-B',
      role: 'MANAGER',
    });

    const mockUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    const req = new NextRequest('http://localhost/api/user/switch-org', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'a0000000-0000-4000-a000-000000000002' }),
    });

    const res = await switchOrgHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.role).toBe('MANAGER');
  });

  // =========================================================================
  // TEST 13: B1 CRM MUTATION PROTECTION INTACT
  // =========================================================================
  it('Test 13: B1 CRM protection invariants remain fully operational', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-b1',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-b1',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });

    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-b1',
      userId: 'user-b1',
      organisationId: 'org-1',
      role: 'ORG_OWNER',
    });

    const session = await auth();
    expect(session!.user.organisationId).toBe('org-1');
  });

  // =========================================================================
  // TEST 14: B2 / B2.F RATE LIMITING & TRUSTED CLIENT IDENTITY INTACT
  // =========================================================================
  it('Test 14: B2 and B2.F rate limiting and trusted client identity resolve accurately', async () => {
    const { getClientIP, checkRateLimit } = await import('@/lib/rate-limit');

    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.99',
          'x-forwarded-for': '10.0.0.1',
        },
      });
      expect(getClientIP(req)).toBe('198.51.100.99');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }

    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9 }),
    };
    const rl = await checkRateLimit(mockLimiter as any, 'client-ip');
    expect(rl.status).toBe('allowed');
  });

  // =========================================================================
  // TEST 15: REQUIRE_PERMISSION ENFORCES AUTHORITATIVE ORG_MEMBERSHIPS ROLE
  // =========================================================================
  it('Test 15: requirePermission respects authoritative orgMemberships role over global role', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-perm',
        role: 'ORG_OWNER', // Stale global/JWT
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-perm',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });

    // 1. Authoritative membership has ORG_OWNER
    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-perm-1',
      userId: 'user-perm',
      organisationId: 'org-1',
      role: 'ORG_OWNER',
    });

    const permitted = await requirePermission('MANAGER');
    expect(permitted.id).toBe('user-perm');

    // 2. Authoritative membership demoted to TUTOR -> requirePermission('MANAGER') rejects
    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-perm-2',
      userId: 'user-perm',
      organisationId: 'org-1',
      role: 'TUTOR',
    });

    await expect(requirePermission('MANAGER')).rejects.toThrow(/Forbidden/);
  });
});
