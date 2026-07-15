import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees, registrationChildren, billingConfigs } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import StudentProfile from '@/components/students/StudentProfile';
import { getStudentNotes } from '@/features/students/notes.actions';
import { getUserAccessibleCentreIds } from '@/lib/permissions';


export default async function StudentProfilePage(
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

    // Consolidated parallel database queries to avoid round-trip latency overhead
    const [studentData, bookingsRaw, initialNotes, [attendanceResults], billingConfig] = await Promise.all([

        db.select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            notes: children.notes,
            registeredSessions: children.registeredSessions,
            centreId: children.centreId,
            organisationId: children.organisationId,
            registrationId: registrationChildren.registrationId, // Left-joined registration identifier
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
        .leftJoin(registrationChildren, eq(children.id, registrationChildren.childId))
        .where(eq(children.id, id))
        .limit(1),

        db.select({
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
            attendanceNote: bookingAttendees.attendanceNote,
        })
        .from(bookings)
        .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
        .leftJoin(centres, eq(bookings.centreId, centres.id))
        .where(eq(bookingAttendees.childId, id))
        .orderBy(desc(bookings.startAt)),

        getStudentNotes(id),

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
        .where(eq(bookingAttendees.childId, id)),

        db.query.billingConfigs.findFirst({
            where: and(
                eq(billingConfigs.childId, id),
                eq(billingConfigs.status, 'active'),
            ),
        }),
    ]);

    if (studentData.length === 0) return notFound();
    const student = studentData[0];

    // Enforce strict multi-tenant boundary checks
    const studentOrgId = student.organisationId ?? student.parent.organisationId;
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

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <StudentProfile
                student={{
                    ...student,
                    bookings: studentBookings,
                    attendanceStats: attendanceResults
                }}
                initialNotes={initialNotes}
                currentUserId={session.user.id}
                currentUserRole={userRole}
                billingConfig={billingConfig ?? null}
            />
        </div>
    );
}
