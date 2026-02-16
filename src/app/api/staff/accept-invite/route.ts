import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, password, firstName, lastName } = body;

        if (!token || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, invite.email),
        });

        if (existingUser) {
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user account
        await db.insert(users).values({
            email: invite.email,
            passwordHash,
            firstName,
            lastName,
            name: firstName && lastName ? `${firstName} ${lastName}` : invite.email.split('@')[0],
            role: invite.role,
            organisationId: invite.organisationId,
        });

        // Mark invitation as used
        await db
            .update(staffInvites)
            .set({ usedAt: new Date() })
            .where(eq(staffInvites.id, invite.id));

        return NextResponse.json({
            message: 'Account created successfully',
        });
    } catch (error) {
        console.error('Accept invite error:', error);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}
