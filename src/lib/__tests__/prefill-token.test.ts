import { describe, it, expect, afterEach, vi } from 'vitest';
import { getPrefillJwtSecret } from '../prefill-token';

describe('getPrefillJwtSecret (PR-06 / SEC-F-05)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in production when no secret environment variable is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PREFILL_TOKEN_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('NEXTAUTH_SECRET', '');

    expect(() => getPrefillJwtSecret()).toThrow(/must be configured in production/i);
  });

  it('uses AUTH_SECRET in production when configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PREFILL_TOKEN_SECRET', '');
    vi.stubEnv('AUTH_SECRET', 'prod-auth-secret-value-at-least-32-bytes');

    const secret = getPrefillJwtSecret();
    expect(new TextDecoder().decode(secret)).toBe('prod-auth-secret-value-at-least-32-bytes');
  });

  it('returns deterministic dev secret outside production when env vars are unset', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PREFILL_TOKEN_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('NEXTAUTH_SECRET', '');

    const secret = getPrefillJwtSecret();
    expect(secret.byteLength).toBeGreaterThanOrEqual(32);
  });
});
