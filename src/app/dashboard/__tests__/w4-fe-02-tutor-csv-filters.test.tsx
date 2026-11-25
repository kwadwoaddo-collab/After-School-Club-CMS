// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';

const pushMock = vi.fn();
const refreshMock = vi.fn();
let mockSelectedCentreId = 'centre-uuid-1';
let mockSearchParams = new URLSearchParams('search=Alice&status=active');

const dbSelectMock = vi.fn();
vi.mock('@/db', () => ({
    db: {
        select: (...args: unknown[]) => dbSelectMock(...args),
        query: {},
    },
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock, refresh: refreshMock }),
    usePathname: () => '/dashboard',
    useSearchParams: () => mockSearchParams,
}));

vi.mock('@/components/dashboard/CentreFilterContext', () => ({
    useCentreFilter: () => ({
        selectedCentreId: mockSelectedCentreId,
        setSelectedCentreId: vi.fn((val: string) => { mockSelectedCentreId = val; }),
        centres: [
            { id: 'centre-uuid-1', name: 'North Hub' },
            { id: 'centre-uuid-2', name: 'South Hub' },
        ],
    }),
}));

vi.mock('@/components/dashboard/SidebarContext', () => ({
    useSidebar: () => ({ collapsed: true, setCollapsed: vi.fn() }),
}));

vi.mock('@/components/dashboard/HeaderPortal', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="header-portal">{children}</div>,
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/features/bookings/actions', () => ({
    markAttendeeAttendance: vi.fn(),
    registerWalkInChild: vi.fn(),
    registerExistingChildWalkIn: vi.fn(),
}));

vi.mock('@/features/attendance/actions', () => ({
    updateAttendanceTimelog: vi.fn(),
    forgiveSessionsAction: vi.fn(),
}));

import ActivityTab from '@/app/dashboard/_components/ActivityTab';
import { AttendeeCard } from '@/app/dashboard/attendance/AttendanceRollCall';
import LedgerClient from '@/app/dashboard/attendance/ledger/LedgerClient';
import ParentsFilters from '@/features/parents/components/ParentsFilters';
import RegistrationsFilters from '@/features/registration/components/RegistrationsFilters';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import Sidebar from '@/components/dashboard/Sidebar';

