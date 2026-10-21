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
const mockEligibleRows = vi.fn();
const mockSelect = () => ({ from: () => ({ where: mockEligibleRows }) });

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
        select: mockSelect,
        transaction: (cb: any) => mockTransaction(cb),
        insert: (...args: any[]) => mockInsert(...args),
    },
}));

describe('Cron Billing Route (§9, Phase 11)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEligibleRows.mockResolvedValue([{ id: 'child-1' }]);
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
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
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
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
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

    it('Respects billing cycle skips by manager for current/upcoming periods and never walks historical periods', async () => {
        const { POST } = await import('./route');
        const { getBillingPeriodForDate, formatIsoDate } = await import('@/lib/billing/date-engine');
        const currentPeriod = getBillingPeriodForDate('2026-01-01', new Date());
        const currentPeriodStartStr = formatIsoDate(currentPeriod.periodStart);

        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-skipped',
                parentId: 'parent-regular-2',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2026-01-01', // old anchor in the past
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
                runs: [],
                skips: [{ periodStart: currentPeriodStartStr }],
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
            },
        ]);

        mockDbQuery.billingCycleSkips.findFirst.mockImplementation(async () => ({
            id: 'skip-1',
            billingConfigId: 'cfg-skipped',
            periodStart: currentPeriodStartStr,
            skipReason: 'Family holiday',
        }));

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.processed).toBe(1);
        expect(data.skipped_by_manager).toBeGreaterThanOrEqual(1);
        expect(data.generated).toBe(0);
    });

    it('Generates draft invoices ONLY for current and eligible upcoming periods (never creates completed historical periods from old anchors)', async () => {
        const { POST } = await import('./route');
        const { toUtcDate, formatIsoDate } = await import('@/lib/billing/date-engine');
        const todayUtc = toUtcDate(new Date());

        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-old-anchor',
                parentId: 'parent-regular-3',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2025-09-01', // Old anchor with >12 completed historical months and zero prior runs
                agreedMonthlyPence: 120000,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
                runs: [],
                skips: [],
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
            },
        ]);

        const createdInvoices: any[] = [];
        const createdRuns: any[] = [];

        mockTransaction.mockImplementation(async (cb: any) => {
            const tx = {
                select: mockSelect,
                execute: vi.fn().mockResolvedValue(undefined),
                query: {
                    billingCycleSkips: { findFirst: vi.fn().mockResolvedValue(null) },
                    billingRuns: { findFirst: vi.fn().mockResolvedValue(null) },
                    invoices: { findFirst: vi.fn().mockResolvedValue(null) },
                },
                insert: vi.fn(() => {
                    const chain: any = {
                        values: vi.fn((vals) => {
                            if (vals.invoiceNumber) {
                                createdInvoices.push(vals);
                            } else if (vals.billingConfigId) {
                                createdRuns.push(vals);
                            }
                            return chain;
                        }),
                        onConflictDoUpdate: vi.fn(() => chain),
                        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
                        returning: vi.fn().mockResolvedValue([{ id: `inv-${createdInvoices.length}`, amount: '1200.00' }]),
                    };
                    return chain;
                }),
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
        expect(data.generated).toBe(2); // Current period + 1 upcoming period (1 month lead time)
        expect(createdInvoices).toHaveLength(2);

        // Verify NO completed historical period was generated and NO fabricated run records were inserted for past cycles
        for (const inv of createdInvoices) {
            expect(inv.status).toBe('draft');
            expect(toUtcDate(inv.billingPeriodEnd).getTime()).toBeGreaterThanOrEqual(todayUtc.getTime());
        }
        expect(createdRuns).toHaveLength(2);
        for (const run of createdRuns) {
            expect(toUtcDate(run.periodEnd).getTime()).toBeGreaterThanOrEqual(todayUtc.getTime());
        }
    });

    it('Inclusive billing-date semantics: treats a period ending today (midnight UTC) as current, not historical', async () => {
        const { POST } = await import('./route');
        const { toUtcDate, formatIsoDate } = await import('@/lib/billing/date-engine');
        const todayUtc = toUtcDate(new Date());
        // Tomorrow is the anchor day -> current period ends today at 00:00:00.000Z!
        const tomorrowUtc = new Date(todayUtc.getTime() + 86_400_000);
        const anchorYear = tomorrowUtc.getUTCFullYear() - 1;
        const anchorMonth = String(tomorrowUtc.getUTCMonth() + 1).padStart(2, '0');
        const anchorDay = String(tomorrowUtc.getUTCDate()).padStart(2, '0');
        const anchorStr = `${anchorYear}-${anchorMonth}-${anchorDay}`;

        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-ends-today',
                parentId: 'parent-ends-today',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: anchorStr,
                agreedMonthlyPence: 50000,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 0, // Only period whose start <= today is due; period ending today has start ~1 month ago
                runs: [],
                skips: [],
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
            },
        ]);

        const createdPeriodEnds: string[] = [];
        mockTransaction.mockImplementation(async (cb: any) => {
            const tx = {
                select: mockSelect,
                execute: vi.fn().mockResolvedValue(undefined),
                query: {
                    billingCycleSkips: { findFirst: vi.fn().mockResolvedValue(null) },
                    billingRuns: { findFirst: vi.fn().mockResolvedValue(null) },
                    invoices: { findFirst: vi.fn().mockResolvedValue(null) },
                },
                insert: vi.fn(() => {
                    const chain: any = {
                        values: vi.fn((vals) => {
                            if (vals.billingPeriodEnd) {
                                createdPeriodEnds.push(formatIsoDate(vals.billingPeriodEnd));
                            }
                            return chain;
                        }),
                        onConflictDoUpdate: vi.fn(() => chain),
                        returning: vi.fn().mockResolvedValue([{ id: 'inv-today', amount: '500.00' }]),
                    };
                    return chain;
                }),
            };
            return cb(tx);
        });

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.generated).toBeGreaterThanOrEqual(1);
        expect(createdPeriodEnds).toContain(formatIsoDate(todayUtc));
    });

    it('Does NOT regenerate discarded drafts (billingRuns row with success=false, invoiceId=null)', async () => {
        const { POST } = await import('./route');
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([
            {
                id: 'cfg-discarded',
                parentId: 'parent-discarded',
                centreId: 'c-1',
                organisationId: 'o-1',
                status: 'active',
                billingAnchorDate: '2026-01-01',
                agreedMonthlyPence: 120000,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
                runs: [], // config.runs only loads success=true, so discarded run is absent from config.runs!
                skips: [],
                children: [{ child: { id: 'child-1', firstName: 'Alice', lastName: 'Smith' } }],
            },
        ]);

        // Every queried period already has a discarded run (success: false, invoiceId: null)
        mockDbQuery.billingRuns.findFirst.mockResolvedValue({
            id: 'run-discarded-1',
            billingConfigId: 'cfg-discarded',
            success: false,
            invoiceId: null,
            errorLog: 'Draft discarded by user',
        });

        const req = new NextRequest('http://localhost/api/cron/billing', {
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.generated).toBe(0);
        expect(data.skipped_already_exists).toBeGreaterThanOrEqual(1);
        expect(mockTransaction).not.toHaveBeenCalled();
    });
});


