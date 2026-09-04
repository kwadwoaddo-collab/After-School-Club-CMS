/**
 * PM-1.2 — Organisation Approval Status Guardrail Security Tests
 *
 * IMPORTANT: This file explicitly bypasses the global org-approval-guard mock
 * (set in vitest.setup.ts) and exercises the REAL implementations of:
 *
 *   isPlatformAdmin()      — allowlist check, fail-closed semantics
 *   assertOrgActive()      — DB-authoritative status check (DB mocked here)
 *   OrgNotActiveError      — error class identity, orgId and status fields
 *   requirePlatformAdmin() — session + allowlist gate
 *
 * Covers audit requirements:
 *   §3  — Real guard tested (global mock bypassed via vi.importActual)
 *   §4  — ACTIVE/PENDING/SUSPENDED/REJECTED lifecycle, DB-authoritative status
 *   §8  — Platform admin allowlist semantics, fail-closed behaviour
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Declarations (must be at top level before any imports) ──────────────

// DB mock — assertOrgActive reads from the DB; we intercept here.
vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}));

// Auth mock — getTypedSession calls auth(); we supply synthetic sessions.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────
// All imports after mock declarations so Vitest's hoisting works correctly.

import { auth } from '@/lib/auth';
import { db } from '@/db';

// ─── Bypass Global Mock ───────────────────────────────────────────────────────
// vitest.setup.ts globally mocks @/lib/org-approval-guard (assertOrgActive = no-op).
// We use vi.importActual to obtain the REAL implementations for this test file.
const {
  isPlatformAdmin,
  assertOrgActive,
  OrgNotActiveError,
  requirePlatformAdmin,
} = await vi.importActual<typeof import('@/lib/org-approval-guard')>('@/lib/org-approval-guard');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDbSelectChain(rows: Array<{ approvalStatus: string }>) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §4a: isPlatformAdmin — Allowlist Semantics (REAL implementation)
// ─────────────────────────────────────────────────────────────────────────────

describe('PM-1.2 §4a: isPlatformAdmin() — Allowlist Semantics', () => {
  const originalEnv = process.env;

  beforeEach(() => { process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });

  it('fails closed when PLATFORM_ADMIN_EMAILS is not set', () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(isPlatformAdmin('anyone@example.com')).toBe(false);
  });

  it('fails closed when PLATFORM_ADMIN_EMAILS is empty string', () => {
    process.env.PLATFORM_ADMIN_EMAILS = '';
    expect(isPlatformAdmin('anyone@example.com')).toBe(false);
  });

  it('fails closed when PLATFORM_ADMIN_EMAILS is only whitespace', () => {
    process.env.PLATFORM_ADMIN_EMAILS = '   ';
    expect(isPlatformAdmin('anyone@example.com')).toBe(false);
  });

  it('returns true for a listed email (case-insensitive)', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ADMIN@PLATFORM.COM';
    expect(isPlatformAdmin('admin@platform.com')).toBe(true);
  });

  it('returns true when email is in a comma-separated allowlist', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@platform.com, admin@platform.com , support@platform.com';
    expect(isPlatformAdmin('admin@platform.com')).toBe(true);
  });

  it('returns false when email is NOT in the allowlist', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    expect(isPlatformAdmin('imposter@evil.com')).toBe(false);
  });

  it('returns false for null email', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it('returns false for undefined email', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    expect(isPlatformAdmin(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4b: assertOrgActive — DB-Authoritative Status Lifecycle (REAL implementation)
// ─────────────────────────────────────────────────────────────────────────────

describe('PM-1.2 §4b: assertOrgActive() — DB-Authoritative Status Checks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves without error for an ACTIVE organisation', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'ACTIVE' }])
    );
    await expect(assertOrgActive('org-active')).resolves.toBeUndefined();
  });

  it('throws OrgNotActiveError for PENDING organisation', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'PENDING' }])
    );
    await expect(assertOrgActive('org-pending')).rejects.toThrow(OrgNotActiveError);
  });

  it('OrgNotActiveError for PENDING carries correct orgId and status', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'PENDING' }])
    );
    const err = await assertOrgActive('org-pending').catch(e => e);
    expect(err.orgId).toBe('org-pending');
    expect(err.approvalStatus).toBe('PENDING');
  });

  it('throws OrgNotActiveError for SUSPENDED organisation', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'SUSPENDED' }])
    );
    await expect(assertOrgActive('org-suspended')).rejects.toThrow(OrgNotActiveError);
  });

  it('OrgNotActiveError for SUSPENDED carries correct status', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'SUSPENDED' }])
    );
    const err = await assertOrgActive('org-suspended').catch(e => e);
    expect(err.approvalStatus).toBe('SUSPENDED');
  });

  it('throws OrgNotActiveError for REJECTED organisation', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'REJECTED' }])
    );
    await expect(assertOrgActive('org-rejected')).rejects.toThrow(OrgNotActiveError);
  });

  it('OrgNotActiveError for REJECTED carries correct status', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'REJECTED' }])
    );
    const err = await assertOrgActive('org-rejected').catch(e => e);
    expect(err.approvalStatus).toBe('REJECTED');
  });

  it('throws OrgNotActiveError with NOT_FOUND status when org does not exist in DB', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([]) // empty result — org not found
    );
    const err = await assertOrgActive('org-missing').catch(e => e);
    expect(err).toBeInstanceOf(OrgNotActiveError);
    expect(err.approvalStatus).toBe('NOT_FOUND');
  });

  it('DB-authoritative: status change ACTIVE → SUSPENDED takes effect on next call (no JWT refresh)', async () => {
    // First request: ACTIVE — allowed
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'ACTIVE' }])
    );
    await expect(assertOrgActive('org-1')).resolves.toBeUndefined();

    // Operator suspends org in DB — next request reads new state immediately
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'SUSPENDED' }])
    );
    await expect(assertOrgActive('org-1')).rejects.toThrow(OrgNotActiveError);
  });

  it('DB-authoritative: approval PENDING → ACTIVE takes effect on next call', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'PENDING' }])
    );
    await expect(assertOrgActive('org-1')).rejects.toThrow(OrgNotActiveError);

    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'ACTIVE' }])
    );
    await expect(assertOrgActive('org-1')).resolves.toBeUndefined();
  });

  it('OrgNotActiveError is an instance of Error with correct name', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeDbSelectChain([{ approvalStatus: 'PENDING' }])
    );
    const err = await assertOrgActive('org-x').catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(OrgNotActiveError);
    expect(err.name).toBe('OrgNotActiveError');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8: requirePlatformAdmin — Identity + Allowlist Gate (REAL implementation)
// ─────────────────────────────────────────────────────────────────────────────

describe('PM-1.2 §8: requirePlatformAdmin() — Platform Admin Gate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });
  afterEach(() => { process.env = originalEnv; });

  it('denies unauthenticated requests (no session) — throws REDIRECT:/login', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/login');
  });

  it('denies session with no user.id — throws REDIRECT:/login', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: {} });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/login');
  });

  it('denies ORG_OWNER not in allowlist — throws REDIRECT:/dashboard', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'u1', email: 'owner@tenant.com', role: 'ORG_OWNER', organisationId: 'org-1' },
      expires: '9999',
    });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('denies MANAGER not in allowlist — throws REDIRECT:/dashboard', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'u2', email: 'mgr@tenant.com', role: 'MANAGER', organisationId: 'org-1' },
      expires: '9999',
    });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('denies FRONT_DESK not in allowlist — throws REDIRECT:/dashboard', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'u3', email: 'desk@tenant.com', role: 'FRONT_DESK', organisationId: 'org-1' },
      expires: '9999',
    });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('denies TUTOR not in allowlist — throws REDIRECT:/dashboard', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@platform.com';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'u4', email: 'tutor@tenant.com', role: 'TUTOR', organisationId: 'org-1' },
      expires: '9999',
    });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('allows allowlisted identity WITHOUT organisationId (pure platform admin, no tenant)', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'platform-admin@ops.internal';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'admin-1', email: 'platform-admin@ops.internal', organisationId: null },
      expires: '9999',
    });
    const result = await requirePlatformAdmin();
    expect(result).toEqual({ email: 'platform-admin@ops.internal', userId: 'admin-1' });
  });

  it('PLATFORM_ADMIN_EMAILS empty = fail-closed, allowlisted user is denied', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = '';
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'admin-1', email: 'platform-admin@ops.internal', organisationId: null },
      expires: '9999',
    });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('PLATFORM_ADMIN_EMAILS unset = fail-closed', async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: 'admin-1', email: 'platform-admin@ops.internal', organisationId: null },
      expires: '9999',
    });
    await expect(requirePlatformAdmin()).rejects.toThrow('REDIRECT:/dashboard');
  });
});
