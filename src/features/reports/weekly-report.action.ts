'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
    organisations, centres, registrations, registrationChildren,
    registrationParents, parents, children, bookings, bookingAttendees,
} from '@/db/schema';
import { eq, and, gte, lte, lt, asc, sql, inArray, count, countDistinct } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { startOfDay, endOfDay, differenceInDays } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyReportData {
    periodLabel: string;
    startDate: string;
    endDate: string;
    orgName: string;
    orgLogoUrl: string | null;
    generatedBy: string;
    generatedAt: string;

    summary: {
        newRegistrations: number;
        newBookings: number;
        sessionsRun: number;
        attendanceRate: number | null;
        pendingRegistrationsThisPeriod: number; // period-scoped, not all-time
        overdueFollowUps: number;               // all-time overdue, labelled clearly
    };

    newRegistrations: {
        childNames: string;     // may be "Alice B, Bob B" for multi-child registrations
        parentName: string;
        parentEmail: string;
        parentPhone: string;
        centre: string;
        startDate: string;
        status: string;
        daysSinceSubmitted: number;
    }[];

    newBookings: {
        childNames: string;   // all children in booking, comma-separated
        parentName: string;
        parentEmail: string;
        centre: string;
        sessionDate: string;
        bookingStatus: string;
        attendance: string;
    }[];

    attendanceByCentre: {
        centreId: string;
        centre: string;
        sessionsRun: number;
        studentsExpected: number;
        studentsAttended: number;
        attendanceRate: number;
    }[];

    pendingActions: {
        type: 'overdue_registration' | 'missed_attendance';
        description: string;
        name: string;
        date: string;
        daysPending: number;
    }[];
}

const STATUS_LABELS: Record<string, string> = {
    awaiting_confirmation: 'Pending Review',
    signed_up: 'Approved',
    cancelled: 'Cancelled',
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
};

// ─────────────────────────────────────────────────────────────────────────────
// Server Action
// ─────────────────────────────────────────────────────────────────────────────

