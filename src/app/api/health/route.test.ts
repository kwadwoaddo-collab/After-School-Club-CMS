/**
 * Shallow Health endpoint regression tests — Operational Optimization
 *
 * Verifies:
 *   - GET /api/health → HTTP 200 {"ok":true}
 *   - GET /api/health does NOT invoke the database
 *   - HEAD /api/health → HTTP 200 with empty body
 *   - HEAD /api/health does NOT invoke the database
 *   - Zero internal detail/secret leakage in responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module-level mock for @/db to verify it is NEVER called ----------------
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { db } from '@/db';
import { GET, HEAD } from './route';

describe('/api/health (shallow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns HTTP 200 with {"ok":true}', async () => {
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ ok: true });
    });

    it('does NOT invoke the database', async () => {
      await GET();
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('does not leak internal system details or credentials', async () => {
      const response = await GET();
      const body = await response.json();
      const bodyString = JSON.stringify(body);

      expect(bodyString).not.toContain('neon');
      expect(bodyString).not.toContain('postgres');
      expect(bodyString).not.toContain('pass');
      expect(bodyString).not.toContain('stack');
      expect(Object.keys(body)).toEqual(['ok']);
      expect(body.ok).toBe(true);
    });
  });

  describe('HEAD /api/health', () => {
    it('returns HTTP 200 with no body', async () => {
      const response = await HEAD();

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('does NOT invoke the database', async () => {
      await HEAD();
      expect(db.execute).not.toHaveBeenCalled();
    });
  });
});
