'use server';

import { db } from '@/db';
import { bookingAttendees, bookings, children, parents, sessionCredits, users } from '@/db/schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { format } from 'date-fns';

// ─── Academic year helpers ────────────────────────────────────────────────────

/** Returns the academic year string for a given date, e.g. "2025-26" */
export function getAcademicYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    // Academic year starts September (month 8)
    if (month >= 8) {
        return `${year}-${String(year + 1).slice(2)}`;
    }
    return `${year - 1}-${String(year).slice(2)}`;
}

/** Returns the start and end Date for an academic year string "2025-26" */
export function getAcademicYearRange(academicYear: string): { start: Date; end: Date } {
    const startYear = parseInt(academicYear.split('-')[0]);
    return {
        start: new Date(startYear, 8, 1),         // Sep 1
        end: new Date(startYear + 1, 6, 31, 23, 59, 59), // Jul 31
    };
}

// ─── Session type detection ───────────────────────────────────────────────────

/** Returns true if the given date falls within the child's registered schedule */
export function isScheduledDay(registeredSessions: string[] | null | undefined, date: Date): boolean {
    if (!registeredSessions || registeredSessions.length === 0) return false;
    const dayName = format(date, 'EEEE'); // "Monday", "Tuesday", etc.
    return registeredSessions.some(s => s.startsWith(dayName));
}

/** Auto-detects session type from the child's schedule and the date */
export function deriveSessionType(
    registeredSessions: string[] | null | undefined,
    date: Date,
): 'scheduled' | 'extra' {
    return isScheduledDay(registeredSessions, date) ? 'scheduled' : 'extra';
}

/** Derives lateness in minutes. Returns null if not late (within 10-min grace). */
export function deriveLateMinutes(checkInTime: string, slotTime: string): number | null {
    const [ih, im] = checkInTime.split(':').map(Number);
    const [sh, sm] = slotTime.split(':').map(Number);
    const inMins = ih * 60 + im;
    const slotMins = sh * 60 + sm;
    const diff = inMins - slotMins;
    return diff > 10 ? diff : null; // 10-minute grace period
}

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
    schedule: string;          // e.g. "Mon/Wed/Fri"
    scheduledAbsences: number;
    extraSessionsAttended: number;
    forgivenSessions: number;
    netBalance: number;        // positive = ahead, negative = in arrears
    missedDates: string[];     // ISO dates of unexcused absences
    extraDates: string[];      // ISO dates of extra sessions
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

    // 2. Fetch all session credits for this centre's children in this year
    const childIds = [
        ...new Set(
            rawBookings.flatMap(b => b.attendees.map(a => a.childId))
        ),
    ];

    const credits = childIds.length > 0
        ? await db.query.sessionCredits.findMany({
            where: and(
                inArray(sessionCredits.childId, childIds),
                eq(sessionCredits.academicYear, year),
            ),
            with: { admin: true },
        })
        : [];

    // 3. Build per-child ledger
    const ledgerMap = new Map<string, StudentLedgerEntry>();

    for (const booking of rawBookings) {
        for (const att of booking.attendees) {
            const child = att.child;
            if (!child) continue;

            if (!ledgerMap.has(child.id)) {
                // Build a readable schedule string from registeredSessions
                const days = new Set<string>();
                (child.registeredSessions || []).forEach(s => {
                    const day = s.split(' ')[0].slice(0, 3); // "Mon", "Tue", etc.
                    days.add(day);
                });
                const schedule = [...days].join('/') || '—';

                ledgerMap.set(child.id, {
                    childId: child.id,
                    firstName: child.firstName,
                    lastName: child.lastName,
                    schoolYear: child.schoolYear,
                    schedule,
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
                // Extra session attended
                entry.extraSessionsAttended += 1;
                entry.extraDates.push(format(new Date(booking.startAt), 'yyyy-MM-dd'));
            } else if (att.sessionType === 'scheduled' && att.attendanceStatus === 'absent') {
                // Scheduled session missed
                entry.scheduledAbsences += 1;
                entry.missedDates.push(format(new Date(booking.startAt), 'yyyy-MM-dd'));
            }
        }
    }

    // 4. Apply credits (forgiven sessions)
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

    // 5. Calculate net balance
    for (const entry of ledgerMap.values()) {
        entry.netBalance = entry.extraSessionsAttended + entry.forgivenSessions - entry.scheduledAbsences;
    }

    return [...ledgerMap.values()].sort((a, b) =>
        a.netBalance - b.netBalance // most in arrears first
    );
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
