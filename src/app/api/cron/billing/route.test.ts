import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockDbQuery = {
    billingConfigs: { findMany: vi.fn() },
    billingCycleSkips: { findFirst: vi.fn() },
    invoices: { findFirst: vi.fn() },
    billingRuns: { findFirst: vi.fn() },
};
const mockTransaction = vi.fn();
const mockInsert = vi.fn();

function makeTxInsertChain(returnValue: any = [{ id: 'mock-invoice-id', amount: '100.00' }]) {
    const chain: any = {
        values: vi.fn(() => chain),
        onConflictDoUpdate: vi.fn(() => chain),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    return chain;
}

vi.mock('@/db', () => ({
    db: {
        query: mockDbQuery,
        transaction: (cb: any) => mockTransaction(cb),
        insert: (...args: any[]) => mockInsert(...args),
    },
}));

describe('Cron Billing Route (§9, Phase 11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([]);
        mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
        mockDbQuery.invoices.findFirst.mockResolvedValue(null);
        mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);
        mockInsert.mockImplementation(() => makeTxInsertChain());
    });

    it('Missing CRON_SECRET fails closed (503)', async () => {
        delete process.env.CRON_SECRET;
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer my-secret' }),
        });
        const res = await GET(req);
        expect(res.status).toBe(503);
    });

    it('Invalid secret rejected (401)', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer wrong-secret' }),
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('Valid secret accepted on GET', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(data.processed).toBe(0);
    });

    it('Skips quarantined parents immediately without invoice generation', async () => {
        const { POST } = await import('./route');
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-quarantined',
                parentId: '14087e1b-4bb8-4b10-8289-75f691fb0ad5', // Known quarantined parent ID
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2026-09-01',
                runs: [],
                skips: [],
                children: [],
            },
        ]);

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.processed).toBe(1);
        expect(data.skipped_quarantined).toBe(1);
        expect(data.generated).toBe(0);
    });

    it('Skips configs that are not due yet', async () => {
        const { POST } = await import('./route');
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-future',
                parentId: 'parent-regular-1',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2030-01-01', // far future
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
                runs: [],
                skips: [],
                children: [],
            },
        ]);

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.processed).toBe(1);
        expect(data.skipped_not_due).toBe(1);
        expect(data.generated).toBe(0);
    });

    it('Respects billing cycle skips by manager', async () => {
        const { POST } = await import('./route');
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-skipped',
                parentId: 'parent-regular-2',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2026-01-01', // in past, so due
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
                runs: [],
                skips: [{ periodStart: '2026-01-01' }],
                children: [],
            },
        ]);

        mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue({
            id: 'skip-1',
            billingConfigId: 'cfg-skipped',
            periodStart: '2026-01-01',
            skipReason: 'Family holiday',
        });

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.processed).toBe(1);
        expect(data.skipped_by_manager).toBeGreaterThanOrEqual(1);
    });

    it('Generates draft invoice for eligible config in transaction', async () => {
        const { POST } = await import('./route');
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-eligible',
                parentId: 'parent-regular-3',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2026-09-01',
                agreedMonthlyPence: 25000,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
                runs: [],
                skips: [],
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
            },
        ]);

        mockTransaction.mockImplementation(async (cb: any) => {
            const tx = {
                execute: vi.fn().mockResolvedValue(undefined),
                query: {
                    billingCycleSkips: { findFirst: vi.fn().mockResolvedValue(null) },
                    billingRuns: { findFirst: vi.fn().mockResolvedValue(null) },
                    invoices: { findFirst: vi.fn().mockResolvedValue(null) },
                },
                insert: vi.fn(() => makeTxInsertChain()),
            };
            return cb(tx);
        });

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.processed).toBe(1);
        expect(data.generated).toBeGreaterThanOrEqual(1);
    });
});
