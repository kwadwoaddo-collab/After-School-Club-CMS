import { studentLifecycleStatusSql } from '@/features/students/lifecycle-queries';
import { expectedRosterIds } from '@/features/students/expected-roster';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { authorisedCollectors, bookings, children, studentNotes } from '@/db/schema';
import { eq, and, gte, lte, inArray, isNull } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { startOfDay, endOfDay, format } from 'date-fns';
import KioskRegister, { type AuthorisedCollectorSummary, type MedicalNoteSummary } from './KioskRegister';
import { compileDailyRegisterSlots } from '@/lib/attendance';
import { logger } from '@/lib/logger';

export default async function KioskPage(props: {
    searchParams: Promise<{ centre?: string }>;
}) {
    const rawParams = await props.searchParams;
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) redirect('/login');

    const orgCentres = await getUserAccessibleCentres(session.user.id);
    const centreIds = orgCentres.map(c => c.id);
    const resolvedCentreId = await resolveActiveCentreId(rawParams.centre, centreIds);
    const isZeroCentreStaff = session.user.role !== 'ORG_OWNER' && centreIds.length === 0;
    const activeCentreId = isZeroCentreStaff ? 'all' : resolvedCentreId;

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    // Zero-centre short-circuit: a non-ORG_OWNER staff user with zero accessible
    // centres (or an org with zero centres when viewing 'all') must never query
    // empty/invalid UUIDs — render a clean empty state immediately.
    let allChildrenAtCentre: any[] = [];
    let todayBookings: any[] = [];
    const hasQueryableScope = !isZeroCentreStaff && (activeCentreId !== 'all' || centreIds.length > 0);

    if (hasQueryableScope) {
        const centreFilter = activeCentreId !== 'all'
            ? eq(bookings.centreId, activeCentreId)
            : inArray(bookings.centreId, centreIds);

        const centreChildrenCondition = activeCentreId !== 'all'
            ? eq(children.centreId, activeCentreId)
            : inArray(children.centreId, centreIds);

        try {
            [allChildrenAtCentre, todayBookings] = await Promise.all([
                db.query.children.findMany({
                    where: and(centreChildrenCondition, eq(children.isRegistered, true), isNull(children.deletedAt)),
                    with: { parent: true, centre: true },
                    extras: { effectiveEnrolmentStatus: studentLifecycleStatusSql(enrolmentBusinessDate(now)).as('effective_enrolment_status') },
                }),
                db.query.bookings.findMany({
                    where: and(centreFilter, gte(bookings.startAt, dayStart), lte(bookings.startAt, dayEnd)),
                    with: {
                        centre: true,
                        attendees: {
                            with: {
                                child: true
                            }
                        }
                    },
                }),
            ]);
        } catch (e) {
            logger.error("Error fetching kiosk register", e);
            allChildrenAtCentre = [];
            todayBookings = [];
        }
    }

    const sortedSlots = hasQueryableScope
        ? compileDailyRegisterSlots({
            targetDate: now,
            allChildrenAtCentre,
            expectedChildIds: expectedRosterIds(allChildrenAtCentre),
            dayBookings: todayBookings,
        })
        : [];

    // Index child health fields from already-fetched children + booking attendees
    const childById = new Map<string, any>();
    for (const child of allChildrenAtCentre) {
        if (child?.id) childById.set(child.id, child);
    }
    for (const booking of todayBookings) {
        for (const att of booking?.attendees ?? []) {
            if (att?.child?.id && !childById.has(att.child.id)) {
                childById.set(att.child.id, att.child);
            }
        }
    }

    const listedChildIds = Array.from(
        new Set(
            sortedSlots.flatMap(slot =>
                [...slot.regulars, ...slot.catchups].map(a => a.childId).filter(Boolean)
            )
        )
    );

    const medicalNotesByChild = new Map<string, MedicalNoteSummary[]>();
    const collectorsByChild = new Map<string, AuthorisedCollectorSummary[]>();

    if (hasQueryableScope && listedChildIds.length > 0) {
        try {
            // Strictly query ONLY non-safeguarding Medical notes — NEVER query or expose safeguarding rows.
            const safeguardColumn = (studentNotes as Record<string, any>).isSafeguarding;
            const medicalWhere = safeguardColumn
                ? and(
                    inArray(studentNotes.childId, listedChildIds),
                    eq(studentNotes.category, 'Medical'),
                    eq(safeguardColumn, false),
                )
                : and(
                    inArray(studentNotes.childId, listedChildIds),
                    eq(studentNotes.category, 'Medical'),
                );

            const [rawMedicalNotes, rawCollectors] = await Promise.all([
                db.query.studentNotes
                    ? db.query.studentNotes.findMany({
                        where: medicalWhere,
                        orderBy: (notes, { desc }) => [desc(notes.createdAt)],
                    })
                    : Promise.resolve([]),
                db.query.authorisedCollectors
                    ? db.query.authorisedCollectors.findMany({
                        where: and(
                            inArray(authorisedCollectors.childId, listedChildIds),
                            eq(authorisedCollectors.organisationId, session.user.organisationId),
                        ),
                    })
                    : Promise.resolve([]),
            ]);

            for (const note of rawMedicalNotes as any[]) {
                if (note.category !== 'Medical' || note.isSafeguarding === true) continue;
                const list = medicalNotesByChild.get(note.childId) ?? [];
                list.push({
                    id: note.id,
                    content: note.content,
                    authorName: note.authorName,
                    createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
                });
                medicalNotesByChild.set(note.childId, list);
            }

            for (const col of rawCollectors as any[]) {
                const list = collectorsByChild.get(col.childId) ?? [];
                list.push({
                    id: col.id,
                    name: col.name,
                    relationship: col.relationship,
                    phone: col.phone ?? null,
                    collectionPassword: col.collectionPassword ?? null,
                });
                collectorsByChild.set(col.childId, list);
            }
        } catch (e) {
            logger.error("Error fetching kiosk medical notes or authorised collectors", e);
        }
    }

    const activeCentreName = isZeroCentreStaff
        ? 'No Centres Assigned'
        : activeCentreId !== 'all'
            ? orgCentres.find(c => c.id === activeCentreId)?.name ?? 'All Centres'
            : 'All Centres';

    // Privacy scrub for Kiosk: abbreviate surnames, strip full phone/email, derive 4-digit PIN
    // only when a valid >=4-digit phone exists, and attach structured medical/collector summaries
    // which KioskRegister renders strictly inside staff-initiated modals (never inline on cards).
    const scrubAttendee = (att: any) => {
        const digits = (att.parentPhone || '').replace(/\D/g, '');
        const parentPhoneLast4 = digits.length >= 4 ? digits.slice(-4) : null;
        const childRecord = childById.get(att.childId);
        const allergies = Array.isArray(childRecord?.allergies)
            ? childRecord.allergies.map((a: string) => a?.trim()).filter(Boolean)
            : [];

        return {
            ...att,
            lastName: att.lastName ? att.lastName.charAt(0) + '.' : '',
            parentLastName: att.parentLastName ? att.parentLastName.charAt(0) + '.' : '',
            parentPhone: null,
            parentPhoneLast4,
            parentEmail: null,
            notes: childRecord?.notes?.trim() || att.notes?.trim() || null,
            allergies,
            dietaryRequirements: childRecord?.dietaryRequirements?.trim() || null,
            medicalConditions: childRecord?.medicalConditions?.trim() || null,
            medicationNotes: childRecord?.medicationNotes?.trim() || null,
            medicalNotes: medicalNotesByChild.get(att.childId) ?? [],
            authorisedCollectors: collectorsByChild.get(att.childId) ?? [],
        };
    };

    const scrubbedSlots = sortedSlots.map(slot => ({
        ...slot,
        regulars: slot.regulars.map(scrubAttendee),
        catchups: slot.catchups.map(scrubAttendee)
    }));

    return (
        <KioskRegister
            slots={scrubbedSlots as any}
            date={format(now, 'EEEE, d MMMM yyyy')}
            dateStr={format(now, 'yyyy-MM-dd')}
            centreName={activeCentreName}
            centres={orgCentres}
            activeCentreId={activeCentreId}
        />
    );
}
