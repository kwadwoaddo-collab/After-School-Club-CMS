// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WeeklyReportData } from '@/features/reports/weekly-report.action';

vi.stubGlobal('React', React);

const mocks = vi.hoisted(() => ({
    getWeeklyReport: vi.fn(),
    generateCEOReportPDF: vi.fn(),
    requireTenantSession: vi.fn(),
    selectOrgLimit: vi.fn(),
}));

vi.mock('@/features/reports/weekly-report.action', () => ({
    getWeeklyReport: (...args: unknown[]) => mocks.getWeeklyReport(...args),
}));

vi.mock('@/lib/pdf-report', () => ({
    generateCEOReportPDF: (...args: unknown[]) => mocks.generateCEOReportPDF(...args),
}));

vi.mock('next/link', () => ({
    default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
}));

vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => mocks.requireTenantSession(...args),
}));

vi.mock('@/db', () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: (...args: unknown[]) => mocks.selectOrgLimit(...args),
                }),
            }),
        }),
    },
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import WeeklyReportTab from '../WeeklyReportTab';
import ReportsPage from '../page';

const fixtureReport: WeeklyReportData = {
    scope: {
        centreId: 'all',
        label: 'All accessible centres',
        centres: [
            { id: 'c-1', name: 'North Campus' },
            { id: 'c-2', name: 'South Campus' },
        ],
    },
    periodLabel: '23 Nov – 24 Nov 2026',
    startDate: '2026-11-23',
    endDate: '2026-11-24',
    orgName: 'SprintScale Club',
    orgLogoUrl: null,
    generatedBy: 'Owner',
    generatedAt: '24 Nov 2026, 23:00',
    summary: {
        newRegistrations: 2,
        newBookings: 5,
        sessionsRun: 3,
        attendanceRate: 92,
        pendingRegistrationsThisPeriod: 0,
        overdueFollowUps: 0,
    },
    newRegistrations: [],
    newBookings: [],
    attendanceByCentre: [],
    pendingActions: [],
    finance: {
        cashCollected: '120.00',
        invoiced: '340.00',
        draftsPrepared: '80.00',
    },
};

describe('ReportsPage & WeeklyReportTab SSR initialData hydration (PR-18c)', () => {
    afterEach(() => {
        cleanup();
        vi.resetAllMocks();
    });

    it('skips client mount POST when initialData is provided, then calls getWeeklyReport on range/centre change', async () => {
        mocks.getWeeklyReport.mockResolvedValue({
            ...fixtureReport,
            finance: { cashCollected: '250.00', invoiced: '500.00', draftsPrepared: '0.00' },
        });

        render(<WeeklyReportTab initialData={fixtureReport} />);

        // Immediate SSR data rendered with zero client Server Action calls
        expect(screen.getByText('£120.00')).toBeTruthy();
        expect(screen.getByRole('option', { name: 'North Campus' })).toBeTruthy();
        expect(mocks.getWeeklyReport).not.toHaveBeenCalled();

        // Subsequent navigation to Last Full Week calls getWeeklyReport
        fireEvent.click(screen.getByRole('button', { name: 'Last Full Week' }));
        await waitFor(() => expect(mocks.getWeeklyReport).toHaveBeenCalledTimes(1));
        await screen.findByText('£250.00');
    });

    it('preloads default week report on the server inside ReportsPage and passes initialData without a client waterfall', async () => {
        mocks.requireTenantSession.mockResolvedValue({
            user: { id: 'u-1', organisationId: 'org-1', role: 'ORG_OWNER' },
        });
        mocks.selectOrgLimit.mockResolvedValue([{ id: 'org-1', name: 'SprintScale Club' }]);
        mocks.getWeeklyReport.mockResolvedValueOnce(fixtureReport);

        const jsx = await ReportsPage();
        expect(mocks.getWeeklyReport).toHaveBeenCalledTimes(1);
        expect(mocks.getWeeklyReport.mock.calls[0]?.[2]).toBe('all');

        // Clear mock before mounting client tree to prove mount triggers 0 extra calls
        mocks.getWeeklyReport.mockClear();
        render(jsx);

        expect(screen.getByText('£120.00')).toBeTruthy();
        expect(mocks.getWeeklyReport).not.toHaveBeenCalled();
    });
});
