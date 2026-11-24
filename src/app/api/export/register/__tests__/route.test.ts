/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/session', () => ({
    getApiSession: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentres: vi.fn(),
}));

function makeSelectChain(rows: unknown[]) {
    const chain: any = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn().mockResolvedValue(rows),
    };
    return chain;
}

vi.mock('@/db', () => ({
    db: {
        select: vi.fn(),
    },
}));

function sessionFor(role?: string) {
    return { user: { id: 'user-1', organisationId: 'org-1', role } };
}

function makeRequest(query = '?date=2026-11-24') {
    return new NextRequest(`http://localhost:3000/api/export/register${query}`);
}

describe('GET /api/export/register role authorization', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns 401 when unauthenticated', async () => {
        const { getApiSession } = await import('@/lib/session');
        (getApiSession as any).mockResolvedValueOnce(null);

        const { GET } = await import('../route');
        const res = await GET(makeRequest());

        expect(res.status).toBe(401);
    });

    it('returns 403 for TUTOR without querying centres or bookings', async () => {
        const { getApiSession } = await import('@/lib/session');
        const { getUserAccessibleCentres } = await import('@/lib/permissions');
        const { db } = await import('@/db');
        (getApiSession as any).mockResolvedValueOnce(sessionFor('TUTOR'));

        const { GET } = await import('../route');
        const res = await GET(makeRequest());

        expect(res.status).toBe(403);
        expect(getUserAccessibleCentres).not.toHaveBeenCalled();
        expect(db.select).not.toHaveBeenCalled();
    });

    it('returns 403 when role is missing', async () => {
        const { getApiSession } = await import('@/lib/session');
        (getApiSession as any).mockResolvedValueOnce(sessionFor(undefined));

        const { GET } = await import('../route');
        const res = await GET(makeRequest());

        expect(res.status).toBe(403);
    });

    it.each(['FRONT_DESK', 'MANAGER', 'ORG_OWNER'])('returns 200 CSV for %s', async (role) => {
        const { getApiSession } = await import('@/lib/session');
        const { getUserAccessibleCentres } = await import('@/lib/permissions');
        const { db } = await import('@/db');

        (getApiSession as any).mockResolvedValueOnce(sessionFor(role));
        (getUserAccessibleCentres as any).mockResolvedValueOnce([{ id: 'centre-1', name: 'Main Centre' }]);
        (db.select as any).mockReturnValueOnce(
            makeSelectChain([
                {
                    bookingId: 'b-1',
                    startAt: new Date('2026-11-24T15:30:00Z'),
                    status: 'confirmed',
                    centreName: 'Main Centre',
                    childFirstName: 'Ada',
                    childLastName: 'Lovelace',
                    schoolYear: 'Y5',
                    parentFirstName: 'Anne',
                    parentLastName: 'Byron',
                    parentPhone: '07700900000',
                    attendanceStatus: 'present',
                },
            ])
        );

        const { GET } = await import('../route');
        const res = await GET(makeRequest());
        const body = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('text/csv');
        expect(body).toContain('"Student Name"');
        expect(body).toContain('"Ada Lovelace"');
    });
});
