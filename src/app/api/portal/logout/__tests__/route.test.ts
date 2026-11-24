import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const deleteCookieMock = vi.fn();

vi.mock('next/headers', () => ({
    cookies: async () => ({
        delete: deleteCookieMock,
    }),
}));

describe('POST / GET /api/portal/logout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST clears parent_session cookie and returns 303 See Other to /portal/login (preventing 307 POST->405)', async () => {
        const { POST } = await import('../route');
        const req = new NextRequest('https://app.sprintscaleit.co.uk/api/portal/logout', {
            method: 'POST',
        });

        const res = await POST(req);
        expect(deleteCookieMock).toHaveBeenCalledWith('parent_session');
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toBe('https://app.sprintscaleit.co.uk/portal/login');
    });

    it('GET clears parent_session cookie and returns 303 See Other to /portal/login', async () => {
        const { GET } = await import('../route');
        const req = new NextRequest('https://app.sprintscaleit.co.uk/api/portal/logout');

        const res = await GET(req);
        expect(deleteCookieMock).toHaveBeenCalledWith('parent_session');
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toBe('https://app.sprintscaleit.co.uk/portal/login');
    });
});
