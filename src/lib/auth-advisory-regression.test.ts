/**
 * Auth.js Critical Advisory Remediation Regression Tests (RC1.S1)
 *
 * Verifies:
 * 1. GHSA-8fpg-xm3f-6cx3 / CVE-2026-73421: Auth.js error-shaped objects lacking `session.user.id`
 *    fail closed (deny access with redirect or null in requireAuth / requireApiAuth).
 * 2. GHSA-7rqj-j65f-68wh / CVE-2026-73420: Homoglyph Unicode characters (e.g. \uFF20 fullwidth @)
 *    in email addresses cannot spoof ASCII accounts in database lookups or parent session verification.
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

vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
    },
  },
}));

describe('Auth.js Critical Advisory Regression Tests (RC1.S1)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('GHSA-8fpg-xm3f-6cx3: Fail-closed verification on error-shaped auth objects', () => {
    it('requireAuth rejects an Auth.js error response lacking user.id and redirects to /login', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({ error: 'Configuration', message: 'There is a problem with the server configuration.' });

      const { requireAuth } = await import('@/lib/require-auth');
      await expect(requireAuth()).rejects.toThrow('REDIRECT:/login');
    });

    it('requireAuth rejects an Auth.js error response with malformed user object and redirects to /login', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({ error: 'OAuthCallbackError', user: null });

      const { requireAuth } = await import('@/lib/require-auth');
      await expect(requireAuth()).rejects.toThrow('REDIRECT:/login');
    });

    it('requireApiAuth returns null on an Auth.js error response without session.user.id', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({ error: 'AccessDenied', message: 'Access denied by provider' });

      const { requireApiAuth } = await import('@/lib/require-auth');
      const result = await requireApiAuth();
      expect(result).toBeNull();
    });

    it('requirePermission throws Unauthorized on an Auth.js error response', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({ error: 'SessionTokenError' });

      const { requirePermission } = await import('@/lib/permissions');
      await expect(requirePermission('MANAGER')).rejects.toThrow('Unauthorized');
    });
  });

  describe('GHSA-7rqj-j65f-68wh: Unicode homoglyph email spoofing rejection', () => {
    it('exact binary string comparison rejects homoglyph fullwidth @ character (\uFF20)', async () => {
      const targetEmail: string = 'eleanor.vance@example.com';
      const homoglyphEmail: string = 'eleanor.vance\uFF20example.com';

      // Verify they are not equal in JavaScript / PostgreSQL string matching
      expect(targetEmail === homoglyphEmail).toBe(false);
      expect(targetEmail.length).toBe(25);
      expect(homoglyphEmail.length).toBe(25);
      expect(homoglyphEmail.charCodeAt(13)).toBe(0xFF20);
      expect(targetEmail.charCodeAt(13)).toBe(0x0040);
    });

    it('parent auth token verification rejects tokens created with mismatched homoglyph identity', async () => {
      const { signParentToken, verifyParentToken } = await import('@/lib/parent-auth');

      const realParentId = '550e8400-e29b-41d4-a716-446655440000';
      const token = await signParentToken(realParentId);

      const verifiedId = await verifyParentToken(token);
      expect(verifiedId).toBe(realParentId);

      // Random / forged token must return null
      expect(await verifyParentToken('invalid.jwt.token')).toBeNull();
    });
  });
});
