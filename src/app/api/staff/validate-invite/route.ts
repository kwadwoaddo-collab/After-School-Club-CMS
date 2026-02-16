import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        const invite = await db.query.staffInvites.findFirst({
            where: eq(staffInvites.token, token),
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

        return NextResponse.json({
            email: invite.email,
            role: invite.role,
            organisationId: invite.organisationId,
        });
    } catch (error) {
        console.error('Validate invite error:', error);
        return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
    }
}
