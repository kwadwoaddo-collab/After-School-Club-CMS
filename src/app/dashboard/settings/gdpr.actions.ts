'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { requireTenantSession } from '@/lib/session';
import { db } from '@/db';
import {
    auditEvents,
    children,
    parents,
    registrations,
    bookings,
    organisations,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';

export const WHOLE_ORG_EXPORT_SAR_NOTICE =
    'CONTROLLER WHOLE-ORGANISATION ARCHIVE: Contains personal data across multiple families. Do NOT send raw output in response to an individual family Subject Access Request without redacting third-party data (UK GDPR Art. 15(4)).';

/**
 * Export all student, parent, registration, and booking data for the organisation as a JSON archive.
 *
 * IMPORTANT (UK GDPR Art. 15(4) & Art. 5(2)):
 * - Intended exclusively as an `ORG_OWNER` controller data-portability / off-boarding backup.
 * - Must NEVER be disclosed unredacted to an individual parent/carer Subject Access Request (SAR),
 *   as it contains personal data belonging to other families and children.
 * - Every execution records an immutable `gdpr_org_export` entry in `audit_events`.
 */
export async function exportOrganisationData(): Promise<{
    ok: boolean;
    json?: string;
    error?: string;
}> {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) return { ok: false, error: 'Unauthorised' };
    if ((session.user as any).role !== 'ORG_OWNER') return { ok: false, error: 'Forbidden' };

    const orgId = session.user.organisationId;
    const actorUserId = session.user.id;

    try {
        const userCentres = await getUserAccessibleCentres(actorUserId);
        const userCentreIds = userCentres.map(c => c.id);

        // Fetch controller archive records scoped to this organisation
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

        const exportedAt = new Date().toISOString();
        const summary = {
            totalParents: orgParents.length,
            totalStudents: orgChildren.length,
            totalRegistrations: orgRegistrations.length,
            totalBookings: orgBookings.length,
        };

        await db.insert(auditEvents).values({
            organisationId: orgId,
            userId: actorUserId,
            eventType: 'gdpr_org_export',
            eventData: JSON.stringify({
                actorUserId,
                exportedAt,
                ...summary,
            }),
        });

        const payload = {
            exportedAt,
            dataProtectionNotice: WHOLE_ORG_EXPORT_SAR_NOTICE,
            organisation: org,
            summary,
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
