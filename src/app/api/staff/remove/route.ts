import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { users, centreMemberships, orgMemberships } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
    try {
        const session = await getApiSession();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
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

        // Prevent removing another ORG_OWNER
        if (targetUser.role === 'ORG_OWNER') {
            return NextResponse.json({ error: 'Cannot remove another owner. Change their role first.' }, { status: 400 });
        }

        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            const targetMemberships = await db
                .select({ centreId: centreMemberships.centreId })
                .from(centreMemberships)
                .where(eq(centreMemberships.userId, userId));

            const isInAccessibleCentre = targetMemberships.some(m => accessibleCentreIds.includes(m.centreId));
            if (targetMemberships.length > 0 && !isInAccessibleCentre) {
                return NextResponse.json({ error: 'Forbidden: Staff member does not belong to your assigned centres' }, { status: 403 });
            }

            if (accessibleCentreIds.length > 0) {
                await db
                    .delete(centreMemberships)
                    .where(and(eq(centreMemberships.userId, userId), inArray(centreMemberships.centreId, accessibleCentreIds)));
            }

            return NextResponse.json({ success: true });
        }

        // ORG_OWNER full removal: Remove all centre memberships
        await db
            .delete(centreMemberships)
            .where(eq(centreMemberships.userId, userId));

        // Remove org membership
        await db
            .delete(orgMemberships)
            .where(
                and(
                    eq(orgMemberships.userId, userId),
                    eq(orgMemberships.organisationId, session.user.organisationId)
                )
            );

        // Detach from organisation — they lose access immediately on next request
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
