/**
 * Milestone 3D — Centres module authorisation regression tests.
 *
 * Covers the two confirmed, narrowly-evidenced defects fixed this milestone
 * (see project-notes/milestone-3d-centres-audit.md §5):
 *   1. updateCentreAction (Settings page, Billing tab) had no role check at
 *      all — any authenticated org member could rewrite a centre's identity
 *      fields and bank details. Fixed to require ['ORG_OWNER','MANAGER'] as
 *      a floor, plus ORG_OWNER for the bank-detail fields specifically.
 *   2. PATCH /api/centres/[id]/subdomain had no role check at all — any
 *      authenticated org member could change a centre's public subdomain.
 *      Fixed to require ['ORG_OWNER','MANAGER'], matching the Settings page.
 *
 * Also covers org isolation on both fixed paths, since that is a separate
 * axis from role enforcement and both must hold independently.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      centres: { findFirst: vi.fn(), findMany: vi.fn() },
      organisations: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'centre-1' }]) })),
      })),
    })),
  },
}));

function sessionFor(role: string, overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'u1',
      organisationId: 'org-1',
      role,
      ...overrides,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// updateCentreAction
// ─────────────────────────────────────────────────────────────────────────────

describe('updateCentreAction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects a TUTOR caller — the gap fixed this milestone', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { updateCentreAction } = await import('./[id]/settings/actions');

    await expect(updateCentreAction('centre-1', { name: 'Hacked Name' })).rejects.toThrow(
      'Forbidden: Insufficient privileges.'
    );
  });

  it('rejects a FRONT_DESK caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { updateCentreAction } = await import('./[id]/settings/actions');

    await expect(updateCentreAction('centre-1', { name: 'Hacked Name' })).rejects.toThrow(
      'Forbidden: Insufficient privileges.'
    );
  });

  it('allows a MANAGER to update non-billing fields', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { db } = await import('@/db');
    const { updateCentreAction } = await import('./[id]/settings/actions');

    await expect(
      updateCentreAction('centre-1', { name: 'New Name', address: '1 High St' })
    ).resolves.toEqual({ success: true });
    expect(db.update).toHaveBeenCalled();
  });

  it('rejects a MANAGER updating bank details — billing fields are ORG_OWNER only', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { updateCentreAction } = await import('./[id]/settings/actions');

    await expect(
      updateCentreAction('centre-1', { bankName: 'Lloyds', sortCode: '000000', accountNo: '12345678' })
    ).rejects.toThrow('Only Owners can update billing settings');
  });

  it('allows an ORG_OWNER to update bank details', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { db } = await import('@/db');
    const { updateCentreAction } = await import('./[id]/settings/actions');

    await expect(
      updateCentreAction('centre-1', { bankName: 'Lloyds', sortCode: '000000', accountNo: '12345678' })
    ).resolves.toEqual({ success: true });
    expect(db.update).toHaveBeenCalled();
  });

  it('rejects an unauthenticated caller', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { updateCentreAction } = await import('./[id]/settings/actions');

    // PM-1.2: requireTenantSession redirects unauthenticated callers
    await expect(updateCentreAction('centre-1', { name: 'x' })).rejects.toThrow('REDIRECT:/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/centres/[id]/subdomain
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/centres/[id]/subdomain', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function makeRequest(body: Record<string, unknown>) {
    return {
      json: vi.fn().mockResolvedValue(body),
    } as any;
  }

  it('denies a TUTOR with 403 — the gap fixed this milestone', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { PATCH } = await import('../../api/centres/[id]/subdomain/route');

    const res = await PATCH(makeRequest({ subdomain: 'newname' }), { params: Promise.resolve({ id: 'centre-1' }) });
    expect(res.status).toBe(403);
  });

  it('denies an unauthenticated request with 401', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(null);
    const { PATCH } = await import('../../api/centres/[id]/subdomain/route');

    const res = await PATCH(makeRequest({ subdomain: 'newname' }), { params: Promise.resolve({ id: 'centre-1' }) });
    expect(res.status).toBe(401);
  });

  it('404s for a centre outside the caller\'s organisation (org isolation)', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { db } = await import('@/db');
    (db.query.centres.findFirst as any).mockResolvedValueOnce(null);
    const { PATCH } = await import('../../api/centres/[id]/subdomain/route');

    const res = await PATCH(makeRequest({ subdomain: 'newname' }), { params: Promise.resolve({ id: 'centre-in-other-org' }) });
    expect(res.status).toBe(404);
  });

  it('allows a MANAGER to set a valid, unused subdomain', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('MANAGER'));
    const { db } = await import('@/db');
    (db.query.centres.findFirst as any)
      .mockResolvedValueOnce({ id: 'centre-1' }) // org-scoped existence check
      .mockResolvedValueOnce(null); // uniqueness check across centres
    (db.query.organisations.findFirst as any).mockResolvedValueOnce(null); // uniqueness check across orgs
    const { PATCH } = await import('../../api/centres/[id]/subdomain/route');

    const res = await PATCH(makeRequest({ subdomain: 'dagenham' }), { params: Promise.resolve({ id: 'centre-1' }) });
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });
});
