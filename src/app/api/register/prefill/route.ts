import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { parents, children, centres } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        // 1. Verify prefill token (JWT signature + expiry)
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-at-least-32-chars-long');
        let payload: any;
        try {
            const result = await jwtVerify(token, secret);
            payload = result.payload;
        } catch (err) {
            logger.error('[Prefill API] Token verification failed:', err);
            return NextResponse.json({ error: 'Invalid or expired prefill token' }, { status: 400 });
        }

        const { parentId, centreId, childIds } = payload;
        if (!parentId || !centreId) {
            return NextResponse.json({ error: 'Malformed token payload' }, { status: 400 });
        }

        // S-1 fix: Establish the requested centre's organisation BEFORE fetching
        // any parent or child PII.
        //
        // The original code fetched the parent by parentId alone. A valid prefill
        // token issued for Org A (parentId=A, centreId=A) could be presented to
        // the prefill API and receive Org A parent/child PII — even if the caller
        // were operating in an Org B registration context.
        //
        // Resolution:
        //   (a) Resolve the centre from the token's centreId to get its organisationId.
        //   (b) Verify the parent's organisationId matches that of the centre.
        //   (c) Verify neither the parent nor the children are soft-deleted.
        //   (d) Only then return PII.

        // 2. Resolve centre to get organisation context
        const centre = await db.query.centres.findFirst({
            where: eq(centres.id, centreId),
            columns: { id: true, organisationId: true },
        });
        if (!centre) {
            return NextResponse.json({ error: 'Centre not found' }, { status: 404 });
        }

        // 3. Fetch parent — must belong to this centre's organisation and not be soft-deleted
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, parentId),
                eq(parents.organisationId, centre.organisationId),  // S-1: org isolation
                isNull(parents.deletedAt)                            // S-2 pattern: exclude deleted
            ),
        });
        if (!parent) {
            // Cross-org token or deleted parent — return 404 without revealing which
            return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
        }

        // 4. Fetch children of this parent at this centre (must not be soft-deleted)
        let parentChildren = await db.query.children.findMany({
            where: and(
                eq(children.parentId, parentId),
                eq(children.centreId, centreId),
                isNull(children.deletedAt),  // S-4 pattern: exclude deleted children
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
        }));

        return NextResponse.json({
            success: true,
            parentId,
            centreId,
            parents: transformedParents,
            children: transformedChildren,
        });
    } catch (err) {
        logger.error('[Prefill API] Error:', err);
        return NextResponse.json({ error: 'Failed to fetch prefill details' }, { status: 500 });
    }
}
