import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockDbQuery = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            billingConfigs: { findMany: (...args: any[]) => mockDbQuery('findMany', ...args) }
        },
        transaction: (...args: any[]) => mockTransaction(...args)
    }
}));

describe('Cron Billing (§9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockDbQuery.mockResolvedValue([]);
    });

    it('Missing CRON_SECRET fails closed (503)', async () => {
        delete process.env.CRON_SECRET;
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': `Bearer my-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(503);
    });

    it('Invalid secret rejected (401)', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': `Bearer wrong-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('Valid secret accepted', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': `Bearer test-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });

    it('GET /api/cron/billing with valid CRON_SECRET responds', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': `Bearer test-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});
