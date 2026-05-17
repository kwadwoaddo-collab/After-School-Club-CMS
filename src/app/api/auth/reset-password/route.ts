import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/services/email';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

/**
 * POST /api/auth/reset-password
 * Request a password reset link (for credential-based ORG_OWNER accounts)
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limit: 5 reset attempts per minute per IP
        const ip = getClientIP(request);
        const { success: allowed } = await checkRateLimit(strictRateLimit, `reset:${ip}`);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many reset attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Look up user — always return success to prevent email enumeration
        const user = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase().trim()),
        });

        // Only process credential users who have a password set
        if (user && user.passwordHash) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 1); // 1 hour expiry

            // Store token on user
            await db.update(users).set({
                passwordResetToken: token,
                passwordResetExpiry: expiry,
            }).where(eq(users.id, user.id));

            // Build reset URL
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            const host = request.headers.get('host') || 'localhost:3000';
            const resetUrl = `${protocol}://${host}/reset-password?token=${token}`;

            // Send email
            await emailService.sendPasswordReset({
                email: user.email,
                name: user.firstName || user.name || 'there',
                resetUrl,
            });

            console.log(`[PasswordReset] Reset link sent to ${email}`);
        } else {
            console.log(`[PasswordReset] No credential account found for ${email} — silently succeeding`);
        }

        // Always return success
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[PasswordReset] Error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

/**
 * PATCH /api/auth/reset-password
 * Confirm token and update password
 */
export async function PATCH(request: NextRequest) {
    try {
        const { token, newPassword } = await request.json();

        if (!token || !newPassword) {
            return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        // Find user by reset token
        const user = await db.query.users.findFirst({
            where: eq(users.passwordResetToken, token),
        });

        if (!user || !user.passwordResetExpiry) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        // Check token hasn't expired
        if (new Date() > new Date(user.passwordResetExpiry)) {
            return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
        }

        // Hash new password
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await db.update(users).set({
            passwordHash,
            passwordResetToken: null,
            passwordResetExpiry: null,
            updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        console.log(`[PasswordReset] Password updated for user ${user.email}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[PasswordReset] Error updating password:', error);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }
}
