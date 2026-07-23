import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { staffInvites } from '@/db/schema';
import { and, eq, isNull, lt } from 'drizzle-orm';

// DELETE /api/staff/invites/clear-expired - removes all expired+unused invites for the org
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if ((session.user as any).role !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const deleted = await db
            .delete(staffInvites)
            .where(
                and(
                    eq(staffInvites.organisationId, session.user.organisationId),
                    isNull(staffInvites.usedAt),
                    lt(staffInvites.expiresAt, new Date())
                )
            )
            .returning({ id: staffInvites.id });

        return NextResponse.json({ success: true, count: deleted.length });
    } catch (error) {
        logger.error('[DELETE /api/staff/invites/clear-expired]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
