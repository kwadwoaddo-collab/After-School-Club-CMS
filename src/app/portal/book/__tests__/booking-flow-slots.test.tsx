// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.stubGlobal('React', React);

const toastMock = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: toastMock }),
}));

const createPortalBookingMock = vi.fn();
const reschedulePortalBookingMock = vi.fn();
vi.mock('../actions', () => ({
    createPortalBooking: (...args: unknown[]) => createPortalBookingMock(...args),
    reschedulePortalBooking: (...args: unknown[]) => reschedulePortalBookingMock(...args),
}));

const getCurrentParentMock = vi.fn();
vi.mock('@/lib/parent-auth', () => ({
    getCurrentParent: () => getCurrentParentMock(),
}));

vi.mock('@/app/portal/notifications/actions', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/portal/components/NotificationBell', () => ({
    default: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/features/portal/components/CancelBookingButton', () => ({
    CancelBookingButton: ({ bookingId }: { bookingId: string }) => (
        <button type="button">Cancel {bookingId}</button>
    ),
}));

const invoicesFindManyMock = vi.fn().mockResolvedValue([]);
const bookingAttendeesFindManyMock = vi.fn().mockResolvedValue([]);
vi.mock('@/db', () => ({
    db: {
        query: {
            invoices: { findMany: (...args: unknown[]) => invoicesFindManyMock(...args) },
            bookingAttendees: { findMany: (...args: unknown[]) => bookingAttendeesFindManyMock(...args) },
        },
    },
}));

import { BookingFlow, normalizePortalSessionSlots } from '../BookingFlow';

describe('normalizePortalSessionSlots (JC-01 pure helper)', () => {
    it('normalizes legacy string[] slots from JSON string and raw array', () => {
        const fromJson = normalizePortalSessionSlots('["15:30", "17:00"]');
        expect(fromJson).toEqual([
            { id: 'slot-0-15:30', time: '15:30' },
            { id: 'slot-1-17:00', time: '17:00' },
        ]);

        const fromArray = normalizePortalSessionSlots(['09:00', '15:30']);
        expect(fromArray).toEqual([
            { id: 'slot-0-09:00', time: '09:00' },
            { id: 'slot-1-15:30', time: '15:30' },
        ]);
    });

    it('normalizes structured SessionSlot objects ({ time, label, daysActive } and { startTime, name, daysActive })', () => {
        const raw = JSON.stringify([
            { id: 's1', time: '15:30', label: 'After School', daysActive: ['Mon', 'Wed', 'Fri'] },
            { name: 'Breakfast Club', startTime: '07:30', endTime: '09:00', price: 5, capacity: 30, daysActive: ['Mon', 'Tue'] },
        ]);

        const all = normalizePortalSessionSlots(raw);
        expect(all).toEqual([
            { id: 's1', time: '15:30', label: 'After School', daysActive: ['Mon', 'Wed', 'Fri'] },
            { id: 'slot-1-07:30-Breakfast Club', time: '07:30', label: 'Breakfast Club', daysActive: ['Mon', 'Tue'] },
        ]);
    });

    it('filters object slots by daysActive when selectedDateStr is provided', () => {
        const raw = JSON.stringify([
            { id: 'mon-wed', time: '15:30', label: 'Mon/Wed Club', daysActive: ['Mon', 'Wednesday'] },
            { id: 'tue-only', time: '16:00', label: 'Tuesday Drama', daysActive: ['Tue'] },
            { id: 'all-days-empty', time: '17:00', label: 'Open Slot', daysActive: [] },
        ]);

        // 2026-11-23 is a Monday; 2026-11-24 is a Tuesday
        const mondaySlots = normalizePortalSessionSlots(raw, '2026-11-23');
        expect(mondaySlots.map(s => s.id)).toEqual(['mon-wed', 'all-days-empty']);

        const tuesdaySlots = normalizePortalSessionSlots(raw, '2026-11-24');
        expect(tuesdaySlots.map(s => s.id)).toEqual(['tue-only', 'all-days-empty']);
    });

    it('handles null, invalid JSON, and malformed slot objects safely without throwing', () => {
        expect(normalizePortalSessionSlots(null)).toEqual([]);
        expect(normalizePortalSessionSlots('{not-valid-json')).toEqual([]);
        expect(normalizePortalSessionSlots([{}, null, '', { label: 'Missing Time' }, '16:15'])).toEqual([
            { id: 'slot-4-16:15', time: '16:15' },
        ]);
    });
});

