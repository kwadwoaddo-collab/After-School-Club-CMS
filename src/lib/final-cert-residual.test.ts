import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isEmailVerificationRequired } from "./auth";

// ---------------------------------------------------------------------------
// Mocks for DB and Services
// ---------------------------------------------------------------------------
const verificationTokensStore = new Map<string, { identifier: string; token: string; expires: Date }>();

const mockSelect = vi.fn(() => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation(async () => {
        const values = Array.from(verificationTokensStore.values());
        return values.filter(v => v.expires > new Date());
      }),
    })),
  }),
}));

const mockTransaction = vi.fn(async (cb: any) => {
  return cb({
    update: () => ({
      set: () => ({
        where: () => [],
      }),
    }),
    delete: () => ({
      where: () => {
        verificationTokensStore.clear();
        return [];
      },
    }),
  });
});

const mockFindUser = vi.fn();
const mockFindCentre = vi.fn();
const mockFindCentreMembership = vi.fn();

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/session", () => ({
  getApiSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", organisationId: "org-1", role: "ORG_OWNER" },
  }),
  requireTenantSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", organisationId: "org-1", role: "ORG_OWNER" },
  }),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => mockSelect(),
    transaction: (cb: any) => mockTransaction(cb),
    query: {
      users: {
        findFirst: (...args: any[]) => mockFindUser(...args),
      },
      centres: {
        findFirst: (...args: any[]) => mockFindCentre(...args),
      },
      centreMemberships: {
        findFirst: (...args: any[]) => mockFindCentreMembership(...args),
      },
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  authRateLimit: {},
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}));

