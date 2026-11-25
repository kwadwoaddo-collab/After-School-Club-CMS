// @vitest-environment jsdom
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const navMocks = vi.hoisted(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    pathname: '/dashboard/documents',
    search: '',
    markAttendeeAttendance: vi.fn(),
    deleteInvoice: vi.fn(),
    voidInvoice: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: navMocks.push, refresh: navMocks.refresh }),
    usePathname: () => navMocks.pathname,
    useSearchParams: () => new URLSearchParams(navMocks.search),
}));

vi.mock('@/features/bookings/actions', () => ({
    markAttendeeAttendance: (...args: unknown[]) => navMocks.markAttendeeAttendance(...args),
}));

vi.mock('@/features/finance/actions', () => ({
    deleteInvoice: (...args: unknown[]) => navMocks.deleteInvoice(...args),
    voidInvoice: (...args: unknown[]) => navMocks.voidInvoice(...args),
}));

import { ToastProvider, useToast } from '@/components/ui/ToastProvider';
import { CentreFilterProvider, useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import StudentForm from '@/features/students/components/StudentForm';
import KioskRegister from '@/app/dashboard/kiosk/KioskRegister';
import { InvoiceTable } from '@/features/finance/components/FinanceDashboardClient';

const BRANCH_3_CLIENT_FILES = [
    'src/components/ui/ToastProvider.tsx',
    'src/components/dashboard/CentreFilterContext.tsx',
    'src/components/dashboard/Sidebar.tsx',
    'src/components/dashboard/OrgSwitcher.tsx',
    'src/app/dashboard/availability/[centreId]/AvailabilityForm.tsx',
    'src/features/settings/components/CentreHoursForm.tsx',
    'src/app/dashboard/centres/[id]/settings/CentreSettingsClient.tsx',
    'src/app/dashboard/kiosk/KioskRegister.tsx',
    'src/app/dashboard/incidents/IncidentsClient.tsx',
    'src/app/dashboard/incidents/NewIncidentModal.tsx',
    'src/app/dashboard/communications/CommunicationsClient.tsx',
    'src/app/dashboard/documents/DocumentsClient.tsx',
    'src/app/dashboard/reports/ReportsClient.tsx',
    'src/app/dashboard/reports/WeeklyReportTab.tsx',
    'src/app/dashboard/registrations/[id]/DownloadButton.tsx',
    'src/app/dashboard/registrations/[id]/EditRegistrationForm.tsx',
    'src/features/staff/components/StaffCentreAssignment.tsx',
    'src/features/staff/components/StaffProfileForm.tsx',
    'src/features/parents/components/BinActions.tsx',
    'src/app/dashboard/finance/reconciliation/reconciliation-client.tsx',
    'src/app/dashboard/attendance/AttendanceRollCall.tsx',
    'src/features/bookings/components/BookingsTable.tsx',
    'src/features/bookings/components/BookingsFilters.tsx',
    'src/features/finance/components/FinanceDashboardClient.tsx',
    'src/features/finance/components/CashReceiptsOwnerView.tsx',
    'src/app/dashboard/attendance/ledger/LedgerClient.tsx',
    'src/features/billing/components/GenerateInvoiceModal.tsx',
    'src/features/finance/components/PaymentHistoryList.tsx',
    'src/features/parents/components/DeleteParentButton.tsx',
    'src/features/settings/components/RegistrationTermsForm.tsx',
    'src/features/students/components/StudentsFilters.tsx',
    'src/features/students/components/InternalNotesTimeline.tsx',
    'src/features/students/components/StudentActions.tsx',
    'src/features/students/components/StudentForm.tsx',
];

function ToastHarness() {
    const { toast } = useToast();
    return (
        <div>
            <button type="button" onClick={() => toast({ title: 'Saved', message: 'Profile updated', variant: 'success' })}>
                Trigger Success
            </button>
            <button type="button" onClick={() => toast({ title: 'Failed', message: 'Network error', variant: 'error' })}>
                Trigger Error
            </button>
        </div>
    );
}

function CentreSwitchHarness() {
    const { setSelectedCentreId } = useCentreFilter();
    return (
        <button type="button" onClick={() => setSelectedCentreId('centre-2')}>
            Switch to Centre 2
        </button>
    );
}

describe('Wave 5 Branch 3 (w5-fe-01): Client state, WCAG 2.2 AA & InvoiceFlow tokens', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        navMocks.pathname = '/dashboard/documents';
        navMocks.search = '';
    });

    afterEach(() => {
        cleanup();
    });

    it('renders error toasts as assertive alerts and status toasts with WCAG AA contrast tokens', () => {
        render(
            <ToastProvider>
                <ToastHarness />
            </ToastProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Trigger Success' }));
        fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }));

        const statusToast = screen.getByRole('status');
        expect(statusToast.getAttribute('aria-live')).toBe('polite');
        expect(statusToast.innerHTML).toContain('text-emerald-800');

        const alertToast = screen.getByRole('alert');
        expect(alertToast.getAttribute('aria-live')).toBe('assertive');
        expect(alertToast.innerHTML).toContain('text-danger');
        expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(2);
    });

    it('cleans folder/page/centre query params via router.push when present, and falls back to router.refresh otherwise', () => {
        navMocks.search = 'centre=centre-1&folder=policies&page=3';
        const { unmount } = render(
            <CentreFilterProvider centres={[{ id: 'centre-1', name: 'One' }, { id: 'centre-2', name: 'Two' }]} defaultCentreId="centre-1">
                <CentreSwitchHarness />
            </CentreFilterProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Switch to Centre 2' }));
        expect(navMocks.push).toHaveBeenCalledWith('/dashboard/documents?centre=centre-2');
        expect(navMocks.refresh).not.toHaveBeenCalled();
        unmount();

        navMocks.push.mockClear();
        navMocks.search = 'status=active';
        render(
            <CentreFilterProvider centres={[{ id: 'centre-1', name: 'One' }, { id: 'centre-2', name: 'Two' }]} defaultCentreId="centre-1">
                <CentreSwitchHarness />
            </CentreFilterProvider>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Switch to Centre 2' }));
        expect(navMocks.refresh).toHaveBeenCalledTimes(1);
        expect(navMocks.push).not.toHaveBeenCalled();
    });

    it('wires htmlFor/id across StudentForm fields and announces validation alerts', () => {
        render(
            <StudentForm
                accessibleCentres={[
                    { id: 'c-1', name: 'Croydon Hub' },
                    { id: 'c-2', name: 'Lewisham Hub' },
                ]}
            />
        );

        expect(screen.getByLabelText(/Assign to centre/i).id).toBe('centreId');
        expect(screen.getByLabelText(/Date of birth/i).id).toBe('dateOfBirth');
        expect(screen.getByLabelText(/School year/i).id).toBe('schoolYear');
        expect(screen.getByLabelText(/Email/i).id).toBe('parentEmail');
        expect(screen.getByLabelText(/Phone/i).id).toBe('parentPhone');

        window.scrollTo = vi.fn();
        fireEvent.click(screen.getByRole('button', { name: /Add student/i }));
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });

    it('applies WCAG AA emerald-700/amber-700 Kiosk action pills and rolls back optimistic status on server rejection', async () => {
        navMocks.markAttendeeAttendance
            .mockResolvedValueOnce({ bookingId: 'bk-1', attendeeId: 'att-1' })
            .mockResolvedValueOnce({ success: false, error: 'Session locked' });

        render(
            <KioskRegister
                slots={[
                    {
                        time: '15:45',
                        timeLabel: '3:45 pm',
                        regulars: [
                            {
                                id: 'att-1',
                                childId: 'child-1',
                                firstName: 'Ama',
                                lastName: 'Boateng',
                                schoolYear: 'Y4',
                                parentFirstName: 'Kofi',
                                parentLastName: 'Boateng',
                                parentPhone: '07700900123',
                                attendanceStatus: null,
                                attendanceNote: null,
                                lateMinutes: null,
                                bookingId: 'bk-1',
                                checkInTime: null,
                                checkOutTime: null,
                                isCatchUp: false,
                            },
                        ],
                        catchups: [],
                    },
                ]}
                date="Wednesday, 25 November 2026"
                dateStr="2026-11-25"
                centreName="North Centre"
                centres={[{ id: 'c-1', name: 'North Centre' }]}
                activeCentreId="c-1"
            />
        );

        const inBtn = screen.getByRole('button', { name: /^In$/i });
        fireEvent.click(inBtn);
        await waitFor(() => {
            const updatedInBtn = screen.getByRole('button', { name: /^In$/i });
            expect(updatedInBtn.getAttribute('aria-pressed')).toBe('true');
            expect(updatedInBtn.className).toContain('bg-emerald-700');
        });

        const lateBtn = screen.getByRole('button', { name: /^Late$/i });
        fireEvent.click(lateBtn);
        await waitFor(() => expect(navMocks.markAttendeeAttendance).toHaveBeenCalledTimes(2));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /^Late$/i }).getAttribute('aria-pressed')).toBe('false');
            expect(screen.getByRole('button', { name: /^In$/i }).getAttribute('aria-pressed')).toBe('true');
        });
    });

    it('awaits deleteInvoice inside ConfirmActionModal so server errors surface inline and invoice numbers render as links', async () => {
        navMocks.deleteInvoice.mockRejectedValue(new Error('Draft has linked payment records'));

        render(
            <InvoiceTable
                isOwner
                invoices={[
                    {
                        id: 'inv-1',
                        invoiceNumber: 'INV-2026-001',
                        status: 'draft',
                        amount: 120,
                        dueDate: '2026-12-01',
                        child: { id: 'ch-1', firstName: 'Nana', lastName: 'Mensah' },
                    },
                ]}
            />
        );

        const invLink = screen.getByRole('link', { name: 'INV-2026-001' });
        expect(invLink.getAttribute('href')).toBe('/dashboard/finance/invoices/inv-1');

        fireEvent.click(screen.getByRole('button', { name: 'Delete Draft' }));
        fireEvent.click(screen.getByRole('button', { name: 'Discard Permanently' }));

        await waitFor(() => {
            expect(screen.getByText(/Draft has linked payment records/i)).toBeTruthy();
        });
    });

    it('enforces zero indigo-* or blue-* palette leaks across all 34 Branch 3 client components', () => {
        const root = process.cwd();
        const leaks: string[] = [];

        for (const relPath of BRANCH_3_CLIENT_FILES) {
            const content = fs.readFileSync(path.join(root, relPath), 'utf8');
            if (/\b(indigo|blue)-\d+/.test(content)) {
                leaks.push(relPath);
            }
        }

        expect(leaks).toEqual([]);
    });
});
