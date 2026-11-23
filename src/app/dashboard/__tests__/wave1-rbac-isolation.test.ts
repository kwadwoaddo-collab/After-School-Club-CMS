 
/**
 * Wave 1 PR #2 — RBAC & Multi-Centre Isolation Regression Tests
 *
 * Covers:
 * - DC-02: TUTOR blocked from Bookings PII (/dashboard/bookings, [bookingId], [bookingId]/reschedule)
 *          with redirect('/dashboard/attendance') + cross-centre notFound() for non-ORG_OWNER staff.
 * - DC-18: Global Header search bar hidden for TUTOR role without breaking ORG_OWNER/MANAGER/FRONT_DESK.
 * - DC-03: Multi-centre isolation on /dashboard/registrations/[id] — TUTOR redirected to
 *          /dashboard/attendance, cross-centre blocked with notFound(), zero-centre blocked with
 *          notFound(), while org-wide submissions (registration.centreId === null) remain triageable
 *          by MANAGER/FRONT_DESK with >= 1 accessible centre.
 * - DC-19: /dashboard/share redirects TUTOR to /dashboard/attendance, filters centres strictly to
 *          accessibleCentreIds for MANAGER/FRONT_DESK, and short-circuits zero-centre staff cleanly.
 * - Registrations page uses canonical getTrustedApplicationUrl() instead of legacy Vercel fallback.
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

vi.mock('next-auth/react', () => ({
    signOut: vi.fn(),
}));

vi.mock('@/components/dashboard/SidebarContext', () => ({
    useSidebar: () => ({
        collapsed: false,
        setCollapsed: vi.fn(),
    }),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: vi.fn(),
    getUserAccessibleCentres: vi.fn(),
    canUserAccessCentre: vi.fn(),
}));

vi.mock('@/features/students/notes.actions', () => ({
    getStudentNotes: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            bookings: { findFirst: vi.fn(), findMany: vi.fn() },
            registrations: { findFirst: vi.fn(), findMany: vi.fn() },
            organisations: { findFirst: vi.fn() },
            centres: { findFirst: vi.fn(), findMany: vi.fn() },
        },
        select: vi.fn(),
    },
}));

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import BookingsPage from '@/app/dashboard/bookings/page';
import BookingDetailPage from '@/app/dashboard/bookings/[bookingId]/page';
import ReschedulePage from '@/app/dashboard/bookings/[bookingId]/reschedule/page';
import RegistrationDetailPage from '@/app/dashboard/registrations/[id]/page';
import SharePage from '@/app/dashboard/share/page';
import Header from '@/components/dashboard/Header';

function selectChain(result: any[]) {
    const node: any = {
        from: () => node,
        leftJoin: () => node,
        where: () => node,
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

const CENTRE_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const CENTRE_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const BOOKING_ID = 'cccccccc-0000-4000-8000-000000000003';
const REG_ID = 'dddddddd-0000-4000-8000-000000000004';

describe('DC-02 — TUTOR blocked from Bookings PII & cross-centre isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('redirects TUTOR from /dashboard/bookings to /dashboard/attendance before querying DB', async () => {
        (auth as any).mockResolvedValue(makeSession('TUTOR'));

        await expect(
            BookingsPage({ searchParams: Promise.resolve({}) } as any)
        ).rejects.toThrow('REDIRECT:/dashboard/attendance');
        expect(db.select).not.toHaveBeenCalled();
    });

    it('redirects TUTOR from /dashboard/bookings/[bookingId] to /dashboard/attendance', async () => {
        (auth as any).mockResolvedValue(makeSession('TUTOR'));

        await expect(
            BookingDetailPage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
        ).rejects.toThrow('REDIRECT:/dashboard/attendance');
        expect(db.query.bookings.findFirst).not.toHaveBeenCalled();
    });

    it('redirects TUTOR from /dashboard/bookings/[bookingId]/reschedule to /dashboard/attendance', async () => {
        (auth as any).mockResolvedValue(makeSession('TUTOR'));

        await expect(
            ReschedulePage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
        ).rejects.toThrow('REDIRECT:/dashboard/attendance');
        expect(db.select).not.toHaveBeenCalled();
    });

    it.each(['MANAGER', 'FRONT_DESK'])(
        'returns notFound() on /dashboard/bookings/[bookingId] when %s lacks access to booking.centreId',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.query.bookings.findFirst as any).mockResolvedValue({
                id: BOOKING_ID,
                centreId: CENTRE_B,
                centre: { id: CENTRE_B, organisationId: 'org-1', name: 'Centre B' },
                attendees: [],
                parent: { id: 'p-1', firstName: 'Jane', lastName: 'Doe' },
            });
            (getUserAccessibleCentreIds as any).mockResolvedValue([CENTRE_A]);

            await expect(
                BookingDetailPage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
            ).rejects.toThrow('NOT_FOUND');
        }
    );

    it.each(['MANAGER', 'FRONT_DESK'])(
        'returns notFound() on /dashboard/bookings/[bookingId]/reschedule when %s lacks access to booking.centreId',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.select as any).mockReturnValue(
                selectChain([{
                    id: BOOKING_ID,
                    startAt: new Date(),
                    duration: 60,
                    modality: 'in_person',
                    status: 'confirmed',
                    parentFirstName: 'Jane',
                    parentLastName: 'Doe',
                    parentEmail: 'jane@example.com',
                    centreName: 'Centre B',
                    centreId: CENTRE_B,
                    centreOrganisationId: 'org-1',
                    centreOperatingHours: null,
                }])
            );
            (getUserAccessibleCentreIds as any).mockResolvedValue([CENTRE_A]);

            await expect(
                ReschedulePage({ params: Promise.resolve({ bookingId: BOOKING_ID }) } as any)
            ).rejects.toThrow('NOT_FOUND');
        }
    );
});

describe('DC-18 — Hide Header search bar for TUTOR role', () => {
    it('hides the global search input when userRole is TUTOR', () => {
        const html = renderToStaticMarkup(
            React.createElement(Header, {
                userName: 'Club Leader',
                userInitial: 'C',
                userRole: 'TUTOR',
                hideSearch: false,
            })
        );
        expect(html).not.toContain('Search students, bookings, and parents');
        expect(html).toContain('Club Leader');
    });

    it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])(
        'renders the global search input for %s when hideSearch is false',
        (role) => {
            const html = renderToStaticMarkup(
                React.createElement(Header, {
                    userName: 'Staff User',
                    userInitial: 'S',
                    userRole: role,
                    hideSearch: false,
                })
            );
            expect(html).toContain('Search students, bookings, and parents');
        }
    );
});

describe('DC-03 — Multi-centre isolation on /dashboard/registrations/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function mockRegistrationRecord(centreId: string | null) {
        return {
            id: REG_ID,
            organisationId: 'org-1',
            centreId,
            bookingId: null,
            status: 'awaiting_confirmation',
            createdAt: new Date('2026-10-01T10:00:00Z'),
            submittedAt: new Date('2026-10-01T10:00:00Z'),
            startDate: '2026-10-15',
            fundingTypes: ['self_funded'],
            fundingOther: null,
            emergencyContactName: 'Emergency Contact',
            emergencyContactRelationship: 'Aunt',
            emergencyContactPhone: '07000000000',
            hasSpecialNeeds: false,
            specialNeedsDetails: null,
            parentSignature: null,
            registrationChildren: [],
            registrationParents: [
                {
                    id: 'rp-1',
                    parentId: null,
                    isPrimary: true,
                    submittedFirstName: 'Sam',
                    submittedLastName: 'Parent',
                    submittedRelationship: 'Parent',
                    submittedPhone: '07111111111',
                    submittedEmail: 'sam@example.com',
                    parent: null,
                },
            ],
        };
    }

    it('redirects TUTOR to /dashboard/attendance before querying DB', async () => {
        (auth as any).mockResolvedValue(makeSession('TUTOR'));

        await expect(
            RegistrationDetailPage({ params: Promise.resolve({ id: REG_ID }) } as any)
        ).rejects.toThrow('REDIRECT:/dashboard/attendance');
        expect(db.query.registrations.findFirst).not.toHaveBeenCalled();
    });

    it.each(['MANAGER', 'FRONT_DESK'])(
        'returns notFound() when %s accesses a registration belonging to another centre',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.query.registrations.findFirst as any).mockResolvedValue(mockRegistrationRecord(CENTRE_B));
            (getUserAccessibleCentreIds as any).mockResolvedValue([CENTRE_A]);

            await expect(
                RegistrationDetailPage({ params: Promise.resolve({ id: REG_ID }) } as any)
            ).rejects.toThrow('NOT_FOUND');
        }
    );

    it.each(['MANAGER', 'FRONT_DESK'])(
        'returns notFound() when %s has zero accessible centres (even if registration.centreId === null)',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.query.registrations.findFirst as any).mockResolvedValue(mockRegistrationRecord(null));
            (getUserAccessibleCentreIds as any).mockResolvedValue([]);

            await expect(
                RegistrationDetailPage({ params: Promise.resolve({ id: REG_ID }) } as any)
            ).rejects.toThrow('NOT_FOUND');
        }
    );

    it.each(['MANAGER', 'FRONT_DESK'])(
        'ALLOWS org-wide registration (centreId === null) for %s with >= 1 accessible centre',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.query.registrations.findFirst as any).mockResolvedValue(mockRegistrationRecord(null));
            (db.query.organisations.findFirst as any).mockResolvedValue({ name: 'Oakridge Club' });
            (getUserAccessibleCentreIds as any).mockResolvedValue([CENTRE_A]);

            await expect(
                RegistrationDetailPage({ params: Promise.resolve({ id: REG_ID }) } as any)
            ).resolves.toBeTruthy();
        }
    );

    it('allows ORG_OWNER without calling getUserAccessibleCentreIds', async () => {
        (auth as any).mockResolvedValue(makeSession('ORG_OWNER'));
        (db.query.registrations.findFirst as any).mockResolvedValue(mockRegistrationRecord(CENTRE_B));
        (db.query.organisations.findFirst as any).mockResolvedValue({ name: 'Oakridge Club' });
        (db.query.centres.findFirst as any).mockResolvedValue({ name: 'Centre B' });

        await expect(
            RegistrationDetailPage({ params: Promise.resolve({ id: REG_ID }) } as any)
        ).resolves.toBeTruthy();
        expect(getUserAccessibleCentreIds).not.toHaveBeenCalled();
    });
});

describe('DC-19 — /dashboard/share RBAC and multi-centre isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('redirects TUTOR to /dashboard/attendance', async () => {
        (auth as any).mockResolvedValue(makeSession('TUTOR'));

        await expect(SharePage()).rejects.toThrow('REDIRECT:/dashboard/attendance');
    });

    it.each(['MANAGER', 'FRONT_DESK'])(
        'filters displayed centres strictly to accessibleCentreIds for %s',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.query.organisations.findFirst as any).mockResolvedValue({
                id: 'org-1',
                name: 'Oakridge Club',
                slug: 'oakridge',
            });
            (db.query.centres.findMany as any).mockResolvedValue([
                { id: CENTRE_A, name: 'Centre A', slug: 'centre-a' },
            ]);
            (getUserAccessibleCentreIds as any).mockResolvedValue([CENTRE_A]);

            const element = await SharePage();
            const html = renderToStaticMarkup(element);

            expect(getUserAccessibleCentreIds).toHaveBeenCalledWith('user-1');
            expect(db.query.centres.findMany).toHaveBeenCalledTimes(1);
            expect(html).toContain('Centre A');
            expect(html).not.toContain('Centre B');
        }
    );

    it.each(['MANAGER', 'FRONT_DESK'])(
        'short-circuits cleanly with EmptyState when %s has zero accessible centres (no centres query)',
        async (role) => {
            (auth as any).mockResolvedValue(makeSession(role));
            (db.query.organisations.findFirst as any).mockResolvedValue({
                id: 'org-1',
                name: 'Oakridge Club',
                slug: 'oakridge',
            });
            (getUserAccessibleCentreIds as any).mockResolvedValue([]);

            const element = await SharePage();
            const html = renderToStaticMarkup(element);

            expect(db.query.centres.findMany).not.toHaveBeenCalled();
            expect(html).toContain('No centres assigned');
        }
    );
});

describe('Canonical base URL in registrations/page.tsx', () => {
    it('uses getTrustedApplicationUrl() and does not contain after-school-club-live.vercel.app', () => {
        const src = fs.readFileSync(
            path.join(process.cwd(), 'src/app/dashboard/registrations/page.tsx'),
            'utf8'
        );
        expect(src).toContain('getTrustedApplicationUrl');
        expect(src).not.toContain('after-school-club-live.vercel.app');
        expect(src).not.toContain('process.env.NEXT_PUBLIC_BASE_URL');
    });
});
