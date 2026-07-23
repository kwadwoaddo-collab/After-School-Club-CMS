import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centreMemberships } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if ((session.user as any).role !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let body: { userId?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { userId } = body;

        if (!userId || typeof userId !== 'string') {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        if (!UUID_RE.test(userId)) {
            return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
        }

        // Prevent removing yourself
        if (userId === session.user.id) {
            return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
        }

        // Verify the user belongs to this org
        const [targetUser] = await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.id, userId),
                    eq(users.organisationId, session.user.organisationId)
                )
            )
            .limit(1);

        if (!targetUser) {
            return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        // Remove all centre memberships
        await db
            .delete(centreMemberships)
            .where(eq(centreMemberships.userId, userId));

        // Detach from organisation — they lose access on their next page load
        await db
            .update(users)
            .set({ organisationId: null })
            .where(eq(users.id, userId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[POST /api/staff/remove]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
