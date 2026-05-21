import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, children, parents, bookings, bookingAttendees, studentNotes, centres } from '@/db/schema';
import { eq, desc, sql, inArray, and, or, ilike } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Users, GraduationCap, Sparkles } from 'lucide-react';
import { getUserAccessibleCentreIds, getUserAccessibleCentres } from '@/lib/permissions';
import StudentsTable from '@/components/students/StudentsTable';
import type { StudentRow } from '@/components/students/StudentsTable';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import StudentsFilters from '@/components/students/StudentsFilters';

export default async function StudentsPage(props: {
    searchParams: Promise<{
        centre?: string;
        search?: string;
        year?: string;
        status?: string;
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
                        <h1 className="text-3xl font-bold text-white tracking-tight">Students</h1>
                        <p className="text-on-surface-variant font-medium mt-1">
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
        conditions.push(inArray(children.centreId, accessibleCentreIds));
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

    if (searchParams.status && searchParams.status !== 'all') {
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
            completedCount: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
            nextAssessment: sql<Date | null>`min(${bookings.startAt})`,
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
            completedCount: bd.completedCount,
            nextAssessment: bd.nextAssessment,
        }])
    );

    const studentIds = studentsList.map(s => s.id);
    const safetyNotes = studentIds.length > 0 ? await db.query.studentNotes.findMany({
        where: and(
            inArray(studentNotes.childId, studentIds),
            inArray(studentNotes.category, ['Medical', 'Safeguarding'])
        )
    }) : [];

    const enrichedStudents: StudentRow[] = studentsList.map((student) => {
        const bookingInfo = bookingDataMap.get(student.id);
        const bookingCount = Number(bookingInfo?.totalCount ?? 0);
        const completedCount = Number(bookingInfo?.completedCount ?? 0);
        const studentSafetyNotes = safetyNotes.filter(n => n.childId === student.id);

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
            completedCount,
            attendanceRate: bookingCount > 0 ? (completedCount / bookingCount) * 100 : 0,
            nextAssessment: bookingInfo?.nextAssessment ?? null,
            medicalNotes: studentSafetyNotes.filter(n => n.category === 'Medical').map(n => n.content),
            safeguardingNotes: studentSafetyNotes.filter(n => n.category === 'Safeguarding').map(n => n.content),
        };
    });

    const totalCount = enrichedStudents.length;
    const registeredCount = enrichedStudents.filter(s => s.isRegistered).length;
    const leadCount = enrichedStudents.filter(s => !s.isRegistered).length;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Students</h1>
                    <p className="text-on-surface-variant font-medium mt-1">
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

            {/* KPI Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Students */}
                <div className="bg-[#1a1d23] rounded-2xl p-6 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2a2a2a] text-[#adc6ff] flex-shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">{totalCount}</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Total Students</p>
                        </div>
                    </div>
                </div>

                {/* Registered Students */}
                <div className="bg-[#1a1d23] rounded-2xl p-6 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2a2a2a] text-emerald-400 flex-shrink-0">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">{registeredCount}</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Registered</p>
                        </div>
                    </div>
                </div>

                {/* Lead / Unregistered Students */}
                <div className="bg-[#1a1d23] rounded-2xl p-6 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2a2a2a] text-amber-400 flex-shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">{leadCount}</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Leads / Unregistered</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <StudentsFilters centres={accessibleCentres} resultsCount={enrichedStudents.length} />

            <StudentsTable students={enrichedStudents} />
        </div>
    );
}
