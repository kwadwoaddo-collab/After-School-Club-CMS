import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIP, checkRateLimit, _resetLocalRateLimitStore } from './rate-limit';

describe('src/lib/rate-limit.ts — PM-2E2.B2 Hardened Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLocalRateLimitStore();
  });

  describe('getClientIP — Trusted Identity Resolution', () => {
    it('prioritizes x-vercel-forwarded-for over client-supplied x-real-ip and x-forwarded-for', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.42',
          'x-real-ip': '203.0.113.99', // attacker spoof attempt
          'x-forwarded-for': '192.0.2.1, 10.0.0.1', // attacker spoof attempt
        },
      });
      expect(getClientIP(req)).toBe('198.51.100.42');
    });

    it('in production, returns unknown when x-vercel-forwarded-for is absent, rejecting attacker spoofed headers', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const req = new Request('http://localhost/api/test', {
          headers: {
            'cf-connecting-ip': '198.51.100.55', // fake Cloudflare header
            'x-forwarded-for': '203.0.113.19', // fake xff header
            'x-real-ip': '198.51.100.77', // fake real-ip header
          },
        });
        expect(getClientIP(req)).toBe('unknown');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it('in production, returns valid IP when x-vercel-forwarded-for is present', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const req = new Request('http://localhost/api/test', {
          headers: {
            'x-vercel-forwarded-for': '198.51.100.42',
            'x-forwarded-for': '203.0.113.19',
          },
        });
        expect(getClientIP(req)).toBe('198.51.100.42');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it('in non-production, falls back to first valid IP in x-forwarded-for', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'development';
        const req = new Request('http://localhost/api/test', {
          headers: {
            'x-forwarded-for': '203.0.113.19, 10.0.0.1',
          },
        });
        expect(getClientIP(req)).toBe('203.0.113.19');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it('in non-production, falls back to x-real-ip when x-forwarded-for is absent', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'test';
        const req = new Request('http://localhost/api/test', {
          headers: {
            'x-real-ip': '198.51.100.77',
          },
        });
        expect(getClientIP(req)).toBe('198.51.100.77');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it('handles IPv6 addresses correctly and normalizes to lowercase', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-vercel-forwarded-for': '2001:0DB8:85A3:0000:0000:8A2E:0370:7334',
        },
      });
      expect(getClientIP(req)).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('rejects garbage / injection strings and falls back to safe default', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-vercel-forwarded-for': 'invalid-ip-string; DROP TABLE',
        },
      });
      // In test env (NODE_ENV=test), falls back to 127.0.0.1
      expect(getClientIP(req)).toBe('127.0.0.1');
    });

    it('returns "127.0.0.1" in non-production when no forwarding headers are present', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'development';
        const req = new Request('http://localhost/api/test');
        expect(getClientIP(req)).toBe('127.0.0.1');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  describe('checkRateLimit — Fail-Safe Architecture', () => {
    it('delegates to central Redis limiter when Redis is healthy and returns allowed', async () => {
      const mockLimiter = {
        limit: vi.fn().mockResolvedValue({
          success: true,
          limit: 10,
          reset: Date.now() + 60000,
          remaining: 9,
        }),
      };

      const res = await checkRateLimit(mockLimiter as any, 'test-ip');
      expect(mockLimiter.limit).toHaveBeenCalledWith('test-ip');
      expect(res.success).toBe(true);
      expect(res.status).toBe('allowed');
      expect(res.remaining).toBe(9);
    });

    it('delegates to central Redis limiter when limit is exceeded and returns status: limited', async () => {
      const mockLimiter = {
        limit: vi.fn().mockResolvedValue({
          success: false,
          limit: 10,
          reset: Date.now() + 60000,
          remaining: 0,
        }),
      };

      const res = await checkRateLimit(mockLimiter as any, 'test-ip');
      expect(res.success).toBe(false);
      expect(res.status).toBe('limited');
      expect(res.remaining).toBe(0);
      expect(res.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it('activates local in-memory fallback when Redis throws an exception (does NOT fail open unconditionally)', async () => {
      const mockLimiter = {
        limit: vi.fn().mockRejectedValue(new Error('Upstash connection timeout')),
      };

      // Perform 5 requests within local fallback limit (localLimit: 5)
      for (let i = 1; i <= 5; i++) {
        const res = await checkRateLimit(mockLimiter as any, 'failing-redis-ip', { localLimit: 5 });
        expect(res.success).toBe(true);
        expect(res.status).toBe('allowed');
      }

      // 6th request must be throttled by local fallback limiter!
      const blockedRes = await checkRateLimit(mockLimiter as any, 'failing-redis-ip', { localLimit: 5 });
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.status).toBe('limited');
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.reason).toContain('Rate limit exceeded (local fallback)');
    });

    it('activates local fallback when limiter is null (unconfigured Redis)', async () => {
      // 3 requests allowed with localLimit: 3
      for (let i = 1; i <= 3; i++) {
        const res = await checkRateLimit(null, 'null-redis-ip', { localLimit: 3 });
        expect(res.success).toBe(true);
        expect(res.status).toBe('allowed');
      }

      // 4th request throttled
      const blocked = await checkRateLimit(null, 'null-redis-ip', { localLimit: 3 });
      expect(blocked.success).toBe(false);
      expect(blocked.status).toBe('limited');
    });

    it('fails closed with status: unavailable when fallbackPolicy is fail-closed', async () => {
      const mockLimiter = {
        limit: vi.fn().mockRejectedValue(new Error('Redis hard failure')),
      };

      const res = await checkRateLimit(mockLimiter as any, 'strict-ip', {
        fallbackPolicy: 'fail-closed',
      });
      expect(res.success).toBe(false);
      expect(res.status).toBe('unavailable');
      expect(res.reason).toContain('Rate limiting backend error');
    });
  });
});
