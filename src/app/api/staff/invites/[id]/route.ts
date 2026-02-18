import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { staffInvites } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();

    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any).role !== 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Only delete if it belongs to this org
    const deleted = await db
        .delete(staffInvites)
        .where(
            and(
                eq(staffInvites.id, id),
                eq(staffInvites.organisationId, session.user.organisationId)
            )
        )
        .returning({ id: staffInvites.id });

    if (deleted.length === 0) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
