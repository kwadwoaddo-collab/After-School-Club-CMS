// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/bookings/actions', () => ({ markAttendeeAttendance: vi.fn(), registerWalkInChild: vi.fn(), registerExistingChildWalkIn: vi.fn() }));
vi.mock('@/features/attendance/actions', () => ({ updateAttendanceTimelog: vi.fn() }));
import { markAttendeeAttendance } from '@/features/bookings/actions';
import { updateAttendanceTimelog } from '@/features/attendance/actions';
import AttendanceRollCall, { AttendeeCard } from './AttendanceRollCall';
const attendee = { id: 'attendee-1', childId: 'child-1', firstName: 'Dummy', lastName: 'Student', schoolYear: 'Y3', parentFirstName: 'Dummy', parentLastName: 'Parent', parentPhone: null, parentEmail: null, attendanceStatus: null, attendanceNote: null, lateMinutes: null, isCatchUp: false, bookingId: 'booking-1', checkInTime: null, checkOutTime: null, sessionType: 'scheduled' as const, flagHomework: false, flagBehaviour: false, flagNote: null, notes: null };
const setup = (overrides = {}) => { const onStatusChange = vi.fn(); render(<AttendeeCard attendee={{ ...attendee, ...overrides }} dateStr="2026-10-26" sessionTime="15:45" centreId="centre-1" onToast={vi.fn()} onStatusChange={onStatusChange} />); return onStatusChange; };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('confirmed attendance saves', () => {
    it('does not show check-in success until the save succeeds', async () => {
        let resolve!: () => void;
        vi.mocked(updateAttendanceTimelog).mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
        const changed = setup(); fireEvent.click(screen.getByRole('button', { name: 'Check In' }));
        expect(changed).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'In' })).toBeNull();
        await waitFor(() => expect(updateAttendanceTimelog).toHaveBeenCalledTimes(1));
        await act(async () => resolve()); await waitFor(() => expect(changed).toHaveBeenCalledWith('attendee-1', { checkedIn: true, checkedOut: false, absent: false }));
    });
    it('rolls back failed time edits and offers a persistent retry with the attempted time', async () => {
        vi.mocked(updateAttendanceTimelog).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
        setup({ checkInTime: '15:45', attendanceStatus: 'present' });
        const input = screen.getByLabelText('Check-in time for Dummy Student');
        fireEvent.change(input, { target: { value: '16:00' } }); fireEvent.blur(input);
        await screen.findByRole('alert'); expect((input as HTMLInputElement).value).toBe('15:45');
        expect(screen.getByRole('alert').textContent).toContain('Some changes may have reached the server');
        await waitFor(() => expect((screen.getByRole('button', { name: 'Retry save' }) as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
        await waitFor(() => expect((input as HTMLInputElement).value).toBe('16:00'));
        expect(updateAttendanceTimelog).toHaveBeenLastCalledWith(expect.objectContaining({ checkInTime: '16:00' }));
    });
    it('persists Undo and leaves absence displayed if the Undo fails', async () => {
        vi.mocked(updateAttendanceTimelog).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
        setup({ attendanceStatus: 'absent' }); fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        await screen.findByRole('alert'); expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
        await waitFor(() => expect((screen.getByRole('button', { name: 'Retry save' }) as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
        await screen.findByRole('button', { name: 'Check In' });
        expect(updateAttendanceTimelog).toHaveBeenLastCalledWith(expect.objectContaining({ clearAttendance: true, checkInTime: null, checkOutTime: null, absenceReason: null }));
    });
    it('reuses a created attendee after the timelog write fails', async () => {
        vi.mocked(markAttendeeAttendance).mockResolvedValue({ bookingId: 'saved-booking', attendeeId: 'saved-attendee' } as never);
        vi.mocked(updateAttendanceTimelog).mockRejectedValueOnce(new Error('second write failed')).mockResolvedValueOnce(undefined);
        setup({ id: 'temp-child', bookingId: null }); fireEvent.click(screen.getByRole('button', { name: 'Check In' }));
        await screen.findByRole('alert'); await waitFor(() => expect((screen.getByRole('button', { name: 'Retry save' }) as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
        await screen.findByRole('button', { name: 'In' });
        expect(markAttendeeAttendance).toHaveBeenCalledTimes(1);
        expect(markAttendeeAttendance).toHaveBeenCalledWith(expect.objectContaining({ status: null }));
        expect(updateAttendanceTimelog).toHaveBeenLastCalledWith(expect.objectContaining({ attendeeId: 'saved-attendee' }));
    });
});

it('reports partial bulk failure accurately and requires reload before retry', async () => {
    vi.mocked(markAttendeeAttendance).mockResolvedValueOnce({ bookingId: 'booking-1', attendeeId: 'attendee-1' } as never).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(updateAttendanceTimelog).mockResolvedValue(undefined);
    render(<AttendanceRollCall slots={[{ time: '15:45', timeLabel: '3:45 pm', regulars: [attendee, { ...attendee, id: 'attendee-2', childId: 'child-2', firstName: 'Other' }], catchups: [] }]} centreId="centre-1" dateStr="2026-10-26" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark All In' }));
    const warning = await screen.findByRole('alert');
    expect(warning.textContent).toContain('1 of 2 check-ins confirmed');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Mark All In' }) as HTMLButtonElement).disabled).toBe(true));
    expect(updateAttendanceTimelog).toHaveBeenCalledTimes(1);
    expect(updateAttendanceTimelog).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: 'attendee-1', checkInTime: expect.stringMatching(/^\d{2}:\d{2}$/) }));
});