describe("FINAL-CERT — Residual Security Qualifications Revalidation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verificationTokensStore.clear();
  });

  // =========================================================================
  // 1. CONSUMED VERIFICATION-TOKEN REPLAY REJECTION
  // =========================================================================
  it("Gate 1: Verification token single-use consumption and sequential replay rejection", async () => {
    const { GET: verifyHandler } = await import("@/app/api/auth/verify-email/route");
    const { hashToken } = await import("@/lib/magic-link");

    const email = "replay-victim@example.com";
    const rawToken = "super-secret-one-time-token-123456";
    const hashed = hashToken(rawToken);

    // Initial state: token exists in verificationTokens table
    verificationTokensStore.set(`${email}:${hashed}`, {
      identifier: email,
      token: hashed,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // valid for 24h
    });

    const requestUrl = `http://localhost/api/auth/verify-email?token=${rawToken}&email=${email}`;

    // FIRST ATTEMPT: Legitimate verification
    const res1 = await verifyHandler(new NextRequest(requestUrl, { method: "GET" }));
    expect(res1.status).toBe(307);
    expect(res1.headers.get("location")).toContain("verified=true");
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Token store is now empty because transaction deleted the token
    expect(verificationTokensStore.size).toBe(0);

    // SECOND ATTEMPT: Attacker or network replay of the exact same URL/token
    const res2 = await verifyHandler(new NextRequest(requestUrl, { method: "GET" }));
    expect(res2.status).toBe(307);
    // REPLAY REJECTED: Must redirect with ExpiredOrInvalidToken
    expect(res2.headers.get("location")).toContain("error=ExpiredOrInvalidToken");
  });

  // =========================================================================
  // 2. HISTORICAL PRE-ROLLOUT-BOUNDARY CREDENTIAL USER LOGIN
  // =========================================================================
  it("Gate 2: isEmailVerificationRequired respects AUTH_VERIFICATION_ROLLOUT_BOUNDARY", () => {
    const originalEnv = process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY;
    const boundary = "2026-09-11T14:40:55.000Z";
    process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY = boundary;

    try {
      // Case A: User created before boundary without emailVerified -> EXEMPT (allowed)
      const legacyUser = {
        emailVerified: null,
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
      };
      expect(isEmailVerificationRequired(legacyUser)).toBe(false);

      // Case B: User created after boundary without emailVerified -> REQUIRED (blocked)
      const modernUnverifiedUser = {
        emailVerified: null,
        createdAt: new Date("2026-09-12T12:00:00.000Z"),
      };
      expect(isEmailVerificationRequired(modernUnverifiedUser)).toBe(true);

      // Case C: User created after boundary with emailVerified -> EXEMPT (allowed)
      const modernVerifiedUser = {
        emailVerified: new Date("2026-09-12T13:00:00.000Z"),
        createdAt: new Date("2026-09-12T12:00:00.000Z"),
      };
      expect(isEmailVerificationRequired(modernVerifiedUser)).toBe(false);

      // Case D: User created exactly at boundary without emailVerified -> REQUIRED
      const boundaryUser = {
        emailVerified: null,
        createdAt: new Date(boundary),
      };
      expect(isEmailVerificationRequired(boundaryUser)).toBe(true);
    } finally {
      process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY = originalEnv;
    }
  });

  it("Gate 2b: Credentials authorize permits legacy pre-boundary user and blocks modern unverified user", async () => {
    const originalEnv = process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY;
    process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY = "2026-09-11T14:40:55.000Z";

    try {
      const { authConfig } = await import("@/lib/auth");
      const credentialsProvider = (authConfig.providers as any[])?.find(
        (p: any) => p?.id === "credentials" || p?.name === "credentials"
      );
      expect(credentialsProvider).toBeDefined();
      const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;

      const bcrypt = await import("bcryptjs");
      const password = "ValidPassword123!";
      const passwordHash = await bcrypt.hash(password, 10);

      // Legacy User (created 2026-09-10, emailVerified: null)
      mockFindUser.mockResolvedValueOnce({
        id: "legacy-user-1",
        email: "legacy@example.com",
        passwordHash,
        emailVerified: null,
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
        firstName: "Legacy",
        lastName: "User",
        role: "ORG_OWNER",
        organisationId: "org-legacy",
      });

      const legacyAuthResult = await authorizeFn({
        email: "legacy@example.com",
        password,
      });
      expect(legacyAuthResult).not.toBeNull();
      expect(legacyAuthResult?.id).toBe("legacy-user-1");

      // Modern User (created 2026-09-12, emailVerified: null)
      mockFindUser.mockResolvedValueOnce({
        id: "modern-user-1",
        email: "modern@example.com",
        passwordHash,
        emailVerified: null,
        createdAt: new Date("2026-09-12T12:00:00.000Z"),
        firstName: "Modern",
        lastName: "User",
        role: "ORG_OWNER",
        organisationId: "org-modern",
      });

      const modernAuthResult = await authorizeFn({
        email: "modern@example.com",
        password,
      });
      // Modern unverified user must be BLOCKED
      expect(modernAuthResult).toBeNull();
    } finally {
      process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY = originalEnv;
    }
  });

  // =========================================================================
  // 3. CROSS-TENANT ISOLATION FAIL-CLOSED INVARIANT
  // =========================================================================
  it("Gate 3: Cross-tenant permission check blocks foreign centre access fail-closed", async () => {
    const { canUserAccessCentre } = await import("@/lib/permissions");

    // Case A: ORG_OWNER in org-1 can access centre in org-1
    mockFindUser.mockResolvedValueOnce({
      id: "owner-1",
      role: "ORG_OWNER",
      organisationId: "org-1",
    });
    mockFindCentre.mockResolvedValueOnce({
      id: "centre-1a",
      organisationId: "org-1",
    });
    const canAccessOwn = await canUserAccessCentre("owner-1", "centre-1a");
    expect(canAccessOwn).toBe(true);

    // Case B: ORG_OWNER in org-1 attempts to access centre in org-2 -> REJECTED
    mockFindUser.mockResolvedValueOnce({
      id: "owner-1",
      role: "ORG_OWNER",
      organisationId: "org-1",
    });
    mockFindCentre.mockResolvedValueOnce(null); // not found in org-1
    const canAccessForeign = await canUserAccessCentre("owner-1", "centre-2a");
    expect(canAccessForeign).toBe(false);

    // Case C: Non-existent user -> REJECTED fail-closed
    mockFindUser.mockResolvedValueOnce(null);
    const canAccessNoUser = await canUserAccessCentre("ghost-user", "centre-1a");
    expect(canAccessNoUser).toBe(false);
  });
});
