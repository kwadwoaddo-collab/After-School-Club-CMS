/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { staffInvites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// ── DELETE /api/staff/invites/[id] — revoke a pending invite ─────────────────
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getApiSession();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const [invite] = await db
        .select({ id: staffInvites.id, role: staffInvites.role })
        .from(staffInvites)
        .where(and(
            eq(staffInvites.id, id),
            eq(staffInvites.organisationId, session.user.organisationId)
        ))
        .limit(1);

    if (!invite) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (userRole !== 'ORG_OWNER' && invite.role === 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden: Managers cannot revoke owner invites' }, { status: 403 });
    }

    await db.delete(staffInvites).where(eq(staffInvites.id, id));

    return NextResponse.json({ success: true });
}
