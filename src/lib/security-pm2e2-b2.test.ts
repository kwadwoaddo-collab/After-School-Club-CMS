import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIP, checkRateLimit, _resetLocalRateLimitStore } from './rate-limit';
import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route';
import { POST as portalLoginHandler } from '@/app/api/portal/login/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MILESTONE PM-2E2.B2 — Rate Limiting & Trusted Client Identity Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLocalRateLimitStore();
  });

  // =========================================================================
  // TEST 1: NORMAL DISTRIBUTED LIMITING
  // =========================================================================
  it('Test 1: When distributed Redis limiter returns allowed, request is allowed', async () => {
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60000,
      }),
    };

    const res = await checkRateLimit(mockLimiter as any, 'client-123');
    expect(res.success).toBe(true);
    expect(res.status).toBe('allowed');
    expect(res.remaining).toBe(9);
  });

  // =========================================================================
  // TEST 2: ACTUAL LIMIT EXHAUSTION RETURNS STATUS LIMITED
  // =========================================================================
  it('Test 2: When limiter returns exceeded, result returns success: false and status: limited', async () => {
    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 45000,
      }),
    };

    const res = await checkRateLimit(mockLimiter as any, 'client-123');
    expect(res.success).toBe(false);
    expect(res.status).toBe('limited');
    expect(res.remaining).toBe(0);
    expect(res.retryAfter).toBeGreaterThan(0);
  });

  // =========================================================================
  // TEST 3: REDIS EXCEPTION DOES NOT SILENTLY ALLOW UNLIMITED TRAFFIC
  // =========================================================================
  it('Test 3: Redis network exception activates local fallback and blocks excess attempts', async () => {
    const mockLimiter = {
      limit: vi.fn().mockRejectedValue(new Error('ECONNREFUSED to Upstash')),
    };

    const ip = '198.51.100.1';
    // Burst 5 attempts (localLimit: 5)
    for (let i = 1; i <= 5; i++) {
      const res = await checkRateLimit(mockLimiter as any, ip, { localLimit: 5 });
      expect(res.success).toBe(true);
    }

    // 6th attempt must be throttled by local fallback
    const throttled = await checkRateLimit(mockLimiter as any, ip, { localLimit: 5 });
    expect(throttled.success).toBe(false);
    expect(throttled.status).toBe('limited');
  });

  // =========================================================================
  // TEST 4: MISSING REDIS CONFIGURATION DOES NOT RUN UNPROTECTED
  // =========================================================================
  it('Test 4: Missing Redis configuration activates local fallback to prevent open flood', async () => {
    const ip = '198.51.100.2';
    // 3 attempts allowed
    for (let i = 1; i <= 3; i++) {
      const res = await checkRateLimit(null, ip, { localLimit: 3 });
      expect(res.success).toBe(true);
    }

    // 4th attempt blocked
    const resBlocked = await checkRateLimit(null, ip, { localLimit: 3 });
    expect(resBlocked.success).toBe(false);
    expect(resBlocked.status).toBe('limited');
  });

  // =========================================================================
  // TEST 5: SPOOFED X-FORWARDED-FOR DOES NOT ROTATE IDENTITY ON VERCEL
  // =========================================================================
  it('Test 5: Attacker rotating x-forwarded-for header cannot bypass Vercel edge IP identity', () => {
    const req1 = new Request('http://localhost/api/auth/signup', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.50',
        'x-forwarded-for': '1.1.1.1',
      },
    });

    const req2 = new Request('http://localhost/api/auth/signup', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.50',
        'x-forwarded-for': '2.2.2.2', // rotated by attacker
      },
    });

    expect(getClientIP(req1)).toBe('203.0.113.50');
    expect(getClientIP(req2)).toBe('203.0.113.50');
    expect(getClientIP(req1)).toBe(getClientIP(req2));
  });

  // =========================================================================
  // TEST 6: SPOOFED X-REAL-IP DOES NOT ROTATE IDENTITY ON VERCEL
  // =========================================================================
  it('Test 6: Attacker rotating x-real-ip header cannot bypass Vercel edge IP identity', () => {
    const req1 = new Request('http://localhost/api/auth/signup', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.50',
        'x-real-ip': '8.8.8.8',
      },
    });

    const req2 = new Request('http://localhost/api/auth/signup', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.50',
        'x-real-ip': '9.9.9.9', // rotated by attacker
      },
    });

    expect(getClientIP(req1)).toBe('203.0.113.50');
    expect(getClientIP(req2)).toBe('203.0.113.50');
  });

  // =========================================================================
  // TEST 7: TRUSTED PLATFORM IDENTITY RESOLUTION
  // =========================================================================
  it('Test 7: Authoritative Vercel edge header produces consistent client identity', () => {
    const req = new Request('http://localhost/api/portal/login', {
      headers: {
        'x-vercel-forwarded-for': '198.51.100.99',
      },
    });
    expect(getClientIP(req)).toBe('198.51.100.99');
  });

  // =========================================================================
  // TEST 8: MULTIPLE FORWARDING VALUES PARSED CORRECTLY
  // =========================================================================
  it('Test 8: Multiple comma-separated forwarding values parse leftmost client IP correctly', () => {
    const req = new Request('http://localhost/api/test', {
      headers: {
        'x-vercel-forwarded-for': '198.51.100.10, 10.0.0.1, 10.0.0.2',
      },
    });
    expect(getClientIP(req)).toBe('198.51.100.10');

    const reqNonVercel = new Request('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '198.51.100.20, 10.0.0.1',
      },
    });
    expect(getClientIP(reqNonVercel)).toBe('198.51.100.20');
  });

  // =========================================================================
  // TEST 9: IPV6 IDENTITY HANDLING
  // =========================================================================
  it('Test 9: Valid IPv6 address is parsed, validated, and normalized to lowercase', () => {
    const req = new Request('http://localhost/api/test', {
      headers: {
        'x-vercel-forwarded-for': '2001:DB8:85A3::8A2E:370:7334',
      },
    });
    expect(getClientIP(req)).toBe('2001:db8:85a3::8a2e:370:7334');
  });

  // =========================================================================
  // TEST 10: INFRASTRUCTURE FAILURE RESPONSE (HTTP 503 ON FAIL-CLOSED)
  // =========================================================================
  it('Test 10: Fail-closed policy returns status: unavailable', async () => {
    const mockFailingLimiter = {
      limit: vi.fn().mockRejectedValue(new Error('Outage')),
    };

    const res = await checkRateLimit(mockFailingLimiter as any, 'client-ip', {
      fallbackPolicy: 'fail-closed',
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe('unavailable');
  });

  // =========================================================================
  // TEST 11: RECOVERY AFTER TRANSIENT FAILURE
  // =========================================================================
  it('Test 11: Once Redis recovers from transient failure, distributed rate limiting seamlessly resumes', async () => {
    const mockLimiter = {
      limit: vi
        .fn()
        .mockRejectedValueOnce(new Error('Transient network glitch'))
        .mockResolvedValueOnce({
          success: true,
          limit: 10,
          remaining: 8,
          reset: Date.now() + 60000,
        }),
    };

    // Glitch request -> local fallback activates
    const glitchRes = await checkRateLimit(mockLimiter as any, 'client-rec', { localLimit: 5 });
    expect(glitchRes.success).toBe(true);

    // Next request -> Redis healthy -> distributed limiter returns result directly
    const recoveredRes = await checkRateLimit(mockLimiter as any, 'client-rec');
    expect(recoveredRes.success).toBe(true);
    expect(recoveredRes.status).toBe('allowed');
    expect(recoveredRes.remaining).toBe(8);
  });

  // =========================================================================
  // TEST 12: PUBLIC REGISTRATION INTEGRITY PRESERVED
  // =========================================================================
  it('Test 12: Public registration rate limit check returns structured result', async () => {
    const req = new NextRequest('http://localhost/api/register', {
      headers: {
        'x-vercel-forwarded-for': '198.51.100.88',
      },
    });
    const ip = getClientIP(req);
    expect(ip).toBe('198.51.100.88');

    const mockLimiter = {
      limit: vi.fn().mockResolvedValue({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60000,
      }),
    };

    const rl = await checkRateLimit(mockLimiter as any, `register:${ip}`);
    expect(rl.success).toBe(true);
    expect(rl.status).toBe('allowed');
  });

  // =========================================================================
  // TEST 13: STRICT PRODUCTION TRUST BOUNDARY (PM-2E2.B2.F)
  // =========================================================================
  it('Test 13: In production, untrusted forwarding headers are rejected when x-vercel-forwarded-for is missing', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const spoofedReq = new Request('http://localhost/api/auth/signup', {
        headers: {
          'cf-connecting-ip': '203.0.113.100',
          'x-forwarded-for': '198.51.100.200',
          'x-real-ip': '192.0.2.1',
        },
      });
      // Production must return 'unknown' rather than trusting spoofed headers
      expect(getClientIP(spoofedReq)).toBe('unknown');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });
});
