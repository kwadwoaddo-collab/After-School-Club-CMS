import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users, orgMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashToken } from '@/lib/magic-link';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        // TOKEN-1 fix: tokens are stored as SHA-256 hashes.
        const invite = await db.query.staffInvites.findFirst({
            where: eq(staffInvites.token, hashToken(token)),
        });

        if (!invite) {
            return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
        }

        if (invite.usedAt) {
            return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
        }

        if (new Date() > invite.expiresAt) {
            return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
        }

        let requiresAuth = false;
        let requiresPassword = false;
        if (db.query?.users?.findFirst) {
            const user = await db.query.users.findFirst({
                where: eq(users.email, invite.email),
            });
            if (user) {
                const existingMemberships = db.query?.orgMemberships?.findMany
                    ? await db.query.orgMemberships.findMany({
                          where: eq(orgMemberships.userId, user.id),
                      })
                    : [];
                const isAlreadyMemberOfInviteOrg =
                    (user.organisationId === invite.organisationId && Boolean(user.emailVerified)) ||
                    existingMemberships.some((m) => m.organisationId === invite.organisationId);
                requiresAuth =
                    Boolean(user.passwordHash) ||
                    Boolean(user.organisationId && user.organisationId !== invite.organisationId) ||
                    existingMemberships.some((m) => m.organisationId !== invite.organisationId) ||
                    Boolean(user.emailVerified && !isAlreadyMemberOfInviteOrg);
                requiresPassword = Boolean(user.passwordHash);
            }
        }

        return NextResponse.json({
            email: invite.email,
            role: invite.role,
            organisationId: invite.organisationId,
            requiresAuth,
            requiresPassword,
        });
    } catch (error) {
        logger.error('Validate invite error:', error);
        return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
    }
}
