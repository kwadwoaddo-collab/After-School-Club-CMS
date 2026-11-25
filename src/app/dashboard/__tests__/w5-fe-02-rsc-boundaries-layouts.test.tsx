// @vitest-environment jsdom
import React from 'react';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    logError: vi.fn(),
    requirePlatformAdmin: vi.fn(),
    requireAuth: vi.fn(),
    getUserAccessibleCentres: vi.fn(),
    usersFindFirst: vi.fn(),
    orgMembershipsFindFirst: vi.fn(),
    orgMembershipsFindMany: vi.fn(),
    centresFindMany: vi.fn(),
    orgsOrderBy: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: (...args: unknown[]) => mocks.logError(...args),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
    notFound: vi.fn(() => {
        throw new Error('NOT_FOUND');
    }),
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/book',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/org-approval-guard', () => ({
    requirePlatformAdmin: () => mocks.requirePlatformAdmin(),
}));

vi.mock('@/lib/require-auth', () => ({
    requireAuth: (...args: unknown[]) => mocks.requireAuth(...args),
}));

vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentres: (...args: unknown[]) => mocks.getUserAccessibleCentres(...args),
    getUserAccessibleCentreIds: vi.fn().mockResolvedValue([]),
    getVisibleChildIds: vi.fn().mockResolvedValue(null),
    canUserAccessCentre: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/app/platform/organisations/actions', () => ({
    approveOrg: vi.fn(),
    rejectOrg: vi.fn(),
    suspendOrg: vi.fn(),
    reactivateOrg: vi.fn(),
}));

vi.mock('@/features/staff/components/StaffProfileForm', () => ({
    default: (props: { currentRole: string; currentAssignments: string[]; ownerCount: number }) => (
        <div
            data-testid="staff-profile-form"
            data-role={props.currentRole}
            data-assignments={props.currentAssignments.join(',')}
            data-owner-count={String(props.ownerCount)}
        />
    ),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            users: { findFirst: (...args: unknown[]) => mocks.usersFindFirst(...args) },
            orgMemberships: {
                findFirst: (...args: unknown[]) => mocks.orgMembershipsFindFirst(...args),
                findMany: (...args: unknown[]) => mocks.orgMembershipsFindMany(...args),
            },
            centres: { findMany: (...args: unknown[]) => mocks.centresFindMany(...args) },
        },
        select: () => ({
            from: () => ({
                orderBy: () => mocks.orgsOrderBy(),
                where: () => Promise.resolve([]),
            }),
        }),
    },
}));

import GlobalError from '@/app/global-error';
import ImportError from '@/app/dashboard/students/import/error';
import CentresError from '@/app/dashboard/centres/error';
import SettingsError from '@/app/dashboard/settings/error';
import AvailabilityError from '@/app/dashboard/availability/error';
import IncidentsError from '@/app/dashboard/incidents/error';
import CommunicationsError from '@/app/dashboard/communications/error';
import ReportsError from '@/app/dashboard/reports/error';
import StaffError from '@/app/dashboard/staff/error';
import DocumentsError from '@/app/dashboard/documents/error';
import HelpError from '@/app/dashboard/help/error';

import SessionLedgerLoading from '@/app/dashboard/attendance/ledger/loading';
import CentreAvailabilityLoading from '@/app/dashboard/availability/[centreId]/loading';
import BookingRescheduleLoading from '@/app/dashboard/bookings/[bookingId]/reschedule/loading';
import AddCentreLoading from '@/app/dashboard/centres/add/loading';
import CentreSettingsLoading from '@/app/dashboard/centres/[id]/settings/loading';
import CentreBillingLoading from '@/app/dashboard/centres/[id]/billing/loading';
import ParentsBinLoading from '@/app/dashboard/parents/bin/loading';
import WondeSettingsLoading from '@/app/dashboard/settings/wonde/loading';
import StaffInviteLoading from '@/app/dashboard/staff/invite/loading';
import StudentAttendanceLoading from '@/app/dashboard/students/[id]/attendance/loading';
import StudentsImportLoading from '@/app/dashboard/students/import/loading';

import BookLayout from '@/app/book/layout';
import RegisterLayout from '@/app/register/layout';
import CentrePortalLayout from '@/app/centre-portal/[subdomain]/layout';
import PlatformLayout from '@/app/platform/layout';
import PlatformOrganisationsPage from '@/app/platform/organisations/page';
import EditStaffPage from '@/app/dashboard/staff/[userId]/page';

