import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { parents, children, centres } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify } from 'jose';
import { resolveBookingForRegistration } from '@/lib/services/booking-outcome-sync';
import { getPrefillJwtSecret } from '@/lib/prefill-token';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400, headers: NO_STORE_HEADERS });
        }

        // 1. Verify prefill token (JWT signature + expiry) — fail closed in production if secret unset
        const secret = getPrefillJwtSecret();
        let payload: any;
        try {
            const result = await jwtVerify(token, secret);
            payload = result.payload;
        } catch (err) {
            logger.error('[Prefill API] Token verification failed:', err);
            return NextResponse.json({ error: 'Invalid or expired prefill token' }, { status: 400, headers: NO_STORE_HEADERS });
        }

        const { parentId, centreId, childIds, bookingId: tokenBookingId } = payload;
        const queryBookingId = searchParams.get('bookingId');
        if (!parentId || !centreId) {
            return NextResponse.json({ error: 'Malformed token payload' }, { status: 400, headers: NO_STORE_HEADERS });
        }

        // 2. Resolve centre + parent organisation and enforce ACTIVE approval status
        const centre = await db.query.centres.findFirst({
            where: eq(centres.id, centreId),
            columns: { id: true, organisationId: true },
            with: {
                organisation: {
                    columns: { id: true, approvalStatus: true },
                },
            },
        });
        if (!centre || !centre.organisation) {
            return NextResponse.json({ error: 'Centre not found' }, { status: 404, headers: NO_STORE_HEADERS });
        }

        if (centre.organisation.approvalStatus !== 'ACTIVE') {
            return NextResponse.json({ error: 'Organisation is not active' }, { status: 403, headers: NO_STORE_HEADERS });
        }

        // 3. Fetch parent — must belong to this centre's organisation and not be soft-deleted
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, parentId),
                eq(parents.organisationId, centre.organisationId),
                isNull(parents.deletedAt)
            ),
        });
        if (!parent) {
            return NextResponse.json({ error: 'Parent record not found' }, { status: 404, headers: NO_STORE_HEADERS });
        }

        // 4. Fetch children of this parent at this centre (must not be soft-deleted)
        let parentChildren = await db.query.children.findMany({
            where: and(
                eq(children.parentId, parentId),
                eq(children.centreId, centreId),
                isNull(children.deletedAt),
            ),
        });

        // Filter by selected childIds if specified in the token
        if (childIds && Array.isArray(childIds)) {
            parentChildren = parentChildren.filter(c => childIds.includes(c.id));
        }

        // 5. Transform to match form expected schema
        const transformedParents = [{
            firstName: parent.firstName,
            lastName: parent.lastName,
            email: parent.email || '',
            phone: parent.phone || '',
            relationship: parent.relationship || '',
            addressLine1: parent.addressLine1 || '',
            addressLine2: parent.addressLine2 || '',
            city: parent.city || '',
            postcode: parent.postcode || '',
        }];

        const transformedChildren = parentChildren.map(c => ({
            childId: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
            schoolYear: c.schoolYear || 'Reception',
            sessions: c.registeredSessions || [],
            allergies: c.allergies || [],
            dietaryRequirements: c.dietaryRequirements || '',
            medicalConditions: c.medicalConditions || '',
            medicationNotes: c.medicationNotes || '',
            gpName: c.gpName || '',
            gpPhone: c.gpPhone || '',
            senDetails: c.senDetails || '',
            photoConsent: c.photoConsent ?? false,
            sunCreamConsent: c.sunCreamConsent ?? false,
            firstAidConsent: c.firstAidConsent ?? false,
        }));

        const resolvedBookingId = await resolveBookingForRegistration(db, {
            organisationId: centre.organisationId,
            centreId,
            parentId,
            childIds: parentChildren.map(c => c.id),
            childNames: parentChildren.map(c => ({ firstName: c.firstName, lastName: c.lastName })),
            explicitBookingId: tokenBookingId || queryBookingId || null,
        });

        return NextResponse.json(
            {
                success: true,
                parentId,
                centreId,
                bookingId: resolvedBookingId,
                parents: transformedParents,
                children: transformedChildren,
            },
            { headers: NO_STORE_HEADERS },
        );
    } catch (err) {
        logger.error('[Prefill API] Error:', err);
        return NextResponse.json({ error: 'Failed to fetch prefill details' }, { status: 500, headers: NO_STORE_HEADERS });
    }
}
