import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindManyOrgs = vi.fn();
const mockFindManyUsers = vi.fn();
const mockFetchDrafts = vi.fn();
const mockFetchSetupRequired = vi.fn();
const mockFetchPaymentsExpected = vi.fn();
const mockFetchOverdue = vi.fn();
const mockDbInsert = vi.fn();
const mockSendEmail = vi.fn();
const mockGetUserAccessibleCentreIds = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            organisations: { findMany: (...args: any[]) => mockFindManyOrgs(...args) },
            users: { findMany: (...args: any[]) => mockFindManyUsers(...args) },
        },
        insert: (...args: any[]) => ({
            values: (...vArgs: any[]) => mockDbInsert(...args, ...vArgs),
        }),
    },
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: any[]) => mockGetUserAccessibleCentreIds(...args),
}));

vi.mock('@/lib/services/email', () => ({
    sendEmail: (...args: any[]) => mockSendEmail(...args),
}));

vi.mock('@/features/billing/queries', () => ({
    fetchDraftsToReview: (...args: any[]) => mockFetchDrafts(...args),
    fetchBillingSetupRequired: (...args: any[]) => mockFetchSetupRequired(...args),
    fetchPaymentsExpected: (...args: any[]) => mockFetchPaymentsExpected(...args),
    fetchOverdueInvoices: (...args: any[]) => mockFetchOverdue(...args),
}));

describe('Cron Digest Route (§49, B17, Issue C)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockFindManyOrgs.mockResolvedValue([
            { id: 'org-1', name: 'Test Org 1' },
        ]);
        mockFindManyUsers.mockResolvedValue([
            { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER', email: 'owner@test.com' },
            { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER', email: 'manager@test.com' },
        ]);
        mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);
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
        mockDbInsert.mockResolvedValue(undefined);
        mockSendEmail.mockResolvedValue({ success: true });
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

    it('delivers exception-based digest to Owners (org-wide) and Managers (centre-scoped)', async () => {
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
        expect(body.totalNotificationsSent).toBe(2);
        expect(body.totalEmailsSent).toBe(2);
        expect(body.totalSuppressed).toBe(0);

        // Verify Owner called with 'all'
        expect(mockFetchDrafts).toHaveBeenCalledWith('org-1', 'all');
        // Verify Manager called with their assigned centre(s)
        expect(mockFetchDrafts).toHaveBeenCalledWith('org-1', ['centre-1']);

        // Verify notifications and emails were dispatched
        expect(mockDbInsert).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it('suppresses digest delivery when there are 0 exceptions', async () => {
        mockFetchDrafts.mockResolvedValue([]);
        mockFetchSetupRequired.mockResolvedValue([]);
        mockFetchPaymentsExpected.mockResolvedValue([]);
        mockFetchOverdue.mockResolvedValue([]);

        const { POST } = await import('./route');
        const req = new NextRequest('http://localhost/api/cron/digest', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer test-secret' }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.totalNotificationsSent).toBe(0);
        expect(body.totalEmailsSent).toBe(0);
        expect(body.totalSuppressed).toBe(2);
        expect(mockSendEmail).not.toHaveBeenCalled();
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
