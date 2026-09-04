import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    updateAttendanceTimelog,
    getSessionLedger,
    forgiveSessionsAction,
    updateChildFlags,
} from './actions';
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

vi.mock('@/db', () => ({
    db: {
        query: {
            bookingAttendees: {
                findFirst: vi.fn(),
            },
            children: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
            },
            bookings: {
                findMany: vi.fn(),
            },
            sessionCredits: {
                findMany: vi.fn(),
            },
        },
        update: vi.fn(),
        insert: vi.fn(),
    },
}));

const mockSession = {
    user: { id: 'user-123', organisationId: 'org-456', role: 'MANAGER' },
    expires: '9999-12-31T23:59:59.999Z',
};

describe('updateAttendanceTimelog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (canUserAccessCentre as any).mockResolvedValue(true);
    });

    const baseParams = {
        attendeeId: 'attendee-1',
        checkInTime: '15:45',
        dateStr: '2026-08-24',
        sessionTime: '15:45',
    };

    it('throws error if user is not authenticated', async () => {
        (auth as any).mockResolvedValueOnce(null);

        // PM-1.2: requireTenantSession redirects unauthenticated callers
        await expect(updateAttendanceTimelog(baseParams)).rejects.toThrow('REDIRECT:/login');
    });

    it('throws error if user has no organisation', async () => {
        (auth as any).mockResolvedValueOnce({ user: { id: 'user-1' } });

        // PM-1.2: requireTenantSession redirects users with no org to onboarding
        await expect(updateAttendanceTimelog(baseParams)).rejects.toThrow('REDIRECT:/onboarding');
    });

    // Milestone 3F — regression test: previously this action performed no
    // organisation/centre ownership check at all on the client-supplied
    // attendeeId, allowing any authenticated user to mutate any org's
    // bookingAttendees row by ID.
    it('throws error if the attendee record does not exist', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookingAttendees.findFirst as any).mockResolvedValueOnce(null);

        await expect(updateAttendanceTimelog(baseParams)).rejects.toThrow('Attendance record not found or unauthorized');
        expect(db.update).not.toHaveBeenCalled();
    });

    it('throws error if the attendee belongs to a different organisation', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookingAttendees.findFirst as any).mockResolvedValueOnce({
            id: 'attendee-1',
            booking: { centreId: 'centre-1', centre: { organisationId: 'other-org' } },
        });

        await expect(updateAttendanceTimelog(baseParams)).rejects.toThrow('Attendance record not found or unauthorized');
        expect(db.update).not.toHaveBeenCalled();
    });

    it('throws error if user cannot access the attendee\'s centre (same org, different centre)', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookingAttendees.findFirst as any).mockResolvedValueOnce({
            id: 'attendee-1',
            booking: { centreId: 'centre-other', centre: { id: 'centre-other', organisationId: 'org-456' } },
        });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(updateAttendanceTimelog(baseParams)).rejects.toThrow('Attendance record not found or unauthorized');
        expect(canUserAccessCentre).toHaveBeenCalledWith('user-123', 'centre-other');
        expect(db.update).not.toHaveBeenCalled();
    });

    it('updates the attendance record when ownership checks pass', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.bookingAttendees.findFirst as any).mockResolvedValueOnce({
            id: 'attendee-1',
            booking: { centreId: 'centre-1', centre: { id: 'centre-1', organisationId: 'org-456' } },
        });

        const mockSet = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        (db.update as any).mockReturnValue({ set: mockSet, where: mockWhere });

        await updateAttendanceTimelog(baseParams);

        expect(db.update).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            attendanceMarkedBy: 'user-123',
        }));
    });
});

describe('getSessionLedger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (canUserAccessCentre as any).mockResolvedValue(true);
        (db.query.children.findMany as any).mockResolvedValue([]);
        (db.query.bookings.findMany as any).mockResolvedValue([]);
        (db.query.sessionCredits.findMany as any).mockResolvedValue([]);
    });

    it('throws error if user is not authenticated', async () => {
        (auth as any).mockResolvedValueOnce(null);

        // PM-1.2: requireTenantSession redirects unauthenticated callers
        await expect(getSessionLedger('centre-1')).rejects.toThrow('REDIRECT:/login');
    });

    // Milestone 3F — regression test: previously the centreId parameter was
    // trusted blindly, so any authenticated org member could read another
    // centre's (still same-org) session ledger by passing its ID directly.
    it('throws error if user cannot access the requested centre', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(getSessionLedger('centre-other')).rejects.toThrow('Centre not found or unauthorized');
        expect(canUserAccessCentre).toHaveBeenCalledWith('user-123', 'centre-other');
        expect(db.query.children.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty ledger when the centre has no children', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);

        const result = await getSessionLedger('centre-1');

        expect(result).toEqual([]);
    });
});

