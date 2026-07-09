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

    const regularAttendees = allChildrenAtCentre.filter(child => {
        if (!child.registeredSessions || child.registeredSessions.length === 0) return false;
        return child.registeredSessions.some(session => session.startsWith(targetDayName));
    });

    const dayBookings = await db.query.bookings.findMany({
        where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
        with: { parent: true, centre: true, attendees: { with: { child: true } } },
    });

    // Helper to clean and normalize a time string like "3.45pm" to "HH:mm"
    function normalizeTimeToHHMM(timeStr: string): string {
        const clean = timeStr.toLowerCase().replace(/\s/g, '');
        const isPm = clean.includes('pm');
        const digits = clean.replace('am', '').replace('pm', '');
        const [hStr, mStr] = digits.split('.');
        let hours = parseInt(hStr, 10);
        const minutes = mStr ? parseInt(mStr, 10) : 0;
        if (isPm && hours < 12) hours += 12;
        if (!isPm && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    // Initialize standard slots
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
    const standardTimes = isWeekend
        ? ['11:00', '12:15', '13:30', '14:45']
        : ['15:45', '17:00'];

    interface CompiledAttendee {
        id: string;
        childId: string;
        firstName: string;
        lastName: string;
        schoolYear: string;
        parentFirstName: string;
        parentLastName: string;
        parentPhone: string | null;
        parentEmail: string | null;
        attendanceStatus: string | null;
        attendanceNote: string | null;
        lateMinutes: number | null;
        isCatchUp: boolean;
        bookingId: string | null;
    }

    interface CompiledSlot {
        time: string;
        timeLabel: string;
        regulars: CompiledAttendee[];
        catchups: CompiledAttendee[];
    }

    const slotsMap: Record<string, CompiledSlot> = {};
    for (const time of standardTimes) {
        const [h, m] = time.split(':');
        const dateObj = new Date(targetDate);
        dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
        slotsMap[time] = {
            time,
            timeLabel: format(dateObj, 'h:mm a'),
            regulars: [],
            catchups: [],
        };
    }

    // Step A: Map regulars to their slots
    for (const child of regularAttendees) {
        const matchingSchedules = child.registeredSessions!.filter(s => s.startsWith(targetDayName));
        for (const sched of matchingSchedules) {
            const timePart = sched.substring(targetDayName.length).trim(); // e.g. "3.45pm"
            const parsedTime = normalizeTimeToHHMM(timePart);

            if (!slotsMap[parsedTime]) {
                const [h, m] = parsedTime.split(':');
                const dateObj = new Date(targetDate);
                dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
                slotsMap[parsedTime] = {
                    time: parsedTime,
                    timeLabel: format(dateObj, 'h:mm a'),
                    regulars: [],
                    catchups: [],
                };
            }

            // Check if there is an actual booking for today at this time containing this child
            const bookingMatch = dayBookings.find(b => {
                const bTime = format(new Date(b.startAt), 'HH:mm');
                const hasChild = b.attendees.some(a => a.childId === child.id);
                return hasChild && bTime === parsedTime;
            });

            if (bookingMatch) {
                const att = bookingMatch.attendees.find(a => a.childId === child.id)!;
                slotsMap[parsedTime].regulars.push({
                    id: att.id,
                    childId: child.id,
                    firstName: child.firstName,
                    lastName: child.lastName,
                    schoolYear: child.schoolYear,
                    parentFirstName: child.parent.firstName,
                    parentLastName: child.parent.lastName,
                    parentPhone: child.parent.phone,
                    parentEmail: child.parent.email,
                    attendanceStatus: att.attendanceStatus,
                    attendanceNote: att.attendanceNote,
                    lateMinutes: att.lateMinutes,
                    isCatchUp: false,
                    bookingId: bookingMatch.id,
                });
            } else {
                slotsMap[parsedTime].regulars.push({
                    id: `temp-${child.id}-${parsedTime}`,
                    childId: child.id,
                    firstName: child.firstName,
                    lastName: child.lastName,
                    schoolYear: child.schoolYear,
                    parentFirstName: child.parent.firstName,
                    parentLastName: child.parent.lastName,
                    parentPhone: child.parent.phone,
                    parentEmail: child.parent.email,
                    attendanceStatus: null,
                    attendanceNote: null,
                    lateMinutes: null,
                    isCatchUp: false,
                    bookingId: null,
                });
            }
        }
    }

    // Step B: Map catchups from actual bookings
    for (const booking of dayBookings) {
        const bookingTime = format(new Date(booking.startAt), 'HH:mm');
        
        if (!slotsMap[bookingTime]) {
            slotsMap[bookingTime] = {
                time: bookingTime,
                timeLabel: format(new Date(booking.startAt), 'h:mm a'),
                regulars: [],
                catchups: [],
            };
        }

        for (const att of booking.attendees) {
            // A child is a catchup if they don't have today's slot in their weekly registeredSessions
            const isRegular = att.child.registeredSessions?.some(s => {
                if (!s.startsWith(targetDayName)) return false;
                const timePart = s.substring(targetDayName.length).trim();
                const parsedTime = normalizeTimeToHHMM(timePart);
                return parsedTime === bookingTime;
            });

            if (!isRegular) {
                slotsMap[bookingTime].catchups.push({
                    id: att.id,
                    childId: att.child.id,
                    firstName: att.child.firstName,
                    lastName: att.child.lastName,
                    schoolYear: att.child.schoolYear,
                    parentFirstName: booking.parent.firstName,
                    parentLastName: booking.parent.lastName,
                    parentPhone: booking.parent.phone,
                    parentEmail: booking.parent.email,
                    attendanceStatus: att.attendanceStatus,
                    attendanceNote: att.attendanceNote,
                    lateMinutes: att.lateMinutes,
                    isCatchUp: true,
                    bookingId: booking.id,
                });
            }
        }
    }

    // Sort slots by time ascending
    const sortedSlots = Object.values(slotsMap).sort((a, b) => a.time.localeCompare(b.time));

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
                    { label: 'Sessions', value: dayBookings.length, color: 'text-[#adc6ff]', icon: '📋' },
                    { label: 'Students', value: totalStudents,       color: 'text-white',     icon: '👤' },
                    { label: 'Present',  value: present,             color: 'text-emerald-400', icon: '✅' },
                    { label: 'Absent',   value: absent,              color: 'text-red-400',   icon: '❌' },
                    { label: 'Rate',     value: `${attendanceRate}%`, color: attendanceRate >= 80 ? 'text-emerald-400' : attendanceRate >= 50 ? 'text-amber-400' : 'text-red-400', icon: '📊' },
                ].map(stat => (
                    <div key={stat.label} className="bg-[#1a1d23] rounded-2xl p-5 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{stat.icon}</span>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c909f]">{stat.label}</p>
                        </div>
                        <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
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
            />
        </div>
    );
}
