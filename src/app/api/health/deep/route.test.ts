/**
 * Deep Health endpoint regression tests — Operational Optimization & Abuse Protection
 *
 * Verifies:
 *   - GET /api/health/deep invokes db.execute with SELECT 1
 *   - healthy DB → HTTP 200 {"ok":true, "database":"healthy"}
 *   - DB failure → HTTP 503 {"ok":false, "database":"unreachable"}
 *   - HEAD /api/health/deep invokes db.execute and returns 200 / 503 with empty body
 *   - Per-IP rate limit (30 req / 60s) returns 429 with Retry-After and skips db.execute
 *   - No internal detail, connection string, password, hostname, or stack trace leakage
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module-level mock for @/db ----------------------------------------
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { db } from '@/db';
import { _resetLocalRateLimitStore } from '@/lib/rate-limit';
import { GET, HEAD } from './route';

describe('/api/health/deep (dependency health)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLocalRateLimitStore();
  });

  describe('GET /api/health/deep', () => {
    it('invokes the database with a SELECT 1 query and returns 200 when reachable', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const response = await GET();
      const body = await response.json();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
      expect(body).toEqual({ ok: true, database: 'healthy' });
    });

    it('returns HTTP 503 with {"ok":false, "database":"unreachable"} when DB is unreachable', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('connection refused')
      );

      const response = await GET();
      const body = await response.json();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
      expect(body).toEqual({ ok: false, database: 'unreachable' });
    });

    it('does not leak error message, hostname, credentials, or stack trace on DB failure', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('connection refused: postgresql://user:supersecretpass@neon.host:5432/neondb')
      );

      const response = await GET();
      const body = await response.json();
      const bodyString = JSON.stringify(body);

      expect(response.status).toBe(503);
      // Must not contain connection details, passwords, or error messages
      expect(bodyString).not.toContain('neon');
      expect(bodyString).not.toContain('postgresql');
      expect(bodyString).not.toContain('supersecretpass');
      expect(bodyString).not.toContain('stack');
      expect(bodyString).not.toContain('refused');
      expect(bodyString).not.toContain('5432');
      // Only keys allowed are 'ok' and 'database'
      expect(Object.keys(body).sort()).toEqual(['database', 'ok'].sort());
      expect(body.ok).toBe(false);
      expect(body.database).toBe('unreachable');
    });

    it('does not expose tenant or business data in healthy response', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { count: 42, orgName: 'Sydenham After School Club' },
      ]);

      const response = await GET();
      const body = await response.json();
      const bodyString = JSON.stringify(body);

      expect(response.status).toBe(200);
      expect(bodyString).not.toContain('Sydenham');
      expect(bodyString).not.toContain('orgName');
      expect(bodyString).not.toContain('count');
      expect(Object.keys(body).sort()).toEqual(['database', 'ok'].sort());
    });

    it('enforces per-IP rate limiting (30 req/min) and returns 429 with Retry-After without waking DB', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const makeReq = (ip: string) =>
        new NextRequest('http://localhost/api/health/deep', {
          headers: { 'x-forwarded-for': ip },
        });

      for (let i = 0; i < 30; i += 1) {
        const res = await GET(makeReq('203.0.113.55'));
        expect(res.status).toBe(200);
      }
      expect(db.execute).toHaveBeenCalledTimes(30);

      const limited = await GET(makeReq('203.0.113.55'));
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
      // DB must NOT be hit on request #31
      expect(db.execute).toHaveBeenCalledTimes(30);

      // Independent IP bucket remains unaffected
      const otherIp = await GET(makeReq('203.0.113.56'));
      expect(otherIp.status).toBe(200);
      expect(db.execute).toHaveBeenCalledTimes(31);
    });
  });

  describe('HEAD /api/health/deep', () => {
    it('invokes database and returns HTTP 200 with no body when DB is reachable', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const response = await HEAD();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('invokes database and returns HTTP 503 with no body when DB is unreachable', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('connection timeout')
      );

      const response = await HEAD();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
      expect(response.body).toBeNull();
    });

    it('returns HTTP 429 with empty body and Retry-After when rate limit is exceeded', async () => {
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const makeHead = () =>
        new NextRequest('http://localhost/api/health/deep', {
          method: 'HEAD',
          headers: { 'x-forwarded-for': '203.0.113.77' },
        });

      for (let i = 0; i < 30; i += 1) {
        const res = await HEAD(makeHead());
        expect(res.status).toBe(200);
      }

      const limited = await HEAD(makeHead());
      expect(limited.status).toBe(429);
      expect(limited.body).toBeNull();
      expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(db.execute).toHaveBeenCalledTimes(30);
    });
  });
});