describe('forgiveSessionsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (canUserAccessCentre as any).mockResolvedValue(true);
    });

    const baseParams = { childId: 'child-1', sessionsAmount: 1, note: 'catch-up' };

    it('throws error if user is not authenticated', async () => {
        (auth as any).mockResolvedValueOnce(null);

        // PM-1.2: requireTenantSession redirects unauthenticated callers
        await expect(forgiveSessionsAction(baseParams)).rejects.toThrow('REDIRECT:/login');
    });

    it('throws error if role is not ORG_OWNER or MANAGER', async () => {
        (auth as any).mockResolvedValueOnce({ user: { id: 'user-1', organisationId: 'org-456', role: 'TUTOR' } });

        await expect(forgiveSessionsAction(baseParams)).rejects.toThrow('Only managers and owners can forgive sessions');
        expect(db.insert).not.toHaveBeenCalled();
    });

    // Milestone 3F — regression test: the role gate was correct, but the
    // childId was never verified against the caller's organisation, so a
    // MANAGER could grant a session credit to a child in a different org.
    it('throws error if the child does not belong to the caller\'s organisation', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'other-org', centreId: 'centre-1' });

        await expect(forgiveSessionsAction(baseParams)).rejects.toThrow('Child not found or unauthorized');
        expect(db.insert).not.toHaveBeenCalled();
    });

    it('throws error if user cannot access the child\'s centre', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'org-456', centreId: 'centre-other' });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(forgiveSessionsAction(baseParams)).rejects.toThrow('Child not found or unauthorized');
        expect(db.insert).not.toHaveBeenCalled();
    });

    it('grants the credit when authorization checks pass', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'org-456', centreId: 'centre-1' });

        const mockValues = vi.fn().mockResolvedValueOnce(undefined);
        (db.insert as any).mockReturnValue({ values: mockValues });

        await forgiveSessionsAction(baseParams);

        expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
            childId: 'child-1',
            adminId: 'user-123',
        }));
    });
});

describe('updateChildFlags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (canUserAccessCentre as any).mockResolvedValue(true);
    });

    const baseParams = { childId: 'child-1', flagHomework: true, flagBehaviour: false };

    it('throws error if user is not authenticated', async () => {
        (auth as any).mockResolvedValueOnce(null);

        // PM-1.2: requireTenantSession redirects unauthenticated callers
        await expect(updateChildFlags(baseParams)).rejects.toThrow('REDIRECT:/login');
    });

    // Milestone 3F — regression test: previously this action had no
    // organisation or centre check at all on the client-supplied childId.
    it('throws error if the child does not belong to the caller\'s organisation', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'other-org', centreId: 'centre-1' });

        await expect(updateChildFlags(baseParams)).rejects.toThrow('Child not found or unauthorized');
        expect(db.update).not.toHaveBeenCalled();
    });

    it('throws error if user cannot access the child\'s centre', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'org-456', centreId: 'centre-other' });
        (canUserAccessCentre as any).mockResolvedValueOnce(false);

        await expect(updateChildFlags(baseParams)).rejects.toThrow('Child not found or unauthorized');
        expect(db.update).not.toHaveBeenCalled();
    });

    it('updates flags when authorization checks pass', async () => {
        (auth as any).mockResolvedValueOnce(mockSession);
        (db.query.children.findFirst as any).mockResolvedValueOnce({ id: 'child-1', organisationId: 'org-456', centreId: 'centre-1' });

        const mockSet = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockResolvedValueOnce({ rowCount: 1 });
        (db.update as any).mockReturnValue({ set: mockSet, where: mockWhere });

        await updateChildFlags(baseParams);

        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            flagHomework: true,
            flagBehaviour: false,
        }));
    });
});
