/**
 * Milestone 3 — Students module authorisation regression tests.
 *
 * Companion to src/lib/security-p6.test.ts (which covers the page-level
 * denial cases added alongside this file: /dashboard/students/[id],
 * /dashboard/students/[id]/attendance, /dashboard/students/add,
 * /dashboard/students/import). This file covers the mutation endpoints
 * those pages call into — POST /api/students, PATCH and DELETE
 * /api/students/[id], and the CSV import server action — none of which had
 * a role check before this milestone (see
 * project-notes/milestone-3-people-audit.md §2). All four now enforce the
 * same rule already established and tested for the Students list page:
 * ORG_OWNER, MANAGER, and FRONT_DESK are allowed; TUTOR is not.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// These route handlers transitively import @/db (directly or via
// @/lib/permissions) — without DATABASE_URL set, importing the real module
// throws at evaluation time, so it must be mocked even though the denial
// cases below never reach a query. Same rationale as security-p6.test.ts.
vi.mock('@/db', () => ({
  db: {
    query: {
      children: { findFirst: vi.fn() },
      centres: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

function sessionFor(role: string, overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'u1',
      organisationId: 'org-1',
      role,
      name: 'Test User',
      ...overrides,
    },
  };
}

describe('POST /api/students — role enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('denies TUTOR with 401 before touching the request body', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { POST } = await import('@/app/api/students/route');

    // A body that would fail schema validation if the handler ever read it —
    // proves the 401 comes from the auth check, not a downstream error.
    const req = new Request('http://localhost/api/students', {
      method: 'POST',
      body: 'not json',
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('denies an unauthenticated request with 401', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/students/route');

    const req = new Request('http://localhost/api/students', { method: 'POST', body: 'not json' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe('PATCH/DELETE /api/students/[id] — role enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('PATCH denies TUTOR with 401 before checking student access', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { PATCH } = await import('@/app/api/students/[id]/route');

    const req = new Request('http://localhost/api/students/s1', { method: 'PATCH', body: '{}' });
    const res = await PATCH(req, { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(401);
  });

  it('DELETE denies TUTOR with 401 before checking student access', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { DELETE } = await import('@/app/api/students/[id]/route');

    const req = new Request('http://localhost/api/students/s1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(401);
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    'PATCH does not short-circuit on role for %s (passes the auth gate)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { db } = await import('@/db');
      // No matching student — proves we got past the auth gate and reached
      // the (separately-tested) student lookup, not that mutation succeeds.
      (db.select as any).mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) });
      const { PATCH } = await import('@/app/api/students/[id]/route');

      const req = new Request('http://localhost/api/students/s1', { method: 'PATCH', body: '{}' });
      const res = await PATCH(req, { params: Promise.resolve({ id: 's1' }) });
      expect(res.status).not.toBe(401);
    }
  );
});

describe('importStudentsAction — role enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects TUTOR before processing any rows', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { importStudentsAction } = await import('@/features/students/import-actions');

    await expect(importStudentsAction([], null)).rejects.toThrow('Unauthorized');
  });

  it('rejects an unauthenticated caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { importStudentsAction } = await import('@/features/students/import-actions');

    await expect(importStudentsAction([], null)).rejects.toThrow('Unauthorized');
  });

  it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
    'passes the auth gate for %s (empty row set, no DB work triggered)',
    async (role) => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(sessionFor(role));
      const { importStudentsAction } = await import('@/features/students/import-actions');

      const result = await importStudentsAction([], null);
      expect(result.success).toBe(true);
      expect(result.stats.totalRows).toBe(0);
    }
  );
});
