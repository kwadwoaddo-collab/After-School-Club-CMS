'use server';

import { db } from '@/db';
import { bookingAttendees, bookings, children, sessionCredits, users } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { format } from 'date-fns';
import {
    getAcademicYear,
    getAcademicYearRange,
    deriveLateMinutes,
} from './utils';

// ─── Update attendance with check-in/out times ────────────────────────────────


export interface UpdateAttendanceParams {
    attendeeId: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    absenceReason?: 'illness' | 'holiday' | 'family' | 'other' | null;
    attendanceNote?: string | null;
    sessionTime: string; // slot time e.g. "15:45"
}

export async function updateAttendanceTimelog(params: UpdateAttendanceParams) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const { attendeeId, checkInTime, checkOutTime, absenceReason, attendanceNote, sessionTime } = params;

    // Determine attendance status from the time log
    let attendanceStatus: 'present' | 'absent' | 'late' | null = null;
    let lateMinutes: number | null = null;

    if (checkInTime) {
        lateMinutes = deriveLateMinutes(checkInTime, sessionTime);
        attendanceStatus = lateMinutes !== null ? 'late' : 'present';
    } else if (absenceReason) {
        attendanceStatus = 'absent';
    }

    await db.update(bookingAttendees)
        .set({
            checkInTime: checkInTime ?? null,
            checkOutTime: checkOutTime ?? null,
            absenceReason: absenceReason ?? null,
            attendanceNote: attendanceNote ?? null,
            attendanceStatus: attendanceStatus ?? undefined,
            lateMinutes: lateMinutes ?? null,
            attendanceMarkedAt: new Date(),
            attendanceMarkedBy: session.user.id as string,
            updatedAt: new Date(),
        })
        .where(eq(bookingAttendees.id, attendeeId));

    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/attendance/ledger');
}

// ─── Session Ledger ───────────────────────────────────────────────────────────

export interface StudentLedgerEntry {
    childId: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    schedule: string;
    scheduledAbsences: number;
    extraSessionsAttended: number;
    forgivenSessions: number;
    netBalance: number;
    missedDates: string[];
    extraDates: string[];
    forgivenEntries: Array<{ date: string; amount: number; note: string | null; adminName: string | null }>;
}

export async function getSessionLedger(
    centreId: string,
    academicYear?: string,
): Promise<StudentLedgerEntry[]> {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const year = academicYear ?? getAcademicYear();
    const { start, end } = getAcademicYearRange(year);

    // 1. Fetch all bookings+attendees in range for this centre
    const rawBookings = await db.query.bookings.findMany({
        where: and(
            eq(bookings.centreId, centreId),
            gte(bookings.startAt, start),
            lte(bookings.startAt, end),
        ),
        with: {
            attendees: {
                with: {
                    child: {
                        with: { parent: true },
                    },
                },
            },
        },
    });

    // 2. Collect all child IDs
    const childIds = [
        ...new Set(
            rawBookings.flatMap(b => b.attendees.map(a => a.childId))
        ),
    ];

    // 3. Fetch session credits for these children
    const credits = childIds.length > 0
        ? await db.query.sessionCredits.findMany({
            where: and(
                inArray(sessionCredits.childId, childIds),
                eq(sessionCredits.academicYear, year),
            ),
            with: { admin: true },
        })
        : [];

    // 4. Build per-child ledger
    const ledgerMap = new Map<string, StudentLedgerEntry>();

    for (const booking of rawBookings) {
        for (const att of booking.attendees) {
            const child = att.child;
            if (!child) continue;

            if (!ledgerMap.has(child.id)) {
                const days = new Set<string>();
                (child.registeredSessions || []).forEach(s => {
                    const day = s.split(' ')[0].slice(0, 3);
                    days.add(day);
                });

                ledgerMap.set(child.id, {
                    childId: child.id,
                    firstName: child.firstName,
                    lastName: child.lastName,
                    schoolYear: child.schoolYear,
                    schedule: [...days].join('/') || '—',
                    scheduledAbsences: 0,
                    extraSessionsAttended: 0,
                    forgivenSessions: 0,
                    netBalance: 0,
                    missedDates: [],
                    extraDates: [],
                    forgivenEntries: [],
                });
            }

            const entry = ledgerMap.get(child.id)!;

            if (att.sessionType === 'extra' && att.checkInTime) {
                entry.extraSessionsAttended += 1;
                entry.extraDates.push(format(new Date(booking.startAt), 'yyyy-MM-dd'));
            } else if (att.sessionType === 'scheduled' && att.attendanceStatus === 'absent') {
                entry.scheduledAbsences += 1;
                entry.missedDates.push(format(new Date(booking.startAt), 'yyyy-MM-dd'));
            }
        }
    }

    // 5. Apply credits
    for (const credit of credits) {
        const entry = ledgerMap.get(credit.childId);
        if (!entry) continue;
        entry.forgivenSessions += credit.sessionsAmount;
        entry.forgivenEntries.push({
            date: format(new Date(credit.createdAt), 'yyyy-MM-dd'),
            amount: credit.sessionsAmount,
            note: credit.note,
            adminName: (credit as any).admin
                ? `${(credit as any).admin.firstName || ''} ${(credit as any).admin.lastName || ''}`.trim()
                : null,
        });
    }

    // 6. Calculate net balance
    for (const entry of ledgerMap.values()) {
        entry.netBalance = entry.extraSessionsAttended + entry.forgivenSessions - entry.scheduledAbsences;
    }

    return [...ledgerMap.values()].sort((a, b) => a.netBalance - b.netBalance);
}

// ─── Admin: Forgive sessions ──────────────────────────────────────────────────

export async function forgiveSessionsAction(params: {
    childId: string;
    sessionsAmount: number;
    note: string;
    academicYear?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const role = (session.user as any).role as string;
    if (role !== 'ORG_OWNER' && role !== 'MANAGER') {
        throw new Error('Only managers and owners can forgive sessions');
    }

    const year = params.academicYear ?? getAcademicYear();

    await db.insert(sessionCredits).values({
        childId: params.childId,
        academicYear: year,
        sessionsAmount: params.sessionsAmount,
        adminId: session.user.id as string,
        note: params.note || null,
    });

    revalidatePath('/dashboard/attendance/ledger');
}

// ─── Update child operational flags ──────────────────────────────────────────

export async function updateChildFlags(params: {
    childId: string;
    flagHomework: boolean;
    flagBehaviour: boolean;
    flagNote?: string | null;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    await db.update(children)
        .set({
            flagHomework: params.flagHomework,
            flagBehaviour: params.flagBehaviour,
            flagNote: params.flagNote ?? null,
            updatedAt: new Date(),
        })
        .where(eq(children.id, params.childId));

    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/students');
}
