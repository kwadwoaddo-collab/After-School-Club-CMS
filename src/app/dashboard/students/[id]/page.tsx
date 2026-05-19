import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees } from '@/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import StudentProfile from '@/components/students/StudentProfile';
import { getStudentNotes } from '@/features/students/notes.actions';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export default async function StudentProfilePage(
    props: {
        params: Promise<{ id: string }>;
    }
) {
    const params = await props.params;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const userRole = (session.user as any).role as string | undefined;
    const isOwner = userRole === 'ORG_OWNER';

    // 1. Fetch Student with Parent
    const studentData = await db
        .select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            notes: children.notes,
            registeredSessions: children.registeredSessions,
            centreId: children.centreId,
            organisationId: children.organisationId,
            parent: {
                id: parents.id,
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

    // ── Org-level check ──────────────────────────────────────────────────────
    // Use children.organisationId first (fast direct check).
    // Fall back to parent.organisationId for rows not yet backfilled (NULL centreId/orgId).
    const studentOrgId = student.organisationId ?? student.parent.organisationId;
    if (studentOrgId !== session.user.organisationId) {
        return notFound();
    }

    // ── Centre-level check for non-ORG_OWNER users ───────────────────────────
    // ORG_OWNER can view any student in their org.
    // For other roles, the student's centreId must be in their accessible set.
    // Returns notFound() (not 403) to avoid leaking student existence.
    if (!isOwner) {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);

        // If the student has no centreId or it's not in the accessible set → deny
        if (!student.centreId || !accessibleCentreIds.includes(student.centreId)) {
            return notFound();
        }
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
            attendanceStatus: bookingAttendees.attendanceStatus,
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
            completed: sql<number>`count(*) filter (where
                COALESCE(${bookingAttendees.attendanceStatus}::text, CASE WHEN ${bookings.status} = 'completed' THEN 'present' ELSE NULL END) = 'present'
            )`
        })
        .from(bookingAttendees)
        .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
        .where(eq(bookingAttendees.childId, student.id));

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
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
