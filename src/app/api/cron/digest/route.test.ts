import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindManyOrgs = vi.fn();
const mockFetchDrafts = vi.fn();
const mockFetchSetupRequired = vi.fn();
const mockFetchPaymentsExpected = vi.fn();
const mockFetchOverdue = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            organisations: { findMany: (...args: any[]) => mockFindManyOrgs(...args) },
        },
    },
}));

vi.mock('@/features/billing/queries', () => ({
    fetchDraftsToReview: (...args: any[]) => mockFetchDrafts(...args),
    fetchBillingSetupRequired: (...args: any[]) => mockFetchSetupRequired(...args),
    fetchPaymentsExpected: (...args: any[]) => mockFetchPaymentsExpected(...args),
    fetchOverdueInvoices: (...args: any[]) => mockFetchOverdue(...args),
}));

describe('Cron Digest Route (§49, B17)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockFindManyOrgs.mockResolvedValue([
            { id: 'org-1', name: 'Test Org 1' },
        ]);
        mockFetchDrafts.mockResolvedValue([
            { id: 'inv-1', amount: '120.00' },
        ]);
        mockFetchSetupRequired.mockResolvedValue([
            { id: 'config-1' },
        ]);
        mockFetchPaymentsExpected.mockResolvedValue([
            { id: 'inv-2' },
        ]);
        mockFetchOverdue.mockResolvedValue([
            { id: 'inv-3', amount: '80.00', payments: [] },
        ]);
    });

    it('fails closed (503) when CRON_SECRET is missing', async () => {
        delete process.env.CRON_SECRET;
        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/digest', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer some-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(503);
    });

    it('rejects unauthorized requests (401) with invalid secret', async () => {
        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/digest', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer wrong-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('processes operational digest and returns summaries with valid token', async () => {
        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/digest', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.organisationsCount).toBe(1);
        expect(body.summaries).toHaveLength(1);
        expect(body.summaries[0]).toEqual({
            organisationId: 'org-1',
            organisationName: 'Test Org 1',
            draftsToReviewCount: 1,
            draftsToReviewValuePounds: '120.00',
            billingSetupRequiredCount: 1,
            paymentsExpectedCount: 1,
            overdueInvoicesCount: 1,
            overdueInvoicesValuePounds: '80.00',
        });
    });

    it('GET handler aliases POST handler', async () => {
        const { GET } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/digest', {
            method: 'GET',
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});