describe('Wave 4A — fix/w4-fe-02 Tutor gating, CSV formula safety, centre preservation & nav parity', () => {
    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        mockSelectedCentreId = 'centre-uuid-1';
        mockSearchParams = new URLSearchParams('search=Alice&status=active');
    });

    it('ActivityTab returns null immediately for TUTOR without querying DB (W4-D01)', async () => {
        const result = await ActivityTab({
            searchParams: {},
            org: { id: 'org-1', slug: 'oakridge' },
            activeCentreId: 'all',
            accessibleCentreIds: [],
            hasCentres: false,
            userRole: 'TUTOR',
        });
        expect(result).toBeNull();
        expect(dbSelectMock).not.toHaveBeenCalled();
    });

    it('DashboardSchedule fails closed for zero-centre non-owners and routes TUTOR clicks to /dashboard/attendance (Blind Spot #1, W4-D02)', () => {
        const src = fs.readFileSync(
            path.join(process.cwd(), 'src/app/dashboard/_components/DashboardSchedule.tsx'),
            'utf8'
        );
        expect(src).toContain('effectiveIsOwner');
        expect(src).toContain('sql`false`');
        expect(src).toContain('/dashboard/attendance?date=');
    });

    it('AttendeeCard renders plain spans for TUTOR (canViewProfiles=false) and profile links for staff (W4-D02)', () => {
        const attendee = {
            id: 'att-1',
            childId: 'child-1',
            firstName: 'Maya',
            lastName: 'Patel',
            schoolYear: 'Year 4',
            parentId: 'parent-1',
            parentFirstName: 'Priya',
            parentLastName: 'Patel',
            parentPhone: '07700900123',
            parentEmail: 'priya@example.com',
            attendanceStatus: null,
            attendanceNote: null,
            lateMinutes: null,
            isCatchUp: false,
            bookingId: 'bk-1',
            checkInTime: null,
            checkOutTime: null,
            sessionType: 'scheduled' as const,
            flagHomework: false,
            flagBehaviour: false,
            flagNote: null,
            notes: null,
        };

        const tutorHtml = renderToStaticMarkup(
            <AttendeeCard
                attendee={attendee}
                dateStr="2026-11-25"
                sessionTime="15:30"
                centreId="centre-uuid-1"
                canViewProfiles={false}
                onToast={vi.fn()}
            />
        );
        expect(tutorHtml).not.toContain('/dashboard/students/child-1');
        expect(tutorHtml).not.toContain('/dashboard/parents/parent-1');
        expect(tutorHtml).toContain('Maya Patel');

        const staffHtml = renderToStaticMarkup(
            <AttendeeCard
                attendee={attendee}
                dateStr="2026-11-25"
                sessionTime="15:30"
                centreId="centre-uuid-1"
                canViewProfiles={true}
                onToast={vi.fn()}
            />
        );
        expect(staffHtml).toContain('/dashboard/students/child-1');
        expect(staffHtml).toContain('/dashboard/parents/parent-1');
    });

    it('LedgerClient hides Export CSV & profile links for TUTOR, and quotes + neutralizes CSV formulas for staff (SEC-W4-05, W4-D02)', () => {
        const ledgerEntries = [
            {
                childId: 'child-99',
                firstName: '=CMD()',
                lastName: 'O"Connor, Jr',
                schoolYear: 'Year 5',
                schedule: 'Mon, Wed',
                scheduledAbsences: 1,
                extraSessionsAttended: 2,
                forgivenSessions: 0,
                netBalance: 1,
                missedDates: [],
                extraDates: [],
                forgivenEntries: [],
            },
        ];

        const { unmount } = render(
            <LedgerClient
                ledger={ledgerEntries}
                centres={[{ id: 'centre-uuid-1', name: 'North Hub' }]}
                selectedCentreId="centre-uuid-1"
                selectedYear="2026-2027"
                academicYears={['2026-2027']}
                userRole="TUTOR"
            />
        );
        expect(screen.queryByText('Export CSV')).toBeNull();
        expect(document.querySelector('a[href="/dashboard/students/child-99"]')).toBeNull();
        unmount();

        let capturedBlobParts: BlobPart[] = [];
        const OrigBlob = globalThis.Blob;
        const createUrlSpy = vi.fn(() => 'blob:ledger-test');
        const revokeUrlSpy = vi.fn();
        const origCreateObjectURL = URL.createObjectURL;
        const origRevokeObjectURL = URL.revokeObjectURL;
        URL.createObjectURL = createUrlSpy;
        URL.revokeObjectURL = revokeUrlSpy;
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        globalThis.Blob = class MockBlob extends OrigBlob {
            constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
                super(parts, options);
                capturedBlobParts = parts ?? [];
            }
        } as typeof Blob;

        try {
            render(
                <LedgerClient
                    ledger={ledgerEntries}
                    centres={[{ id: 'centre-uuid-1', name: 'North Hub' }]}
                    selectedCentreId="centre-uuid-1"
                    selectedYear="2026-2027"
                    academicYears={['2026-2027']}
                    userRole="MANAGER"
                />
            );

            fireEvent.click(screen.getByText('Export CSV'));
            const csvText = String(capturedBlobParts[0] ?? '');
            expect(csvText).toContain('"\'=CMD() O""Connor, Jr"');
            expect(csvText).toContain('"Mon, Wed"');
            expect(revokeUrlSpy).toHaveBeenCalledWith('blob:ledger-test');
        } finally {
            globalThis.Blob = OrigBlob;
            URL.createObjectURL = origCreateObjectURL;
            URL.revokeObjectURL = origRevokeObjectURL;
            clickSpy.mockRestore();
        }
    });

    it('ParentsFilters preserves active centre on status filter and Clear (FE P1-1)', () => {
        render(<ParentsFilters resultsCount={3} />);

        fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'arrears' } });
        expect(pushMock).toHaveBeenCalledWith('/dashboard/parents?search=Alice&status=arrears&centre=centre-uuid-1');

        pushMock.mockClear();
        fireEvent.click(screen.getByText('Clear'));
        expect(pushMock).toHaveBeenCalledWith('/dashboard/parents?centre=centre-uuid-1');
    });

    it('RegistrationsFilters renders a mobile status select and RegistrationsBulkClient neutralizes CSV formulas (DES P1-4, SEC-W4-05)', () => {
        render(<RegistrationsFilters centres={[{ id: 'centre-uuid-1', name: 'North Hub' }]} resultsCount={2} />);
        const statusSelect = screen.getByLabelText('Filter by status');
        expect(statusSelect).toBeTruthy();

        const bulkSrc = fs.readFileSync(
            path.join(process.cwd(), 'src/components/dashboard/RegistrationsBulkClient.tsx'),
            'utf8'
        );
        expect(bulkSrc).toContain('neutralizeCsvFormula');
    });

    it('MobileBottomNav exposes Attendance for TUTOR and Settings for MANAGER; Sidebar gates Manage Centres & enables FRONT_DESK Share Portals (W4-D11)', () => {
        const tutorNav = renderToStaticMarkup(<MobileBottomNav userRole="TUTOR" />);
        expect(tutorNav).toContain('/dashboard/attendance');

        const managerNav = renderToStaticMarkup(<MobileBottomNav userRole="MANAGER" />);
        expect(managerNav).toContain('/dashboard/settings');

        const frontDeskSidebar = renderToStaticMarkup(<Sidebar userRole="FRONT_DESK" userName="Desk Staff" />);
        expect(frontDeskSidebar).toContain('/dashboard/share');
        expect(frontDeskSidebar).not.toContain('Manage Centres');
    });
});
