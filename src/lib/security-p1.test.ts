/**
 * P1 Security Fix Tests
 *
 * Centre membership enforcement for authenticated API routes:
 *   1. PATCH /api/bookings/[bookingId]/status — centre check for non-owners
 *   2. PATCH /api/bookings/bulk-update        — centre filter for non-owners
 *   3. DELETE /api/bookings/bulk-delete       — centre filter for non-owners
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
            bookings: { findFirst: vi.fn(), findMany: vi.fn() },
        },
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq:      vi.fn((col, val) => ({ col, val, op: 'eq' })),
        and:     vi.fn((...args) => ({ op: 'and', args })),
        inArray: vi.fn((col, vals) => ({ col, vals, op: 'inArray' })),
    };
});

// ─────────────────────────────────────────────────────────────────────────────
// Test constants
// ─────────────────────────────────────────────────────────────────────────────

const BOOKING_ID   = '550e8400-e29b-41d4-a716-446655440001';
const CENTRE_A_ID  = '550e8400-e29b-41d4-a716-446655440010';
const CENTRE_B_ID  = '550e8400-e29b-41d4-a716-446655440020';
const ORG_ID       = 'org-abc';

const mockBooking = (centreId = CENTRE_A_ID) => ({
    id: BOOKING_ID,
    centreId,
    centre: { id: centreId, organisationId: ORG_ID },
    status: 'pending',
});

function patchRequest(body: object): Request {
    return new Request(`http://localhost/api/bookings/${BOOKING_ID}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function bulkRequest(method: string, path: string, body: object): Request {
    return new Request(`http://localhost/api/bookings/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PATCH /api/bookings/[bookingId]/status
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/bookings/[bookingId]/status — centre membership', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const params = Promise.resolve({ bookingId: BOOKING_ID });

    async function getRoute() {
        const { PATCH } = await import('@/app/api/bookings/[bookingId]/status/route');
        return PATCH;
    }

    it('ORG_OWNER can update a booking — no centre check performed', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking());
        const mockReturning = vi.fn().mockResolvedValueOnce([{ id: BOOKING_ID, status: 'confirmed' }]);
        const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const PATCH = await getRoute();
        const res = await PATCH(patchRequest({ status: 'confirmed' }) as any, { params });
        expect(res.status).toBe(200);

        // getUserAccessibleCentreIds must NOT be called for ORG_OWNER
        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });

    it('non-owner whose centre membership includes the booking centre is allowed', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u2', organisationId: ORG_ID, role: 'MANAGER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID));
        const mockReturning = vi.fn().mockResolvedValueOnce([{ id: BOOKING_ID, status: 'confirmed' }]);
        const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const PATCH = await getRoute();
        const res = await PATCH(patchRequest({ status: 'confirmed' }) as any, { params });
        expect(res.status).toBe(200);
    });

    it('non-owner whose centre membership does NOT include the booking centre → 403', async () => {
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

        const PATCH = await getRoute();
        const res = await PATCH(patchRequest({ status: 'confirmed' }) as any, { params });
        expect(res.status).toBe(403);
        // Confirm the DB update was never called
        const { db: db2 } = await import('@/db');
        expect(db2.update).not.toHaveBeenCalled();
    });

    it('returns 403 (org check) when booking belongs to a different organisation', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u4', organisationId: 'org-different', role: 'ORG_OWNER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(mockBooking(CENTRE_A_ID));

        const PATCH = await getRoute();
        const res = await PATCH(patchRequest({ status: 'confirmed' }) as any, { params });
        expect(res.status).toBe(403);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PATCH /api/bookings/bulk-update
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/bookings/bulk-update — centre membership', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const BOOKING_A = '550e8400-e29b-41d4-a716-446655440001';
    const BOOKING_B = '550e8400-e29b-41d4-a716-446655440002';

    async function getRoute() {
        const { PATCH } = await import('@/app/api/bookings/bulk-update/route');
        return PATCH;
    }

    function bulkBody(bookingIds: string[], status = 'confirmed') {
        return bulkRequest('PATCH', 'bulk-update', { bookingIds, status });
    }

    it('ORG_OWNER updates all org bookings regardless of centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findMany as any).mockResolvedValueOnce([
            { id: BOOKING_A, centreId: CENTRE_A_ID, centre: { organisationId: ORG_ID } },
            { id: BOOKING_B, centreId: CENTRE_B_ID, centre: { organisationId: ORG_ID } },
        ]);
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 2 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const PATCH = await getRoute();
        const res = await PATCH(bulkBody([BOOKING_A, BOOKING_B]) as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        // Both bookings updated — ORG_OWNER sees both centres
        expect(json.count).toBe(2);

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });

    it('non-owner only updates bookings in their accessible centres', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u2', organisationId: ORG_ID, role: 'MANAGER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findMany as any).mockResolvedValueOnce([
            { id: BOOKING_A, centreId: CENTRE_A_ID, centre: { organisationId: ORG_ID } },
            { id: BOOKING_B, centreId: CENTRE_B_ID, centre: { organisationId: ORG_ID } },
        ]);
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        // User is only assigned to Centre A
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const PATCH = await getRoute();
        const res = await PATCH(bulkBody([BOOKING_A, BOOKING_B]) as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        // Only BOOKING_A (Centre A) is updated; BOOKING_B (Centre B) is silently skipped
        expect(json.count).toBe(1);
    });

    it('non-owner gets 403 when ALL submitted bookings are in inaccessible centres', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u3', organisationId: ORG_ID, role: 'FRONT_DESK' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findMany as any).mockResolvedValueOnce([
            { id: BOOKING_B, centreId: CENTRE_B_ID, centre: { organisationId: ORG_ID } },
        ]);

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        // User is only assigned to Centre A, but booking is in Centre B
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const PATCH = await getRoute();
        const res = await PATCH(bulkBody([BOOKING_B]) as any);
        expect(res.status).toBe(403);
        // DB update must not have been called
        const { db: db2 } = await import('@/db');
        expect(db2.update).not.toHaveBeenCalled();
    });

    it('returns 200 with count 0 for empty bookingIds (short-circuit, no DB call)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'MANAGER' },
        });

        const PATCH = await getRoute();
        const res = await PATCH(bulkBody([]) as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.count).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELETE /api/bookings/bulk-delete
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/bookings/bulk-delete — centre membership', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const BOOKING_A = '550e8400-e29b-41d4-a716-446655440001';
    const BOOKING_B = '550e8400-e29b-41d4-a716-446655440002';

    async function getRoute() {
        const { DELETE } = await import('@/app/api/bookings/bulk-delete/route');
        return DELETE;
    }

    function deleteBody(bookingIds: string[]) {
        return bulkRequest('DELETE', 'bulk-delete', { bookingIds });
    }

    it('ORG_OWNER deletes all org bookings regardless of centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'ORG_OWNER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findMany as any).mockResolvedValueOnce([
            { id: BOOKING_A, centreId: CENTRE_A_ID, centre: { organisationId: ORG_ID } },
            { id: BOOKING_B, centreId: CENTRE_B_ID, centre: { organisationId: ORG_ID } },
        ]);
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 2 });
        (db.delete as any).mockReturnValue({ where: mockWhere });

        const DELETE = await getRoute();
        const res = await DELETE(deleteBody([BOOKING_A, BOOKING_B]) as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.count).toBe(2);

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });

    it('non-owner only deletes bookings in their accessible centres', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u2', organisationId: ORG_ID, role: 'MANAGER' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findMany as any).mockResolvedValueOnce([
            { id: BOOKING_A, centreId: CENTRE_A_ID, centre: { organisationId: ORG_ID } },
            { id: BOOKING_B, centreId: CENTRE_B_ID, centre: { organisationId: ORG_ID } },
        ]);
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        (db.delete as any).mockReturnValue({ where: mockWhere });

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const DELETE = await getRoute();
        const res = await DELETE(deleteBody([BOOKING_A, BOOKING_B]) as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        // Only BOOKING_A deleted; BOOKING_B silently excluded
        expect(json.count).toBe(1);
    });

    it('non-owner gets 403 when ALL bookings are in inaccessible centres', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u3', organisationId: ORG_ID, role: 'FRONT_DESK' },
        });

        const { db } = await import('@/db');
        (db.query.bookings.findMany as any).mockResolvedValueOnce([
            { id: BOOKING_B, centreId: CENTRE_B_ID, centre: { organisationId: ORG_ID } },
        ]);

        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([CENTRE_A_ID]);

        const DELETE = await getRoute();
        const res = await DELETE(deleteBody([BOOKING_B]) as any);
        expect(res.status).toBe(403);
        const { db: db2 } = await import('@/db');
        expect(db2.delete).not.toHaveBeenCalled();
    });

    it('returns 200 with count 0 for empty bookingIds (short-circuit)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: ORG_ID, role: 'MANAGER' },
        });

        const DELETE = await getRoute();
        const res = await DELETE(deleteBody([]) as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.count).toBe(0);
    });
});
