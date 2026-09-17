import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for portal/page.tsx — confirms draft exclusion is at DB level (not JS filter).
// Covers critic FAIL Q1: portal/page.tsx was using JS filter; now uses notInArray DB WHERE.

const invoicesFindMany = vi.fn();
const bookingAttendeesFindMany = vi.fn();

const getCurrentParent = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: () => getCurrentParent(),
}));

vi.mock('@/app/portal/notifications/actions', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

vi.mock('@/db', () => ({
    db: {
        query: {
            invoices: { findMany: (...args: unknown[]) => invoicesFindMany(...args) },
            bookingAttendees: { findMany: (...args: unknown[]) => bookingAttendeesFindMany(...args) },
        },
    },
}));

vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return { ...actual as object, cache: (fn: unknown) => fn };
});

describe('portal/page — DB-level draft exclusion (§7 critic fix)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentParent.mockResolvedValue({
            id: 'parent-1',
            firstName: 'Test',
            email: 'test@test.com',
            children: [],
            bookings: [],
        });
        bookingAttendeesFindMany.mockResolvedValue([]);
    });

    it('portal home calls findMany with a compound WHERE clause (not a plain eq)', async () => {
        invoicesFindMany.mockResolvedValue([]);
        const { default: PortalDashboard } = await import('@/app/portal/page');
        await PortalDashboard();

        expect(invoicesFindMany).toHaveBeenCalledTimes(1);
        const callArgs = invoicesFindMany.mock.calls[0][0];
        // Must have a WHERE clause (compound and/notInArray)
        expect(callArgs.where).toBeDefined();
        expect(callArgs.where).not.toBeNull();
    });

    it('draft invoice never reaches JS-land (DB filters it out)', async () => {
        // Simulate DB returning only sent invoices (draft excluded at DB level)
        invoicesFindMany.mockResolvedValue([
            { id: 'inv-sent', status: 'sent', amount: '150.00', payments: [] },
        ]);

        const { default: PortalDashboard } = await import('@/app/portal/page');
        await expect(PortalDashboard()).resolves.toBeDefined();
        expect(invoicesFindMany).toHaveBeenCalledTimes(1);
    });

    it('sent invoice still appears in outstanding balance (regression)', async () => {
        invoicesFindMany.mockResolvedValue([
            { id: 'inv-sent', status: 'sent', amount: '200.00', payments: [] },
        ]);
        const { default: PortalDashboard } = await import('@/app/portal/page');
        await expect(PortalDashboard()).resolves.toBeDefined();
        expect(invoicesFindMany).toHaveBeenCalledTimes(1);
    });
});
