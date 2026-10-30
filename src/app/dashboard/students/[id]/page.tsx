import { readEnrolmentStart } from '@/features/students/enrolment-start-query';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
import { confirmedEnrolmentChildSql, currentLifecycleStatusChildSql } from '@/lib/enrolment/finance-eligibility';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees, registrationChildren, registrations, registrationParents, studentEnrolmentEvents, studentFollowUpContacts } from '@/db/schema';
import { eq, desc, sql, and, isNull } from 'drizzle-orm';
import StudentLifecyclePanel from '@/features/students/components/StudentLifecyclePanel';
import ConfirmExistingEnrolment from '@/features/students/components/ConfirmExistingEnrolment';
import StudentProfile from '@/features/students/components/StudentProfile';
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
 
    // Same role rule as the Students list (/dashboard/students, requireAuth
    // roles below) and security-p6.test.ts's "TUTOR cannot access student
    // data" case — the list page enforced this, the detail page didn't, so a
    // TUTOR who knew/guessed a student ID could still reach their full
    // profile (medical notes, safeguarding notes, billing, emergency
    // contacts). See project-notes/milestone-3-people-audit.md §2.
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });

    const userRole = (session.user as any).role as string | undefined;
    const isOwner = userRole === 'ORG_OWNER';

    // Consolidated parallel database queries
    const [studentData, bookingsRaw, initialNotes] = await Promise.all([

        db.select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            notes: children.notes,
            registeredSessions: children.registeredSessions,
            centreId: children.centreId,
            centreName: centres.name,
            sessionSlots: centres.sessionSlots,
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
        .leftJoin(centres, eq(children.centreId, centres.id))
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

    // Fetch siblings at the same centre (for the billing card's children checkboxes and prefill link)
    const siblingsRaw = student.centreId
        ? await db.select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            confirmedEnrolment: sql<boolean>`CASE WHEN ${confirmedEnrolmentChildSql()} THEN true ELSE false END`,
            lifecycleStatus: currentLifecycleStatusChildSql(),
        })
            .from(children)
            .where(and(
                eq(children.parentId, student.parentId),
                eq(children.centreId, student.centreId),
                eq(children.organisationId, session.user.organisationId),
                isNull(children.deletedAt),
            ))
        : [];
    const siblings = siblingsRaw.map(s => ({
        ...s,
        confirmedEnrolment: s.confirmedEnrolment !== undefined ? Boolean(s.confirmedEnrolment) : undefined,
        lifecycleStatus: s.lifecycleStatus || undefined,
    }));

    // Fetch full registration detail (for the Registration tab)
    let registrationDetail: {
        id: string;
        status: string;
        startDate: Date | null;
        sessions: string[] | null;
        fundingTypes: string[] | null;
        emergencyContactName: string | null;
        emergencyContactPhone: string | null;
        emergencyContactRelationship: string | null;
        hasSpecialNeeds: boolean | null;
        specialNeedsDetails: string | null;
        parentEmail: string | null;
        parentPhone: string | null;
        parentName: string | null;
        submittedAt: Date | null;
    } | null = null;

    if (student.registrationId) {
        try {
            const [reg, regChildren, regParents] = await Promise.all([
                db.query.registrations.findFirst({
                    where: eq(registrations.id, student.registrationId),
                    columns: {
                        id: true, status: true, startDate: true,
                        fundingTypes: true, emergencyContactName: true,
                        emergencyContactPhone: true, emergencyContactRelationship: true,
                        hasSpecialNeeds: true, specialNeedsDetails: true, submittedAt: true,
                    },
                }),
                db.query.registrationChildren.findMany({
                    where: and(
                        eq(registrationChildren.registrationId, student.registrationId),
                        eq(registrationChildren.childId, id)
                    ),
                    columns: { submittedSessions: true },
                    limit: 1,
                }),
                db.query.registrationParents.findMany({
                    where: and(
                        eq(registrationParents.registrationId, student.registrationId),
                        eq(registrationParents.isPrimary, true)
                    ),
                    columns: {
                        submittedEmail: true, submittedPhone: true,
                        submittedFirstName: true, submittedLastName: true,
                    },
                    limit: 1,
                }),
            ]);

            if (reg) {
                const primaryParent = regParents[0] ?? null;
                registrationDetail = {
                    id: reg.id,
                    status: reg.status,
                    startDate: reg.startDate ?? null,
                    sessions: regChildren[0]?.submittedSessions ?? null,
                    fundingTypes: reg.fundingTypes ?? null,
                    emergencyContactName: reg.emergencyContactName ?? null,
                    emergencyContactPhone: reg.emergencyContactPhone ?? null,
                    emergencyContactRelationship: reg.emergencyContactRelationship ?? null,
                    hasSpecialNeeds: reg.hasSpecialNeeds ?? null,
                    specialNeedsDetails: reg.specialNeedsDetails ?? null,
                    parentEmail: primaryParent?.submittedEmail ?? null,
                    parentPhone: primaryParent?.submittedPhone ?? null,
                    parentName: primaryParent ? `${primaryParent.submittedFirstName} ${primaryParent.submittedLastName}` : null,
                    submittedAt: reg.submittedAt ?? null,
                };
            }
        } catch (err) {
            logger.error('[student-profile] registration detail fetch failed:', err);
        }
    }

    let billingConfig = null as import('@/features/billing/queries').StudentBillingConfig | null;
    try {
        billingConfig = await fetchStudentBillingConfig(id, student.parentId, session.user.organisationId);
    } catch (err) {
        logger.error('[student-profile] fetchStudentBillingConfig failed:', err);
    }

    const enrolmentStart = await readEnrolmentStart(session.user.organisationId, id);
    const [[confirmedEnrolment], enrolmentEvents, followUpContacts] = await Promise.all([
        db.select({ id: children.id }).from(children).where(and(eq(children.id, id), eq(children.organisationId, session.user.organisationId), confirmedEnrolmentChildSql())).limit(1),
        db.query.studentEnrolmentEvents.findMany({ where: and(eq(studentEnrolmentEvents.childId, id), eq(studentEnrolmentEvents.organisationId, session.user.organisationId)), orderBy: [desc(studentEnrolmentEvents.effectiveDate), desc(studentEnrolmentEvents.createdAt), desc(studentEnrolmentEvents.id)] }),
        db.query.studentFollowUpContacts.findMany({ where: and(eq(studentFollowUpContacts.childId, id), eq(studentFollowUpContacts.organisationId, session.user.organisationId)), orderBy: [desc(studentFollowUpContacts.contactedAt), desc(studentFollowUpContacts.id)], limit: 100 }),
    ]);
    return (
        <StudentProfile
            student={{
                ...student,
                bookings: studentBookings,
            }}
            initialNotes={initialNotes}
            currentUserId={session.user.id}
            currentUserRole={userRole}
            billingConfig={billingConfig}
            siblings={siblings}
            registrationDetail={registrationDetail}
        >
            {!student.registrationId && !confirmedEnrolment && ['ORG_OWNER', 'MANAGER'].includes(userRole ?? '') && <ConfirmExistingEnrolment childId={id} />}
            <StudentLifecyclePanel enrolmentStart={enrolmentStart} childId={id} today={enrolmentBusinessDate()} canChangeStatus={['ORG_OWNER', 'MANAGER'].includes(userRole ?? '')} confirmed={Boolean(confirmedEnrolment)} events={enrolmentEvents.map(event => ({ ...event, createdAt: event.createdAt.toISOString() }))} contacts={followUpContacts.map(contact => ({ ...contact, contactedAt: contact.contactedAt.toISOString(), createdAt: contact.createdAt.toISOString() }))} />
        </StudentProfile>
    );
}