const BRANCH_4_PROD_FILES = [
    'src/app/global-error.tsx',
    'src/app/book/layout.tsx',
    'src/app/register/layout.tsx',
    'src/app/centre-portal/[subdomain]/layout.tsx',
    'src/app/centre-portal/[subdomain]/page.tsx',
    'src/app/platform/layout.tsx',
    'src/app/platform/organisations/page.tsx',
    'src/app/dashboard/staff/page.tsx',
    'src/app/dashboard/staff/[userId]/page.tsx',
    'src/app/dashboard/settings/page.tsx',
    'src/app/dashboard/centres/page.tsx',
    'src/app/dashboard/centres/[id]/settings/page.tsx',
    'src/app/dashboard/availability/[centreId]/page.tsx',
    'src/app/dashboard/incidents/page.tsx',
    'src/app/dashboard/communications/page.tsx',
    'src/app/dashboard/kiosk/page.tsx',
    'src/app/dashboard/registrations/[id]/page.tsx',
    'src/app/dashboard/bookings/page.tsx',
    'src/app/dashboard/bookings/[bookingId]/page.tsx',
    'src/app/dashboard/bookings/[bookingId]/reschedule/page.tsx',
    'src/app/dashboard/parents/page.tsx',
    'src/app/dashboard/finance/receipt/page.tsx',
    'src/app/dashboard/students/[id]/attendance/page.tsx',
    'src/app/dashboard/students/import/error.tsx',
    'src/app/dashboard/centres/error.tsx',
    'src/app/dashboard/settings/error.tsx',
    'src/app/dashboard/availability/error.tsx',
    'src/app/dashboard/incidents/error.tsx',
    'src/app/dashboard/communications/error.tsx',
    'src/app/dashboard/reports/error.tsx',
    'src/app/dashboard/staff/error.tsx',
    'src/app/dashboard/documents/error.tsx',
    'src/app/dashboard/help/error.tsx',
    'src/app/dashboard/attendance/ledger/loading.tsx',
    'src/app/dashboard/availability/[centreId]/loading.tsx',
    'src/app/dashboard/bookings/[bookingId]/reschedule/loading.tsx',
    'src/app/dashboard/centres/add/loading.tsx',
    'src/app/dashboard/centres/[id]/settings/loading.tsx',
    'src/app/dashboard/centres/[id]/billing/loading.tsx',
    'src/app/dashboard/parents/bin/loading.tsx',
    'src/app/dashboard/settings/wonde/loading.tsx',
    'src/app/dashboard/staff/invite/loading.tsx',
    'src/app/dashboard/students/[id]/attendance/loading.tsx',
    'src/app/dashboard/students/import/loading.tsx',
];

