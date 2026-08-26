import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIP, checkRateLimit } from './rate-limit';

describe('src/lib/rate-limit.ts', () => {
  describe('getClientIP', () => {
    it('prioritizes x-real-ip header when provided', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '198.51.100.42',
          'x-forwarded-for': '203.0.113.19, 10.0.0.1',
        },
      });
      expect(getClientIP(req)).toBe('198.51.100.42');
    });

    it('falls back to first IP in x-forwarded-for when x-real-ip is missing', () => {
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.19, 10.0.0.1',
        },
      });
      expect(getClientIP(req)).toBe('203.0.113.19');
    });

    it('returns "unknown" when neither header is present', () => {
      const req = new Request('http://localhost/api/test');
      expect(getClientIP(req)).toBe('unknown');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns { success: true } when limiter is null (unconfigured / permissive fallback)', async () => {
      const res = await checkRateLimit(null, 'test-ip');
      expect(res).toEqual({ success: true });
    });

    it('delegates to limiter.limit when limiter is present', async () => {
      const mockLimiter = {
        limit: vi.fn().mockResolvedValue({
          success: true,
          reset: 1700000000,
          remaining: 9,
        }),
      };

      const res = await checkRateLimit(mockLimiter as any, 'test-ip');
      expect(mockLimiter.limit).toHaveBeenCalledWith('test-ip');
      expect(res).toEqual({
        success: true,
        reset: 1700000000,
        remaining: 9,
      });
    });

    it('returns { success: false } when rate limit is exceeded', async () => {
      const mockLimiter = {
        limit: vi.fn().mockResolvedValue({
          success: false,
          reset: 1700000060,
          remaining: 0,
        }),
      };

      const res = await checkRateLimit(mockLimiter as any, 'test-ip');
      expect(res).toEqual({
        success: false,
        reset: 1700000060,
        remaining: 0,
      });
    });

    it('fails open safely with { success: true } when Redis throws an exception', async () => {
      const mockLimiter = {
        limit: vi.fn().mockRejectedValue(new Error('Redis connection timeout')),
      };

      const res = await checkRateLimit(mockLimiter as any, 'test-ip');
      expect(res).toEqual({ success: true });
    });
  });
});
