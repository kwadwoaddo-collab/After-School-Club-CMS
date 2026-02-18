import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/staff/magic-login?token=xxx
 * Validates an invite token and returns user info for session creation.
 * Used by the CredentialsProvider in auth.ts.
 */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const [invite] = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.token, token))
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

    return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organisationId: user.organisationId,
    });
}
