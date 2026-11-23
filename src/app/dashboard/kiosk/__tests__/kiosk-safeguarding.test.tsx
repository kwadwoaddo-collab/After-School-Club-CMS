// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.stubGlobal('React', React);

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
    redirect: vi.fn((path: string) => {
        throw new Error(`REDIRECT:${path}`);
    }),
}));

vi.mock('next/link', () => ({
    default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
        <a {...props}>{children}</a>
    ),
}));

vi.mock('@/components/dashboard/HeaderPortal', () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/offline-sync', () => ({
    queueOfflineAction: vi.fn(),
    getUnsyncedActions: vi.fn().mockResolvedValue([]),
    markActionSynced: vi.fn(),
}));

const requireTenantSessionMock = vi.fn();
vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => requireTenantSessionMock(...args),
}));

const getUserAccessibleCentresMock = vi.fn();
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentres: (...args: unknown[]) => getUserAccessibleCentresMock(...args),
}));

const resolveActiveCentreIdMock = vi.fn();
vi.mock('@/lib/centre-filter', () => ({
    resolveActiveCentreId: (...args: unknown[]) => resolveActiveCentreIdMock(...args),
}));

const childrenFindManyMock = vi.fn();
const bookingsFindManyMock = vi.fn();
const studentNotesFindManyMock = vi.fn();
const collectorsFindManyMock = vi.fn();
vi.mock('@/db', () => ({
    db: {
        query: {
            children: { findMany: (...args: unknown[]) => childrenFindManyMock(...args) },
            bookings: { findMany: (...args: unknown[]) => bookingsFindManyMock(...args) },
            studentNotes: { findMany: (...args: unknown[]) => studentNotesFindManyMock(...args) },
            authorisedCollectors: { findMany: (...args: unknown[]) => collectorsFindManyMock(...args) },
        },
    },
}));

const markAttendeeAttendanceMock = vi.fn();
vi.mock('@/features/bookings/actions', () => ({
    markAttendeeAttendance: (...args: unknown[]) => markAttendeeAttendanceMock(...args),
    registerWalkInChild: vi.fn(),
    registerExistingChildWalkIn: vi.fn(),
}));

vi.mock('@/features/attendance/actions', () => ({
    updateAttendanceTimelog: vi.fn(),
}));

import KioskRegister, { type Attendee as KioskAttendee } from '../KioskRegister';
import KioskPage from '../page';
import AttendanceRollCall from '../../attendance/AttendanceRollCall';
import AttendancePage from '../../attendance/page';

const baseKioskAttendee: KioskAttendee = {
    id: 'att-1',
    childId: 'child-1',
    firstName: 'Amara',
    lastName: 'O.',
    schoolYear: 'Y4',
    notes: 'Carries EpiPen in blue pouch',
    allergies: ['Severe Peanuts', 'Tree Nuts'],
    dietaryRequirements: 'Halal — strictly nut-free',
    medicalConditions: 'Chronic Asthma',
    medicationNotes: 'Salbutamol inhaler 2 puffs as needed',
    medicalNotes: [
        {
            id: 'mn-1',
            content: 'Parent reported seasonal wheezing flare-up this week',
            authorName: 'Grace Okafor (Parent)',
            category: 'Medical',
            isSafeguarding: false,
        },
        {
            id: 'sn-secret',
            content: 'CONFIDENTIAL_DSL_SAFEGUARDING_RECORD_DO_NOT_LEAK',
            authorName: 'DSL Lead',
            category: 'Safeguarding',
            isSafeguarding: true,
        },
    ],
    authorisedCollectors: [
        {
            id: 'col-1',
            name: 'Uncle Kwame Mensah',
            relationship: 'Uncle',
            phone: '07700 900777',
            collectionPassword: 'BLUE-FALCON-99',
        },
    ],
    parentFirstName: 'Grace',
    parentLastName: 'O.',
    parentPhone: null,
    parentPhoneLast4: null,
    parentEmail: null,
    attendanceStatus: 'present',
    attendanceNote: null,
    lateMinutes: null,
    checkInTime: '15:45',
    checkOutTime: null,
    isCatchUp: false,
    bookingId: 'booking-1',
};

function renderKiosk(overrides: Partial<KioskAttendee> = {}) {
    const attendee = { ...baseKioskAttendee, ...overrides };
    return render(
        <KioskRegister
            slots={[
                {
                    time: '15:45',
                    timeLabel: '3:45 PM',
                    regulars: [attendee],
                    catchups: [],
                },
            ]}
            date="Monday, 23 November 2026"
            dateStr="2026-11-23"
            centreName="Lewisham Hub"
            centres={[{ id: 'centre-1', name: 'Lewisham Hub' }]}
            activeCentreId="centre-1"
        />
    );
}

