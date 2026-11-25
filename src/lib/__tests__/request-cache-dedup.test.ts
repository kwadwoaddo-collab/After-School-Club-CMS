import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rscRequestStore = new AsyncLocalStorage<Map<unknown, Map<string, unknown>>>();

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
      const fnKey = Symbol('rsc-cache-fn');
      return (...args: Args): Result => {
        const store = rscRequestStore.getStore();
        if (!store) {
          return fn(...args);
        }
        let argMap = store.get(fnKey);
        if (!argMap) {
          argMap = new Map<string, unknown>();
          store.set(fnKey, argMap);
        }
        const key = JSON.stringify(args);
        if (argMap.has(key)) {
          return argMap.get(key) as Result;
        }
        const result = fn(...args);
        argMap.set(key, result);
        return result;
      };
    },
  };
});

const {
  mockNextAuth,
  mockFindUser,
  mockFindOrgMembership,
  mockFindCentres,
  mockFindCentre,
  mockFindCentreMemberships,
  mockSelect,
} = vi.hoisted(() => ({
  mockNextAuth: vi.fn(),
  mockFindUser: vi.fn(),
  mockFindOrgMembership: vi.fn(),
  mockFindCentres: vi.fn(),
  mockFindCentre: vi.fn(),
  mockFindCentreMemberships: vi.fn(),
  mockSelect: vi.fn(),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockFindUser(...args) },
      orgMemberships: { findFirst: (...args: unknown[]) => mockFindOrgMembership(...args) },
      centres: {
        findMany: (...args: unknown[]) => mockFindCentres(...args),
        findFirst: (...args: unknown[]) => mockFindCentre(...args),
      },
      centreMemberships: {
        findMany: (...args: unknown[]) => mockFindCentreMemberships(...args),
        findFirst: vi.fn(),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

function makeOrgSelectChain(rows: Array<{ approvalStatus: string }>) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  };
}

function runInRscRequest<T>(work: () => Promise<T>): Promise<T> {
  return rscRequestStore.run(new Map(), work);
}

describe('PR-16 (BE-5): Per-request RSC query deduplication & live revocation safety', () => {
  const originalEnableFlag = process.env.ENABLE_REQUEST_CACHE_IN_TEST;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnableFlag === undefined) {
      delete process.env.ENABLE_REQUEST_CACHE_IN_TEST;
    } else {
      process.env.ENABLE_REQUEST_CACHE_IN_TEST = originalEnableFlag;
    }
  });

  it('deduplicates assertOrgActive() within a single RSC request and re-queries on the next HTTP request (immediate suspension)', async () => {
    process.env.ENABLE_REQUEST_CACHE_IN_TEST = 'true';
    const { assertOrgActive, OrgNotActiveError } = await vi.importActual<
      typeof import('@/lib/org-approval-guard')
    >('@/lib/org-approval-guard');

    mockSelect.mockReturnValueOnce(makeOrgSelectChain([{ approvalStatus: 'ACTIVE' }]));

    // Request 1: Layout + Page + Child RSC all call assertOrgActive('org-1') -> 1 DB query
    await runInRscRequest(async () => {
      await expect(assertOrgActive('org-1')).resolves.toBeUndefined();
      await expect(assertOrgActive('org-1')).resolves.toBeUndefined();
      await expect(assertOrgActive('org-1')).resolves.toBeUndefined();
    });
    expect(mockSelect).toHaveBeenCalledTimes(1);

    // Operator suspends org-1 -> Request 2 immediately sees SUSPENDED (no cross-request cache)
    mockSelect.mockReturnValueOnce(makeOrgSelectChain([{ approvalStatus: 'SUSPENDED' }]));
    await runInRscRequest(async () => {
      await expect(assertOrgActive('org-1')).rejects.toThrow(OrgNotActiveError);
    });
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('deduplicates user membership & accessible centre queries within one RSC render while isolating returned arrays and subsequent requests', async () => {
    process.env.ENABLE_REQUEST_CACHE_IN_TEST = 'true';
    const {
      getUserAccessibleCentres,
      getUserAccessibleCentreIds,
      isOrgOwner,
      canUserAccessCentre,
    } = await import('@/lib/permissions');

    mockFindUser.mockResolvedValue({
      id: 'user-1',
      organisationId: 'org-1',
      role: 'ORG_OWNER',
    });
    mockFindOrgMembership.mockResolvedValue({
      userId: 'user-1',
      organisationId: 'org-1',
      role: 'ORG_OWNER',
    });
    mockFindCentres.mockResolvedValue([
      { id: 'c-1', name: 'Dagenham', organisationId: 'org-1' },
      { id: 'c-2', name: 'Lewisham', organisationId: 'org-1' },
    ]);
    mockFindCentre.mockResolvedValue({ id: 'c-1', organisationId: 'org-1' });

    await runInRscRequest(async () => {
      const centresA = await getUserAccessibleCentres('user-1');
      // Mutate caller's array to verify sibling Server Components receive a clean copy
      centresA.pop();

      const centreIds = await getUserAccessibleCentreIds('user-1');
      const owner = await isOrgOwner('user-1');
      const canAccess = await canUserAccessCentre('user-1', 'c-1');

      expect(centreIds).toEqual(['c-1', 'c-2']);
      expect(owner).toBe(true);
      expect(canAccess).toBe(true);
    });

    // Across 4 permission helper calls in 1 RSC render: only 1 user + 1 orgMembership + 1 centres.findMany
    expect(mockFindUser).toHaveBeenCalledTimes(1);
    expect(mockFindOrgMembership).toHaveBeenCalledTimes(1);
    expect(mockFindCentres).toHaveBeenCalledTimes(1);

    // Next HTTP request: user's orgMembership is revoked -> immediately denied
    mockFindOrgMembership.mockResolvedValueOnce(null);
    await runInRscRequest(async () => {
      expect(await getUserAccessibleCentres('user-1')).toEqual([]);
      expect(await isOrgOwner('user-1')).toBe(false);
    });
    expect(mockFindUser).toHaveBeenCalledTimes(2);
    expect(mockFindOrgMembership).toHaveBeenCalledTimes(2);
  });

  it('deduplicates zero-arg auth() and getTypedSession() within one RSC render and revalidates on the next request', async () => {
    process.env.ENABLE_REQUEST_CACHE_IN_TEST = 'true';
    const { auth } = await import('@/lib/auth');
    const { getTypedSession } = await import('@/lib/session');

    mockNextAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Jane Owner',
        email: 'jane@example.com',
        role: 'ORG_OWNER',
        organisationId: 'org-1',
      },
      expires: '2026-12-31T00:00:00.000Z',
    });
    mockFindUser.mockResolvedValue({
      id: 'user-1',
      name: 'Jane Owner',
      email: 'jane@example.com',
      role: 'ORG_OWNER',
      organisationId: 'org-1',
    });
    mockFindOrgMembership.mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      organisationId: 'org-1',
      role: 'ORG_OWNER',
    });

    await runInRscRequest(async () => {
      // Simulate DashboardLayout calling getTypedSession() + Page calling auth() + Component calling getTypedSession()
      const typed1 = await getTypedSession();
      const raw = await auth();
      const typed2 = await getTypedSession();

      expect(typed1?.user.organisationId).toBe('org-1');
      expect(raw?.user.organisationId).toBe('org-1');
      expect(typed2?.user.role).toBe('ORG_OWNER');
    });

    expect(mockNextAuth).toHaveBeenCalledTimes(1);
    expect(mockFindUser).toHaveBeenCalledTimes(1);
    expect(mockFindOrgMembership).toHaveBeenCalledTimes(1);

    // Next HTTP request: user deleted from DB -> auth() / getTypedSession() immediately return null
    mockFindUser.mockResolvedValueOnce(null);
    await runInRscRequest(async () => {
      expect(await getTypedSession()).toBeNull();
    });
    expect(mockFindUser).toHaveBeenCalledTimes(2);
  });

  it('bypasses React.cache by default under VITEST so unit tests reusing mock IDs never bleed', async () => {
    delete process.env.ENABLE_REQUEST_CACHE_IN_TEST;
    const { assertOrgActive, OrgNotActiveError } = await vi.importActual<
      typeof import('@/lib/org-approval-guard')
    >('@/lib/org-approval-guard');

    mockSelect.mockReturnValueOnce(makeOrgSelectChain([{ approvalStatus: 'ACTIVE' }]));
    mockSelect.mockReturnValueOnce(makeOrgSelectChain([{ approvalStatus: 'PENDING' }]));

    // Even inside the same RSC store, default VITEST mode does not memoize across calls
    await runInRscRequest(async () => {
      await expect(assertOrgActive('org-1')).resolves.toBeUndefined();
      await expect(assertOrgActive('org-1')).rejects.toThrow(OrgNotActiveError);
    });
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});
