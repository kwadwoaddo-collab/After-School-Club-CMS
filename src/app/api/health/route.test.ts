/**
 * Health endpoint regression tests — Milestone 7H
 *
 * Verifies:
 *   - healthy DB → HTTP 200 {"ok":true}
 *   - DB failure → HTTP 503 {"ok":false}
 *   - no internal detail/secret leakage in either response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module-level mock for @/db ----------------------------------------
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { db } from '@/db';
import { GET } from './route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 200 with {"ok":true} when DB is reachable', async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it('returns HTTP 503 with {"ok":false} when DB is unreachable', async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection refused')
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false });
  });

  it('does not leak error message, hostname, or stack trace on DB failure', async () => {
    (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection refused: postgresql://user:pass@neon.host:5432/neondb')
    );

    const response = await GET();
    const body = await response.json();
    const bodyString = JSON.stringify(body);

    expect(response.status).toBe(503);
    // Must not contain connection details or error messages
    expect(bodyString).not.toContain('neon');
    expect(bodyString).not.toContain('postgresql');
    expect(bodyString).not.toContain('pass');
    expect(bodyString).not.toContain('stack');
    expect(bodyString).not.toContain('refused');
    // Only key allowed is 'ok' with value false
    expect(Object.keys(body)).toEqual(['ok']);
    expect(body.ok).toBe(false);
  });

  it('does not expose tenant data in healthy response', async () => {
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
    expect(Object.keys(body)).toEqual(['ok']);
  });
});
