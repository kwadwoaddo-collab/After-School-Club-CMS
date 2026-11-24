import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockDbQuery = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            invoices: { findMany: (...args: any[]) => mockDbQuery('invoices', ...args) },
            bookings: { findMany: (...args: any[]) => mockDbQuery('bookings', ...args) }
        },
        transaction: (...args: any[]) => mockTransaction(...args)
    }
}));

describe('Cron Reminders (§9, PR-15)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockDbQuery.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exports maxDuration = 60', async () => {
        const mod = await import('./route');
        expect(mod.maxDuration).toBe(60);
    });

    it('Missing CRON_SECRET fails closed (503)', async () => {
        delete process.env.CRON_SECRET;
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/reminders', {
            headers: new Headers({ 'Authorization': `Bearer my-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(503);
    });

    it('Invalid secret rejected (401)', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/reminders', {
            headers: new Headers({ 'Authorization': `Bearer wrong-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('Valid secret accepted with partial: false when completed within budget', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/reminders', {
            headers: new Headers({ 'Authorization': `Bearer test-secret` })
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.partial).toBe(false);
        expect(body.invoiceRemindersSent).toBe(0);
    });

    it('exits cleanly with partial: true when the 50s cooperative time budget is reached', async () => {
        const tomorrow = new Date(Date.now() + 86_400_000);
        mockDbQuery.mockResolvedValue([
            {
                id: 'booking-1',
                status: 'confirmed',
                startAt: tomorrow,
                parent: { email: 'p1@example.com', firstName: 'ParentOne' },
                centre: { name: 'Main Centre', organisation: { name: 'Club' } },
                attendees: [{ child: { firstName: 'ChildOne' } }],
            },
            {
                id: 'booking-2',
                status: 'confirmed',
                startAt: tomorrow,
                parent: { email: 'p2@example.com', firstName: 'ParentTwo' },
                centre: { name: 'Main Centre', organisation: { name: 'Club' } },
                attendees: [{ child: { firstName: 'ChildTwo' } }],
            },
        ]);

        const baseNow = Date.UTC(2026, 10, 24, 17, 0, 0);
        let calls = 0;
        vi.spyOn(Date, 'now').mockImplementation(() => {
            calls++;
            // Call 1 = startedAt, Call 2 = booking-1 check (10ms), Call 3 = booking-2 check (50_010ms)
            if (calls <= 2) return baseNow + calls * 10;
            return baseNow + 50_010;
        });

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/reminders', {
            method: 'POST',
            headers: new Headers({ 'Authorization': `Bearer test-secret` }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.partial).toBe(true);
        expect(body.total).toBe(2);
        expect(body.invoiceRemindersSent).toBe(0);
    });
});
