/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, children } from '@/db/schema';
import { eq, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, addDays, subDays, format } from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users, CheckCircle2, CalendarCheck, Download, AlertTriangle } from 'lucide-react';
import AttendanceRollCall from './AttendanceRollCall';
import { compileDailyRegisterSlots } from '@/lib/attendance';
import { logger } from '@/lib/logger';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default async function AttendancePage(props: {
    searchParams: Promise<{ date?: string; centre?: string }>;
}) {
    const rawParams = await props.searchParams;
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/login');
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
    const targetStr = format(targetDate, 'yyyy-MM-dd');
    const isToday = targetStr === todayStr;

    let hasError = false;
    let orgCentres: any[] = [];
    let centreIds: string[] = [];
    let activeCentreId = 'all';
    let allChildrenAtCentre: any[] = [];
    let dayBookings: any[] = [];

    try {
        orgCentres = await getUserAccessibleCentres(session.user.id);
        centreIds = orgCentres.map(c => c.id);
        activeCentreId = await resolveActiveCentreId(rawParams.centre, centreIds);

        const centreFilter = activeCentreId !== 'all'
            ? eq(bookings.centreId, activeCentreId)
            : centreIds.length > 0
                ? inArray(bookings.centreId, centreIds)
                : eq(bookings.centreId, 'no-centre');

        const centreChildrenCondition = activeCentreId !== 'all'
            ? eq(children.centreId, activeCentreId)
            : centreIds.length > 0
                ? inArray(children.centreId, centreIds)
                : eq(children.centreId, 'no-centre');

        allChildrenAtCentre = await db.query.children.findMany({
            where: and(centreChildrenCondition, eq(children.isRegistered, true), isNull(children.deletedAt)),
            with: { parent: true, centre: true },
        });

        dayBookings = await db.query.bookings.findMany({
            where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
            with: { parent: true, centre: true, attendees: { with: { child: true } } },
        });
    } catch (e) {
        logger.error("Error fetching attendance", e);
        hasError = true;
    }

    const sortedSlots = compileDailyRegisterSlots({
        targetDate,
        allChildrenAtCentre,
        dayBookings,
    });

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

    return (
        <div className="space-y-6">
            <HeaderPortal targetId="header-left">
                <h1 className="text-page-title text-text">Attendance</h1>
            </HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                {!isToday && (
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/attendance">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            Go to Today
                        </Link>
                    </Button>
                )}
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
            </HeaderPortal>

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
                    { label: 'Sessions', value: dayBookings.length, color: 'text-accent', icon: <CalendarCheck className="w-4 h-4" />, iconBg: 'bg-accent-soft' },
                    { label: 'Students', value: totalStudents, color: 'text-text', icon: <Users className="w-4 h-4" />, iconBg: 'bg-page' },
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
                allStudents={allChildrenAtCentre.map(c => ({
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
