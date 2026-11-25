// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SessionContext } from 'next-auth/react';

const mocks = vi.hoisted(() => ({
    logError: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: mocks.logError,
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
    redirect: (url: string) => {
        throw new Error(`REDIRECT:${url}`);
    },
    notFound: () => {
        throw new Error('NOT_FOUND');
    },
}));

vi.mock('@/features/billing/actions', () => ({
    saveFamilyBillingSettings: vi.fn(),
    changeFamilyBillingStatus: vi.fn(),
    confirmFamilyStudentsEnrolment: vi.fn(),
}));

import DashboardError from '@/app/dashboard/error';
import DashboardNotFound from '@/app/dashboard/not-found';
import AttendanceError from '@/app/dashboard/attendance/error';
import FinanceError from '@/app/dashboard/finance/error';
import KioskError from '@/app/dashboard/kiosk/error';
import BookingsError from '@/app/dashboard/bookings/error';
import StudentsError from '@/app/dashboard/students/error';
import RegistrationsError from '@/app/dashboard/registrations/error';
import ParentsError from '@/app/dashboard/parents/error';
import BillingSettingsCard from '@/features/billing/components/BillingSettingsCard';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('Wave 4B fe-06 — Dashboard error boundaries & dark-mode CTA tokens', () => {
    const boundaries = [
        { name: 'DashboardError', Component: DashboardError },
        { name: 'AttendanceError', Component: AttendanceError },
        { name: 'FinanceError', Component: FinanceError },
        { name: 'KioskError', Component: KioskError },
        { name: 'BookingsError', Component: BookingsError },
        { name: 'StudentsError', Component: StudentsError },
        { name: 'RegistrationsError', Component: RegistrationsError },
        { name: 'ParentsError', Component: ParentsError },
    ] as const;

    it.each(boundaries)(
        '$name renders role="alert", uses bg-accent text-on-accent, and never leaks raw SQL/PII error details',
        ({ Component }) => {
            const sensitiveError = new Error('SELECT * FROM parents WHERE email = secret@example.com');
            const reset = vi.fn();
            render(<Component error={sensitiveError} reset={reset} />);

            const alert = screen.getByRole('alert');
            expect(alert.textContent).not.toContain('SELECT * FROM parents');
            expect(alert.textContent).not.toContain('secret@example.com');

            const retryButton = screen.getByRole('button', { name: /try again/i });
            expect(retryButton.className).toContain('bg-accent');
            expect(retryButton.className).toContain('text-on-accent');
            expect(retryButton.className).not.toContain('text-white');
            expect(mocks.logError).toHaveBeenCalledTimes(1);
        }
    );

    it('DashboardNotFound uses bg-accent text-on-accent on Back to Dashboard CTA', () => {
        render(<DashboardNotFound />);
        const link = screen.getByRole('link', { name: /back to dashboard/i });
        expect(link.className).toContain('bg-accent');
        expect(link.className).toContain('text-on-accent');
        expect(link.className).not.toContain('text-white');
    });

    it('BillingSettingsCard renders read-only for FRONT_DESK (via SessionContext or prop) without edit/pause/cancel buttons', () => {
        const sampleConfig = {
            id: 'cfg-1',
            parentId: 'parent-1',
            centreId: 'centre-1',
            agreedMonthlyPence: 12000,
            billingAnchorDate: '2026-10-01',
            billingEndDate: null,
            invoiceLeadDays: 30,
            paymentDayOfMonth: 1,
            leadTimeUnit: 'CALENDAR_MONTHS' as const,
            leadTimeValue: 1,
            status: 'active' as const,
            notes: 'Sibling plan',
            coveredChildren: [{ childId: 'child-1', childName: 'Ada Lovelace' }],
        };

        render(
            <SessionContext.Provider
                value={{
                    data: { user: { id: 'u-1', role: 'FRONT_DESK' }, expires: '2099-01-01' } as never,
                    status: 'authenticated',
                    update: vi.fn(),
                }}
            >
                <BillingSettingsCard
                    childId="child-1"
                    parentId="parent-1"
                    centreId="centre-1"
                    orgId="org-1"
                    siblings={[{ id: 'child-1', firstName: 'Ada', lastName: 'Lovelace' }]}
                    existingConfig={sampleConfig}
                />
            </SessionContext.Provider>
        );

        expect(screen.getByText('£120.00')).toBeTruthy();
        expect(screen.getByText(/View-only/i)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /edit billing settings/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /pause/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    });

    it('BillingSettingsCard empty state hides Set Up Family Billing button when canManageBilling={false}', () => {
        render(
            <BillingSettingsCard
                childId="child-1"
                parentId="parent-1"
                centreId="centre-1"
                orgId="org-1"
                siblings={[{ id: 'child-1', firstName: 'Ada', lastName: 'Lovelace' }]}
                existingConfig={null}
                canManageBilling={false}
            />
        );

        expect(screen.getByText('No billing set up')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /set up family billing/i })).toBeNull();
    });

    it('verifies WondeSettingsPage, StudentsPage, and ParentProfileClient structural invariants', () => {
        const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

        const wondeSrc = read('src/app/dashboard/settings/wonde/page.tsx');
        expect(wondeSrc).toContain("requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
        expect(wondeSrc).toContain('href="/dashboard/settings"');
        expect(wondeSrc).toContain('Back to Settings');
        expect(wondeSrc).toContain('text-page-title');

        const studentsSrc = read('src/app/dashboard/students/page.tsx');
        expect(studentsSrc).toContain('sticky top-14');
        expect(studentsSrc).not.toContain('sticky top-16');
        expect(studentsSrc).toContain('followUpsHref');
        expect(studentsSrc).toContain('lowAttendanceHref');

        const parentClientSrc = read('src/app/dashboard/parents/[id]/ParentProfileClient.tsx');
        expect(parentClientSrc).toContain("import dynamic from 'next/dynamic'");
        expect(parentClientSrc).toContain('text-on-accent');
        expect(parentClientSrc).not.toContain('bg-accent text-white');
    });
});
