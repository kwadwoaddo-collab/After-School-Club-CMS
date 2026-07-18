import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees, registrationChildren } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import StudentProfile from '@/components/students/StudentProfile';
import { getStudentNotes } from '@/features/students/notes.actions';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { fetchStudentBillingConfig } from '@/features/billing/queries';

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

    // Consolidated parallel database queries
    const [studentData, bookingsRaw, initialNotes, [attendanceResults]] = await Promise.all([

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
            parentId: children.parentId,
            registrationId: registrationChildren.registrationId,
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
    ]);

    if (studentData.length === 0) return notFound();
    const student = studentData[0];

    // Enforce strict multi-tenant boundary
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

    // Fetch siblings at the same centre (for the billing card's children checkboxes)
    const siblings = student.centreId
        ? await db.select({ id: children.id, firstName: children.firstName, lastName: children.lastName })
            .from(children)
            .where(and(
                eq(children.parentId, student.parentId),
                eq(children.centreId, student.centreId),
            ))
        : [];

    // Fetch family billing config — plain query, no serialization issues
    let billingConfig = null as import('@/features/billing/queries').StudentBillingConfig | null;
    try {
        billingConfig = await fetchStudentBillingConfig(id, student.parentId, session.user.organisationId);
    } catch (err) {
        console.error('[student-profile] fetchStudentBillingConfig failed:', err);
    }

    return (
        <div className="pb-12">
            <StudentProfile
                student={{
                    ...student,
                    bookings: studentBookings,
                    attendanceStats: attendanceResults
                }}
                initialNotes={initialNotes}
                currentUserId={session.user.id}
                currentUserRole={userRole}
                billingConfig={billingConfig}
                siblings={siblings}
            />
        </div>
    );
}