export async function getWeeklyReport(
    startIso: string,
    endIso: string,
): Promise<WeeklyReportData> {

    // ── Auth ─────────────────────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Allowlist roles — new roles must be explicitly granted
    const role = (session.user as any).role as string;
    const allowedRoles = ['ORG_OWNER', 'MANAGER'];
    if (!allowedRoles.includes(role)) throw new Error('Forbidden: insufficient permissions');

    const orgId = session.user.organisationId;
    const generatedBy = (session.user as any).name ?? session.user.email ?? 'Unknown';

    // ── Validate date range ───────────────────────────────────────────────────
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid date range');
    if (end < start) throw new Error('End date must be after start date');
    const maxRange = 90 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) throw new Error('Date range cannot exceed 90 days');

    const periodStart = startOfDay(start);
    const periodEnd = endOfDay(end);
    const now = new Date();
    // 2-hour grace period: only flag sessions that ended more than 2 hours ago
    const missedCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    // Overdue registration threshold: 3 days
    const overdueCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // ── Fetch accessible centres ──────────────────────────────────────────────
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (accessibleCentreIds.length === 0) throw new Error('No accessible centres');

    // ── Fetch org info ────────────────────────────────────────────────────────
    const [org] = await db
        .select({ name: organisations.name, logoUrl: organisations.logoUrl })
        .from(organisations)
        .where(eq(organisations.id, orgId))
        .limit(1);

    // ─────────────────────────────────────────────────────────────────────────
    // All queries run in parallel
    // ─────────────────────────────────────────────────────────────────────────
    const [
        newRegsRaw,
        newBookingsRaw,
        attendanceRaw,
        pendingRegsRaw,
        missedAttendanceRaw,
        summaryPending,
    ] = await Promise.all([

        // ── 1. New registrations — grouped by registration, children aggregated
        // Correct join path: registrations → registrationChildren (names)
        //                    registrations → registrationParents (snapshot contact info)
        db.select({
            regId: registrations.id,
            status: registrations.status,
            startDate: registrations.startDate,
            submittedAt: registrations.submittedAt,
            createdAt: registrations.createdAt,
            centreName: centres.name,
            childFirst: registrationChildren.submittedFirstName,
            childLast: registrationChildren.submittedLastName,
            parentFirst: registrationParents.submittedFirstName,
            parentLast: registrationParents.submittedLastName,
            parentEmail: registrationParents.submittedEmail,
            parentPhone: registrationParents.submittedPhone,
        })
        .from(registrations)
        .innerJoin(registrationChildren, eq(registrationChildren.registrationId, registrations.id))
        .leftJoin(
            registrationParents,
            and(
                eq(registrationParents.registrationId, registrations.id),
                eq(registrationParents.isPrimary, true),
            ),
        )
        .leftJoin(
            centres,
            and(
                eq(centres.id, registrations.centreId),
                eq(centres.organisationId, orgId), // hard org gate
            ),
        )
        .where(and(
            eq(registrations.organisationId, orgId),
            inArray(registrations.centreId, accessibleCentreIds),
            gte(registrations.createdAt, periodStart),
            lte(registrations.createdAt, periodEnd),
        ))
        .orderBy(asc(registrations.createdAt)),

        // ── 2. New bookings created in period
        // Hard org gate via centres join; use alias() for parents to maintain type-safety + org gate
        (() => {
            const parentAlias = alias(parents, 'booking_parent');
            return db.select({
                bookingId: bookings.id,
                startAt: bookings.startAt,
                status: bookings.status,
                centreName: centres.name,
                childFirst: children.firstName,
                childLast: children.lastName,
                parentFirst: parentAlias.firstName,
                parentLast: parentAlias.lastName,
                parentEmail: parentAlias.email,
                attendanceStatus: bookingAttendees.attendanceStatus,
            })
            .from(bookings)
            .innerJoin(
                centres,
                and(
                    eq(centres.id, bookings.centreId),
                    eq(centres.organisationId, orgId), // hard org gate
                ),
            )
            .innerJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
            .innerJoin(children, eq(children.id, bookingAttendees.childId))
            .leftJoin(
                parentAlias,
                and(
                    eq(parentAlias.id, children.parentId),
                    eq(parentAlias.organisationId, orgId), // hard org gate on parents
                ),
            )
            .where(and(
                inArray(bookings.centreId, accessibleCentreIds),
                gte(bookings.createdAt, periodStart),
                lte(bookings.createdAt, periodEnd),
            ))
            .orderBy(asc(bookings.startAt));
        })(),

        // ── 3. Attendance by centre (sessions that ran in period)
        // Grouped by centreId + name to avoid name-collision merge
        db.select({
            centreId: centres.id,
            centreName: centres.name,
            sessionsRun: countDistinct(bookings.id),
            studentsExpected: count(bookingAttendees.id),
            studentsAttended: sql<number>`count(${bookingAttendees.id}) filter (where ${bookingAttendees.attendanceStatus} = 'present')::int`,
        })
        .from(bookings)
        .innerJoin(
            centres,
            and(
                eq(centres.id, bookings.centreId),
                eq(centres.organisationId, orgId), // hard org gate
            ),
        )
        .innerJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
        .where(and(
            inArray(bookings.centreId, accessibleCentreIds),
            gte(bookings.startAt, periodStart),
            lte(bookings.startAt, periodEnd),
            eq(bookings.status, 'confirmed'),
        ))
        .groupBy(centres.id, centres.name) // group by PK to avoid name collisions
        .orderBy(asc(centres.name)),

        // ── 4. Overdue pending registrations (all-time backlog > 3 days)
        db.select({
            regId: registrations.id,
            createdAt: registrations.createdAt,
            submittedAt: registrations.submittedAt,
            childFirst: registrationChildren.submittedFirstName,
            childLast: registrationChildren.submittedLastName,
            centreName: centres.name,
        })
        .from(registrations)
        .innerJoin(registrationChildren, eq(registrationChildren.registrationId, registrations.id))
        .leftJoin(
            centres,
            and(eq(centres.id, registrations.centreId), eq(centres.organisationId, orgId)),
        )
        .where(and(
            eq(registrations.organisationId, orgId),
            inArray(registrations.centreId, accessibleCentreIds),
            eq(registrations.status, 'awaiting_confirmation'),
            lte(registrations.createdAt, overdueCutoff),
        ))
        .orderBy(asc(registrations.createdAt)),

        // ── 5. Past sessions with no attendance recorded (with 2h grace period)
        // Scoped to last 30 days of open issues, not the selected period
        db.select({
            bookingId: bookings.id,
            startAt: bookings.startAt,
            centreName: centres.name,
            childFirst: children.firstName,
            childLast: children.lastName,
        })
        .from(bookings)
        .innerJoin(
            centres,
            and(
                eq(centres.id, bookings.centreId),
                eq(centres.organisationId, orgId), // hard org gate
            ),
        )
        .innerJoin(bookingAttendees, eq(bookingAttendees.bookingId, bookings.id))
        .innerJoin(children, eq(children.id, bookingAttendees.childId))
        .where(and(
            inArray(bookings.centreId, accessibleCentreIds),
            eq(bookings.status, 'confirmed'),
            gte(bookings.startAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), // last 30 days of open issues
            lt(bookings.startAt, missedCutoff), // 2h grace period
            sql`${bookingAttendees.attendanceStatus} is null`,
        ))
        .orderBy(asc(bookings.startAt)),

        // ── 6. Summary: pending registrations — period-scoped
        db.select({ count: countDistinct(registrations.id) })
        .from(registrations)
        .where(and(
            eq(registrations.organisationId, orgId),
            inArray(registrations.centreId, accessibleCentreIds),
            eq(registrations.status, 'awaiting_confirmation'),
            gte(registrations.createdAt, periodStart),
            lte(registrations.createdAt, periodEnd),
        )),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Shape: New Registrations — deduplicate multi-child registrations
    // ─────────────────────────────────────────────────────────────────────────
    const regMap = new Map<string, {
        childNames: string[];
        parentName: string;
        parentEmail: string;
        parentPhone: string;
        centre: string;
        startDate: string;
        status: string;
        submittedAt: Date | null;
        createdAt: Date;
    }>();

    for (const r of newRegsRaw) {
        const childName = `${r.childFirst} ${r.childLast}`.trim();
        if (regMap.has(r.regId)) {
            regMap.get(r.regId)!.childNames.push(childName);
        } else {
            regMap.set(r.regId, {
                childNames: [childName],
                parentName: `${r.parentFirst ?? ''} ${r.parentLast ?? ''}`.trim() || '—',
                parentEmail: r.parentEmail ?? '—',
                parentPhone: r.parentPhone ?? '—',
                centre: r.centreName ?? '—',
                startDate: r.startDate
                    ? new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'TBD',
                status: STATUS_LABELS[r.status] ?? r.status,
                submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
                createdAt: new Date(r.createdAt),
            });
        }
    }

    const newRegistrations = Array.from(regMap.values()).map(r => ({
        childNames: r.childNames.join(', '),
        parentName: r.parentName,
        parentEmail: r.parentEmail,
        parentPhone: r.parentPhone,
        centre: r.centre,
        startDate: r.startDate,
        status: r.status,
        // Use submittedAt preferentially, fall back to createdAt
        daysSinceSubmitted: differenceInDays(now, r.submittedAt ?? r.createdAt),
    }));

    // ─────────────────────────────────────────────────────────────────────────
    // Shape: New Bookings — aggregate all attendees per booking via Map
    // Attendee join causes fan-out; group so all child names appear in one row
    // ─────────────────────────────────────────────────────────────────────────
    const bookingMap = new Map<string, {
        childNames: string[];
        parentName: string;
        parentEmail: string;
        centre: string;
        startAt: Date | null;
        status: string;
        attendanceStatuses: (string | null)[];
    }>();

    for (const b of newBookingsRaw) {
        const childName = `${b.childFirst} ${b.childLast}`.trim();
        if (bookingMap.has(b.bookingId)) {
            const entry = bookingMap.get(b.bookingId)!;
            entry.childNames.push(childName);
            entry.attendanceStatuses.push(b.attendanceStatus);
        } else {
            bookingMap.set(b.bookingId, {
                childNames: [childName],
                parentName: `${b.parentFirst ?? ''} ${b.parentLast ?? ''}`.trim() || '—',
                parentEmail: b.parentEmail ?? '—',
                centre: b.centreName,
                startAt: b.startAt ? new Date(b.startAt) : null,
                status: b.status,
                attendanceStatuses: [b.attendanceStatus],
            });
        }
    }

    const newBookings = Array.from(bookingMap.values()).map(b => {
        // Summarise attendance across all children in the booking
        const total = b.attendanceStatuses.length;
        const present = b.attendanceStatuses.filter(s => s === 'present').length;
        const absent = b.attendanceStatuses.filter(s => s === 'absent').length;
        const attendance = total === 0 ? '— Pending'
            : present === total ? '✓ All Present'
            : absent === total ? '✗ All Absent'
            : `${present}/${total} Present`;
        return {
            childNames: b.childNames.join(', '),
            parentName: b.parentName,
            parentEmail: b.parentEmail,
            centre: b.centre,
            sessionDate: b.startAt
                ? b.startAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                : '—',
            bookingStatus: STATUS_LABELS[b.status] ?? b.status,
            attendance,
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Shape: Attendance by centre (grouped by id+name — no collision risk)
    // ─────────────────────────────────────────────────────────────────────────
    const attendanceByCentre = attendanceRaw.map(a => {
        const expected = Number(a.studentsExpected);
        const attended = Number(a.studentsAttended);
        return {
            centreId: a.centreId,
            centre: a.centreName,
            sessionsRun: Number(a.sessionsRun),
            studentsExpected: expected,
            studentsAttended: attended,
            attendanceRate: expected > 0 ? Math.round((attended / expected) * 100) : 0,
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Shape: Pending Actions
    // ─────────────────────────────────────────────────────────────────────────

    // Aggregate pending registrations by regId — show all children, not just first
    const pendingRegMap = new Map<string, {
        childNames: string[];
        centreName: string;
        createdAt: Date;
        submittedAt: Date | null;
    }>();
    for (const r of pendingRegsRaw) {
        const childName = `${r.childFirst} ${r.childLast}`.trim();
        if (pendingRegMap.has(r.regId)) {
            pendingRegMap.get(r.regId)!.childNames.push(childName);
        } else {
            pendingRegMap.set(r.regId, {
                childNames: [childName],
                centreName: r.centreName ?? 'Unknown centre',
                createdAt: new Date(r.createdAt),
                submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
            });
        }
    }

    const pendingActions: WeeklyReportData['pendingActions'] = [
        ...Array.from(pendingRegMap.values()).map(r => ({
            type: 'overdue_registration' as const,
            description: `Registration at ${r.centreName} — awaiting staff review`,
            name: r.childNames.join(', '),
            date: r.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            daysPending: differenceInDays(now, r.submittedAt ?? r.createdAt),
        })),
        // Deduplicate missed attendance by bookingId — group booking with 3 children
        // should appear once in the list, not 3 times
        ...(() => {
            const missedMap = new Map<string, { childNames: string[]; centreName: string; startAt: Date }>();
            for (const b of missedAttendanceRaw) {
                const name = `${b.childFirst} ${b.childLast}`.trim();
                if (missedMap.has(b.bookingId)) {
                    missedMap.get(b.bookingId)!.childNames.push(name);
                } else {
                    missedMap.set(b.bookingId, {
                        childNames: [name],
                        centreName: b.centreName,
                        startAt: new Date(b.startAt),
                    });
                }
            }
            return Array.from(missedMap.values()).map(b => ({
                type: 'missed_attendance' as const,
                description: `Session at ${b.centreName} — no attendance recorded`,
                name: b.childNames.join(', '),
                date: b.startAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                daysPending: differenceInDays(now, b.startAt),
            }));
        })(),
    ].sort((a, b) => b.daysPending - a.daysPending);

    // ─────────────────────────────────────────────────────────────────────────
    // Shape: Summary — derive attendance rate from per-centre totals (consistent)
    // ─────────────────────────────────────────────────────────────────────────
    // Derive sessionsRun from attendanceByCentre sum — guarantees summary card
    // matches the per-centre table totals (Query 6 removed; no divergence possible)
    const totalExpected = attendanceByCentre.reduce((s, c) => s + c.studentsExpected, 0);
    const totalAttended = attendanceByCentre.reduce((s, c) => s + c.studentsAttended, 0);
    const totalSessionsRun = attendanceByCentre.reduce((s, c) => s + c.sessionsRun, 0);

    const summary: WeeklyReportData['summary'] = {
        newRegistrations: newRegistrations.length,
        newBookings: newBookings.length,
        sessionsRun: totalSessionsRun,  // consistent with per-centre table
        attendanceRate: totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : null,
        pendingRegistrationsThisPeriod: Number(summaryPending[0]?.count ?? 0),
        overdueFollowUps: pendingRegMap.size,
    };

    return {
        periodLabel: `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        startDate: startIso,
        endDate: endIso,
        orgName: org?.name ?? 'Organisation',
        orgLogoUrl: org?.logoUrl ?? null,
        generatedBy,
        generatedAt: now.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }),
        summary,
        newRegistrations,
        newBookings,
        attendanceByCentre,
        pendingActions,
    };
}
