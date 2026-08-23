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
 *
 * Orchestrator follow-up (post Stage-A review) adds:
 *
 * 4. /dashboard/bookings/[bookingId]/reschedule had NO organisation check at
 *    all (worse than Booking Detail's pre-fix state) — any authenticated
 *    user of any organisation could view another organisation's booking
 *    (parent name/email, child name, centre name, date/time) by navigating
 *    directly to its URL. Fixed with the same organisation + centre checks
 *    already applied to Booking Detail and to the reschedule mutation
 *    (POST /api/bookings/[bookingId]/reschedule).
 * 5. GET /api/bookings/[bookingId] does not exist — only DELETE is
 *    implemented in that route file. Confirmed live (curl against the dev
 *    server returns 405 Method Not Allowed with no payload, before any
 *    application code runs). The Stage-A surface inventory's table row
 *    listing "GET/DELETE [bookingId]" together was inaccurate; corrected in
 *    the audit doc. No code change — a regression test guards against a
 *    future unprotected GET being added silently.
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
    select: vi.fn(),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  },
}));

// Chainable stand-in for drizzle's fluent select builder — supports both
// call shapes used by the reschedule page: `.select().from()...limit(1)`
// (awaited via .limit) and `.select().from()...where(...)` (awaited
// directly, via the thenable `.then`).
function selectChain(result: any[]) {
  const node: any = {
    from: () => node,
    leftJoin: () => node,
    where: () => node,
    limit: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return node;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// 4. /dashboard/bookings/[bookingId]/reschedule — orchestrator follow-up
// ─────────────────────────────────────────────────────────────────────────────

describe('ReschedulePage — organisation + centre isolation (closed post Stage-A review)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('redirects to the bookings list for a booking belonging to a DIFFERENT organisation', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { organisationId: 'org-1' }));
    const { db } = await import('@/db');
    (db.select as any).mockReturnValueOnce(
      selectChain([{
        id: BOOKING_ID,
        startAt: new Date(),
        duration: 60,
        modality: 'in_person',
        status: 'confirmed',
        parentFirstName: 'Other',
        parentLastName: 'Org Parent',
        parentEmail: 'other@example.com',
        centreName: 'Their Centre',
        centreId: CENTRE_B,
        centreOrganisationId: 'org-OTHER', // different org
        centreOperatingHours: null,
      }])
    );

    const { default: ReschedulePage } = await import('@/app/dashboard/bookings/[bookingId]/reschedule/page');

    await expect(
      ReschedulePage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard/bookings');
  });

  it('redirects for a non-ORG_OWNER user with no membership to the (same-org) booking centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK', { organisationId: 'org-1' }));
    const { db } = await import('@/db');
    (db.select as any).mockReturnValueOnce(
      selectChain([{
        id: BOOKING_ID,
        startAt: new Date(),
        duration: 60,
        modality: 'in_person',
        status: 'confirmed',
        parentFirstName: 'P',
        parentLastName: 'L',
        parentEmail: 'p@example.com',
        centreName: 'Centre B',
        centreId: CENTRE_B,
        centreOrganisationId: 'org-1', // same org
        centreOperatingHours: null,
      }])
    );
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]); // no access to CENTRE_B

    const { default: ReschedulePage } = await import('@/app/dashboard/bookings/[bookingId]/reschedule/page');

    await expect(
      ReschedulePage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).rejects.toThrow('REDIRECT:/dashboard/bookings');
  });

  it('renders for a non-ORG_OWNER user with membership to the booking centre', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK', { organisationId: 'org-1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReturnValueOnce(
        selectChain([{
          id: BOOKING_ID,
          startAt: new Date(),
          duration: 60,
          modality: 'in_person',
          status: 'confirmed',
          parentFirstName: 'P',
          parentLastName: 'L',
          parentEmail: 'p@example.com',
          centreName: 'Centre A',
          centreId: CENTRE_A,
          centreOrganisationId: 'org-1',
          centreOperatingHours: null,
        }])
      )
      .mockReturnValueOnce(selectChain([])); // attendees query
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
    (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A]);

    const { default: ReschedulePage } = await import('@/app/dashboard/bookings/[bookingId]/reschedule/page');

    await expect(
      ReschedulePage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).resolves.toBeTruthy();
  });

  it('ORG_OWNER is not subject to the centre-membership check', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', { organisationId: 'org-1' }));
    const { db } = await import('@/db');
    (db.select as any)
      .mockReturnValueOnce(
        selectChain([{
          id: BOOKING_ID,
          startAt: new Date(),
          duration: 60,
          modality: 'in_person',
          status: 'confirmed',
          parentFirstName: 'P',
          parentLastName: 'L',
          parentEmail: 'p@example.com',
          centreName: 'Centre B',
          centreId: CENTRE_B,
          centreOrganisationId: 'org-1',
          centreOperatingHours: null,
        }])
      )
      .mockReturnValueOnce(selectChain([]));
    const { getUserAccessibleCentreIds } = await import('@/lib/permissions');

    const { default: ReschedulePage } = await import('@/app/dashboard/bookings/[bookingId]/reschedule/page');

    await expect(
      ReschedulePage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
    ).resolves.toBeTruthy();
    expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/bookings/[bookingId] — confirmed not to exist
// ─────────────────────────────────────────────────────────────────────────────
//
// Orchestrator follow-up item B. Live-verified against the dev server:
// `curl` returns 405 Method Not Allowed with no payload, before any
// application code runs (Next.js App Router's default behaviour for a
// route file with no matching HTTP-method export). This test guards
// against a future GET handler being added to this file without centre
// isolation — if one is ever added, this test starts failing and forces
// deliberate review rather than silent exposure.

describe('GET /api/bookings/[bookingId] — confirmed absent (no route to isolate)', () => {
  it('the route module exports no GET handler', async () => {
    const routeModule = await import('@/app/api/bookings/[bookingId]/route');
    expect((routeModule as any).GET).toBeUndefined();
    expect((routeModule as any).DELETE).toBeDefined();
  });
});
