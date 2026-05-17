import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markAttendeeAttendance } from './actions';
import { auth } from '@/lib/auth';
import { db } from '@/db';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            bookings: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(),
    },
}));

// Mock eq for the where clause
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq: vi.fn(),
    };
});

describe('markAttendeeAttendance', () => {
    const mockSession = {
        user: { id: 'user-123', organisationId: 'org-456' },
        expires: '9999-12-31T23:59:59.999Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws error if user is not authenticated', async () => {
        (auth as any).mockResolvedValueOnce(null);

        await expect(markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
        })).rejects.toThrow('Unauthorized');
    });

    it('throws error if user has no organisation', async () => {
        (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });

        await expect(markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
        })).rejects.toThrow('Unauthorized');
    });

    it('throws error if booking does not exist', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookings.findFirst as any).mockResolvedValueOnce(null);

        await expect(markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
        })).rejects.toThrow('Unauthorized access to this booking');
    });

    it('throws error if booking belongs to a different organisation', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookings.findFirst as any).mockResolvedValueOnce({
            centre: { organisationId: 'other-org' },
            attendees: [{ id: 'attendee-1' }]
        });

        await expect(markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
        })).rejects.toThrow('Unauthorized access to this booking');
    });

    it('throws error if attendee does not exist in booking', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookings.findFirst as any).mockResolvedValueOnce({
            centre: { organisationId: 'org-456' },
            attendees: [{ id: 'other-attendee' }]
        });

        await expect(markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
        })).rejects.toThrow('Attendee not found in this booking');
    });

    it('successfully updates attendance and records audit trail', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookings.findFirst as any).mockResolvedValueOnce({
            centre: { organisationId: 'org-456' },
            attendees: [{ id: 'attendee-1' }]
        });

        const mockSet = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        (db.update as any).mockReturnValue({
            set: mockSet,
            where: mockWhere,
        });

        await markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
            note: 'test note'
        });

        expect(db.update).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            attendanceStatus: 'present',
            attendanceNote: 'test note',
            attendanceMarkedBy: 'user-123',
            // attendanceMarkedAt is a Date, so we just expect it to be set
        }));
        // We assert that the update explicitly includes the audit trail
        const setArgs = mockSet.mock.calls[0][0];
        expect(setArgs.attendanceMarkedAt).toBeInstanceOf(Date);
        expect(setArgs.updatedAt).toBeInstanceOf(Date);
    });
});
