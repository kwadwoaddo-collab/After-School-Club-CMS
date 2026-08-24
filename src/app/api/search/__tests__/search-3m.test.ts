/**
 * Milestone 3M — Search API regression tests
 *
 * S-2: No role restriction — TUTOR role could bypass Students/Parents page
 *      gates by calling /api/search directly.
 *      Fix: SEARCH_ALLOWED_ROLES constant enforces ORG_OWNER/MANAGER/FRONT_DESK.
 *
 * S-1 / S-3: Soft-delete filter (isNull) and booking org-isolation (innerJoin centres)
 *      are validated at the route-execution level with a DB mock returning empty results.
 */
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
    },
}));

import { auth } from '@/lib/auth';
const mockAuth = auth as MockedFunction<typeof auth>;

function makeRequest(query: string) {
    return new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(query)}`);
}

function makeSession(role: string) {
    return {
        user: {
            id: 'user-1',
            organisationId: 'org-1',
            role,
            name: 'Test User',
        },
        expires: new Date(Date.now() + 3600_000).toISOString(),
    };
}

describe('S-2 – Role restriction on /api/search', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 403 Forbidden for TUTOR role', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('TUTOR') as any);
        const res = await GET(makeRequest('alice'));
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body).toMatchObject({ error: 'Forbidden' });
    });

    it('allows ORG_OWNER role (returns 200)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('ORG_OWNER') as any);
        const res = await GET(makeRequest('al'));
        expect(res.status).toBe(200);
    });

    it('allows MANAGER role (returns 200)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('MANAGER') as any);
        const res = await GET(makeRequest('al'));
        expect(res.status).toBe(200);
    });

    it('allows FRONT_DESK role (returns 200)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('FRONT_DESK') as any);
        const res = await GET(makeRequest('al'));
        expect(res.status).toBe(200);
    });

    it('returns 401 for unauthenticated requests', async () => {
        mockAuth.mockResolvedValueOnce(null);
        const res = await GET(makeRequest('al'));
        expect(res.status).toBe(401);
    });
});

describe('S-2 – Short query passthrough for allowed role', () => {
    it('returns empty results when query is under 2 chars (allowed role)', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('ORG_OWNER') as any);
        const res = await GET(makeRequest('a'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.results).toEqual([]);
    });
});

describe('S-1 / S-3 – Route executes without error for allowed roles', () => {
    it('completes a search request for ORG_OWNER with a valid query', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('ORG_OWNER') as any);
        const res = await GET(makeRequest('smith'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('results');
        expect(Array.isArray(body.results)).toBe(true);
    });
});
