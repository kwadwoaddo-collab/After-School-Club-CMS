/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { staffInvites, verificationTokens, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
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
        .select({
            id: staffInvites.id,
            role: staffInvites.role,
            email: staffInvites.email,
            token: staffInvites.token,
            usedAt: staffInvites.usedAt,
        })
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
    if (invite.token) {
        await db.delete(verificationTokens).where(
            eq(verificationTokens.identifier, `invite-centre:${invite.token}`)
        );
    }
    if (!invite.usedAt && invite.email) {
        await db.delete(users).where(
            and(
                eq(users.email, invite.email),
                isNull(users.emailVerified),
                isNull(users.organisationId),
                isNull(users.passwordHash)
            )
        );
    }

    return NextResponse.json({ success: true });
}
