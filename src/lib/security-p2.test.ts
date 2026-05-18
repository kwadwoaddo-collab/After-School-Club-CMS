/**
 * P2 Security Fix Tests
 *
 * Centre membership enforcement for reschedule and cancel booking routes:
 *   1. POST /api/bookings/[bookingId]/reschedule — org + centre check
 *   2. POST /api/bookings/[bookingId]/cancel     — org + centre check
 *
 * All tests mock at the module boundary; no DB or network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            bookings: { findFirst: vi.fn() },
        },
        update: vi.fn(),
    },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq:  vi.fn((col, val) => ({ col, val, op: 'eq' })),
        and: vi.fn((...args) => ({ op: 'and', args })),
    };
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BOOKING_ID  = '550e8400-e29b-41d4-a716-446655440001';
const CENTRE_A_ID = '550e8400-e29b-41d4-a716-446655440010';
const CENTRE_B_ID = '550e8400-e29b-41d4-a716-446655440020';
const ORG_ID      = 'org-abc';

const mockBooking = (centreId = CENTRE_A_ID, orgId = ORG_ID) => ({
    id: BOOKING_ID,
    centreId,
    centre: { id: centreId, organisationId: orgId },
    status: 'confirmed',
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/bookings/[bookingId]/reschedule
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/bookings/[bookingId]/reschedule — org + centre membership', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
    });

    const params = Promise.resolve({ bookingId: BOOKING_ID });
    const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    function makeRequest(body: object): Request {
        return new Request(`http://localhost/api/bookings/${BOOKING_ID}/reschedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    async function getRoute() {
        const { POST } = await import('@/app/api/bookings/[bookingId]/reschedule/route');
        return POST;
    }

    it('returns 401 when unauthenticated', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(401);
    });

    it('returns 401 when session has no organisationId', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({ user: { id: 'u1', role: 'MANAGER' } });

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(401);
    });

    it('returns 404 when booking does not exist', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(null);

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(404);
    });

    it('returns 403 when booking belongs to a different organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-different', role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID, ORG_ID));

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(403);
    });

    it('ORG_OWNER can reschedule any booking in their org — no centre check', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID));
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(200);

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });

    it('non-owner with centre access can reschedule', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u2', organisationId: ORG_ID, role: 'MANAGER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID));
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(200);
    });

    it('non-owner without centre access → 403', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u3', organisationId: ORG_ID, role: 'MANAGER' },
        });
        const { db } = await import('@/db');
        // Booking is in Centre B
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_B_ID));

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        // User is only assigned to Centre A
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: FUTURE_DATE }) as any, { params });
        expect(res.status).toBe(403);

        // DB update must not have been called
        const { db: db2 } = await import('@/db');
        expect(db2.update).not.toHaveBeenCalled();
    });

    it('returns 400 when newStartAt is in the past', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking());

        const PAST_DATE = new Date(Date.now() - 1000).toISOString();
        const POST = await getRoute();
        const res = await POST(makeRequest({ newStartAt: PAST_DATE }) as any, { params });
        expect(res.status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/bookings/[bookingId]/cancel
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/bookings/[bookingId]/cancel — org + centre membership', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
    });

    const params = Promise.resolve({ bookingId: BOOKING_ID });

    function makeRequest(): Request {
        return new Request(`http://localhost/api/bookings/${BOOKING_ID}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
    }

    async function getRoute() {
        const { POST } = await import('@/app/api/bookings/[bookingId]/cancel/route');
        return POST;
    }

    it('returns 401 when unauthenticated', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(401);
    });

    it('returns 401 when session has no organisationId', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({ user: { id: 'u1' } });

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(401);
    });

    it('returns 404 when booking does not exist', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        // Explicitly return null to simulate booking not found
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(null);

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(404);
    });

    it('returns 403 when booking belongs to a different organisation', async () => {
        const { auth } = await import('@/lib/auth');  
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-different', role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        // Booking belongs to ORG_ID, not 'org-different'
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID, ORG_ID));

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(403);
    });

    it('ORG_OWNER can cancel any booking in their org — no centre check', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID));
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(200);

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });

    it('non-owner with centre access can cancel', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u2', organisationId: ORG_ID, role: 'MANAGER' },
        });
        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID));
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(200);
    });

    it('non-owner without centre access → 403', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u3', organisationId: ORG_ID, role: 'FRONT_DESK' },
        });
        const { db } = await import('@/db');
        // Booking is in Centre B; user only has Centre A
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_B_ID, ORG_ID));

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const POST = await getRoute();
        const res = await POST(makeRequest() as any, { params });
        expect(res.status).toBe(403);

        const { db: db2 } = await import('@/db');
        expect(db2.update).not.toHaveBeenCalled();
    });
});
