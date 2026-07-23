'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
    children,
    parents,
    registrations,
    registrationParents,
    registrationChildren,
    bookings,
    bookingAttendees,
    organisations,
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';

/**
 * Export all student, parent, and registration data for the organisation as a JSON blob.
 * Intended for GDPR subject-access requests.
 */
export async function exportOrganisationData(): Promise<{
    ok: boolean;
    json?: string;
    error?: string;
}> {
    const session = await auth();
    if (!session?.user?.organisationId) return { ok: false, error: 'Unauthorised' };
    if ((session.user as any).role !== 'ORG_OWNER') return { ok: false, error: 'Forbidden' };

    const orgId = session.user.organisationId;
 
    try {
        const userCentres = await getUserAccessibleCentres(session.user.id);
        const userCentreIds = userCentres.map(c => c.id);

        // Fetch everything
        const [org, orgParents, orgChildren, orgRegistrations, orgBookings] = await Promise.all([
            db.query.organisations.findFirst({
                where: eq(organisations.id, orgId),
                columns: { name: true, slug: true, contactEmail: true, contactPhone: true, address: true, createdAt: true },
            }),
            db.query.parents.findMany({
                where: eq(parents.organisationId, orgId),
                columns: {
                    id: true, firstName: true, lastName: true, email: true, phone: true,
                    relationship: true, addressLine1: true, city: true, postcode: true, createdAt: true,
                },
            }),
            db.query.children.findMany({
                where: eq(children.organisationId, orgId),
                columns: {
                    id: true, firstName: true, lastName: true, dateOfBirth: true,
                    schoolYear: true, notes: true, createdAt: true,
                },
            }),
            db.query.registrations.findMany({
                where: eq(registrations.organisationId, orgId),
                with: {
                    registrationParents: true,
                    registrationChildren: true,
                },
                columns: {
                    id: true, status: true, startDate: true, fundingTypes: true,
                    hasSpecialNeeds: true, specialNeedsDetails: true,
                    emergencyContactName: true, emergencyContactPhone: true,
                    emergencyContactRelationship: true, submittedAt: true,
                },
            }),
            userCentreIds.length > 0
                ? db.query.bookings.findMany({
                    where: inArray(bookings.centreId, userCentreIds),
                    with: {
                        attendees: {
                            with: { child: { columns: { firstName: true, lastName: true } } },
                        },
                    },
                    columns: {
                        id: true, startAt: true, duration: true, status: true,
                        modality: true, assessmentType: true, createdAt: true,
                    },
                })
                : Promise.resolve([]),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            organisation: org,
            summary: {
                totalParents: orgParents.length,
                totalStudents: orgChildren.length,
                totalRegistrations: orgRegistrations.length,
                totalBookings: orgBookings.length,
            },
            parents: orgParents,
            students: orgChildren,
            registrations: orgRegistrations,
            bookings: orgBookings,
        };

        return { ok: true, json: JSON.stringify(payload, null, 2) };
    } catch (err) {
        logger.error('[GDPR Export]', err);
        return { ok: false, error: 'Export failed. Please try again.' };
    }
}
