// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getCurrentParent: vi.fn(),
    invoicesFindMany: vi.fn(),
    bookingAttendeesFindMany: vi.fn(),
    childrenFindFirst: vi.fn(),
    studentNotesFindMany: vi.fn(),
    selectQueue: [] as unknown[][],
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
    signIn: vi.fn(),
}));

vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: () => mocks.getCurrentParent(),
}));

vi.mock('@/app/portal/notifications/actions', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/portal/components/NotificationBell', () => ({
    default: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/features/portal/components/CancelBookingButton', () => ({
    CancelBookingButton: () => <button type="button">Cancel</button>,
}));

vi.mock('@/features/portal/components/AddMedicalNoteForm', () => ({
    AddMedicalNoteForm: () => <div data-testid="add-medical-note-form" />,
}));

vi.mock('@/components/dashboard/CopyableLink', () => ({
    CopyableLink: ({ link }: { link: string }) => <div data-testid="copyable-link">{link}</div>,
}));

vi.mock('@/db', () => {
    const createSelectChain = () => {
        const nextRows = () => Promise.resolve(mocks.selectQueue.shift() ?? []);
        const chain: Record<string, unknown> = {
            from: () => chain,
            leftJoin: () => chain,
            innerJoin: () => chain,
            where: () => chain,
            groupBy: () => chain,
            orderBy: () => chain,
            limit: () => chain,
            catch: () => nextRows(),
            then: (onFulfilled?: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
                nextRows().then(onFulfilled, onRejected),
        };
        return chain;
    };

    return {
        db: {
            select: () => createSelectChain(),
            query: {
                invoices: { findMany: (...args: unknown[]) => mocks.invoicesFindMany(...args) },
                bookingAttendees: { findMany: (...args: unknown[]) => mocks.bookingAttendeesFindMany(...args) },
                children: { findFirst: (...args: unknown[]) => mocks.childrenFindFirst(...args) },
                studentNotes: { findMany: (...args: unknown[]) => mocks.studentNotesFindMany(...args) },
            },
        },
    };
});

import Home from '../page';
import LoginPage from '../login/page';
import StaffLoginPage from '../staff-login/page';
import PortalLoginPage from '../portal/login/page';
import SignupPage from '../signup/page';
import ForgotPasswordPage from '../forgot-password/page';
import PortalLayout from '../portal/layout';
import PortalDashboard from '../portal/page';
import ChildDetailsPage from '../portal/children/[id]/page';
import { RevenueWidget } from '@/components/dashboard/RevenueWidget';
import DashboardSchedule from '../dashboard/_components/DashboardSchedule';
import ActivityTab from '../dashboard/_components/ActivityTab';
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist';

describe('Wave 3C Part 2 — WCAG Landmarks, Skip Links, Accessible Names, 24px Targets & Tutor Schedule Guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.selectQueue = [];
        try {
            if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
                localStorage.clear();
            }
        } catch {
            /* noop */
        }
    });

    afterEach(() => {
        cleanup();
    });

    describe('1. Auth doors single <h1> & <main id="main-content"> landmarks + 24px standalone links', () => {
        it('/login renders sole <h1> "Admin & Staff Sign In", demotes left panel to <h2>, wraps form in <main id="main-content">, and sizes standalone links >= 24px', () => {
            const { container } = render(<LoginPage />);

            const h1s = screen.getAllByRole('heading', { level: 1 });
            expect(h1s).toHaveLength(1);
            expect(h1s[0].textContent).toBe('Admin & Staff Sign In');

            const marketingHeading = screen.getByRole('heading', {
                level: 2,
                name: /Run your club from one workspace/i,
            });
            expect(marketingHeading).toBeDefined();

            const mains = container.querySelectorAll('main');
            expect(mains).toHaveLength(1);
            expect(mains[0].getAttribute('id')).toBe('main-content');

            const signUpLink = screen.getByRole('link', { name: 'Sign up' });
            expect(signUpLink.className).toContain('min-h-6');
            expect(signUpLink.className).toContain('min-w-6');

            const parentLink = screen.getByRole('link', { name: /Sign in as a parent/i });
            expect(parentLink.className).toContain('min-h-6');
            expect(parentLink.className).toContain('min-w-6');
        });

        it('/staff-login, /portal/login, /signup, and /forgot-password each expose a single <main id="main-content"> and single <h1>', () => {
            const doors = [
                { name: '/staff-login', el: <StaffLoginPage /> },
                { name: '/portal/login', el: <PortalLoginPage /> },
                { name: '/signup', el: <SignupPage /> },
                { name: '/forgot-password', el: <ForgotPasswordPage /> },
            ];

            for (const door of doors) {
                const { container, unmount } = render(door.el);
                const mains = container.querySelectorAll('main');
                expect(mains, `${door.name} should have 1 <main>`).toHaveLength(1);
                expect(mains[0].getAttribute('id'), `${door.name} <main> id`).toBe('main-content');

                const h1s = screen.getAllByRole('heading', { level: 1 });
                expect(h1s, `${door.name} should have 1 <h1>`).toHaveLength(1);
                unmount();
            }
        });

        it('/portal/login standalone links ("← Back to Home", "Staff Login") meet 24x24px target classes', () => {
            render(<PortalLoginPage />);

            const backHome = screen.getByRole('link', { name: /Back to Home/i });
            expect(backHome.className).toContain('min-h-6');
            expect(backHome.className).toContain('min-w-6');

            const staffLogin = screen.getByRole('link', { name: 'Staff Login' });
            expect(staffLogin.className).toContain('min-h-6');
            expect(staffLogin.className).toContain('min-w-6');
        });
    });

    describe('2. Skip-to-main-content links & <main id="main-content"> targets', () => {
        it('landing page (/) renders skip link targeting <main id="main-content"> without duplicate <main>', () => {
            const { container } = render(<Home />);

            const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
            expect(skipLink.getAttribute('href')).toBe('#main-content');
            expect(skipLink.className).toContain('sr-only');
            expect(skipLink.className).toContain('focus:not-sr-only');

            const mains = container.querySelectorAll('main');
            expect(mains).toHaveLength(1);
            expect(mains[0].getAttribute('id')).toBe('main-content');
        });

        it('PortalLayout + PortalDashboard render skip link and a single <main id="main-content">', async () => {
            mocks.getCurrentParent.mockResolvedValue({
                id: 'parent-1',
                firstName: 'Amara',
                email: 'amara@example.co.uk',
                children: [],
                bookings: [],
            });
            mocks.invoicesFindMany.mockResolvedValue([]);
            mocks.bookingAttendeesFindMany.mockResolvedValue([]);

            const dashboardEl = await PortalDashboard();
            const { container } = render(<PortalLayout>{dashboardEl}</PortalLayout>);

            const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
            expect(skipLink.getAttribute('href')).toBe('#main-content');

            const mains = container.querySelectorAll('main');
            expect(mains).toHaveLength(1);
            expect(mains[0].getAttribute('id')).toBe('main-content');
        });
    });

    describe('3. Accessible link names & 24x24px targets on ChildDetailsPage & RevenueWidget', () => {
        it('ChildDetailsPage gives icon back link accessible name "Back to Parent Portal" and sizes "Book a session →" >= 24px', async () => {
            mocks.getCurrentParent.mockResolvedValue({
                id: 'parent-1',
                firstName: 'Amara',
                email: 'amara@example.co.uk',
            });
            mocks.childrenFindFirst.mockResolvedValue({
                id: 'child-1',
                parentId: 'parent-1',
                firstName: 'Kofi',
                lastName: 'Mensah',
                schoolYear: 'year_4',
                dateOfBirth: null,
                centre: { id: 'centre-1', name: 'Croydon Central', address: '10 High St' },
                notes: [],
            });
            mocks.selectQueue.push([]);

            const pageEl = await ChildDetailsPage({ params: Promise.resolve({ id: 'child-1' }) });
            const { container } = render(<PortalLayout>{pageEl}</PortalLayout>);

            const backLink = screen.getByRole('link', { name: 'Back to Parent Portal' });
            expect(backLink.getAttribute('href')).toBe('/portal');

            const bookLink = screen.getByRole('link', { name: /Book a session/i });
            expect(bookLink.className).toContain('min-h-6');
            expect(bookLink.className).toContain('min-w-6');

            const mains = container.querySelectorAll('main');
            expect(mains).toHaveLength(1);
            expect(mains[0].getAttribute('id')).toBe('main-content');
        });

        it('RevenueWidget exposes contextual aria-labels and 24x24px target classes on all 4 metric/overdue links', async () => {
            mocks.selectQueue.push([], [], []);

            const widgetEl = await RevenueWidget({
                organisationId: 'org-1',
                activeCentreId: 'all',
                accessibleCentreIds: ['centre-1'],
            });
            render(widgetEl);

            const weekLink = screen.getByRole('link', {
                name: /Received this week: £0\.00 — open weekly cashflow/i,
            });
            const monthLink = screen.getByRole('link', {
                name: /Received in .+: £0\.00 — open weekly cashflow/i,
            });
            const outstandingLink = screen.getByRole('link', {
                name: /Outstanding balances: £0\.00 across 0 unpaid invoices — open payments/i,
            });
            const overdueLink = screen.getByRole('link', {
                name: /Overdue invoices: 0 — view overdue invoices/i,
            });

            for (const link of [weekLink, monthLink, outstandingLink, overdueLink]) {
                expect(link.className).toContain('min-h-6');
                expect(link.className).toContain('min-w-6');
            }
        });
    });

    describe('4. Tutor schedule guard, heading hierarchy & UK English onboarding copy', () => {
        it('DashboardSchedule promotes "Today\'s Bookings" to <h2>, hides "View all" for TUTOR, and shows >= 24px "View all" for non-TUTOR roles', async () => {
            mocks.selectQueue.push([]);
            const tutorEl = await DashboardSchedule({
                org: { id: 'org-1' },
                accessibleCentreIds: ['centre-1'],
                hasCentres: true,
                userRole: 'TUTOR',
            });
            const { unmount } = render(tutorEl);

            const heading = screen.getByRole('heading', { level: 2, name: "Today's Bookings" });
            expect(heading).toBeDefined();
            expect(screen.queryByRole('link', { name: /View all/i })).toBeNull();
            unmount();

            mocks.selectQueue.push([]);
            const managerEl = await DashboardSchedule({
                org: { id: 'org-1' },
                accessibleCentreIds: ['centre-1'],
                hasCentres: true,
                userRole: 'MANAGER',
            });
            render(managerEl);

            const viewAllLink = screen.getByRole('link', { name: /View all/i });
            expect(viewAllLink.getAttribute('href')).toBe('/dashboard/bookings');
            expect(viewAllLink.className).toContain('min-h-6');
            expect(viewAllLink.className).toContain('min-w-6');
        });

        it('ActivityTab standalone empty-state links ("Create a booking →", "Open registration form →") include 24x24px classes', async () => {
            mocks.selectQueue.push(
                [],
                [],
                [],
                [{ totalAll: 0, thisMonth: 0, thisWeek: 0, activePeriod: 0, prevPeriod: 0 }],
                []
            );

            const activityEl = await ActivityTab({
                searchParams: {},
                org: { id: 'org-1', slug: 'croydon-club' },
                activeCentreId: 'all',
                accessibleCentreIds: ['centre-1'],
                hasCentres: true,
                userRole: 'ORG_OWNER',
            });
            render(activityEl);

            const createBookingLink = screen.getByRole('link', { name: /Create a booking/i });
            expect(createBookingLink.className).toContain('min-h-6');
            expect(createBookingLink.className).toContain('min-w-6');

            const openFormLink = screen.getByRole('link', { name: /Open registration form/i });
            expect(openFormLink.className).toContain('min-h-6');
            expect(openFormLink.className).toContain('min-w-6');
        });

        it('OnboardingChecklist renders clean UK English CTA ("Open organisation settings") instead of "Go to Complete your"', () => {
            render(
                <OnboardingChecklist
                    completedCount={0}
                    steps={[
                        {
                            id: 'org-info',
                            label: 'Complete your organisation profile',
                            description: 'Confirm your club name and contact details.',
                            href: '/dashboard/settings',
                            done: false,
                        },
                    ]}
                />
            );

            const ctaLink = screen.getByRole('link', { name: 'Open organisation settings' });
            expect(ctaLink.getAttribute('href')).toBe('/dashboard/settings');
            expect(screen.queryByText(/Go to Complete your/i)).toBeNull();
        });
    });
});
