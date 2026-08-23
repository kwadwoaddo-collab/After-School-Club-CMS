/**
 * Milestone 3E — Bookings module authorisation regression tests.
 *
 * Covers the three centre-scoping gaps found during the Stage A audit (see
 * project-notes/milestone-3e-bookings-audit.md §G — "Confirmed defects"):
 * each is an inconsistency between a route/page and an already-established
 * sibling that performs the identical action correctly, not an invented
 * policy.
 *
 * 1. DELETE /api/bookings/[bookingId] was missing the centre-membership
 *    check its own sibling POST /api/bookings/bulk-delete already applies
 *    for the identical action.
 * 2. PATCH /api/bookings/[bookingId]/centre (reassign) checked access to the
 *    *target* centre but not the booking's *current* centre — unlike its
 *    siblings (cancel/reschedule/status), which all check the booking's
 *    current centre for non-ORG_OWNER users.
 * 3. /dashboard/bookings/[bookingId] (the detail page) had no centre check
 *    at all, unlike the List page (which only ever queries the viewer's
 *    accessible centres) and unlike the mutation APIs acting on the same
 *    record.
 *
 * The GET /api/parents/[id] role-gate fix (the mandatory §18 audit item) is
 * covered by src/features/parents/authorization.test.ts, alongside its
 * pre-existing Parents-module coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: vi.fn(),
  getUserAccessibleCentres: vi.fn(),
  canUserAccessCentre: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      bookings: { findFirst: vi.fn(), findMany: vi.fn() },
      centres: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  },
}));

vi.mock('@/lib/db-notifications', () => ({ notifyOwners: vi.fn() }));
vi.mock('@/lib/services/notifications', () => ({
  notificationService: { sendBookingCancellation: vi.fn(), sendBookingReschedule: vi.fn() },
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

const CENTRE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CENTRE_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const BOOKING_ID = 'cccccccc-0000-4000-8000-000000000003';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DELETE /api/bookings/[bookingId]
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/bookings/[bookingId] — centre membership (closed in Milestone 3E)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('denies a non-ORG_OWNER user with no membership to the booking centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_B,
      centre: { organisationId: 'org-1' },
    });
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]);

    const { DELETE } = await import('@/app/api/bookings/[bookingId]/route');
    const req = new Request(`http://localhost/api/bookings/${BOOKING_ID}`, { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ bookingId: BOOKING_ID }) });

    expect(res.status).toBe(403);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('allows a non-ORG_OWNER user with membership to the booking centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_A,
      centre: { organisationId: 'org-1' },
    });
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]);

    const { DELETE } = await import('@/app/api/bookings/[bookingId]/route');
    const req = new Request(`http://localhost/api/bookings/${BOOKING_ID}`, { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ bookingId: BOOKING_ID }) });

    expect(res.status).toBe(200);
    expect(db.delete).toHaveBeenCalled();
  });

  it('ORG_OWNER is not subject to the centre-membership check', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_B,
      centre: { organisationId: 'org-1' },
    });
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');

    const { DELETE } = await import('@/app/api/bookings/[bookingId]/route');
    const req = new Request(`http://localhost/api/bookings/${BOOKING_ID}`, { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ bookingId: BOOKING_ID }) });

    expect(res.status).toBe(200);
    expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /api/bookings/[bookingId]/centre (reassign)
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/bookings/[bookingId]/centre — source-centre membership (closed in Milestone 3E)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('denies reassignment when the caller has no membership to the CURRENT centre, even with access to the target', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { canUserAccessCentre, getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (canUserAccessCentre as any).mockResolvedValueOnce(true); // has access to target centre A
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_B, // current centre — caller has no membership here
      centre: { organisationId: 'org-1' },
    });
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]);

    const { PATCH } = await import('@/app/api/bookings/[bookingId]/centre/route');
    const req = new Request(`http://localhost/api/bookings/${BOOKING_ID}/centre`, {
      method: 'PATCH',
      body: JSON.stringify({ centreId: CENTRE_A }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ bookingId: BOOKING_ID }) });

    expect(res.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('allows reassignment when the caller has membership to both centres', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
    const { canUserAccessCentre, getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (canUserAccessCentre as any).mockResolvedValueOnce(true);
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_A,
      centre: { organisationId: 'org-1' },
    });
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A, CENTRE_B]);
    (db.query.centres.findFirst as any).mockResolvedValueOnce({ id: CENTRE_B, organisationId: 'org-1' });

    const { PATCH } = await import('@/app/api/bookings/[bookingId]/centre/route');
    const req = new Request(`http://localhost/api/bookings/${BOOKING_ID}/centre`, {
      method: 'PATCH',
      body: JSON.stringify({ centreId: CENTRE_B }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ bookingId: BOOKING_ID }) });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. /dashboard/bookings/[bookingId] — detail page centre scoping
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingDetailPage — centre membership on view (closed in Milestone 3E)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('404s for a non-ORG_OWNER user with no membership to the booking centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_B,
      centre: { organisationId: 'org-1' },
      attendees: [],
      parent: { firstName: 'P', lastName: 'L' },
    });
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]);

    const { default: BookingDetailPage } = await import('@/app/dashboard/bookings/[bookingId]/page');

    await expect(
      BookingDetailPage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).rejects.toThrow('NOT_FOUND');
  });

  it('renders for a non-ORG_OWNER user with membership to the booking centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_A,
      centre: { organisationId: 'org-1', name: 'Centre A', address: null },
      attendees: [],
      parent: { firstName: 'P', lastName: 'L', id: 'parent-1' },
      status: 'confirmed',
      createdAt: new Date(),
      startAt: new Date(),
      staff: null,
    });
    const { getUserAccessibleCentreIds, getUserAccessibleCentres } = await import('@/lib/permissions');
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]);
    (getUserAccessibleCentres as any).mockResolvedValueOnce([{ id: CENTRE_A, name: 'Centre A' }]);

    const { default: BookingDetailPage } = await import('@/app/dashboard/bookings/[bookingId]/page');

    await expect(
      BookingDetailPage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).resolves.toBeTruthy();
  });

  it('ORG_OWNER is not subject to the centre-membership check', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER'));
    const { db } = await import('@/db');
    (db.query.bookings.findFirst as any).mockResolvedValueOnce({
      id: BOOKING_ID,
      centreId: CENTRE_B,
      centre: { organisationId: 'org-1', name: 'Centre B', address: null },
      attendees: [],
      parent: { firstName: 'P', lastName: 'L', id: 'parent-1' },
      status: 'confirmed',
      createdAt: new Date(),
      startAt: new Date(),
      staff: null,
    });
    const { getUserAccessibleCentreIds, getUserAccessibleCentres } = await import('@/lib/permissions');
    (getUserAccessibleCentres as any).mockResolvedValueOnce([{ id: CENTRE_B, name: 'Centre B' }]);

    const { default: BookingDetailPage } = await import('@/app/dashboard/bookings/[bookingId]/page');

    await expect(
      BookingDetailPage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).resolves.toBeTruthy();
    expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
  });
});
