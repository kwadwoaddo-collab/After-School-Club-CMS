import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import StudentProfile from '@/components/students/StudentProfile';
import { getStudentNotes } from '@/features/students/notes.actions';

export default async function StudentProfilePage(
    props: {
        params: Promise<{ id: string }>;
    }
) {
    const params = await props.params;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    // 1. Fetch Student with Parent
    const studentData = await db
        .select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            notes: children.notes,
            parent: {
                firstName: parents.firstName,
                lastName: parents.lastName,
                phone: parents.phone,
                email: parents.email,
                organisationId: parents.organisationId,
            }
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(children.id, params.id))
        .limit(1);

    if (studentData.length === 0) return notFound();

    const student = studentData[0];

    // Security check: Ensure student belongs to the same organisation
    if (student.parent.organisationId !== session.user.organisationId) {
        return notFound();
    }

    // 2. Fetch Recent Bookings for this student
    const studentBookings = await db
        .select({
            id: bookings.id,
            startAt: bookings.startAt,
            status: bookings.status,
            centreName: centres.name,
            attendeeId: bookingAttendees.id,
            feedbackNotes: bookingAttendees.feedbackNotes,
            feedbackScore: bookingAttendees.feedbackScore,
            feedbackStatus: bookingAttendees.feedbackStatus,
            feedbackAttachmentBase64: bookingAttendees.feedbackAttachmentBase64,
            feedbackAttachmentMime: bookingAttendees.feedbackAttachmentMime,
            feedbackSentAt: bookingAttendees.feedbackSentAt,
        })
        .from(bookings)
        .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
        .innerJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(bookingAttendees.childId, student.id))
        .orderBy(desc(bookings.startAt))
        .limit(10);

    const initialNotes = await getStudentNotes(student.id);

    // 3. Fetch Full Attendance Stats
    const [attendanceResults] = await db
        .select({
            total: sql<number>`count(*)`,
            completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .where(eq(bookingAttendees.childId, student.id));

    return (
        <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
            <StudentProfile
                student={{
                    ...student,
                    bookings: studentBookings,
                    attendanceStats: attendanceResults
                }}
                initialNotes={initialNotes}
            />
        </div>
    );
}