describe('BookingFlow component — JC-01 SessionSlot rendering & clean time submission', () => {
    let consoleErrorSpy: { mock: { calls: unknown[][] }; mockRestore: () => void };

    beforeEach(() => {
        vi.clearAllMocks();
        window.scrollTo = vi.fn();
        consoleErrorSpy = vi.spyOn(console, 'error');
        createPortalBookingMock.mockResolvedValue({
            success: true,
            confirmationCode: 'CONF1234',
        });
    });

    afterEach(() => {
        cleanup();
        consoleErrorSpy.mockRestore();
    });

    const sampleChild = {
        id: 'child-1',
        firstName: 'Maya',
        lastName: 'Okonkwo',
        schoolYear: 'Y4',
        centreId: 'centre-1',
    };

    it('renders legacy string[] sessionSlots without errors and submits clean time string', async () => {
        render(
            <BookingFlow
                registeredChildren={[sampleChild]}
                centres={[
                    {
                        id: 'centre-1',
                        name: 'Lewisham Centre',
                        address: '1 High St',
                        sessionSlots: JSON.stringify(['15:30', '17:00']),
                    },
                ]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Next/i }));

        // Pick first selectable weekday date
        const dateButtons = screen.getAllByRole('button').filter(btn =>
            /Mon|Tue|Wed|Thu|Fri/i.test(btn.textContent || '')
        );
        expect(dateButtons.length).toBeGreaterThan(0);
        fireEvent.click(dateButtons[0]);

        const slotBtn = screen.getByRole('button', { name: '15:30' });
        expect(slotBtn).toBeTruthy();
        fireEvent.click(slotBtn);

        fireEvent.click(screen.getByRole('button', { name: /Review/i }));
        expect(screen.getByText('Confirm Your Booking')).toBeTruthy();
        expect(screen.getByText('15:30')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Confirm Booking/i }));

        await waitFor(() => expect(createPortalBookingMock).toHaveBeenCalledTimes(1));
        const submittedArgs = createPortalBookingMock.mock.calls[0][0] as {
            childId: string;
            centreId: string;
            startAt: string;
            duration: number;
        };
        expect(submittedArgs.childId).toBe('child-1');
        expect(submittedArgs.centreId).toBe('centre-1');
        const parsedStart = new Date(submittedArgs.startAt);
        expect(Number.isNaN(parsedStart.getTime())).toBe(false);
        expect(parsedStart.getHours()).toBe(15);
        expect(parsedStart.getMinutes()).toBe(30);

        const reactChildErrors = consoleErrorSpy.mock.calls.filter((call: unknown[]) =>
            call.some((arg: unknown) => String(arg).includes('Objects are not valid as a React child'))
        );
        expect(reactChildErrors).toHaveLength(0);
    });

    it('renders structured SessionSlot[] objects with friendly labels, filters by day, and submits clean slot.time', async () => {
        const structuredSlots = [
            {
                id: 'breakfast-1',
                name: 'Breakfast Club',
                startTime: '07:30',
                endTime: '09:00',
                price: 5,
                capacity: 30,
                daysActive: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            },
            {
                id: 'afterschool-mon',
                time: '15:45',
                label: 'Monday Robotics',
                daysActive: ['Mon'],
            },
            {
                id: 'afterschool-tue',
                time: '16:15',
                label: 'Tuesday Coding',
                daysActive: ['Tue'],
            },
        ];

        render(
            <BookingFlow
                registeredChildren={[sampleChild]}
                centres={[
                    {
                        id: 'centre-1',
                        name: 'Sydenham Centre',
                        address: '22 Station Rd',
                        sessionSlots: JSON.stringify(structuredSlots),
                    },
                ]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Next/i }));

        // Find a Monday button and a Tuesday button among selectable dates
        const allButtons = screen.getAllByRole('button');
        const monButton = allButtons.find(btn => (btn.textContent || '').startsWith('Mon'));
        const tueButton = allButtons.find(btn => (btn.textContent || '').startsWith('Tue'));
        expect(monButton).toBeDefined();
        expect(tueButton).toBeDefined();

        // Click Tuesday: Tuesday Coding + Breakfast Club visible; Monday Robotics hidden
        fireEvent.click(tueButton!);
        expect(screen.getByRole('button', { name: 'Breakfast Club (07:30)' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Tuesday Coding (16:15)' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Monday Robotics (15:45)' })).toBeNull();

        // Click Monday: Monday Robotics + Breakfast Club visible; Tuesday Coding hidden
        fireEvent.click(monButton!);
        expect(screen.getByRole('button', { name: 'Breakfast Club (07:30)' })).toBeTruthy();
        const mondayRoboticsBtn = screen.getByRole('button', { name: 'Monday Robotics (15:45)' });
        expect(mondayRoboticsBtn).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Tuesday Coding (16:15)' })).toBeNull();

        // Select Monday Robotics (15:45) and complete booking
        fireEvent.click(mondayRoboticsBtn);
        fireEvent.click(screen.getByRole('button', { name: /Review/i }));

        // Step 3 displays clean time string "15:45"
        expect(screen.getByText('15:45')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Confirm Booking/i }));

        await waitFor(() => expect(createPortalBookingMock).toHaveBeenCalledTimes(1));
        const submittedArgs = createPortalBookingMock.mock.calls[0][0] as {
            startAt: string;
        };
        const parsedStart = new Date(submittedArgs.startAt);
        expect(Number.isNaN(parsedStart.getTime())).toBe(false);
        expect(parsedStart.getHours()).toBe(15);
        expect(parsedStart.getMinutes()).toBe(45);

        const reactChildErrors = consoleErrorSpy.mock.calls.filter((call: unknown[]) =>
            call.some((arg: unknown) => String(arg).includes('Objects are not valid as a React child'))
        );
        expect(reactChildErrors).toHaveLength(0);
    });
});

