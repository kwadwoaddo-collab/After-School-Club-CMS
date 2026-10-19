import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users, orgMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashToken } from '@/lib/magic-link';

/**
 * GET /api/staff/magic-login?token=xxx
 * Validates an invite token for passwordless staff magic-login.
 * Security: Rejects existing password-protected accounts, ORG_OWNER accounts,
 * and cross-tenant accounts that do not already belong to the invitation's organisation.
 */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // TOKEN-1 fix: tokens are stored as SHA-256 hashes.
    const [invite] = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.token, hashToken(token)))
        .limit(1);

    if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
        where: eq(users.email, invite.email),
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingMemberships = db.query?.orgMemberships?.findMany
        ? await db.query.orgMemberships.findMany({
              where: eq(orgMemberships.userId, user.id),
          })
        : [];

    const isAlreadyMemberOfInviteOrg =
        (user.organisationId === invite.organisationId && Boolean(user.emailVerified)) ||
        existingMemberships.some((m) => m.organisationId === invite.organisationId);

    const isExistingAccount =
        Boolean(user.passwordHash) ||
        user.role === 'ORG_OWNER' ||
        Boolean(user.organisationId && user.organisationId !== invite.organisationId) ||
        existingMemberships.some((m) => m.organisationId !== invite.organisationId) ||
        Boolean(user.emailVerified && !isAlreadyMemberOfInviteOrg);

    if (isExistingAccount) {
        return NextResponse.json(
            { error: 'Existing accounts cannot be signed in via magic-login token' },
            { status: 403 }
        );
    }

    return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.organisationId ? user.role : invite.role,
        organisationId: user.organisationId || invite.organisationId,
    });
}
