import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, staffInvites, organisations } from '@/db/schema';
import { eq, and, or, lt, isNotNull } from 'drizzle-orm';
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

        // If the user has been removed from the org (organisationId is null),
        // they can't log in — silently succeed (don't reveal account status)
        if (!user.organisationId) {
            console.warn(`[Magic Link] User ${email} has no organisationId — access revoked`);
            return NextResponse.json({ success: true });
        }

        // Fetch the organisation name for the email sender
        const [org] = await db
            .select({ name: organisations.name })
            .from(organisations)
            .where(eq(organisations.id, user.organisationId))
            .limit(1);

        // Generate a new magic link token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry

        // Clean up any used or expired invite/login records for this email address first
        await db.delete(staffInvites).where(
            and(
                eq(staffInvites.email, email),
                or(
                    isNotNull(staffInvites.usedAt),
                    lt(staffInvites.expiresAt, new Date())
                )
            )
        );

        // Store as a staff invite (reusing the table)
        await db.insert(staffInvites).values({
            organisationId: user.organisationId,
            email,
            role: user.role,
            token,
            expiresAt,
        });

        // Build the magic link
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const magicLink = `${protocol}://${host}/accept-invite?token=${token}`;

        // Send the email — sender will show as "[Org Name] via SprintScale"
        const emailResult = await emailService.sendMagicLink({
            email,
            name: user.name || user.firstName || 'there',
            magicLink,
            orgName: org?.name,
        });

        if (!emailResult.success) {
            console.error(`[Magic Link] Failed to send email to ${email}:`, emailResult.error);
            return NextResponse.json({ error: 'Failed to send login link' }, { status: 500 });
        }

        console.log(`[Magic Link] Sent to ${email}, token expires at ${expiresAt.toISOString()}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Magic Link] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to send login link' }, { status: 500 });
    }
}
