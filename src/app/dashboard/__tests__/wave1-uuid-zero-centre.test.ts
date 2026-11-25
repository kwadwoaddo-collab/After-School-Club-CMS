/**
 * Wave 1 PR #3 — Postgres 22P02 UUID Crash Hardening & Zero-Centre Trap Tests
 *
 * Covers:
 * - Shared UUID validator (`src/lib/uuid.ts` — `UUID_RE`, `isValidUuid`).
 * - Invalid UUID route/query params return `notFound()` (or ignore invalid optional query params)
 *   BEFORE querying Postgres on:
 *   - `/dashboard/registrations/[id]`
 *   - `/dashboard/bookings/[bookingId]`
 *   - `/dashboard/bookings/[bookingId]/reschedule`
 *   - `/dashboard/parents/[id]`
 *   - `/dashboard/finance/receipt?paymentId=...`
 * - Zero-centre (`accessibleCentres = []`) and zero-child (`visibleChildIds = []`) staff
 *   short-circuit DB queries cleanly and render role-aware `<EmptyState>` (never passing
 *   `'unauthorized_centre_id'`, `'unauthorized_child_id'`, `'none'`, or `'all'` into UUID columns) on:
 *   - `/dashboard/finance/invoices`
 *   - `/dashboard/finance/reconciliation`
 *   - `/dashboard/finance/receipt`
 *   - `/dashboard/registrations`
 *   - `/dashboard/incidents`
 *   - `/dashboard/parents/[id]`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
    notFound: vi.fn(() => {
        throw new Error('NOT_FOUND');
    }),
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: vi.fn(),
    getUserAccessibleCentres: vi.fn(),
    getVisibleChildIds: vi.fn(),
    canUserAccessCentre: vi.fn(),
}));

vi.mock('@/lib/centre-filter', () => ({
    resolveActiveCentreId: vi.fn().mockResolvedValue('all'),
}));

vi.mock('@/features/students/notes.actions', () => ({
    getStudentNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/dashboard/incidents/IncidentsClient', () => ({
    default: ({ centreId }: { centreId: string }) =>
        React.createElement(
            'div',
            { 'data-testid': 'incidents-client', 'data-centre-id': centreId },
            `IncidentsClient:${centreId}`
        ),
}));

vi.mock('@/features/finance/components/ReceiptGeneratorClient', () => ({
    default: ({ children: kids }: { children: unknown[] }) =>
        React.createElement(
            'div',
            { 'data-testid': 'receipt-generator-client', 'data-children-count': kids.length },
            `ReceiptGeneratorClient:${kids.length}`
        ),
}));

vi.mock('@/features/finance/components/FilterableInvoiceHistorySection', () => ({
    default: ({ initialInvoices }: { initialInvoices: unknown[] }) =>
        React.createElement(
            'div',
            { 'data-testid': 'invoice-history-section' },
            `Invoices:${initialInvoices.length}`
        ),
}));

vi.mock('@/components/dashboard/HeaderPortal', () => ({
    default: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
}));

vi.mock('@/features/students/components/JoiningJourneyGuide', () => ({
    default: () => null,
}));

vi.mock('@/features/registration/components/RegistrationsFilters', () => ({
    default: () => React.createElement('div', { 'data-testid': 'registrations-filters' }),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            bookings: { findFirst: vi.fn(), findMany: vi.fn() },
            registrations: { findFirst: vi.fn(), findMany: vi.fn() },
            organisations: { findFirst: vi.fn() },
            centres: { findFirst: vi.fn(), findMany: vi.fn() },
            parents: { findFirst: vi.fn(), findMany: vi.fn() },
            children: { findFirst: vi.fn(), findMany: vi.fn() },
            invoices: { findFirst: vi.fn(), findMany: vi.fn() },
            payments: { findFirst: vi.fn(), findMany: vi.fn() },
            billingConfigs: { findMany: vi.fn() },
        },
        select: vi.fn(),
    },
}));

import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
    getUserAccessibleCentreIds,
    getUserAccessibleCentres,
    getVisibleChildIds,
} from '@/lib/permissions';
import { isValidUuid, UUID_RE } from '@/lib/uuid';
import InvoicesListPage from '@/app/dashboard/finance/invoices/page';
import ReconciliationPage from '@/app/dashboard/finance/reconciliation/page';
import ReceiptPage from '@/app/dashboard/finance/receipt/page';
import RegistrationsPage from '@/app/dashboard/registrations/page';
import RegistrationDetailPage from '@/app/dashboard/registrations/[id]/page';
import BookingDetailPage from '@/app/dashboard/bookings/[bookingId]/page';
import ReschedulePage from '@/app/dashboard/bookings/[bookingId]/reschedule/page';
import IncidentsPage from '@/app/dashboard/incidents/page';
import ParentProfilePage from '@/app/dashboard/parents/[id]/page';

const CENTRE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const VALID_UUID_V4 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_V7 = '018f4b7e-7c40-7000-8a12-3456789abcde';

function selectChain(result: any[]) {
    const node: any = {
        from: () => node,
        leftJoin: () => node,
        where: () => node,
        orderBy: () => Promise.resolve(result),
        groupBy: () => Promise.resolve(result),
        limit: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return node;
}

function makeSession(role: string, overrides: Record<string, unknown> = {}) {
    return {
        user: {
            id: 'user-1',
            organisationId: 'org-1',
            role,
            name: 'Staff Member',
            email: 'staff@example.com',
            ...overrides,
        },
        expires: new Date(Date.now() + 3_600_000).toISOString(),
    };
}

describe('src/lib/uuid.ts — isValidUuid & UUID_RE', () => {
    it.each([
        VALID_UUID_V4,
        VALID_UUID_V7,
        CENTRE_A,
        '00000000-0000-0000-0000-000000000000',
        '550E8400-E29B-41D4-A716-446655440000',
    ])('accepts valid standard 8-4-4-4-12 hex UUID: %s', (candidate) => {
        expect(UUID_RE.test(candidate)).toBe(true);
        expect(isValidUuid(candidate)).toBe(true);
    });

    it.each([
        'none',
        'unauthorized_centre_id',
        'unauthorized_child_id',
        'new',
        'all',
        'not-a-uuid',
        'p1',
        'b1',
        '',
        '550e8400-e29b-41d4-a716-44665544000g',
        '550e8400e29b41d4a716446655440000',
    ])('rejects invalid UUID string: %s', (candidate) => {
        expect(isValidUuid(candidate)).toBe(false);
    });

    it('rejects non-string inputs cleanly', () => {
        expect(isValidUuid(null)).toBe(false);
        expect(isValidUuid(undefined)).toBe(false);
        expect(isValidUuid(12345)).toBe(false);
        expect(isValidUuid({})).toBe(false);
    });
});

describe('Invalid UUID route/query params return notFound() before Postgres queries (22P02 prevention)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(['not-a-uuid', 'none', 'new', 'unauthorized_centre_id'])(
        '/dashboard/registrations/[id] returns notFound() without querying DB for id="%s"',
        async (badId) => {
            (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));

            await expect(
                RegistrationDetailPage({ params: Promise.resolve({ id: badId }) } as any)
            ).rejects.toThrow('NOT_FOUND');
            expect(db.query.registrations.findFirst).not.toHaveBeenCalled();
        }
    );

    it('accepts valid UUIDv7 on /dashboard/registrations/[id] (not over-restricted to v1-v5)', async () => {
        (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));
        (db.query.registrations.findFirst as any).mockResolvedValue(null);

        await expect(
            RegistrationDetailPage({ params: Promise.resolve({ id: VALID_UUID_V7 }) } as any)
        ).rejects.toThrow('NOT_FOUND');
        expect(db.query.registrations.findFirst).toHaveBeenCalledTimes(1);
    });

    it.each(['not-a-uuid', 'new', 'none'])(
        '/dashboard/bookings/[bookingId] returns notFound() without querying DB for bookingId="%s"',
        async (badId) => {
            (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));

            await expect(
                BookingDetailPage({ params: Promise.resolve({ bookingId: badId }) } as any)
            ).rejects.toThrow('NOT_FOUND');
            expect(db.query.bookings.findFirst).not.toHaveBeenCalled();
        }
    );

    it.each(['not-a-uuid', 'new', 'none'])(
        '/dashboard/bookings/[bookingId]/reschedule returns notFound() without querying DB for bookingId="%s"',
        async (badId) => {
            (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));

            await expect(
                ReschedulePage({ params: Promise.resolve({ bookingId: badId }) } as any)
            ).rejects.toThrow('NOT_FOUND');
            expect(db.select).not.toHaveBeenCalled();
        }
    );

    it.each(['not-a-uuid', 'p1', 'none'])(
        '/dashboard/parents/[id] returns notFound() without querying DB for id="%s"',
        async (badId) => {
            (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));

            await expect(
                ParentProfilePage({ params: Promise.resolve({ id: badId }) } as any)
            ).rejects.toThrow('NOT_FOUND');
            expect(db.query.parents.findFirst).not.toHaveBeenCalled();
        }
    );

    it('/dashboard/finance/receipt ignores malformed paymentId without querying payments table', async () => {
        (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));
        (getUserAccessibleCentres as any).mockResolvedValue([{ id: CENTRE_A, name: 'Centre A' }]);
        (db.query.organisations.findFirst as any).mockResolvedValue({
            id: 'org-1',
            name: 'Oakridge Club',
            slug: 'oakridge',
        });
        (getVisibleChildIds as any).mockResolvedValue(null);
        (db.query.children.findMany as any).mockResolvedValue([]);

        const element = await ReceiptPage({
            searchParams: Promise.resolve({ paymentId: 'not-a-valid-uuid' }),
        });
        const html = renderToStaticMarkup(element);

        expect(db.query.payments.findFirst).not.toHaveBeenCalled();
        expect(html).toContain('Parent Payment Receipt');
    });
});

describe('Zero-centre & zero-child traps short-circuit DB queries cleanly with role-aware EmptyStates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('InvoicesListPage: zero-centre MANAGER renders EmptyState without querying invoices', async () => {
        (auth as any).mockResolvedValue(makeSession('MANAGER'));
        (getUserAccessibleCentres as any).mockResolvedValue([]);

        const element = await InvoicesListPage();
        const html = renderToStaticMarkup(element);

        expect(db.query.invoices.findMany).not.toHaveBeenCalled();
        expect(html).toContain('No centres assigned');
    });

    it('ReconciliationPage: zero-centre MANAGER renders EmptyState without querying invoices', async () => {
        (auth as any).mockResolvedValue(makeSession('MANAGER'));
        (getUserAccessibleCentres as any).mockResolvedValue([]);

        const element = await ReconciliationPage({ searchParams: Promise.resolve({}) });
        const html = renderToStaticMarkup(element);

        expect(db.select).not.toHaveBeenCalled();
        expect(html).toContain('No centres assigned');
    });

    it('ReceiptPage: zero-centre MANAGER renders EmptyState without querying children or payments', async () => {
        (auth as any).mockResolvedValue(makeSession('MANAGER'));
        (getUserAccessibleCentres as any).mockResolvedValue([]);

        const element = await ReceiptPage({ searchParams: Promise.resolve({}) });
        const html = renderToStaticMarkup(element);

        expect(db.query.children.findMany).not.toHaveBeenCalled();
        expect(db.query.payments.findFirst).not.toHaveBeenCalled();
        expect(html).toContain('No centres assigned');
    });

    it('ReceiptPage: MANAGER with 1 centre but 0 visible children skips children query cleanly', async () => {
        (auth as any).mockResolvedValue(makeSession('MANAGER'));
        (getUserAccessibleCentres as any).mockResolvedValue([{ id: CENTRE_A, name: 'Centre A' }]);
        (db.query.organisations.findFirst as any).mockResolvedValue({
            id: 'org-1',
            name: 'Oakridge Club',
            slug: 'oakridge',
        });
        (getVisibleChildIds as any).mockResolvedValue([]);

        const element = await ReceiptPage({ searchParams: Promise.resolve({}) });
        const html = renderToStaticMarkup(element);

        expect(db.query.children.findMany).not.toHaveBeenCalled();
        expect(html).toContain('ReceiptGeneratorClient:0');
    });

    it.each(['MANAGER', 'FRONT_DESK'])(
        'RegistrationsPage: zero-centre %s renders EmptyState without querying registrations',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.select as any).mockReturnValue(
                selectChain([{ slug: 'oakridge', name: 'Oakridge Club' }])
            );
            (getUserAccessibleCentres as any).mockResolvedValue([]);

            const element = await RegistrationsPage({ searchParams: Promise.resolve({}) });
            const html = renderToStaticMarkup(element);

            expect(db.query.registrations.findMany).not.toHaveBeenCalled();
            expect(html).toContain('No centres assigned');
        }
    );

    it.each(['MANAGER', 'FRONT_DESK'])(
        'IncidentsPage: zero-centre %s renders EmptyState instead of bouncing to /dashboard or mounting centreId="all"',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.select as any).mockReturnValue(
                selectChain([{ id: 'org-1', name: 'Oakridge Club' }])
            );
            (getUserAccessibleCentreIds as any).mockResolvedValue([]);

            const element = await IncidentsPage();
            const html = renderToStaticMarkup(element);

            expect(html).toContain('No centres assigned');
            expect(html).not.toContain('IncidentsClient');
            expect(db.query.centres.findFirst).not.toHaveBeenCalled();
        }
    );

    it('IncidentsPage: zero-centre ORG_OWNER renders setup EmptyState with Add Centre link', async () => {
        (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));
        (db.select as any).mockReturnValue(
            selectChain([{ id: 'org-1', name: 'Oakridge Club' }])
        );
        (getUserAccessibleCentreIds as any).mockResolvedValue([]);

        const element = await IncidentsPage();
        const html = renderToStaticMarkup(element);

        expect(html).toContain('No centres set up yet');
        expect(html).toContain('/dashboard/centres/add');
        expect(html).not.toContain('IncidentsClient');
    });

    it('IncidentsPage: DB error before centre resolution never passes centreId="all" to IncidentsClient', async () => {
        (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));
        (db.select as any).mockImplementation(() => {
            throw new Error('Transient DB connection error');
        });

        const element = await IncidentsPage();
        const html = renderToStaticMarkup(element);

        expect(html).toContain('Unable to load centres');
        expect(html).not.toContain('IncidentsClient:all');
        expect(html).not.toContain('data-centre-id="all"');
    });

    it.each(['MANAGER', 'FRONT_DESK'])(
        'ParentProfilePage: zero-centre %s returns notFound() before querying parents or invoices',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (getUserAccessibleCentres as any).mockResolvedValue([]);

            await expect(
                ParentProfilePage({ params: Promise.resolve({ id: VALID_UUID_V4 }) } as any)
            ).rejects.toThrow('NOT_FOUND');
            expect(db.query.parents.findFirst).not.toHaveBeenCalled();
            expect(db.query.invoices.findMany).not.toHaveBeenCalled();
        }
    );
});

describe('Source-code audit: zero dummy sentinel UUIDs in target dashboard pages', () => {
    const targetFiles = [
        'src/app/dashboard/finance/invoices/page.tsx',
        'src/app/dashboard/finance/reconciliation/page.tsx',
        'src/app/dashboard/finance/receipt/page.tsx',
        'src/app/dashboard/registrations/page.tsx',
        'src/app/dashboard/registrations/[id]/page.tsx',
        'src/app/dashboard/bookings/[bookingId]/page.tsx',
        'src/app/dashboard/bookings/[bookingId]/reschedule/page.tsx',
        'src/app/dashboard/incidents/page.tsx',
        'src/app/dashboard/parents/[id]/page.tsx',
    ];

    it.each(targetFiles)('%s contains no dummy sentinel UUID strings', (relPath) => {
        const src = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
        expect(src).not.toContain('unauthorized_centre_id');
        expect(src).not.toContain('unauthorized_child_id');
        expect(src).not.toContain('00000000-0000-0000-0000-000000000000');
        expect(src).toContain('isValidUuid');
    });
});
