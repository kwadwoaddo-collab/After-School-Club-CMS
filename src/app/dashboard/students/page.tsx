import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, children, parents, bookings, bookingAttendees, studentNotes } from '@/db/schema';
import { eq, desc, sql, inArray, and } from 'drizzle-orm';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import StudentsTable from '@/components/students/StudentsTable';
import type { StudentRow } from '@/components/students/StudentsTable';

export default async function StudentsPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    const userRole = (session.user as any).role as string | undefined;
    const isOwner = userRole === 'ORG_OWNER';

    // ── Centre-scoped student visibility ────────────────────────────────────
    // ORG_OWNER: all students in the org via children.organisationId (direct column).
    // Non-owners: only students whose children.centreId is in their accessible set.
    //   • Both paths use DB-level filtering — no in-memory JS filtering.
    //   • Short-circuit if no accessible centres (non-owners only).

    let accessibleCentreIds: string[] = [];

    if (!isOwner) {
        accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);

        if (accessibleCentreIds.length === 0) {
            // Non-owner with zero accessible centres — short-circuit with empty page
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
    }

    // ── Main student query — direct centreId column, no join ─────────────────
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
        .where(
            isOwner
                // ORG_OWNER: direct org scoping via children.organisationId
                ? eq(children.organisationId, org.id)
                // Non-owner: students whose home centre is in their accessible set
                : and(
                    eq(children.organisationId, org.id),
                    inArray(children.centreId, accessibleCentreIds)
                )
        )
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
        // Non-owners: restrict booking stats to their centres too
        .where(
            isOwner
                ? undefined as any
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
            dateOfBirth: student.dateOfBirth,
            schoolYear: student.schoolYear,
            isRegistered: student.isRegistered,
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

            <StudentsTable students={enrichedStudents} />
        </div>
    );
}
