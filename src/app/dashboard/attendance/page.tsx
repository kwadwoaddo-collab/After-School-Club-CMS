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
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#e5e2e1] tracking-tight">Attendance Roll-Call</h1>
                    <p className="text-[#8c909f] font-medium mt-1">Mark attendance for today&apos;s sessions</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Jump to today */}
                    {!isToday && (
                        <Link href="/dashboard/attendance" className="px-3 py-2 rounded-xl bg-[#adc6ff]/10 border border-[#adc6ff]/20 text-[#adc6ff] text-xs font-bold hover:bg-[#adc6ff]/20 transition-all flex items-center gap-1.5">
                            <CalendarCheck className="w-3.5 h-3.5" />
                            Go to Today
                        </Link>
                    )}
                    {/* Export CSV — direct download, no JS required */}
                    <a
                        href={`/api/export/register?date=${targetStr}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`}
                        download={`register-${targetStr}.csv`}
                        className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                        title={`Download register for ${format(targetDate, 'd MMM yyyy')} as CSV`}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </a>
                    <Link href={`/dashboard/attendance?date=${prevDay}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`} className="p-2 rounded-xl bg-[#1a1d23] border border-[#424754]/15 text-[#8c909f] hover:text-white hover:border-[#adc6ff]/30 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </Link>
                    <div className="px-4 py-2 rounded-xl bg-[#1a1d23] border border-[#424754]/15">
                        <p className="text-white font-bold text-sm">
                            {format(targetDate, 'EEEE, d MMM yyyy')}
                            {isToday && <span className="ml-2 text-[#adc6ff] text-xs font-bold uppercase tracking-wider">Today</span>}
                        </p>
                    </div>
                    <Link href={`/dashboard/attendance?date=${nextDay}${activeCentreId !== 'all' ? `&centre=${activeCentreId}` : ''}`} className="p-2 rounded-xl bg-[#1a1d23] border border-[#424754]/15 text-[#8c909f] hover:text-white hover:border-[#adc6ff]/30 transition-all">
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                    { label: 'Sessions', value: dayBookings.length, color: 'text-[#adc6ff]', icon: <CalendarCheck className="w-4 h-4" />, iconBg: 'bg-[#adc6ff]/10' },
                    { label: 'Students', value: totalStudents, color: 'text-white', icon: <Users className="w-4 h-4" />, iconBg: 'bg-white/5' },
                    { label: 'Present', value: present, color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" />, iconBg: 'bg-emerald-500/10' },
                    { label: 'Absent', value: absent, color: 'text-red-400', icon: <Users className="w-4 h-4" />, iconBg: 'bg-red-500/10' },
                    {
                        label: 'Rate',
                        value: `${attendanceRate}%`,
                        color: attendanceRate >= 80 ? 'text-emerald-400' : attendanceRate >= 50 ? 'text-amber-400' : 'text-red-400',
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        iconBg: attendanceRate >= 80 ? 'bg-emerald-500/10' : attendanceRate >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'
                    },
                ].map(stat => (
                    <div key={stat.label} className="glassmorphic-card rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c909f] mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            {totalStudents > 0 && (
                <div className="bg-[#1a1d23] rounded-2xl p-5 border border-[#424754]/15">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-[#8c909f]">Register completion</p>
                        <p className="text-sm font-bold text-white">{marked}/{totalStudents} marked</p>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#adc6ff] to-[#4d8eff] rounded-full transition-all duration-700" style={{ width: `${Math.round((marked / totalStudents) * 100)}%` }} />
                    </div>
                    {marked === totalStudents && (
                        <p className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mt-2">
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
