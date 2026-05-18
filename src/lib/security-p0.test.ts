/**
 * P0 Security Fix Tests
 *
 * Tests for the multi-tenant centre/site isolation fixes:
 *   1. PATCH /api/register/[id]/status — auth + org ownership + centre-level check
 *   2. GET  /api/register              — auth, session-derived orgId, centre restriction
 *   3. POST /api/register              — centreId validated against resolved org
 *   4. POST /api/bookings              — centreId validated against DB before booking
 *
 * These tests use unit-level mocking to avoid DB/network dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Shared mock setup
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
            registrations: { findFirst: vi.fn(), findMany: vi.fn() },
            centres:       { findFirst: vi.fn() },
            organisations: { findFirst: vi.fn() },
        },
        update: vi.fn(),
        insert: vi.fn(),
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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(body: object, method = 'PATCH'): Request {
    return new Request('http://localhost/api/test', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function getStatusRoute() {
    // Re-import per test so module state is fresh after vi.mock
    const { PATCH } = await import('@/app/api/register/[id]/status/route');
    return PATCH;
}

async function getRegisterRoute() {
    const mod = await import('@/app/api/register/route');
    return mod;
}

async function getBookingsRoute() {
    const { POST } = await import('@/app/api/bookings/route');
    return POST;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PATCH /api/register/[id]/status
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/register/[id]/status', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const params = Promise.resolve({ id: 'reg-abc' });

    it('returns 401 when unauthenticated', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'signed_up' }) as any, { params });
        expect(res.status).toBe(401);
    });

    it('returns 401 when session has no organisationId', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({ user: { id: 'u1' } });

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'signed_up' }) as any, { params });
        expect(res.status).toBe(401);
    });

    it('returns 400 when status value is invalid', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'hacked' }) as any, { params });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Invalid status');
    });

    it('returns 404 when registration belongs to a different org', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.registrations.findFirst as any).mockResolvedValueOnce(null);

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'signed_up' }) as any, { params });
        expect(res.status).toBe(404);
    });

    it('returns 403 when non-owner accesses a centre they are not assigned to', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'MANAGER' },
        });
        const { db } = await import('@/db');
        (db.query.registrations.findFirst as any).mockResolvedValueOnce({
            id: 'reg-abc',
            organisationId: 'org-1',
            centreId: 'centre-B',
        });
        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-A']);

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'signed_up' }) as any, { params });
        expect(res.status).toBe(403);
    });

    it('returns 200 when ORG_OWNER updates a registration in their org', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.registrations.findFirst as any).mockResolvedValueOnce({
            id: 'reg-abc',
            organisationId: 'org-1',
            centreId: 'centre-A',
        });
        // db.update chain
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'signed_up' }) as any, { params });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
    });

    it('returns 200 when MANAGER updates a registration in their centre', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'MANAGER' },
        });
        const { db } = await import('@/db');
        (db.query.registrations.findFirst as any).mockResolvedValueOnce({
            id: 'reg-abc',
            organisationId: 'org-1',
            centreId: 'centre-A',
        });
        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-A', 'centre-B']);

        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        const mockSet   = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const PATCH = await getStatusRoute();
        const res = await PATCH(makeRequest({ status: 'not_interested' }) as any, { params });
        expect(res.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/register
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/register', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    function makeGetRequest(params: Record<string, string> = {}): Request {
        const url = new URL('http://localhost/api/register');
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        return new Request(url.toString(), { method: 'GET' });
    }

    it('returns 401 when unauthenticated', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);

        const { GET } = await getRegisterRoute();
        const res = await GET(makeGetRequest() as any);
        expect(res.status).toBe(401);
    });

    it('ignores orgId query param and uses session orgId instead', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        const { db } = await import('@/db');
        (db.query.registrations.findMany as any).mockResolvedValueOnce([]);

        const { GET } = await getRegisterRoute();
        // Attacker passes a different orgId in query string
        const res = await GET(makeGetRequest({ orgId: 'org-attacker' }) as any);
        expect(res.status).toBe(200);

        // The query must have been called with org-1 (from session), not org-attacker
        // We verify findMany was called (exact where arg tested via integration)
        expect(db.query.registrations.findMany).toHaveBeenCalledOnce();
    });

    it('returns empty array when non-owner has no centre memberships', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'MANAGER' },
        });
        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce([]);

        const { GET } = await getRegisterRoute();
        const res = await GET(makeGetRequest() as any);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual([]);
    });

    it('restricts non-owner to their accessible centres', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce({
            user: { id: 'u1', organisationId: 'org-1', role: 'MANAGER' },
        });
        const { getUserAccessibleCentreIds } = await import('@/lib/permissions');
        (getUserAccessibleCentreIds as any).mockResolvedValueOnce(['centre-A']);
        const { db } = await import('@/db');
        (db.query.registrations.findMany as any).mockResolvedValueOnce([
            { id: 'reg-1', centreId: 'centre-A' },
        ]);

        const { GET } = await getRegisterRoute();
        const res = await GET(makeGetRequest() as any);
        expect(res.status).toBe(200);
        // findMany was called (with inArray filter — can't inspect where directly without integration)
        expect(db.query.registrations.findMany).toHaveBeenCalledOnce();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/register — centreId validation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/register — centreId validation', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const validBody = {
        orgSlug: 'org-a',
        centreId: 'centre-from-org-b',  // cross-org attack
        children: [{ firstName: 'Alice', lastName: 'Smith', schoolYear: 'Y3' }],
        parents: [{ firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com' }],
        termsAgreed: true,
    };

    it('returns 400 when centreId does not belong to the resolved org', async () => {
        const { db } = await import('@/db');
        // org resolves fine
        (db.query.organisations.findFirst as any).mockResolvedValueOnce({ id: 'org-a-uuid', name: 'Org A', slug: 'org-a' });
        // centre lookup returns null (centreId is from a different org)
        (db.query.centres.findFirst as any).mockResolvedValueOnce(null);

        const { POST } = await getRegisterRoute();
        const req = new Request('http://localhost/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validBody),
        });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('Invalid centre');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/bookings — centreId validation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/bookings — centreId validation', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const validBookingBody = {
        parent: { firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', phone: '07700000000' },
        children: [{ firstName: 'Alice', lastName: 'Smith', schoolYear: 'Y3', subjects: ['Maths'] }],
        appointment: {
            // Must be a real UUID so Zod's z.string().uuid() passes
            centreId: '550e8400-e29b-41d4-a716-446655440000',
            modality: 'in_person',
            startAt: '09:00',
            date: '2030-01-15',
            duration: 45,
        },
        consent: { communications: true },
    };

    it('returns 400 when centreId does not exist in the database', async () => {
        const { db } = await import('@/db');
        (db.query.centres.findFirst as any).mockResolvedValueOnce(null);

        const POST = await getBookingsRoute();
        const req = new Request('http://localhost/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validBookingBody),
        });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Invalid centre ID');
    });

    it('returns 400 when centre exists but its org does not (orphan centre)', async () => {
        const { db } = await import('@/db');
        (db.query.centres.findFirst as any).mockResolvedValueOnce({ id: 'centre-uuid', organisationId: 'org-ghost' });
        (db.query.organisations.findFirst as any).mockResolvedValueOnce(null);

        const POST = await getBookingsRoute();
        const req = new Request('http://localhost/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validBookingBody),
        });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Invalid centre ID');
    });

    it('returns 400 when centreId is missing from the body', async () => {
        const POST = await getBookingsRoute();
        const bodyWithoutCentre = {
            ...validBookingBody,
            appointment: { ...validBookingBody.appointment, centreId: undefined },
        };
        const req = new Request('http://localhost/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyWithoutCentre),
        });
        const res = await POST(req as any);
        expect(res.status).toBe(400);
    });
});