describe('Confirmed enrolment admission', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockDbQuery.billingConfigs.findMany.mockResolvedValue([{
            id: 'cfg-mixed', parentId: 'family', centreId: 'centre', organisationId: 'org',
            status: 'active', billingAnchorDate: '2026-01-01', agreedMonthlyPence: 190000,
            children: [
                { child: { id: 'confirmed', firstName: 'Confirmed', lastName: 'Child' } },
                { child: { id: 'prospect', firstName: 'Prospect', lastName: 'Child' } },
            ], runs: [], skips: [],
        }]);
    });
    it('does not bill the full family fee when one covered sibling awaits confirmation', async () => {
        mockEligibleRows.mockResolvedValue([{ id: 'confirmed' }]);
        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/cron/billing', {
            headers: { Authorization: 'Bearer test-secret' },
        }));
        const result = await response.json();
        expect(result.generated).toBe(0);
        expect(result.skipped_unconfirmed).toBe(1);
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockInsert).not.toHaveBeenCalled();
    });
    it('rechecks confirmation inside the locked transaction before writing an invoice', async () => {
        mockEligibleRows.mockResolvedValueOnce([{ id: 'confirmed' }, { id: 'prospect' }]).mockResolvedValue([]);
        mockDbQuery.billingCycleSkips.findFirst.mockResolvedValue(null);
        mockDbQuery.invoices.findFirst.mockResolvedValue(null);
        mockDbQuery.billingRuns.findFirst.mockResolvedValue(null);
        const txInsert = vi.fn();
        const execute = vi.fn().mockResolvedValue(undefined);
        mockTransaction.mockImplementation(async cb => cb({
            select: mockSelect, execute, insert: txInsert,
            query: { billingCycleSkips: { findFirst: vi.fn().mockResolvedValue(null) },
                billingRuns: { findFirst: vi.fn().mockResolvedValue(null) },
                invoices: { findFirst: vi.fn().mockResolvedValue(null) } },
        }));
        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/cron/billing', {
            headers: { Authorization: 'Bearer test-secret' },
        }));
        const result = await response.json();
        expect(result.generated).toBe(0);
        expect(result.errors).toBe(1);
        expect(mockTransaction).toHaveBeenCalled();
        expect(execute).toHaveBeenCalled();
        expect(txInsert).not.toHaveBeenCalled();
    });

    it('retains prospective configurations without creating an invoice or changing their history', async () => {
        mockEligibleRows.mockResolvedValue([]);
        const { POST } = await import('./route');
        const response = await POST(new NextRequest('http://localhost/api/cron/billing', {
            headers: { Authorization: 'Bearer test-secret' },
        }));
        expect((await response.json()).skipped_unconfirmed).toBe(1);
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockInsert).not.toHaveBeenCalled();
    });
});