describe('KioskRegister & AttendanceRollCall safeguarding protections (PR #4a)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        markAttendeeAttendanceMock.mockResolvedValue({ bookingId: 'booking-1', attendeeId: 'att-1' });
        childrenFindManyMock.mockResolvedValue([]);
        bookingsFindManyMock.mockResolvedValue([]);
        studentNotesFindManyMock.mockResolvedValue([]);
        collectorsFindManyMock.mockResolvedValue([]);
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    });

    afterEach(() => {
        cleanup();
    });

    it('(a) does NOT render raw medical/allergy strings or collection passwords inline on the Kiosk grid before opening the modal', () => {
        const { container } = renderKiosk();

        // Compact indicator button IS shown on the card
        expect(
            screen.getByRole('button', { name: /Medical \/ Pickup Info for Amara O\./i })
        ).toBeTruthy();

        // UK GDPR Art. 9 shoulder-surfing check: NONE of the sensitive strings appear anywhere in the DOM or attributes
        const rawHtml = container.innerHTML;
        expect(rawHtml).not.toContain('Severe Peanuts');
        expect(rawHtml).not.toContain('Tree Nuts');
        expect(rawHtml).not.toContain('Halal');
        expect(rawHtml).not.toContain('Chronic Asthma');
        expect(rawHtml).not.toContain('Salbutamol');
        expect(rawHtml).not.toContain('Carries EpiPen');
        expect(rawHtml).not.toContain('seasonal wheezing');
        expect(rawHtml).not.toContain('BLUE-FALCON-99');
        expect(rawHtml).not.toContain('Uncle Kwame Mensah');
        expect(rawHtml).not.toContain('CONFIDENTIAL_DSL_SAFEGUARDING_RECORD_DO_NOT_LEAK');
    });

    it('(b) reveals medical, allergy, dietary & collector details inside the staff-initiated modal while never exposing safeguarding notes', () => {
        renderKiosk();

        fireEvent.click(
            screen.getByRole('button', { name: /Medical \/ Pickup Info for Amara O\./i })
        );

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Severe Peanuts, Tree Nuts/i)).toBeTruthy();
        expect(within(dialog).getByText(/Halal — strictly nut-free/i)).toBeTruthy();
        expect(within(dialog).getByText(/Chronic Asthma/i)).toBeTruthy();
        expect(within(dialog).getByText(/Salbutamol inhaler 2 puffs as needed/i)).toBeTruthy();
        expect(within(dialog).getByText(/Carries EpiPen in blue pouch/i)).toBeTruthy();
        expect(within(dialog).getByText(/Parent reported seasonal wheezing flare-up this week/i)).toBeTruthy();
        expect(within(dialog).getByText(/Uncle Kwame Mensah/i)).toBeTruthy();
        expect(within(dialog).getByText(/BLUE-FALCON-99/i)).toBeTruthy();

        // Safeguarding note must NEVER be exposed even inside the modal
        expect(dialog.innerHTML).not.toContain('CONFIDENTIAL_DSL_SAFEGUARDING_RECORD_DO_NOT_LEAK');

        // Closing modal hides sensitive text again
        fireEvent.click(within(dialog).getByRole('button', { name: /Close medical and pickup modal/i }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByText(/Severe Peanuts/i)).toBeNull();
    });

    it('(c) rejects "0000" when parent phone is blank/missing, surfaces collectors in Sign-Out modal, and allows explicit Staff Override', async () => {
        renderKiosk({ parentPhone: null, parentPhoneLast4: null });

        // Open Check-Out modal
        fireEvent.click(screen.getByRole('button', { name: /Out/i }));

        const dialog = screen.getByRole('dialog');
        // Authorised collectors & collection password are surfaced inside Sign-Out modal
        expect(within(dialog).getByText(/Uncle Kwame Mensah/i)).toBeTruthy();
        expect(within(dialog).getByText(/BLUE-FALCON-99/i)).toBeTruthy();
        expect(within(dialog).getByText(/PIN verification is disabled/i)).toBeTruthy();

        // Attempting '0000' via keyboard must be rejected and MUST NOT sign out
        fireEvent.keyDown(window, { key: '0' });
        fireEvent.keyDown(window, { key: '0' });
        fireEvent.keyDown(window, { key: '0' });
        fireEvent.keyDown(window, { key: '0' });

        expect(markAttendeeAttendanceMock).not.toHaveBeenCalled();
        expect(within(dialog).getByText(/PIN matching is disabled/i)).toBeTruthy();

        // Confirm Sign-Out button is disabled until BOTH ID verified checkbox AND collector name are provided
        const confirmBtn = within(dialog).getByRole('button', { name: /Confirm Sign-Out/i }) as HTMLButtonElement;
        expect(confirmBtn.disabled).toBe(true);

        const checkbox = within(dialog).getByRole('checkbox', {
            name: /Staff Override: Collector ID Verified in Person/i,
        });
        fireEvent.click(checkbox);
        expect(confirmBtn.disabled).toBe(true);

        const collectorInput = within(dialog).getByLabelText(/Collector Full Name/i);
        fireEvent.change(collectorInput, { target: { value: 'Uncle Kwame Mensah' } });
        expect(confirmBtn.disabled).toBe(false);

        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(markAttendeeAttendanceMock).toHaveBeenCalledTimes(1);
        });
        expect(markAttendeeAttendanceMock).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'check_out',
                childId: 'child-1',
                note: expect.stringContaining('Staff Override (ID verified in person): collected by Uncle Kwame Mensah'),
            })
        );
    });

    it('keeps standard 4-digit PIN sign-out working when a valid 4-digit phone suffix exists while still rejecting "0000"', async () => {
        renderKiosk({ parentPhone: null, parentPhoneLast4: '4829' });

        fireEvent.click(screen.getByRole('button', { name: /Out/i }));
        const dialog = screen.getByRole('dialog');

        // Enter wrong PIN '0000' -> rejected
        for (let i = 0; i < 4; i++) {
            fireEvent.click(within(dialog).getByRole('button', { name: '0' }));
        }
        await waitFor(() => {
            expect(within(dialog).getByText(/Incorrect PIN/i)).toBeTruthy();
        });
        expect(markAttendeeAttendanceMock).not.toHaveBeenCalled();

        // Enter valid PIN '4829' -> signs out
        for (const digit of ['4', '8', '2', '9']) {
            fireEvent.click(within(dialog).getByRole('button', { name: digit }));
        }
        await waitFor(() => {
            expect(markAttendeeAttendanceMock).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'check_out', childId: 'child-1' })
            );
        });
    });

    it('surfaces the Stethoscope medical/collector modal on AttendanceRollCall without exposing safeguarding notes', () => {
        render(
            <AttendanceRollCall
                slots={[
                    {
                        time: '15:45',
                        timeLabel: '3:45 pm',
                        regulars: [
                            {
                                id: 'att-rc-1',
                                childId: 'child-1',
                                firstName: 'Amara',
                                lastName: 'Okafor',
                                schoolYear: 'Y4',
                                parentFirstName: 'Grace',
                                parentLastName: 'Okafor',
                                parentPhone: '07700 900123',
                                parentEmail: 'grace@example.com',
                                attendanceStatus: null,
                                attendanceNote: null,
                                lateMinutes: null,
                                isCatchUp: false,
                                bookingId: 'booking-1',
                                checkInTime: null,
                                checkOutTime: null,
                                sessionType: 'scheduled',
                                flagHomework: false,
                                flagBehaviour: false,
                                flagNote: null,
                                notes: null,
                                allergies: ['Dairy'],
                                medicalConditions: 'Mild Eczema',
                                medicalNotes: [
                                    {
                                        id: 'mn-rc-1',
                                        content: 'Bring emollient cream on Fridays',
                                        authorName: 'Grace Okafor (Parent)',
                                        category: 'Medical',
                                        isSafeguarding: false,
                                    },
                                    {
                                        id: 'sn-rc-secret',
                                        content: 'SECRET_SAFEGUARDING_TEXT',
                                        authorName: 'Manager',
                                        category: 'Safeguarding',
                                        isSafeguarding: true,
                                    },
                                ],
                                authorisedCollectors: [
                                    {
                                        id: 'col-rc-1',
                                        name: 'Auntie Efua',
                                        relationship: 'Aunt',
                                        phone: '07700 900888',
                                        collectionPassword: 'SUNFLOWER',
                                    },
                                ],
                            },
                        ],
                        catchups: [],
                    },
                ]}
                centreId="centre-1"
                dateStr="2026-11-23"
            />
        );

        const badgeBtn = screen.getByRole('button', { name: /Medical and pickup info for Amara Okafor/i });
        fireEvent.click(badgeBtn);

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Dairy/i)).toBeTruthy();
        expect(within(dialog).getByText(/Mild Eczema/i)).toBeTruthy();
        expect(within(dialog).getByText(/Bring emollient cream on Fridays/i)).toBeTruthy();
        expect(within(dialog).getByText(/Auntie Efua/i)).toBeTruthy();
        expect(within(dialog).getByText(/SUNFLOWER/i)).toBeTruthy();
        expect(dialog.innerHTML).not.toContain('SECRET_SAFEGUARDING_TEXT');
    });

    it('short-circuits zero-centre non-ORG_OWNER staff on both AttendancePage and KioskPage without querying invalid UUIDs', async () => {
        requireTenantSessionMock.mockResolvedValue({
            user: { id: 'staff-zero', organisationId: 'org-1', role: 'FRONT_DESK' },
        });
        getUserAccessibleCentresMock.mockResolvedValue([]);
        resolveActiveCentreIdMock.mockResolvedValue('centre-spoofed');

        const attendanceEl = await AttendancePage({ searchParams: Promise.resolve({ centre: 'centre-spoofed' }) });
        render(attendanceEl);
        expect(screen.getByText(/No centres assigned/i)).toBeTruthy();

        const kioskEl = await KioskPage({ searchParams: Promise.resolve({ centre: 'centre-spoofed' }) });
        expect(kioskEl).toBeTruthy();

        expect(childrenFindManyMock).not.toHaveBeenCalled();
        expect(bookingsFindManyMock).not.toHaveBeenCalled();
        expect(studentNotesFindManyMock).not.toHaveBeenCalled();
        expect(collectorsFindManyMock).not.toHaveBeenCalled();
    });
});
