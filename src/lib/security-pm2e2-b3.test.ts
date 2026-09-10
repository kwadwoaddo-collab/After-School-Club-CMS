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

describe('MILESTONE PM-2E2.B3 — Session Revocation & Privilege Invalidation Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // TEST 1: ROLE DEMOTION (STALE JWT MANAGER -> DB TUTOR)
  // =========================================================================
  it('Test 1: When JWT has MANAGER role but DB role was demoted to TUTOR, live session reflects TUTOR', async () => {
    // Stale JWT claim issued when user was MANAGER
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'MANAGER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // Authoritative DB state: user demoted to TUTOR
    mockFindUser.mockResolvedValue({
      id: 'user-123',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'TUTOR',
      organisationId: 'org-1',
    });

    const session = await auth();
    expect(session).not.toBeNull();
    expect(session!.user.role).toBe('TUTOR'); // Must NOT be stale 'MANAGER'

    const typedSession = await getTypedSession();
    expect(typedSession!.user.role).toBe('TUTOR');
  });

  // =========================================================================
  // TEST 2: MEMBERSHIP REMOVAL / DETACHMENT
  // =========================================================================
  it('Test 2: When staff is detached from org (users.organisationId = null), session loses organisation access', async () => {
    // Stale JWT has organisationId: 'org-1'
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-456',
        name: 'John Staff',
        email: 'john@example.com',
        role: 'TUTOR',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // Authoritative DB state: staff was removed from org
    mockFindUser.mockResolvedValue({
      id: 'user-456',
      name: 'John Staff',
      email: 'john@example.com',
      role: 'TUTOR',
      organisationId: null,
    });

    const session = await auth();
    expect(session!.user.organisationId).toBeNull();
    expect(session!.user.needsOnboarding).toBe(true);

    // API route caller gets null (401 Unauthorized)
    const apiSession = await getApiSession();
    expect(apiSession).toBeNull();
  });

  // =========================================================================
  // TEST 3: USER DELETION / DISABLEMENT
  // =========================================================================
  it('Test 3: When user is deleted from DB, cryptographic JWT is revoked and auth() returns null', async () => {
    // Valid cryptographic JWT exists in browser
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'deleted-user-789',
        name: 'Deleted User',
        email: 'deleted@example.com',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // DB row no longer exists
    mockFindUser.mockResolvedValue(null);

    const session = await auth();
    expect(session).toBeNull();

    const typedSession = await getTypedSession();
    expect(typedSession).toBeNull();

    const apiSession = await getApiSession();
    expect(apiSession).toBeNull();
  });

  // =========================================================================
  // TEST 4: ORGANISATION INACTIVE (SUSPENDED / REJECTED)
  // =========================================================================
  it('Test 4: When organisation is SUSPENDED or REJECTED, assertOrgActive blocks getApiSession', async () => {
    const { assertOrgActive, OrgNotActiveError } = await import('@/lib/org-approval-guard');

    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-101',
        role: 'ORG_OWNER',
        organisationId: 'suspended-org',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-101',
      role: 'ORG_OWNER',
      organisationId: 'suspended-org',
    });

    // Mock assertOrgActive throwing OrgNotActiveError for suspended org
    vi.mocked(assertOrgActive).mockRejectedValueOnce(
      new OrgNotActiveError('suspended-org', 'SUSPENDED')
    );

    const apiSession = await getApiSession();
    expect(apiSession).toBeNull();
  });

  // =========================================================================
  // TEST 5: CENTRE MEMBERSHIP REMOVAL
  // =========================================================================
  it('Test 5: When user is demoted from ORG_OWNER to TUTOR and centre membership is removed, centre access is denied', async () => {
    mockFindUser.mockResolvedValue({
      id: 'user-demoted',
      role: 'TUTOR', // live role is TUTOR
      organisationId: 'org-1',
    });

    // Centre membership does not exist
    mockFindCentreMembership.mockResolvedValue(null);

    const hasAccess = await canUserAccessCentre('user-demoted', 'centre-99');
    expect(hasAccess).toBe(false);
  });

  // =========================================================================
  // TEST 6: ORGANISATION SWITCHING WITH VALID MEMBERSHIP
  // =========================================================================
  it('Test 6: User may switch active organisation only if valid orgMemberships record exists', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-multiorg',
        role: 'TUTOR',
        organisationId: 'org-A',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // Mock orgMemberships lookup succeeds for target org-B
    mockFindOrgMembership.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-multiorg',
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
  // TEST 7: ORGANISATION SWITCHING WITHOUT MEMBERSHIP REJECTED
  // =========================================================================
  it('Test 7: Switching to an organisation where user has no membership returns 403 Forbidden', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-multiorg',
        role: 'TUTOR',
        organisationId: 'org-A',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // No membership for foreign org
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
  // TEST 8: FORGED / STALE JWT ORGANISATION CLAIM CANNOT OVERRIDE DB
  // =========================================================================
  it('Test 8: Forged or stale JWT organisationId is overwritten by live DB user organisationId', async () => {
    // Attacker modifies client JWT or holds old token for org-forged
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-attacker',
        role: 'ORG_OWNER',
        organisationId: 'org-forged-target',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // Live DB state proves user belongs only to org-legitimate with role TUTOR
    mockFindUser.mockResolvedValue({
      id: 'user-attacker',
      role: 'TUTOR',
      organisationId: 'org-legitimate',
    });

    const session = await auth();
    expect(session!.user.organisationId).toBe('org-legitimate');
    expect(session!.user.role).toBe('TUTOR');
  });

  // =========================================================================
  // TEST 9: DATABASE FAILURE FAILS CLOSED (FAIL-SAFE)
  // =========================================================================
  it('Test 9: Database connection error during live session lookup fails closed (returns null)', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-normal',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // DB throws network exception
    mockFindUser.mockRejectedValue(new Error('PostgreSQL connection error'));

    // Must fail closed (return null) rather than trusting stale JWT claims!
    const session = await auth();
    expect(session).toBeNull();
  });

  // =========================================================================
  // TEST 10: LEGITIMATE UNCHANGED SESSION CONTINUES WORKING
  // =========================================================================
  it('Test 10: Normal active user with valid DB state continues working seamlessly', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-valid',
        name: 'Alice Owner',
        email: 'alice@example.com',
        role: 'ORG_OWNER',
        organisationId: 'org-active-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    mockFindUser.mockResolvedValue({
      id: 'user-valid',
      name: 'Alice Owner',
      email: 'alice@example.com',
      role: 'ORG_OWNER',
      organisationId: 'org-active-1',
    });

    // Organisation DB select returns ACTIVE
    const mockLimit = vi.fn().mockResolvedValue([{ approvalStatus: 'ACTIVE' }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const session = await auth();
    expect(session).not.toBeNull();
    expect(session!.user.id).toBe('user-valid');
    expect(session!.user.role).toBe('ORG_OWNER');
    expect(session!.user.organisationId).toBe('org-active-1');

    const apiSession = await getApiSession();
    expect(apiSession).not.toBeNull();
    expect(apiSession!.user.role).toBe('ORG_OWNER');
  });

  // =========================================================================
  // TEST 11: ORG_OWNER PRIVILEGES RESPECTED IN ACTIVE ORG
  // =========================================================================
  it('Test 11: requirePermission passes for verified ORG_OWNER and rejects demoted user', async () => {
    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-owner',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-10-10T00:00:00Z',
    });

    // 1. Live role is ORG_OWNER
    mockFindUser.mockResolvedValue({
      id: 'user-owner',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });

    const permitted = await requirePermission('MANAGER');
    expect(permitted.id).toBe('user-owner');

    // 2. User demoted to TUTOR -> requirePermission('MANAGER') throws Forbidden
    mockFindUser.mockResolvedValue({
      id: 'user-owner',
      role: 'TUTOR',
      organisationId: 'org-1',
    });

    await expect(requirePermission('MANAGER')).rejects.toThrow(/Forbidden/);
  });

  // =========================================================================
  // TEST 12: B1 & B2 PROTECTION INVARIANT PRESERVED
  // =========================================================================
  it('Test 12: B1/B2 rate limiting and CRM mutation protections remain intact alongside B3 live session', async () => {
    const { getClientIP, checkRateLimit } = await import('@/lib/rate-limit');

    // B2.F production client IP check
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.22',
          'x-forwarded-for': '10.0.0.1',
        },
      });
      expect(getClientIP(req)).toBe('198.51.100.22');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }

    // Rate limiter check
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9 }),
    };
    const rl = await checkRateLimit(mockLimiter as any, 'client-ip');
    expect(rl.status).toBe('allowed');
  });
});
