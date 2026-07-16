import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        // 1. Verify prefill token
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-at-least-32-chars-long');
        let payload: any;
        try {
            const result = await jwtVerify(token, secret);
            payload = result.payload;
        } catch (err) {
            console.error('[Prefill API] Token verification failed:', err);
            return NextResponse.json({ error: 'Invalid or expired prefill token' }, { status: 400 });
        }

        const { parentId, centreId } = payload;
        if (!parentId || !centreId) {
            return NextResponse.json({ error: 'Malformed token payload' }, { status: 400 });
        }

        // 2. Fetch Parent details
        const parent = await db.query.parents.findFirst({
            where: eq(parents.id, parentId),
        });
        if (!parent) {
            return NextResponse.json({ error: 'Parent record not found' }, { status: 404 });
        }

        // 3. Fetch all children of this parent at this centre
        const parentChildren = await db.query.children.findMany({
            where: and(
                eq(children.parentId, parentId),
                eq(children.centreId, centreId),
            ),
        });

        // 4. Transform to match form expected schema
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
        console.error('[Prefill API] Error:', err);
        return NextResponse.json({ error: 'Failed to fetch prefill details' }, { status: 500 });
    }
}
