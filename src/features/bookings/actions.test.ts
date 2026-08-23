import { describe, it, expect, vi, beforeEach } from 'vitest';
import { markAttendeeAttendance, registerWalkInChild, registerExistingChildWalkIn } from './actions';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { canUserAccessCentre } from '@/lib/permissions';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
    canUserAccessCentre: vi.fn(),
}));

vi.mock('@/lib/services/crm', () => ({
    resolveOrCreateParent: vi.fn(),
    resolveOrCreateChild: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            bookings: {
                findFirst: vi.fn(),
            },
            centres: {
                findFirst: vi.fn(),
            },
            children: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(),
        transaction: vi.fn(),
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
        // Default: caller can access the centre. Individual tests override
        // this to exercise the centre-membership-denied path.
        (canUserAccessCentre as any).mockResolvedValue(true);
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

    // Milestone 3F — regression test for the centre-membership isolation gap:
    // organisation match alone was previously sufficient to mark attendance
    // at any centre in the caller's org, even one the caller isn't assigned to.
    it('throws error if user cannot access the booking centre (same org, different centre)', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookings.findFirst as any).mockResolvedValueOnce({
            centreId: 'centre-other',
            centre: { id: 'centre-other', organisationId: 'org-456' },
            attendees: [{ id: 'attendee-1' }],
        });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(markAttendeeAttendance({
            bookingId: 'booking-1',
            attendeeId: 'attendee-1',
            status: 'present',
        })).rejects.toThrow('Unauthorized access to this booking');

        expect(canUserAccessCentre).toHaveBeenCalledWith('user-123', 'centre-other');
    });

    it('throws error if user cannot access the target centre on the on-demand booking path', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'org-456' });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(markAttendeeAttendance({
            bookingId: null,
            attendeeId: null,
            status: 'present',
            childId: 'child-1',
            dateStr: '2026-08-24',
            sessionTime: '15:30',
            centreId: 'centre-other',
        })).rejects.toThrow('Centre not found or unauthorized');

        expect(canUserAccessCentre).toHaveBeenCalledWith('user-123', 'centre-other');
        expect(db.transaction).not.toHaveBeenCalled();
    });
});

describe('registerWalkInChild', () => {
    const mockSession = {
        user: { id: 'user-123', organisationId: 'org-456' },
        expires: '9999-12-31T23:59:59.999Z',
    };

    const baseParams = {
        centreId: 'centre-1',
        dateStr: '2026-08-24',
        childFirstName: 'New',
        childLastName: 'Child',
        schoolYear: 'Year 3',
        parentFirstName: 'Parent',
        parentLastName: 'One',
        parentEmail: 'parent@example.com',
        sessionTime: '15:30',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (canUserAccessCentre as any).mockResolvedValue(true);
    });

    it('throws error if user cannot access the target centre (same org, different centre)', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.centres.findFirst as any).mockResolvedValueOnce({ id: 'centre-1', organisationId: 'org-456' });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(registerWalkInChild(baseParams)).rejects.toThrow('Centre not found or unauthorized');

        expect(canUserAccessCentre).toHaveBeenCalledWith('user-123', 'centre-1');
        expect(db.transaction).not.toHaveBeenCalled();
    });
});

describe('registerExistingChildWalkIn', () => {
    const mockSession = {
        user: { id: 'user-123', organisationId: 'org-456' },
        expires: '9999-12-31T23:59:59.999Z',
    };

    const baseParams = {
        centreId: 'centre-1',
        dateStr: '2026-08-24',
        childId: 'child-1',
        sessionTime: '15:30',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (canUserAccessCentre as any).mockResolvedValue(true);
    });

    it('throws error if user cannot access the target centre (same org, different centre)', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.centres.findFirst as any).mockResolvedValueOnce({ id: 'centre-1', organisationId: 'org-456' });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(registerExistingChildWalkIn(baseParams)).rejects.toThrow('Centre not found or unauthorized');

        expect(canUserAccessCentre).toHaveBeenCalledWith('user-123', 'centre-1');
        expect(db.query.children.findFirst).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });
});
