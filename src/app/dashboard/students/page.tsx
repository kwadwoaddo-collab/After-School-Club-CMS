import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, children, parents, bookings, bookingAttendees } from '@/db/schema';
import { eq, desc, sql, min } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, Users, Calendar, Mail, Phone, ArrowRight } from 'lucide-react';

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

    // Get booking counts and next assessment date for each student
    const bookingData = await db
        .select({
            childId: bookingAttendees.childId,
            count: sql<number>`count(*)`,
            nextAssessment: sql<Date | null>`min("bookings"."start_at")`,
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .groupBy(bookingAttendees.childId);

    const bookingDataMap = new Map(
        bookingData.map((bd) => [bd.childId, { count: bd.count, nextAssessment: bd.nextAssessment }])
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Students</h1>
                    <p className="text-slate-500 font-medium mt-1">
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
                <div className="glass-card rounded-[32px] p-12 text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No students yet</h3>
                    <p className="text-slate-500 mb-6">
                        Students will appear here once they book assessments
                    </p>
                </div>
            ) : (
                <div className="glass-card rounded-[32px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        School Year
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        Parent Contact
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        Bookings
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {studentsList.map((student) => {
                                    const bookingInfo = bookingDataMap.get(student.id);
                                    const bookingCount = bookingInfo?.count || 0;
                                    const nextAssessment = bookingInfo?.nextAssessment;

                                    return (
                                        <tr
                                            key={student.id}
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-accent-violet/10 rounded-xl flex items-center justify-center text-accent-violet font-bold">
                                                        {student.firstName[0]}{student.lastName[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">
                                                            {student.firstName} {student.lastName}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            DOB: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'N/A'}
                                                        </p>

                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                                    Year {student.schoolYear}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-sm text-slate-900">
                                                        {student.parentFirstName} {student.parentLastName}
                                                    </p>
                                                    {student.parentEmail && (
                                                        <p className="text-xs text-slate-600 flex items-center gap-1">
                                                            <Mail className="w-3 h-3" />
                                                            {student.parentEmail}
                                                        </p>
                                                    )}
                                                    {student.parentPhone && (
                                                        <p className="text-xs text-slate-600 flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />
                                                            {student.parentPhone}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-primary" />
                                                    <div>
                                                        <span className="font-semibold text-slate-900 block">
                                                            {bookingCount}
                                                        </span>
                                                        {nextAssessment && (
                                                            <span className="text-xs text-slate-500 block">
                                                                {new Date(nextAssessment).toLocaleDateString('en-GB', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/dashboard/students/${student.id}`}
                                                    className="text-sm font-bold text-primary hover:text-blue-600 inline-flex items-center gap-1"
                                                >
                                                    View <ArrowRight className="w-4 h-4" />
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
