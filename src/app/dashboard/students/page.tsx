import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, children, parents, bookings, bookingAttendees, studentNotes, centres } from '@/db/schema';
import { eq, desc, sql, inArray, and, or, ilike } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Users, GraduationCap, Sparkles, AlertTriangle, TrendingDown, Upload } from 'lucide-react';
import { getUserAccessibleCentreIds, getUserAccessibleCentres } from '@/lib/permissions';
import StudentsTable from '@/components/students/StudentsTable';
import type { StudentRow } from '@/components/students/StudentsTable';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import StudentsFilters from '@/components/students/StudentsFilters';
import StudentsGrid from '@/components/students/StudentsGrid';
import HeaderPortal from '@/components/dashboard/HeaderPortal';

export default async function StudentsPage(props: {
    searchParams: Promise<{
        centre?: string;
        search?: string;
        year?: string;
        status?: string;
        view?: string;
    }>
}) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);

    if (accessibleCentreIds.length === 0) {
        // Zero accessible centres — short-circuit with empty page
        return (
            <div className="space-y-8 animate-in fade-in duration-700">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-foreground tracking-tight">Students</h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            View all registered students and their details
                        </p>
                    </div>
                    <Link
                        href="/dashboard/students/add"
                        className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                    >
                        <Plus className="w-4 h-4" /> Add Student
                    </Link>
                </div>
                <StudentsTable students={[]} />
            </div>
        );
    }

    const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);
    const accessibleCentres = await getUserAccessibleCentres(session.user.id);

    const conditions = [
        eq(children.organisationId, org.id)
    ];

    if (activeCentreId !== 'all') {
        conditions.push(eq(children.centreId, activeCentreId));
    } else {
        conditions.push(
            or(
                inArray(children.centreId, accessibleCentreIds),
                sql`${children.centreId} IS NULL`
            )!
        );
    }

    if (searchParams.search) {
        const searchPattern = `%${searchParams.search}%`;
        const searchCondition = or(
            ilike(children.firstName, searchPattern),
            ilike(children.lastName, searchPattern),
            ilike(parents.firstName, searchPattern),
            ilike(parents.lastName, searchPattern),
            ilike(parents.email, searchPattern),
            ilike(parents.phone, searchPattern)
        );
        if (searchCondition) {
            conditions.push(searchCondition);
        }
    }

    if (searchParams.year && searchParams.year !== 'all') {
        conditions.push(eq(children.schoolYear, searchParams.year));
    }

    const showLowAttendance = searchParams.status === 'low-attendance';
    if (searchParams.status && searchParams.status !== 'all' && !showLowAttendance) {
        conditions.push(eq(children.isRegistered, searchParams.status === 'registered'));
    }

    // ── Main student query ─────────────────
    const studentsList = await db
        .select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            isRegistered: children.isRegistered,
            source: children.source,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentEmail: parents.email,
            parentPhone: parents.phone,
            parentId: parents.id,
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(and(...conditions))
        .orderBy(desc(children.createdAt));

    // ── Booking stats for visible students ──────────────────────────────────
    const bookingData = await db
        .select({
            childId: bookingAttendees.childId,
            totalCount: sql<number>`count(*)`,
            pastCount: sql<number>`count(*) filter (where ${bookings.startAt} <= now())`,
            presentCount: sql<number>`count(*) filter (where ${bookings.startAt} <= now() AND
                COALESCE(${bookingAttendees.attendanceStatus}::text, CASE WHEN ${bookings.status} = 'completed' THEN 'present' ELSE NULL END) = 'present'
            )`,
            nextAssessment: sql<Date | null>`min(${bookings.startAt}) filter (where ${bookings.startAt} > now())`,
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .where(
            activeCentreId !== 'all'
                ? eq(bookings.centreId, activeCentreId)
                : inArray(bookings.centreId, accessibleCentreIds)
        )
        .groupBy(bookingAttendees.childId);

    const bookingDataMap = new Map(
        bookingData.map((bd) => [bd.childId, {
            totalCount: bd.totalCount,
            pastCount: bd.pastCount,
            presentCount: bd.presentCount,
            nextAssessment: bd.nextAssessment,
        }])
    );

    const studentIds = studentsList.map(s => s.id);
    let safetyNotes: { childId: string; content: string; category: string }[] = [];
    if (studentIds.length > 0) {
        try {
            safetyNotes = await db.query.studentNotes.findMany({
                where: and(
                    inArray(studentNotes.childId, studentIds),
                    inArray(studentNotes.category, ['Medical', 'Safeguarding'])
                )
            });
        } catch {
            // Migration may not have run yet — fail gracefully
            safetyNotes = [];
        }
    }


    const LOW_ATTENDANCE_THRESHOLD = 75;
    const MIN_SESSIONS_FOR_ALERT = 3;

    const enrichedStudents: StudentRow[] = studentsList.map((student) => {
        const bookingInfo = bookingDataMap.get(student.id);
        const bookingCount = Number(bookingInfo?.totalCount ?? 0);
        const pastCount = Number(bookingInfo?.pastCount ?? 0);
        const presentCount = Number(bookingInfo?.presentCount ?? 0);
        const studentSafetyNotes = safetyNotes.filter(n => n.childId === student.id);
        const attendanceRate = pastCount > 0 ? (presentCount / pastCount) * 100 : 0;

        return {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
            schoolYear: student.schoolYear ? Number(student.schoolYear) : null,
            isRegistered: !!student.isRegistered,
            source: student.source,
            parentId: student.parentId,
            parentFirstName: student.parentFirstName,
            parentLastName: student.parentLastName,
            parentEmail: student.parentEmail,
            parentPhone: student.parentPhone,
            bookingCount,
            completedCount: presentCount,
            attendanceRate,
            lowAttendance: pastCount >= MIN_SESSIONS_FOR_ALERT && attendanceRate < LOW_ATTENDANCE_THRESHOLD,
            nextAssessment: bookingInfo?.nextAssessment ?? null,
            medicalNotes: studentSafetyNotes.filter(n => n.category === 'Medical').map(n => n.content),
            safeguardingNotes: studentSafetyNotes.filter(n => n.category === 'Safeguarding').map(n => n.content),
        };
    });

    const visibleStudents = showLowAttendance
        ? enrichedStudents.filter(s => s.lowAttendance)
        : enrichedStudents;

    const totalCount = enrichedStudents.length;
    const registeredCount = enrichedStudents.filter(s => s.isRegistered).length;
    const leadCount = enrichedStudents.filter(s => !s.isRegistered).length;
    const medicalAlertCount = enrichedStudents.filter(s => s.medicalNotes.length > 0 || s.safeguardingNotes.length > 0).length;
    const lowAttendanceCount = enrichedStudents.filter(s => s.lowAttendance).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header Portals */}
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">Students</h1>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#8c909f] text-[10px] font-bold">
                        {totalCount}
                    </span>
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                <Link
                    href="/dashboard/students/import"
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border rounded-xl text-xs font-bold text-foreground transition-all active:scale-95 duration-100 cursor-pointer"
                >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import CSV</span>
                </Link>
                <Link
                    href="/dashboard/students/add"
                    className="flex items-center gap-2 px-4 py-2 bg-primary rounded-xl text-xs font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn active:scale-95 duration-100 cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Student</span>
                </Link>
            </HeaderPortal>

            {/* KPI Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Total Students */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground tracking-tight">{totalCount}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">Total Students</p>
                        </div>
                    </div>
                </div>

                {/* Registered */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground tracking-tight">{registeredCount}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">Registered</p>
                        </div>
                    </div>
                </div>

                {/* Leads */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600 flex-shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground tracking-tight">{leadCount}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">Leads</p>
                        </div>
                    </div>
                </div>

                {/* Medical Alerts */}
                <div className="bg-card border border-error/20 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-error/10 text-error flex-shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground tracking-tight">{medicalAlertCount}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">Medical Alerts</p>
                        </div>
                    </div>
                </div>

                {/* Low Attendance */}
                <Link
                    href={showLowAttendance ? '/dashboard/students' : '/dashboard/students?status=low-attendance'}
                    className={`rounded-2xl p-5 transition-all bg-card border ${showLowAttendance ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-border hover:border-amber-500/30 hover:shadow-md'} shadow-sm`}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600 flex-shrink-0">
                            <TrendingDown className="w-5 h-5" />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold tracking-tight ${lowAttendanceCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>{lowAttendanceCount}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">Low Attendance</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Filters — sticky */}
            <div className="sticky top-16 sm:top-20 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
                <StudentsFilters
                    centres={accessibleCentres}
                    resultsCount={visibleStudents.length}
                    currentView={searchParams.view === 'grid' ? 'grid' : 'table'}
                />
            </div>

            {searchParams.view === 'grid' ? (
                <StudentsGrid students={visibleStudents} />
            ) : (
                <StudentsTable students={visibleStudents} />
            )}
        </div>
    );
}
