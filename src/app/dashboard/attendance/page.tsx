import { studentLifecycleStatusSql } from '@/features/students/lifecycle-queries';
import { expectedRosterIds } from '@/features/students/expected-roster';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { authorisedCollectors, bookings, children, studentNotes } from '@/db/schema';
import { eq, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, addDays, subDays, format } from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users, CheckCircle2, CalendarCheck, Download, AlertTriangle, Building2 } from 'lucide-react';
import AttendanceRollCall, { type AuthorisedCollectorSummary, type MedicalNoteSummary } from './AttendanceRollCall';
import { compileDailyRegisterSlots } from '@/lib/attendance';
import { logger } from '@/lib/logger';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AttendancePage(props: {
    searchParams: Promise<{ date?: string; centre?: string }>;
}) {
    const rawParams = await props.searchParams;
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) redirect('/login');
    const canExportCsv = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(session.user.role ?? '');
    let targetDate = new Date();
    if (rawParams.date) {
        const parsed = new Date(rawParams.date);
        if (!isNaN(parsed.getTime())) {
            targetDate = parsed;
        }
    }
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);
    const prevDay = format(subDays(targetDate, 1), 'yyyy-MM-dd');
    const nextDay = format(addDays(targetDate, 1), 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const targetStr = enrolmentBusinessDate(targetDate);
    const isToday = targetStr === todayStr;

    let hasError = false;
    let orgCentres: any[] = [];
    let centreIds: string[] = [];
    let activeCentreId = 'all';
    let isZeroCentreStaff = false;
    let hasQueryableScope = false;
    let allChildrenAtCentre: any[] = [];
    let dayBookings: any[] = [];

    try {
        orgCentres = await getUserAccessibleCentres(session.user.id);
        centreIds = orgCentres.map(c => c.id);
        isZeroCentreStaff = session.user.role !== 'ORG_OWNER' && centreIds.length === 0;
        const resolvedCentreId = await resolveActiveCentreId(rawParams.centre, centreIds);
        activeCentreId = isZeroCentreStaff ? 'all' : resolvedCentreId;
        hasQueryableScope = !isZeroCentreStaff && (activeCentreId !== 'all' || centreIds.length > 0);

        // Zero-centre short-circuit: never pass empty arrays or invalid 'no-centre' UUIDs to Postgres.
        if (hasQueryableScope) {
            const centreFilter = activeCentreId !== 'all'
                ? eq(bookings.centreId, activeCentreId)
                : inArray(bookings.centreId, centreIds);

            const centreChildrenCondition = activeCentreId !== 'all'
                ? eq(children.centreId, activeCentreId)
                : inArray(children.centreId, centreIds);

            [allChildrenAtCentre, dayBookings] = await Promise.all([
                db.query.children.findMany({
                    where: and(centreChildrenCondition, eq(children.isRegistered, true), isNull(children.deletedAt)),
                    with: { parent: true, centre: true },
                    extras: { effectiveEnrolmentStatus: studentLifecycleStatusSql(targetStr).as('effective_enrolment_status') },
                }),
                db.query.bookings.findMany({
                    where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
                    with: { parent: true, centre: true, attendees: { with: { child: true } } },
                }),
            ]);
        }
    } catch (e) {
        logger.error("Error fetching attendance", e);
        hasError = true;
    }

    const activeOrPausedChildrenAtCentre = allChildrenAtCentre.filter(
        c => (c.effectiveEnrolmentStatus ?? c.lifecycleStatus ?? 'active') !== 'stopped'
    );
    const expectedIds = expectedRosterIds(activeOrPausedChildrenAtCentre);

    const rawSlots = hasQueryableScope
        ? compileDailyRegisterSlots({
            targetDate,
            allChildrenAtCentre: activeOrPausedChildrenAtCentre,
            expectedChildIds: expectedIds,
            dayBookings,
        })
        : [];

    // Index child health/flag fields for listed attendees
    const childById = new Map<string, any>();
    for (const child of allChildrenAtCentre) {
        if (child?.id) childById.set(child.id, child);
    }
    for (const booking of dayBookings) {
        for (const att of booking?.attendees ?? []) {
            if (att?.child?.id && !childById.has(att.child.id)) {
                childById.set(att.child.id, att.child);
            }
        }
    }

    const listedChildIds = Array.from(
        new Set(
            rawSlots.flatMap(slot =>
                [...slot.regulars, ...slot.catchups].map(a => a.childId).filter(Boolean)
            )
        )
    );

    const medicalNotesByChild = new Map<string, MedicalNoteSummary[]>();
    const collectorsByChild = new Map<string, AuthorisedCollectorSummary[]>();

    if (hasQueryableScope && listedChildIds.length > 0) {
        try {
            // Strictly query ONLY non-safeguarding Medical notes — NEVER query or expose safeguarding rows.
            const safeguardColumn = (studentNotes as Record<string, any>).isSafeguarding;
            const medicalWhere = safeguardColumn
                ? and(
                    inArray(studentNotes.childId, listedChildIds),
                    eq(studentNotes.category, 'Medical'),
                    eq(safeguardColumn, false),
                )
                : and(
                    inArray(studentNotes.childId, listedChildIds),
                    eq(studentNotes.category, 'Medical'),
                );

            const [rawMedicalNotes, rawCollectors] = await Promise.all([
                db.query.studentNotes
                    ? db.query.studentNotes.findMany({
                        where: medicalWhere,
                        orderBy: (notes, { desc }) => [desc(notes.createdAt)],
                    })
                    : Promise.resolve([]),
                db.query.authorisedCollectors
                    ? db.query.authorisedCollectors.findMany({
                        where: and(
                            inArray(authorisedCollectors.childId, listedChildIds),
                            eq(authorisedCollectors.organisationId, session.user.organisationId),
                        ),
                    })
                    : Promise.resolve([]),
            ]);

            for (const note of rawMedicalNotes as any[]) {
                if (note.category !== 'Medical' || note.isSafeguarding === true) continue;
                const list = medicalNotesByChild.get(note.childId) ?? [];
                list.push({
                    id: note.id,
                    content: note.content,
                    authorName: note.authorName,
                    createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
                });
                medicalNotesByChild.set(note.childId, list);
            }

            for (const col of rawCollectors as any[]) {
                const list = collectorsByChild.get(col.childId) ?? [];
                list.push({
                    id: col.id,
                    name: col.name,
                    relationship: col.relationship,
                    phone: col.phone ?? null,
                    collectionPassword: col.collectionPassword ?? null,
                });
                collectorsByChild.set(col.childId, list);
            }
        } catch (e) {
            logger.error("Error fetching attendance medical notes or authorised collectors", e);
        }
    }

    const enrichAttendee = (att: any) => {
        const childRecord = childById.get(att.childId);
        const allergies = Array.isArray(childRecord?.allergies)
            ? childRecord.allergies.map((a: string) => a?.trim()).filter(Boolean)
            : [];
        return {
            ...att,
            flagHomework: Boolean(childRecord?.flagHomework ?? att.flagHomework),
            flagBehaviour: Boolean(childRecord?.flagBehaviour ?? att.flagBehaviour),
            flagNote: childRecord?.flagNote ?? att.flagNote ?? null,
            notes: childRecord?.notes?.trim() || att.notes?.trim() || null,
            allergies,
            dietaryRequirements: childRecord?.dietaryRequirements?.trim() || null,
            medicalConditions: childRecord?.medicalConditions?.trim() || null,
            medicationNotes: childRecord?.medicationNotes?.trim() || null,
            medicalNotes: medicalNotesByChild.get(att.childId) ?? [],
            authorisedCollectors: collectorsByChild.get(att.childId) ?? [],
        };
    };

    const sortedSlots = rawSlots.map(slot => ({
        ...slot,
        regulars: slot.regulars.map(enrichAttendee),
        catchups: slot.catchups.map(enrichAttendee),
    }));

    // Stats calculations
    let totalStudents = 0;
    let marked = 0;
    let present = 0;
    let absent = 0;

    for (const slot of sortedSlots) {
        for (const child of [...slot.regulars, ...slot.catchups]) {
            totalStudents++;
            if (child.attendanceStatus !== null) {
                marked++;
                if (child.attendanceStatus === 'present') present++;
                else if (child.attendanceStatus === 'absent' || child.attendanceStatus === 'no_show') absent++;
            }
        }
    }

    const attendanceRate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;
    const activeCentreName = activeCentreId !== 'all'
        ? orgCentres.find(c => c.id === activeCentreId)?.name ?? null
        : orgCentres.length === 1
            ? orgCentres[0].name
            : null;

    if (isZeroCentreStaff) {
        return (
            <div className="space-y-6">
                <HeaderPortal targetId="header-left">
                    <h1 className="text-page-title text-text">Attendance</h1>
                </HeaderPortal>
                <EmptyState
                    icon={<Building2 className="w-7 h-7" />}
                    title="No centres assigned"
                    description="You do not currently have access to any centres. Ask an organisation owner or manager to assign your centre membership."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-page-title text-text">Attendance</h1>
                    {activeCentreName && (
                        <Badge variant="info">
                            <Building2 className="w-3 h-3" />
                            {activeCentreName}
                        </Badge>
                    )}
                </div>
            </HeaderPortal>

            {(!isToday || canExportCsv) && (
                <HeaderPortal targetId="header-right-actions">
                    {!isToday && (
                        <Button variant="outline" asChild>
                            <Link href={activeCentreId !== 'all' ? `/dashboard/attendance?centre=${activeCentreId}` : '/dashboard/attendance'}>
                                <CalendarCheck className="w-3.5 h-3.5" />
                                Go to Today
                            </Link>
                        </Button>
                    )}
                    {canExportCsv && (
                        <Button variant="outline" asChild>
                            <a
                                href={`/api/export/register?date=${targetStr}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`}
                                download={`register-${targetStr}.csv`}
                                title={`Download register for ${format(targetDate, 'd MMM yyyy')} as CSV`}
                            >
                                <Download className="w-3.5 h-3.5" />
                                Export CSV
                            </a>
                        </Button>
                    )}
                </HeaderPortal>
            )}

            {/* Date navigation */}
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/dashboard/attendance?date=${prevDay}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`} aria-label="Previous day">
                        <ChevronLeft className="w-4 h-4" />
                    </Link>
                </Button>
                <div className="px-4 py-2 rounded-md bg-surface border border-border">
                    <p className="text-text font-medium text-sm">
                        {format(targetDate, 'EEEE, d MMM yyyy')}
                        {isToday && <span className="ml-2 text-accent text-xs font-semibold uppercase tracking-wider">Today</span>}
                    </p>
                </div>
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/dashboard/attendance?date=${nextDay}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`} aria-label="Next day">
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                    { label: 'Booked sessions', value: dayBookings.length, color: 'text-accent', icon: <CalendarCheck className="w-4 h-4" />, iconBg: 'bg-accent-soft' },
                    { label: 'Expected register entries', value: totalStudents, color: 'text-text', icon: <Users className="w-4 h-4" />, iconBg: 'bg-page' },
                    { label: 'Present', value: present, color: 'text-emerald-700 dark:text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" />, iconBg: 'bg-success-soft' },
                    { label: 'Absent', value: absent, color: 'text-danger', icon: <Users className="w-4 h-4" />, iconBg: 'bg-danger-soft' },
                    {
                        label: 'Rate',
                        value: `${attendanceRate}%`,
                        color: attendanceRate >= 80 ? 'text-emerald-700 dark:text-emerald-400' : attendanceRate >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-danger',
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        iconBg: attendanceRate >= 80 ? 'bg-success-soft' : attendanceRate >= 50 ? 'bg-warning-soft' : 'bg-danger-soft'
                    },
                ].map(stat => (
                    <Card key={stat.label}>
                        <div className="p-3.5 flex flex-col justify-between min-h-[85px]">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-label text-text-muted">{stat.label}</span>
                                <div className={`w-6 h-6 rounded-md ${stat.iconBg} flex items-center justify-center ${stat.color} flex-shrink-0`}>
                                    <div className="scale-[0.8]">{stat.icon}</div>
                                </div>
                            </div>
                            <p className={`text-xl sm:text-2xl font-semibold leading-none tracking-tight ${stat.color}`}>{stat.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Progress bar */}
            {totalStudents > 0 && (
                <Card>
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-small-body text-text-secondary">Register completion</p>
                            <p className="text-small-body font-semibold text-text">{marked}/{totalStudents} marked</p>
                        </div>
                        <div className="h-2 bg-page rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all duration-700" style={{ width: `${Math.round((marked / totalStudents) * 100)}%` }} />
                        </div>
                        {marked === totalStudents && (
                            <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mt-2">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Register complete for this day
                            </p>
                        )}
                    </div>
                </Card>
            )}

            {hasError && (
                <div className="rounded-md bg-danger-soft border border-danger/20 text-small-body text-danger font-medium px-4 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p>There was a problem loading all attendance data. Some information may be missing or incomplete.</p>
                </div>
            )}

            <AttendanceRollCall
                slots={sortedSlots as any}
                centreId={activeCentreId}
                dateStr={targetStr}
                canViewProfiles={session.user.role !== 'TUTOR'}
                allStudents={activeOrPausedChildrenAtCentre.map(c => ({
                    id: c.id,
                    firstName: c.firstName,
                    lastName: c.lastName,
                    schoolYear: c.schoolYear,
                    parentId: c.parentId,
                    parentFirstName: c.parent?.firstName ?? '',
                    parentLastName: c.parent?.lastName ?? '',
                    parentEmail: c.parent?.email ?? '',
                    parentPhone: c.parent?.phone ?? '',
                }))}
            />
        </div>
    );
}
