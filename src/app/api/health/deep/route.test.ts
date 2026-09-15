/**
 * Deep Health endpoint regression tests — Operational Optimization
 *
 * Verifies:
 *   - GET /api/health/deep invokes db.execute with SELECT 1
 *   - healthy DB → HTTP 200 {"ok":true, "database":"healthy"}
 *   - DB failure → HTTP 503 {"ok":false, "database":"unreachable"}
 *   - HEAD /api/health/deep invokes db.execute and returns 200 / 503 with empty body
 *   - No internal detail, connection string, password, hostname, or stack trace leakage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module-level mock for @/db ----------------------------------------
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { db } from '@/db';
import { GET, HEAD } from './route';

describe('/api/health/deep (dependency health)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
