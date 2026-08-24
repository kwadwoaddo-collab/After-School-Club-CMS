/**
 * Milestone 3J — Settings Module Security & Validation Regression Tests
 *
 * Covers:
 *   - Defect 1: POST /api/branding now requires ORG_OWNER role (was any auth'd user)
 *   - Defect 4: PATCH /api/settings/organisation now validates contactEmail format
 *
 * Test approach mirrors the established pattern in security-p6.test.ts and
 * src/app/api/reports/students/route.test.ts: mock @/lib/auth and @/db at
 * the module boundary, import route handlers dynamically, assert response
 * status. No network or DB calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      organisations: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

function sessionFor(role: string) {
  return {
    user: {
      id: 'u1',
      email: 'test@example.com',
      organisationId: 'org-1',
      role,
    },
  };
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Defect 1: POST /api/branding role enforcement
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/branding — Milestone 3J Defect 1 fix', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/branding/route');

    const res = await POST(makeRequest({ primaryColor: '#123456' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 for MANAGER role (Defect 1 regression)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { POST } = await import('@/app/api/branding/route');

    const res = await POST(makeRequest({ primaryColor: '#123456' }) as any);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
  });

  it('returns 403 for TUTOR role (Defect 1 regression)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { POST } = await import('@/app/api/branding/route');

    const res = await POST(makeRequest({ primaryColor: '#abcdef' }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 for FRONT_DESK role', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { POST } = await import('@/app/api/branding/route');

    const res = await POST(makeRequest({ primaryColor: '#abcdef' }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid hex colour (even as ORG_OWNER)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { POST } = await import('@/app/api/branding/route');

    const res = await POST(makeRequest({ primaryColor: 'notacolor' }) as any);
    expect(res.status).toBe(400);
  });

  it('succeeds with 200 for ORG_OWNER with valid colour', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));

    // Mock db.update chain for the branding route
    const { db } = await import('@/db');
    const whereMock = vi.fn().mockResolvedValue([]);
    const setMock = vi.fn(() => ({ where: whereMock }));
    (db.update as any).mockReturnValueOnce({ set: setMock });

    const { POST } = await import('@/app/api/branding/route');
    const res = await POST(makeRequest({ primaryColor: '#4f46e5' }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Defect 4: PATCH /api/settings/organisation email format validation
// ═════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/settings/organisation — Milestone 3J Defect 4 fix', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { PATCH } = await import('@/app/api/settings/organisation/route');

    const res = await PATCH(makePatchRequest({ contactEmail: 'bad' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid contactEmail format (Defect 4 regression)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));

    // Provide an org stub so validation proceeds past the lookup
    const { db } = await import('@/db');
    (db.query.organisations.findFirst as any).mockResolvedValueOnce({
      id: 'org-1',
      slug: 'myclub',
      subdomain: null,
    });

    const { PATCH } = await import('@/app/api/settings/organisation/route');
    const res = await PATCH(makePatchRequest({ contactEmail: 'notvalid' }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid email/i);
  });

  it('accepts a valid email format without error', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));

    const { db } = await import('@/db');
    (db.query.organisations.findFirst as any).mockResolvedValueOnce({
      id: 'org-1',
      slug: 'myclub',
      subdomain: null,
    });

    // Mock update chain
    const whereMock = vi.fn().mockResolvedValue([{ id: 'org-1' }]);
    const setMock = vi.fn(() => ({ where: whereMock }));
    (db.update as any).mockReturnValueOnce({ set: setMock });

    const { PATCH } = await import('@/app/api/settings/organisation/route');
    const res = await PATCH(makePatchRequest({ contactEmail: 'admin@myclub.co.uk' }) as any);
    // Should NOT be 400 (may be 200 or fail later due to db mock — we care only
    // that the email format check doesn't reject a valid address)
    expect(res.status).not.toBe(400);
  });

  it('returns 403 for MANAGER attempting to edit org settings', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { PATCH } = await import('@/app/api/settings/organisation/route');

    const res = await PATCH(makePatchRequest({ name: 'New Name' }) as any);
    expect(res.status).toBe(403);
  });
});
