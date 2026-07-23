/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Clock, Calendar, User, CheckCircle, XCircle, AlertCircle, ArrowLeft, ClipboardCheck, MinusCircle, MapPin } from 'lucide-react';
import { resolveAttendanceStatus, getAttendanceColorClass, type AttendanceStatus } from '@/lib/attendance';
import { cn } from '@/components/ui/utils';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';

export default async function StudentAttendanceHistoryPage(
    props: {
        params: Promise<{ id: string }>;
    }
) {
    const params = await props.params;
    const { id } = params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
        notFound();
    }

    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string | undefined;
    const isOwner = userRole === 'ORG_OWNER';

    // Consolidated database queries to avoid round-trip latency overhead
    const [studentData, bookingsRaw, [attendanceResults]] = await Promise.all([
        db.select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            schoolYear: children.schoolYear,
            centreId: children.centreId,
            organisationId: children.organisationId,
            parent: {
                id: parents.id,
                firstName: parents.firstName,
                lastName: parents.lastName,
            }
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(children.id, id))
        .limit(1),

        db.select({
            id: bookings.id,
            startAt: bookings.startAt,
            status: bookings.status,
            assessmentType: bookings.assessmentType,
            centreName: centres.name,
            attendeeId: bookingAttendees.id,
            attendanceStatus: bookingAttendees.attendanceStatus,
            attendanceNote: bookingAttendees.attendanceNote,
            lateMinutes: bookingAttendees.lateMinutes,
        })
        .from(bookings)
        .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
        .leftJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(bookingAttendees.childId, id))
        .orderBy(desc(bookings.startAt)),

        db.select({
            total: sql<number>`count(*)`,
            completed: sql<number>`count(*) filter (where
                COALESCE(${bookingAttendees.attendanceStatus}::text, CASE WHEN ${bookings.status} = 'completed' THEN 'present' ELSE NULL END) = 'present'
            )`,
            absent: sql<number>`count(*) filter (where ${bookingAttendees.attendanceStatus} = 'absent')`,
            late: sql<number>`count(*) filter (where ${bookingAttendees.attendanceStatus} = 'late')`,
            noShow: sql<number>`count(*) filter (where ${bookingAttendees.attendanceStatus} = 'no_show')`,
            excused: sql<number>`count(*) filter (where ${bookingAttendees.attendanceStatus} = 'excused')`,
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .where(eq(bookingAttendees.childId, id))
    ]);

    if (studentData.length === 0) return notFound();
    const student = studentData[0];

    // Enforce strict multi-tenant boundary checks
    const studentOrgId = student.organisationId;
    if (studentOrgId !== session.user.organisationId) return notFound();

    if (!isOwner) {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!student.centreId || !accessibleCentreIds.includes(student.centreId)) {
            return notFound();
        }
    }

    const studentBookings = bookingsRaw.map(b => ({
        ...b,
        centreName: b.centreName || 'Unknown Centre'
    }));

    // Calculate rates
    const totalSessions = Number(attendanceResults?.total || 0);
    const attendedCount = Number(attendanceResults?.completed || 0);
    const lateCount = Number(attendanceResults?.late || 0);
    const absentCount = Number(attendanceResults?.absent || 0);
    const noShowCount = Number(attendanceResults?.noShow || 0);
    const excusedCount = Number(attendanceResults?.excused || 0);

    const attendanceRate = totalSessions > 0
        ? Math.round(((attendedCount + lateCount) / totalSessions) * 100)
        : 0;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
                {/* Back Link */}
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
                        <Link href="/dashboard/attendance" className="hover:text-foreground transition-colors">Attendance</Link>
                        <span>/</span>
                        <span className="text-foreground font-semibold">{student.firstName} {student.lastName}</span>
                    </nav>
                    <Link
                        href={`/dashboard/students/${student.id}`}
                        className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group mt-2"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Student Profile
                    </Link>
                </div>

                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        {student.firstName} {student.lastName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Full Attendance & Session History • Year {student.schoolYear.replace('Y', '')}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total Sessions */}
                    <div className="bg-secondary/40 border border-border rounded-[32px] p-6 flex flex-col justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">Total Sessions</span>
                        <div className="flex items-end justify-between">
                            <span className="text-4xl font-black text-foreground">{totalSessions}</span>
                            <Calendar className="w-8 h-8 text-primary opacity-60" />
                        </div>
                    </div>

                    {/* Attendance Rate */}
                    <div className="bg-secondary/40 border border-border rounded-[32px] p-6 flex flex-col justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">Attendance Rate</span>
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className={cn(
                                    "text-4xl font-black",
                                    totalSessions === 0 ? 'text-muted-foreground' : attendanceRate >= 80 ? 'text-success' : attendanceRate >= 60 ? 'text-warning' : 'text-error'
                                )}>
                                    {totalSessions > 0 ? `${attendanceRate}%` : 'N/A'}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 font-medium mt-1">
                                    {attendedCount + lateCount} present of {totalSessions} sessions
                                </span>
                            </div>
                            <AttendanceRadial percentage={attendanceRate} size="sm">
                                <User className="w-4 h-4 text-success" />
                            </AttendanceRadial>
                        </div>
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-secondary/40 border border-border rounded-[32px] p-6">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 block">Breakdown</span>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div className="flex items-center justify-between text-xs border-b border-border pb-1">
                                <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5 text-success" /> Present
                                </span>
                                <span className="font-bold text-foreground">{attendedCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border pb-1">
                                <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-warning" /> Late
                                </span>
                                <span className="font-bold text-foreground">{lateCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border pb-1">
                                <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                    <XCircle className="w-3.5 h-3.5 text-error" /> Absent
                                </span>
                                <span className="font-bold text-foreground">{absentCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border pb-1">
                                <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                    <MinusCircle className="w-3.5 h-3.5 text-error/70" /> No Show
                                </span>
                                <span className="font-bold text-foreground">{noShowCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-primary" /> Excused
                                </span>
                                <span className="font-bold text-foreground">{excusedCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detailed Logs */}
                <div className="bg-secondary/40 border border-border rounded-[32px] p-8">
                    <h2 className="text-lg font-bold text-foreground tracking-tight uppercase tracking-wider mb-6 flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-primary" /> Session History Log
                    </h2>

                    {studentBookings.length > 0 ? (
                        <div className="space-y-4">
                            {studentBookings.map((booking) => {
                                const resolved = resolveAttendanceStatus(
                                    (booking.attendanceStatus as AttendanceStatus | null) ?? null,
                                    booking.status
                                );

                                const formattedDate = new Date(booking.startAt).toLocaleDateString('en-GB', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                });

                                const formattedTime = new Date(booking.startAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                });

                                const sessionType = booking.assessmentType === 'initial_assessment'
                                    ? 'Initial Assessment'
                                    : booking.assessmentType === 'progress_review'
                                    ? 'Progress Check'
                                    : 'Club Session';

                                return (
                                    <div
                                        key={booking.id}
                                        className="glassmorphic-card p-5 rounded-2xl hover:border-primary/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    >
                                        <div className="space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="font-bold text-foreground text-base">
                                                    {formattedDate}
                                                </span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary/60 border border-border text-muted-foreground">
                                                    {sessionType}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 opacity-70" />
                                                    {formattedTime}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5 opacity-70" />
                                                    {booking.centreName}
                                                </span>
                                                {booking.lateMinutes && booking.lateMinutes > 0 ? (
                                                    <span className="font-bold text-warning">
                                                        +{booking.lateMinutes} mins late
                                                    </span>
                                                ) : null}
                                            </div>

                                            {booking.attendanceNote && (
                                                <div className="mt-2 text-xs text-muted-foreground/70 italic bg-secondary/40 rounded-lg p-2.5 border border-border">
                                                    <span className="font-bold not-italic text-muted-foreground block mb-0.5">Staff Notes:</span>
                                                    {booking.attendanceNote}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-shrink-0 flex items-center">
                                            <span className={cn(
                                                "text-xs font-black uppercase tracking-wider rounded-xl px-4 py-2 border",
                                                getAttendanceColorClass(resolved.status)
                                            )}>
                                                {resolved.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-card rounded-2xl border border-dashed border-border">
                            <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">No attendance records found for this student.</p>
                        </div>
                    )}
                </div>
            </div>
    );
}
