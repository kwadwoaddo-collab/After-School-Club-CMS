import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { ChevronLeft, CalendarDays, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import {
    resolveAttendanceStatus,
    getAttendanceColorClass,
    countAttendance,
} from '@/lib/attendance';
import type { AttendanceStatus } from '@/lib/attendance';

export default async function StudentAttendancePage(
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string | undefined;
    const isOwner = userRole === 'ORG_OWNER';

    // 1. Fetch student (minimal: org/centre check + name)
    const studentRows = await db
        .select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            centreId: children.centreId,
            organisationId: children.organisationId,
            parentOrgId: parents.organisationId,
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(children.id, params.id))
        .limit(1);

    if (studentRows.length === 0) return notFound();
    const student = studentRows[0];

    const studentOrgId = student.organisationId ?? student.parentOrgId;
    if (studentOrgId !== session.user.organisationId) return notFound();

    if (!isOwner) {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!student.centreId || !accessibleCentreIds.includes(student.centreId)) {
            return notFound();
        }
    }

    // 2. Fetch all attendance records for this student
    const records = await db
        .select({
            id: bookingAttendees.id,
            bookingId: bookings.id,
            startAt: bookings.startAt,
            bookingStatus: bookings.status,
            centreName: centres.name,
            attendanceStatus: bookingAttendees.attendanceStatus,
            attendanceNote: bookingAttendees.attendanceNote,
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(bookingAttendees.childId, params.id))
        .orderBy(desc(bookings.startAt));

    // 3. Compute summary stats
    const stats = countAttendance(
        records.map(r => ({
            attendanceStatus: r.attendanceStatus as AttendanceStatus | null,
            bookingStatus: r.bookingStatus,
        }))
    );
    const attendanceRate = stats.total > 0
        ? Math.round((stats.attended / stats.total) * 100)
        : 0;

    const rateColor =
        attendanceRate >= 80 ? 'text-emerald-400' :
        attendanceRate >= 60 ? 'text-amber-400' :
        'text-red-400';
    const rateBg =
        attendanceRate >= 80 ? 'bg-emerald-500/20 border-emerald-500/20' :
        attendanceRate >= 60 ? 'bg-amber-500/20 border-amber-500/20' :
        'bg-red-500/20 border-red-500/20';

    const fullName = `${student.firstName} ${student.lastName}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-700 py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">

            {/* Back link + heading */}
            <div className="flex items-center justify-between gap-4">
                <Link
                    href={`/dashboard/students/${params.id}`}
                    className="group flex items-center gap-2 text-[#8c909f] hover:text-white transition-colors"
                >
                    <div className="w-8 h-8 rounded-full bg-[#1a1d23] border border-[#424754]/30 flex items-center justify-center group-hover:border-[#adc6ff]/40 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">Back to {fullName}</span>
                </Link>
            </div>

            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#e5e2e1] tracking-tight">
                    Attendance History
                </h1>
                <p className="text-[#8c909f] font-medium mt-1">{fullName}</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#8c909f] uppercase tracking-widest">Total</span>
                    <span className="text-2xl font-black text-[#e5e2e1]">{stats.total}</span>
                    <span className="text-xs text-[#8c909f]">sessions</span>
                </div>
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#8c909f] uppercase tracking-widest">Present</span>
                    <span className="text-2xl font-black text-emerald-400">{stats.attended}</span>
                    <span className="text-xs text-[#8c909f]">attended</span>
                </div>
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-2xl p-5 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-[#8c909f] uppercase tracking-widest">Absent</span>
                    <span className="text-2xl font-black text-red-400">{stats.absent + stats.noShow}</span>
                    <span className="text-xs text-[#8c909f]">missed</span>
                </div>
                <div className={`${rateBg} border rounded-2xl p-5 flex flex-col gap-1`}>
                    <span className="text-[10px] font-black text-[#8c909f] uppercase tracking-widest">Rate</span>
                    <span className={`text-2xl font-black ${rateColor}`}>{attendanceRate}%</span>
                    <span className="text-xs text-[#8c909f]">attendance</span>
                </div>
            </div>

            {/* Session table */}
            {records.length === 0 ? (
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-2xl p-12 text-center">
                    <CalendarDays className="w-10 h-10 text-[#424754] mx-auto mb-4" />
                    <p className="text-[#e5e2e1] font-bold text-lg">No sessions found</p>
                    <p className="text-[#8c909f] text-sm mt-1">
                        This student has no booking records yet.
                    </p>
                </div>
            ) : (
                <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_auto_1fr] text-[10px] font-black text-[#8c909f] uppercase tracking-widest px-6 py-3 border-b border-[#424754]/15">
                        <span>Date</span>
                        <span>Centre</span>
                        <span>Status</span>
                        <span className="pl-4">Note</span>
                    </div>
                    <div className="divide-y divide-[#424754]/10">
                        {records.map(record => {
                            const resolved = resolveAttendanceStatus(
                                record.attendanceStatus as AttendanceStatus | null,
                                record.bookingStatus,
                            );
                            const colorClass = getAttendanceColorClass(resolved.status);

                            return (
                                <div
                                    key={record.id}
                                    className="grid grid-cols-[1fr_1fr_auto_1fr] items-center px-6 py-4 hover:bg-white/[0.02] transition-colors"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-[#e5e2e1]">
                                            {new Date(record.startAt).toLocaleDateString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </p>
                                        <p className="text-xs text-[#8c909f] mt-0.5">
                                            {new Date(record.startAt).toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium text-[#8c909f]">{record.centreName}</p>
                                    <span
                                        className={`text-[10px] font-black uppercase rounded-full px-3 py-1 whitespace-nowrap ${colorClass}`}
                                    >
                                        {resolved.label}
                                    </span>
                                    <p className="text-xs text-[#8c909f] pl-4 truncate">
                                        {record.attendanceNote ?? '—'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
