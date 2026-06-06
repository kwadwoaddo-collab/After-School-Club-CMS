import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { staffInvites } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if ((session.user as any).role !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        if (!UUID_RE.test(id)) {
            return NextResponse.json({ error: 'Invalid invite ID' }, { status: 400 });
        }

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
    } catch (error) {
        console.error('[DELETE /api/staff/invites/[id]]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
