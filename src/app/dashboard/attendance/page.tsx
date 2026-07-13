import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, children } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, addDays, subDays, format } from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users, CheckCircle2, CalendarCheck, Download } from 'lucide-react';
import AttendanceRollCall from './AttendanceRollCall';
import { compileDailyRegisterSlots } from '@/lib/attendance';

export default async function AttendancePage(props: {
    searchParams: Promise<{ date?: string; centre?: string }>;
}) {
    const rawParams = await props.searchParams;
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/login');

    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const centreIds = orgCentres.map(c => c.id);
    const activeCentreId = await resolveActiveCentreId(rawParams.centre, centreIds);

    const targetDate = rawParams.date ? new Date(rawParams.date) : new Date();
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);
    const prevDay = format(subDays(targetDate, 1), 'yyyy-MM-dd');
    const nextDay = format(addDays(targetDate, 1), 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const targetStr = format(targetDate, 'yyyy-MM-dd');
    const isToday = targetStr === todayStr;

    const centreFilter = activeCentreId !== 'all'
        ? eq(bookings.centreId, activeCentreId)
        : centreIds.length > 0
            ? inArray(bookings.centreId, centreIds)
            : eq(bookings.centreId, 'no-centre');

    const targetDayName = format(targetDate, 'EEEE'); // e.g. "Monday"

    const centreChildrenCondition = activeCentreId !== 'all'
        ? eq(children.centreId, activeCentreId)
        : centreIds.length > 0
            ? inArray(children.centreId, centreIds)
            : eq(children.centreId, 'no-centre');

    const allChildrenAtCentre = await db.query.children.findMany({
        where: and(centreChildrenCondition, eq(children.isRegistered, true)),
        with: { parent: true, centre: true },
    });

    const dayBookings = await db.query.bookings.findMany({
        where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
        with: { parent: true, centre: true, attendees: { with: { child: true } } },
    });

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
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Attendance Roll-Call</h1>
                    <p className="text-muted-foreground font-medium mt-1">Mark attendance for today&apos;s sessions</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Jump to today */}
                    {!isToday && (
                        <Link href="/dashboard/attendance" className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-1.5">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            Go to Today
                        </Link>
                    )}
                    {/* Export CSV */}
                    <a
                        href={`/api/export/register?date=${targetStr}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`}
                        download={`register-${targetStr}.csv`}
                        className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                        title={`Download register for ${format(targetDate, 'd MMM yyyy')} as CSV`}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </a>
                    <Link href={`/dashboard/attendance?date=${prevDay}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`} className="p-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </Link>
                    <div className="px-4 py-2 rounded-xl bg-secondary border border-border">
                        <p className="text-foreground font-bold text-sm">
                            {format(targetDate, 'EEEE, d MMM yyyy')}
                            {isToday && <span className="ml-2 text-primary text-xs font-bold uppercase tracking-wider">Today</span>}
                        </p>
                    </div>
                    <Link href={`/dashboard/attendance?date=${nextDay}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`} className="p-2 rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                    { label: 'Sessions', value: dayBookings.length, color: 'text-primary', icon: <CalendarCheck className="w-4 h-4" />, iconBg: 'bg-primary/10' },
                    { label: 'Students', value: totalStudents, color: 'text-foreground', icon: <Users className="w-4 h-4" />, iconBg: 'bg-secondary' },
                    { label: 'Present', value: present, color: 'text-emerald-600', icon: <CheckCircle2 className="w-4 h-4" />, iconBg: 'bg-emerald-500/10' },
                    { label: 'Absent', value: absent, color: 'text-red-600', icon: <Users className="w-4 h-4" />, iconBg: 'bg-red-500/10' },
                    {
                        label: 'Rate',
                        value: `${attendanceRate}%`,
                        color: attendanceRate >= 80 ? 'text-emerald-600' : attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600',
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        iconBg: attendanceRate >= 80 ? 'bg-emerald-500/10' : attendanceRate >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'
                    },
                ].map(stat => (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex flex-col justify-between min-h-[85px] hover:scale-[1.01] transition-transform duration-150">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                            <div className={`w-6 h-6 rounded-md ${stat.iconBg} flex items-center justify-center ${stat.color} flex-shrink-0`}>
                                <div className="scale-[0.8]">{stat.icon}</div>
                            </div>
                        </div>
                        <p className={`text-xl sm:text-2xl font-black leading-none tracking-tight ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            {totalStudents > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-muted-foreground">Register completion</p>
                        <p className="text-sm font-bold text-foreground">{marked}/{totalStudents} marked</p>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-700" style={{ width: `${Math.round((marked / totalStudents) * 100)}%` }} />
                    </div>
                    {marked === totalStudents && (
                        <p className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold mt-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Register complete for this day
                        </p>
                    )}
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
