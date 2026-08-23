import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * Regression test for Milestone 3F defect K7 (Kiosk crash for a user with
 * zero accessible centres).
 *
 * Root cause, confirmed by reading the pre-fix source (src/app/dashboard/
 * kiosk/page.tsx): when a staff member has no centreMemberships rows (e.g.
 * a freshly-invited TUTOR), getUserAccessibleCentres() returns [], so
 * centreIds is [] and resolveActiveCentreId falls back to 'all'. The
 * pre-fix code then built its Drizzle `where` conditions as:
 *
 *   activeCentreId !== 'all'
 *     ? eq(bookings.centreId, activeCentreId)
 *     : centreIds.length > 0
 *       ? inArray(bookings.centreId, centreIds)
 *       : eq(bookings.centreId, 'no-centre')   // <-- reached here
 *
 * `bookings.centreId` (and `children.centreId`) are `uuid` columns; the
 * literal string 'no-centre' is not a valid uuid, so Postgres rejected the
 * query with a type error. Unlike the sibling Attendance register page
 * (src/app/dashboard/attendance/page.tsx), which wraps the equivalent
 * queries in try/catch and falls back to an error banner, the Kiosk page
 * issued these queries unprotected — the error propagated out of the
 * Server Component and was caught only by Next's generic error boundary,
 * so a zero-centre user saw a broken page instead of Kiosk's own "no
 * sessions today" empty state.
 *
 * The fix skips both queries entirely when there is no queryable scope
 * (activeCentreId === 'all' && centreIds.length === 0), rendering
 * KioskRegister with empty slots instead — the same graceful path Kiosk
 * already takes on a quiet day with real bookings — and additionally wraps
 * the queries in try/catch (matching the Attendance page's own pattern) as
 * defense in depth for any other unexpected query failure.
 *
 * This test drives the real page function with a mocked db layer and
 * asserts: (1) a zero-centre user never issues the doomed query and gets a
 * render with empty slots instead of a thrown error, and (2 & 3) the
 * pre-existing "All Centres" (multi-centre) and single-centre paths still
 * issue their queries exactly as before — the fix must not change any
 * behavior for users who do have centre access.
 */

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`REDIRECT:${path}`);
    }),
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const getUserAccessibleCentres = vi.fn();
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentres: (...args: unknown[]) => getUserAccessibleCentres(...args),
}));

const resolveActiveCentreId = vi.fn();
vi.mock('@/lib/centre-filter', () => ({
    resolveActiveCentreId: (...args: unknown[]) => resolveActiveCentreId(...args),
}));

const childrenFindMany = vi.fn();
const bookingsFindMany = vi.fn();
vi.mock('@/db', () => ({
    db: {
        query: {
            children: { findMany: (...args: unknown[]) => childrenFindMany(...args) },
            bookings: { findMany: (...args: unknown[]) => bookingsFindMany(...args) },
        },
    },
}));

function findElementByType(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
    if (node == null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findElementByType(child, type);
            if (found) return found;
        }
        return null;
    }
    if (React.isValidElement(node)) {
        if (node.type === type) {
            return node as unknown as { props: Record<string, unknown> };
        }
        const props = node.props as Record<string, unknown>;
        return findElementByType(props?.children, type);
    }
    return null;
}

describe('KioskPage — no-queryable-scope regression (Milestone 3F, K7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        childrenFindMany.mockResolvedValue([]);
        bookingsFindMany.mockResolvedValue([]);
    });

    it('skips the db queries and renders an empty register for a user with zero accessible centres', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-tariq', organisationId: 'org-1', role: 'TUTOR' },
        });
        getUserAccessibleCentres.mockResolvedValue([]); // zero centre memberships
        resolveActiveCentreId.mockResolvedValue('all'); // falls back per centre-filter.ts

        const { default: KioskPage } = await import('./page');
        const { default: KioskRegister } = await import('./KioskRegister');

        const element = await KioskPage({ searchParams: Promise.resolve({}) });

        // The doomed eq(centreId, 'no-centre') query must never be issued.
        expect(childrenFindMany).not.toHaveBeenCalled();
        expect(bookingsFindMany).not.toHaveBeenCalled();

        const kioskElement = findElementByType(element, KioskRegister);
        expect(kioskElement).not.toBeNull();
        // compileDailyRegisterSlots always returns a placeholder entry per
        // configured session time; what matters for this regression is that
        // every one of them is empty (no data was — or could safely be —
        // fetched), not that the slots array itself is [].
        const slots = kioskElement!.props.slots as Array<{ regulars: unknown[]; catchups: unknown[] }>;
        expect(slots.every(s => s.regulars.length === 0 && s.catchups.length === 0)).toBe(true);
        expect(kioskElement!.props.centres).toEqual([]);
    });

    it('still queries via inArray for a multi-centre "All Centres" user (unchanged behavior)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-marcus', organisationId: 'org-1', role: 'MANAGER' },
        });
        const centres = [
            { id: 'centre-main', name: 'Main Campus', organisationId: 'org-1' },
            { id: 'centre-secondary', name: 'Secondary Campus', organisationId: 'org-1' },
        ];
        getUserAccessibleCentres.mockResolvedValue(centres);
        resolveActiveCentreId.mockResolvedValue('all');

        const { default: KioskPage } = await import('./page');
        await KioskPage({ searchParams: Promise.resolve({}) });

        expect(childrenFindMany).toHaveBeenCalledTimes(1);
        expect(bookingsFindMany).toHaveBeenCalledTimes(1);
    });

    it('still queries via eq for a single-centre selection (unchanged behavior)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-freya', organisationId: 'org-1', role: 'FRONT_DESK' },
        });
        const centres = [{ id: 'centre-main', name: 'Main Campus', organisationId: 'org-1' }];
        getUserAccessibleCentres.mockResolvedValue(centres);
        resolveActiveCentreId.mockResolvedValue('centre-main');

        const { default: KioskPage } = await import('./page');
        await KioskPage({ searchParams: Promise.resolve({ centre: 'centre-main' }) });

        expect(childrenFindMany).toHaveBeenCalledTimes(1);
        expect(bookingsFindMany).toHaveBeenCalledTimes(1);
    });

    it('falls back to empty slots (not a thrown error) if the query unexpectedly rejects', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { id: 'user-marcus', organisationId: 'org-1', role: 'MANAGER' },
        });
        const centres = [{ id: 'centre-main', name: 'Main Campus', organisationId: 'org-1' }];
        getUserAccessibleCentres.mockResolvedValue(centres);
        resolveActiveCentreId.mockResolvedValue('centre-main');
        childrenFindMany.mockRejectedValue(new Error('connection reset'));

        const { default: KioskPage } = await import('./page');
        const { default: KioskRegister } = await import('./KioskRegister');

        const element = await KioskPage({ searchParams: Promise.resolve({ centre: 'centre-main' }) });
        const kioskElement = findElementByType(element, KioskRegister);
        expect(kioskElement).not.toBeNull();
        const slots = kioskElement!.props.slots as Array<{ regulars: unknown[]; catchups: unknown[] }>;
        expect(slots.every(s => s.regulars.length === 0 && s.catchups.length === 0)).toBe(true);
    });
});
