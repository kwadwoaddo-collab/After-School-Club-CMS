import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, children, parents, bookings, bookingAttendees, centres } from '@/db/schema';
import { eq, desc, sql, min, inArray, and } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Users, Calendar, Mail, Phone, ArrowRight, AlertTriangle, Shield } from 'lucide-react';
import { studentNotes } from '@/db/schema';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

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

    // Get centres accessible to this user (ORG_OWNER sees all, others see assigned centres)
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);

    // Fetch all students with their parent info
    const studentsList = await db
        .select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentEmail: parents.email,
            parentPhone: parents.phone,
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(parents.organisationId, org.id))
        .orderBy(desc(children.createdAt));

    // Get booking counts and next assessment date for each student (filtered by accessible centres)
    const bookingData = await db
        .select({
            childId: bookingAttendees.childId,
            count: sql<number>`count(*)`,
            nextAssessment: sql<Date | null>`min("bookings"."start_at")`,
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .where(inArray(bookings.centreId, accessibleCentreIds))
        .groupBy(bookingAttendees.childId);

    const bookingDataMap = new Map(
        bookingData.map((bd) => [bd.childId, { count: bd.count, nextAssessment: bd.nextAssessment }])
    );

    const studentIds = studentsList.map(s => s.id);
    const safetyNotes = studentIds.length > 0 ? await db.query.studentNotes.findMany({
        where: and(
            inArray(studentNotes.childId, studentIds),
            inArray(studentNotes.category, ['Medical', 'Safeguarding'])
        )
    }) : [];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
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

            {/* Students List */}
            {studentsList.length === 0 ? (
                <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl rounded-[32px] p-16 text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/20">
                        <Users className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">No students yet</h3>
                    <p className="text-on-surface-variant mb-8 max-w-xs mx-auto">
                        Students will appear here once they book assessments, or you can add one manually.
                    </p>
                    <Link
                        href="/dashboard/students/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                    >
                        <Plus className="w-4 h-4" /> Add New Student
                    </Link>
                </div>
            ) : (
                <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl rounded-[32px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                        School Year
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                        Parent Contact
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                        Bookings
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                                {studentsList.map((student) => {
                                    const bookingInfo = bookingDataMap.get(student.id);
                                    const bookingCount = bookingInfo?.count || 0;
                                    const nextAssessment = bookingInfo?.nextAssessment;
                                    const studentSafetyNotes = safetyNotes.filter(n => n.childId === student.id);
                                    const studentMedicalNotes = studentSafetyNotes.filter(n => n.category === 'Medical');
                                    const studentSafeguardingNotes = studentSafetyNotes.filter(n => n.category === 'Safeguarding');

                                    const hasMedicalNote = studentMedicalNotes.length > 0;
                                    const medicalNotesContent = studentMedicalNotes.map(n => n.content).join('\n\n');

                                    const hasSafeguardingNote = studentSafeguardingNotes.length > 0;
                                    const safeguardingNotesContent = studentSafeguardingNotes.map(n => n.content).join('\n\n');

                                    return (
                                        <tr
                                            key={student.id}
                                            className="hover:bg-surface-bright transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary font-bold">
                                                        {student.firstName[0]}{student.lastName[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-white group-hover:text-primary transition-colors">
                                                                {student.firstName} {student.lastName}
                                                            </p>
                                                            {hasMedicalNote && (
                                                                <div className="relative group/tooltip flex items-center outline-none">
                                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-error/10 border border-error/20 cursor-help shadow-[0_0_8px_rgba(255,113,108,0.2)]">
                                                                        <AlertTriangle className="w-3.5 h-3.5 text-error" />
                                                                    </div>
                                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-surface-container-high border border-outline-variant/50 text-white text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                        <div className="font-bold text-error mb-1 border-b border-error/20 pb-1 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/>Medical / Allergy Alert</div>
                                                                        {medicalNotesContent}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-container-high"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {hasSafeguardingNote && (
                                                                <div className="relative group/tooltip flex items-center outline-none">
                                                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 border border-primary/20 cursor-help shadow-[0_0_8px_rgba(142,171,255,0.2)]">
                                                                        <Shield className="w-3.5 h-3.5 text-primary" />
                                                                    </div>
                                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-surface-container-high border border-outline-variant/50 text-white text-xs rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] whitespace-pre-wrap leading-relaxed font-medium">
                                                                        <div className="font-bold text-primary mb-1 border-b border-primary/20 pb-1 flex items-center gap-1.5"><Shield className="w-3 h-3"/>Safeguarding Alert</div>
                                                                        {safeguardingNotesContent}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-container-high"></div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                                                            DOB: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}
                                                        </p>

                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 bg-surface-container-high border border-outline-variant/10 text-on-surface text-xs font-bold rounded-full shadow-sm">
                                                    Year {student.schoolYear}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-sm text-white">
                                                        {student.parentFirstName} {student.parentLastName}
                                                    </p>
                                                    {student.parentEmail && (
                                                        <p className="text-xs text-on-surface-variant opacity-80 flex items-center gap-1.5">
                                                            <Mail className="w-3 h-3 opacity-70" />
                                                            {student.parentEmail}
                                                        </p>
                                                    )}
                                                    {student.parentPhone && (
                                                        <p className="text-xs text-on-surface-variant opacity-80 flex items-center gap-1.5">
                                                            <Phone className="w-3 h-3 opacity-70" />
                                                            {student.parentPhone}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/10 flex flex-col items-center justify-center">
                                                        <span className="font-bold text-white text-xs leading-none">
                                                            {bookingCount}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        {nextAssessment ? (
                                                            <>
                                                                <span className="font-semibold text-white text-xs block">Next Booking</span>
                                                                <span className="text-xs text-on-surface-variant block">
                                                                    {new Date(nextAssessment).toLocaleDateString('en-GB', {
                                                                        day: 'numeric',
                                                                        month: 'short',
                                                                        year: 'numeric'
                                                                    })}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-on-surface-variant italic">No upcoming</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/dashboard/students/${student.id}`}
                                                    className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-lg inline-flex items-center gap-2 transition-all"
                                                >
                                                    Manage <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
