// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const mockParent = {
    id: 'parent-uuid-1111-1111-1111-111111111111',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'sarah.jenkins@example.com',
    phone: '+44 7700 900123',
};

const mockNotFound = vi.fn(() => {
    const err = new Error('NEXT_NOT_FOUND');
    (err as any).digest = 'NEXT_NOT_FOUND';
    throw err;
});

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
    notFound: () => mockNotFound(),
    redirect: (url: string) => mockRedirect(url),
}));

const getCurrentParentMock = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: () => getCurrentParentMock(),
}));

const findFirstMock = vi.fn();
vi.mock('@/db', () => ({
    db: {
        query: {
            invoices: {
                findFirst: (...args: unknown[]) => findFirstMock(...args),
            },
        },
    },
}));

import ParentReceiptPage from '../[id]/page';

describe('Parent Receipt Page — Security Guards, Cross-Parent Isolation & Ofsted Gating (PR Slice W6-C / UX-03)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentParentMock.mockResolvedValue(mockParent);
    });

    afterEach(() => {
        cleanup();
    });

    it('redirects unauthenticated parents to /portal/login', async () => {
        getCurrentParentMock.mockResolvedValueOnce(null);
        await expect(
            ParentReceiptPage({ params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) })
        ).rejects.toThrow();
        expect(mockRedirect).toHaveBeenCalledWith('/portal/login');
    });

    it('triggers notFound() when passed an invalid UUID', async () => {
        await expect(
            ParentReceiptPage({ params: Promise.resolve({ id: 'not-a-valid-uuid' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(mockNotFound).toHaveBeenCalled();
    });

    it('triggers notFound() for cross-parent invoices (or non-existent invoices)', async () => {
        // When database returns null because parentId did not match parent-uuid-1
        findFirstMock.mockResolvedValueOnce(null);
        await expect(
            ParentReceiptPage({ params: Promise.resolve({ id: '22222222-2222-2222-2222-222222222222' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(mockNotFound).toHaveBeenCalled();
    });

    it('triggers notFound() when an unpaid invoice is queried', async () => {
        // Database where clause includes eq(invoices.status, 'paid') so query returns null
        findFirstMock.mockResolvedValueOnce(null);
        await expect(
            ParentReceiptPage({ params: Promise.resolve({ id: '33333333-3333-3333-3333-333333333333' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(mockNotFound).toHaveBeenCalled();
    });

    it('triggers notFound() when the associated child has been soft-deleted', async () => {
        findFirstMock.mockResolvedValueOnce({
            id: '44444444-4444-4444-4444-444444444444',
            invoiceNumber: 'INV-999',
            status: 'paid',
            amount: '120.00',
            serviceType: 'childcare',
            child: { id: 'c1', firstName: 'Leo', lastName: 'Jenkins', deletedAt: new Date() },
            centre: { id: 'ct1', name: 'Croydon Hub', ofstedId: 'EY999999' },
            payments: [{ id: 'p1', amount: '120.00', method: 'stripe', recordedAt: new Date() }],
        });

        await expect(
            ParentReceiptPage({ params: Promise.resolve({ id: '44444444-4444-4444-4444-444444444444' }) })
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(mockNotFound).toHaveBeenCalled();
    });

    it('renders Childcare receipt with Ofsted Registration No and Key Details (PR #82)', async () => {
        findFirstMock.mockResolvedValueOnce({
            id: '55555555-5555-5555-5555-555555555555',
            invoiceNumber: 'INV-801',
            status: 'paid',
            amount: '150.00',
            serviceType: 'childcare',
            billingPeriodStart: new Date('2026-11-01T00:00:00Z'),
            billingPeriodEnd: new Date('2026-11-30T00:00:00Z'),
            child: { id: 'c1', firstName: 'Leo', lastName: 'Jenkins', deletedAt: null },
            centre: { id: 'ct1', name: 'Croydon Hub', ofstedId: 'EY123456' },
            payments: [
                { id: 'p1', amount: '150.00', method: 'bank_transfer', recordedAt: new Date('2026-11-20T10:00:00Z') },
            ],
        });

        const page = await ParentReceiptPage({
            params: Promise.resolve({ id: '55555555-5555-5555-5555-555555555555' }),
        });
        render(page);

        expect(screen.getByRole('heading', { level: 1, name: /Parent Payment Receipt/i })).toBeDefined();
        expect(screen.getByText('Key Details')).toBeDefined();
        expect(screen.getByText('Type of Service:')).toBeDefined();
        expect(screen.getByText('Childcare')).toBeDefined();
        expect(screen.getByText('Ofsted Registration No:')).toBeDefined();
        expect(screen.getByText('EY123456')).toBeDefined();
        expect(screen.getByText(/Assessment period covered by this payment/i)).toBeDefined();
        expect(screen.getByRole('button', { name: 'Print receipt' })).toBeDefined();
    });

    it('renders Tuition receipt WITHOUT Ofsted Registration No (PR #82 Tuition exclusion)', async () => {
        findFirstMock.mockResolvedValueOnce({
            id: '66666666-6666-6666-6666-666666666666',
            invoiceNumber: 'INV-802',
            status: 'paid',
            amount: '220.00',
            serviceType: 'tuition',
            billingPeriodStart: new Date('2026-11-01T00:00:00Z'),
            billingPeriodEnd: new Date('2026-11-30T00:00:00Z'),
            child: { id: 'c1', firstName: 'Leo', lastName: 'Jenkins', deletedAt: null },
            centre: { id: 'ct1', name: 'Croydon Hub', ofstedId: 'EY123456' },
            payments: [
                { id: 'p2', amount: '220.00', method: 'stripe', recordedAt: new Date('2026-11-22T14:00:00Z') },
            ],
        });

        const page = await ParentReceiptPage({
            params: Promise.resolve({ id: '66666666-6666-6666-6666-666666666666' }),
        });
        render(page);

        expect(screen.getByText('Type of Service:')).toBeDefined();
        expect(screen.getByText('Tuition')).toBeDefined();
        // CRITICAL: Ofsted number MUST NOT be displayed for Tuition!
        expect(screen.queryByText('Ofsted Registration No:')).toBeNull();
        expect(screen.queryByText('EY123456')).toBeNull();
    });
});