describe('PortalDashboard — DC-13 upcoming status filtering & dead Join Call removal', () => {
    afterEach(() => {
        cleanup();
    });

    it('excludes cancelled and rejected bookings from Upcoming Sessions and omits Join Call button', async () => {
        const futureConfirmed = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const futureCancelled = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
        const futureRejected = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

        getCurrentParentMock.mockResolvedValue({
            id: 'parent-1',
            firstName: 'Ada',
            email: 'ada@example.com',
            children: [],
            bookings: [
                {
                    id: 'bk-confirmed',
                    startAt: futureConfirmed,
                    duration: 60,
                    status: 'confirmed',
                    modality: 'online',
                    assessmentType: null,
                    centre: { name: 'Active Centre' },
                },
                {
                    id: 'bk-cancelled',
                    startAt: futureCancelled,
                    duration: 60,
                    status: 'cancelled',
                    modality: 'in_person',
                    assessmentType: 'initial_assessment',
                    centre: { name: 'Active Centre' },
                },
                {
                    id: 'bk-rejected',
                    startAt: futureRejected,
                    duration: 60,
                    status: 'rejected',
                    modality: 'in_person',
                    assessmentType: 'initial_assessment',
                    centre: { name: 'Active Centre' },
                },
            ],
        });
        bookingAttendeesFindManyMock.mockResolvedValue([{ bookingId: 'bk-confirmed', childId: 'child-1' }]);

        const { default: PortalDashboard } = await import('@/app/portal/page');
        const ui = await PortalDashboard();
        render(ui);

        // Only the 1 confirmed booking appears in Upcoming Sessions
        expect(screen.getAllByText('Club Session')).toHaveLength(1);
        expect(screen.queryByText('Initial Assessment')).toBeNull();
        expect(screen.getByRole('button', { name: 'Cancel bk-confirmed' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Cancel bk-cancelled' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Cancel bk-rejected' })).toBeNull();

        // Dead "Join Call" button is completely removed
        expect(screen.queryByText(/Join Call/i)).toBeNull();
    });
});
