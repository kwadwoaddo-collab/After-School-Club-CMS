import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, staffInvites } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/services/email';

/**
 * POST /api/staff/request-magic-link
 * Allows returning staff to request a new login link.
 * Only works for pre-approved staff emails (users with non-ORG_OWNER roles).
 */
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Find the user - must be a staff member (not ORG_OWNER)
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        // Always return success to prevent email enumeration
        if (!user || user.role === 'ORG_OWNER') {
            return NextResponse.json({ success: true });
        }

        // Generate a new magic link token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry for login links

        // Store as a staff invite (reusing the table)
        await db.insert(staffInvites).values({
            organisationId: user.organisationId!,
            email,
            role: user.role,
            token,
            expiresAt,
        });

        // Build the magic link
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const magicLink = `${protocol}://${host}/accept-invite?token=${token}`;

        // Send the email
        await emailService.sendMagicLink({
            email,
            name: user.name || user.firstName || 'there',
            magicLink,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Magic Link] Error:', error);
        return NextResponse.json({ error: 'Failed to send login link' }, { status: 500 });
    }
}
