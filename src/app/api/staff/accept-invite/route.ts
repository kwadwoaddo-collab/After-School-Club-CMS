import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/staff/accept-invite
 * Called when staff click their magic link.
 * Marks the invite as used and marks the user as email-verified.
 * The frontend then calls signIn('credentials') with the invite token to create a session.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        // Find and validate the invitation
        const [invite] = await db
            .select()
            .from(staffInvites)
            .where(eq(staffInvites.token, token))
            .limit(1);

        if (!invite) {
            return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
        }

        if (invite.usedAt) {
            return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
        }

        if (new Date() > invite.expiresAt) {
            return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
        }

        // Find the pre-created user account
        const user = await db.query.users.findFirst({
            where: eq(users.email, invite.email),
        });

        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        // Mark email as verified and mark invite as used
        await db
            .update(users)
            .set({ emailVerified: new Date() })
            .where(eq(users.id, user.id));

        await db
            .update(staffInvites)
            .set({ usedAt: new Date() })
            .where(eq(staffInvites.id, invite.id));

        return NextResponse.json({
            success: true,
            email: invite.email,
            name: user.name,
            role: invite.role,
        });
    } catch (error) {
        logger.error('Accept invite error:', error);
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }
}