describe('Wave 5 Branch 4 (w5-fe-02): RSC waterfalls, boundaries, layouts & multi-org staff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it.each([
        ['CentresError', CentresError],
        ['SettingsError', SettingsError],
        ['AvailabilityError', AvailabilityError],
        ['IncidentsError', IncidentsError],
        ['CommunicationsError', CommunicationsError],
        ['ReportsError', ReportsError],
        ['StaffError', StaffError],
        ['DocumentsError', DocumentsError],
        ['HelpError', HelpError],
    ] as const)(
        '%s sanitizes error.message, renders digest reference & role="alert", and uses bg-accent text-on-accent',
        (_name, Component) => {
            const err = Object.assign(new Error('SELECT * FROM children WHERE allergies = Peanuts'), {
                digest: 'ERR-W5-42',
            });
            const reset = vi.fn();
            render(<Component error={err} reset={reset} />);

            const alert = screen.getByRole('alert');
            expect(alert.textContent).not.toContain('SELECT * FROM children');
            expect(alert.textContent).not.toContain('Peanuts');
            expect(alert.textContent).toContain('ERR-W5-42');

            const btn = screen.getByRole('button', { name: /try again/i });
            expect(btn.getAttribute('type')).toBe('button');
            expect(btn.className).toContain('bg-accent');
            expect(btn.className).toContain('text-on-accent');
            expect(btn.className).toContain('min-h-11');
            fireEvent.click(btn);
            expect(reset).toHaveBeenCalledTimes(1);
        }
    );

    it('GlobalError imports globals.css and ImportError avoids nested <main> landmarks', () => {
        const globalSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/global-error.tsx'), 'utf8');
        expect(globalSrc).toContain("import './globals.css';");
        expect(globalSrc).toContain('<title>Critical System Error');

        const err = Object.assign(new Error('PGCONN password=secret'), { digest: 'DIGEST-99' });
        const reset = vi.fn();
        const { container } = render(<ImportError error={err} reset={reset} />);
        expect(container.querySelector('main')).toBeNull();
        expect(screen.getByRole('alert').textContent).not.toContain('PGCONN');
        expect(screen.getByRole('alert').textContent).toContain('DIGEST-99');

        const gReset = vi.fn();
        render(<GlobalError error={err} reset={gReset} />);
        expect(screen.getByRole('button', { name: /refresh application/i }).className).toContain('bg-accent');
    });

    it.each([
        ['SessionLedgerLoading', SessionLedgerLoading],
        ['CentreAvailabilityLoading', CentreAvailabilityLoading],
        ['BookingRescheduleLoading', BookingRescheduleLoading],
        ['AddCentreLoading', AddCentreLoading],
        ['CentreSettingsLoading', CentreSettingsLoading],
        ['CentreBillingLoading', CentreBillingLoading],
        ['ParentsBinLoading', ParentsBinLoading],
        ['WondeSettingsLoading', WondeSettingsLoading],
        ['StaffInviteLoading', StaffInviteLoading],
        ['StudentAttendanceLoading', StudentAttendanceLoading],
        ['StudentsImportLoading', StudentsImportLoading],
    ] as const)('%s renders accessible role="status" aria-busy="true" surface skeleton', (_name, LoadingComp) => {
        const { container } = render(<LoadingComp />);
        const status = screen.getByRole('status');
        expect(status.getAttribute('aria-busy')).toBe('true');
        expect(container.querySelector('.bg-surface.border-border.rounded-xl')).toBeTruthy();
    });

    it('adds skip-to-content links and <main id="main-content" tabIndex={-1}> across Book, Register, CentrePortal, and Platform layouts', async () => {
        for (const LayoutComp of [BookLayout, RegisterLayout, CentrePortalLayout]) {
            const { unmount, container } = render(
                <LayoutComp>
                    <div>Child Content</div>
                </LayoutComp>
            );
            const skip = screen.getByRole('link', { name: /skip to main content/i });
            expect(skip.getAttribute('href')).toBe('#main-content');
            const main = container.querySelector('main#main-content');
            expect(main).toBeTruthy();
            expect(main?.getAttribute('tabindex')).toBe('-1');
            unmount();
        }

        mocks.requirePlatformAdmin.mockResolvedValueOnce({ email: 'admin@sprintscaleit.co.uk' });
        const platformUi = await PlatformLayout({ children: <div>Platform Body</div> });
        const { container: pContainer } = render(platformUi);
        expect(screen.getByRole('link', { name: /skip to main content/i }).getAttribute('href')).toBe('#main-content');
        expect(pContainer.querySelector('main#main-content')?.getAttribute('tabindex')).toBe('-1');
    });

    it('renders PlatformOrganisationsPage with overflow-x-auto, min-w-[640px], and accessible rejection reason input', async () => {
        mocks.requirePlatformAdmin.mockResolvedValueOnce({ email: 'admin@sprintscaleit.co.uk' });
        mocks.orgsOrderBy.mockResolvedValueOnce([
            {
                id: 'org-1',
                name: 'Bright Stars Club',
                slug: 'bright-stars',
                approvalStatus: 'PENDING',
                contactEmail: 'hello@brightstars.co.uk',
                createdAt: new Date('2026-11-20T10:00:00Z'),
                approvedAt: null,
                rejectionReason: null,
            },
        ]);

        const pageUi = await PlatformOrganisationsPage();
        const { container } = render(pageUi);
        expect(container.querySelector('.overflow-x-auto table.min-w-\\[640px\\]')).toBeTruthy();
        expect(screen.getByLabelText('Rejection reason for Bright Stars Club')).toBeTruthy();
    });

    it('scopes EditStaffPage to orgMemberships role, filters cross-org centreMemberships, and blocks manager access to unassigned staff', async () => {
        // 1. Manager attempting to view unassigned staff member in org -> redirected
        mocks.requireAuth.mockResolvedValueOnce({
            session: { user: { id: 'mgr-1', organisationId: 'org-a', role: 'MANAGER' } },
        });
        mocks.usersFindFirst.mockResolvedValueOnce({
            id: 'tutor-unassigned',
            firstName: 'Tunde',
            lastName: 'Bello',
            email: 'tunde@example.com',
            organisationId: 'org-b', // active org points elsewhere, but belongs via orgMemberships!
            role: 'ORG_OWNER', // owner in org-b, TUTOR in org-a
            createdAt: new Date('2026-10-01T00:00:00Z'),
            memberships: [
                { centreId: 'c-other-org', centre: { id: 'c-other-org', organisationId: 'org-b' } },
            ],
        });
        mocks.orgMembershipsFindFirst.mockResolvedValueOnce({ role: 'TUTOR' });
        mocks.getUserAccessibleCentres.mockResolvedValueOnce([{ id: 'c-a1', name: 'Centre A1' }]);
        mocks.centresFindMany.mockResolvedValueOnce([{ id: 'c-a1' }]);
        mocks.orgMembershipsFindMany.mockResolvedValueOnce([{ id: 'owner-1' }]);

        await expect(
            EditStaffPage({ params: Promise.resolve({ userId: 'tutor-unassigned' }) })
        ).rejects.toThrow('REDIRECT:/dashboard/staff');

        // 2. Owner viewing multi-org user sees org-a role (TUTOR) and only org-a centre assignments
        mocks.requireAuth.mockResolvedValueOnce({
            session: { user: { id: 'owner-1', organisationId: 'org-a', role: 'ORG_OWNER' } },
        });
        mocks.usersFindFirst.mockResolvedValueOnce({
            id: 'tutor-multi',
            firstName: 'Tunde',
            lastName: 'Bello',
            email: 'tunde@example.com',
            organisationId: 'org-b',
            role: 'ORG_OWNER',
            createdAt: new Date('2026-10-01T00:00:00Z'),
            memberships: [
                { centreId: 'c-a1', centre: { id: 'c-a1', organisationId: 'org-a' } },
                { centreId: 'c-other-org', centre: { id: 'c-other-org', organisationId: 'org-b' } },
            ],
        });
        mocks.orgMembershipsFindFirst.mockResolvedValueOnce({ role: 'TUTOR' });
        mocks.centresFindMany.mockResolvedValueOnce([{ id: 'c-a1', name: 'Centre A1' }]);
        mocks.orgMembershipsFindMany.mockResolvedValueOnce([{ id: 'owner-1' }, { id: 'owner-2' }]);

        const ownerUi = await EditStaffPage({ params: Promise.resolve({ userId: 'tutor-multi' }) });
        render(ownerUi);
        const formEl = screen.getByTestId('staff-profile-form');
        expect(formEl.getAttribute('data-role')).toBe('TUTOR');
        expect(formEl.getAttribute('data-assignments')).toBe('c-a1');
        expect(formEl.getAttribute('data-owner-count')).toBe('2');
    });

    it('enforces zero indigo-*/blue-* palette leaks, sticky top-14, deletedAt guard, and Promise.all across Branch 4 RSC files', () => {
        const root = process.cwd();
        const leaks: string[] = [];

        for (const rel of BRANCH_4_PROD_FILES) {
            const content = fs.readFileSync(path.join(root, rel), 'utf8');
            if (/\b(indigo|blue)-\d+/.test(content)) {
                leaks.push(rel);
            }
        }
        expect(leaks).toEqual([]);

        for (const waterfallPage of [
            'src/app/dashboard/staff/page.tsx',
            'src/app/dashboard/staff/[userId]/page.tsx',
            'src/app/dashboard/settings/page.tsx',
            'src/app/dashboard/centres/page.tsx',
            'src/app/dashboard/centres/[id]/settings/page.tsx',
            'src/app/dashboard/availability/[centreId]/page.tsx',
            'src/app/dashboard/incidents/page.tsx',
            'src/app/dashboard/communications/page.tsx',
            'src/app/dashboard/kiosk/page.tsx',
            'src/app/dashboard/registrations/[id]/page.tsx',
            'src/app/dashboard/bookings/[bookingId]/page.tsx',
            'src/app/dashboard/bookings/[bookingId]/reschedule/page.tsx',
            'src/app/dashboard/finance/receipt/page.tsx',
            'src/app/dashboard/students/[id]/attendance/page.tsx',
        ]) {
            expect(fs.readFileSync(path.join(root, waterfallPage), 'utf8')).toContain('Promise.all');
        }

        const receiptSrc = fs.readFileSync(path.join(root, 'src/app/dashboard/finance/receipt/page.tsx'), 'utf8');
        expect(receiptSrc).toContain('isNull(children.deletedAt)');
        expect(receiptSrc).toContain('Parent Payment Receipt');

        expect(fs.readFileSync(path.join(root, 'src/app/dashboard/bookings/page.tsx'), 'utf8')).toContain('sticky top-14');
        expect(fs.readFileSync(path.join(root, 'src/app/dashboard/parents/page.tsx'), 'utf8')).toContain('sticky top-14');
    });
});
