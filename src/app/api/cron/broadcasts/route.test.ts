import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockProcessBroadcastDeliveries = vi.fn();

vi.mock('@/features/communications/delivery', () => ({
    processBroadcastDeliveries: (...args: any[]) => mockProcessBroadcastDeliveries(...args),
}));

describe('Cron Broadcasts Route (PR-15)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockProcessBroadcastDeliveries.mockResolvedValue({
            processedCount: 3,
            sentCount: 3,
            failedCount: 0,
            retriedCount: 0,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exports maxDuration = 60', async () => {
        const mod = await import('./route');
        expect(mod.maxDuration).toBe(60);
    });

    it('fails closed (503) when CRON_SECRET is missing', async () => {
        delete process.env.CRON_SECRET;
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/broadcasts', {
            headers: { Authorization: 'Bearer test-secret' },
        });
        const res = await GET(req);
        expect(res.status).toBe(503);
    });

    it('rejects unauthorized requests (401)', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/broadcasts', {
            headers: { Authorization: 'Bearer wrong-secret' },
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('runs bounded recovery and returns partial: false when finished within budget', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/broadcasts?limit=40', {
            headers: { Authorization: 'Bearer test-secret' },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.partial).toBe(false);
        expect(body.processedCount).toBe(3);
        expect(body.sentCount).toBe(3);
        expect(mockProcessBroadcastDeliveries).toHaveBeenCalledTimes(1);
    });

    it('exits cleanly with partial: true when the 50s cooperative time budget is reached across sub-batches', async () => {
        mockProcessBroadcastDeliveries.mockResolvedValueOnce({
            processedCount: 25,
            sentCount: 25,
            failedCount: 0,
            retriedCount: 0,
        });

        const baseNow = Date.UTC(2026, 10, 24, 2, 0, 0);
        let calls = 0;
        vi.spyOn(Date, 'now').mockImplementation(() => {
            calls++;
            // Call 1 = startedAt, Call 2 = sub-batch 1 check (10ms), Call 3 = sub-batch 2 check (50_020ms)
            if (calls <= 2) return baseNow + calls * 10;
            return baseNow + 50_020;
        });

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/broadcasts?limit=100', {
            method: 'POST',
            headers: { Authorization: 'Bearer test-secret' },
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.partial).toBe(true);
        expect(body.processedCount).toBe(25);
        expect(mockProcessBroadcastDeliveries).toHaveBeenCalledTimes(1);
    });
});
