import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { hashToken } from '@/lib/magic-link';
import { emailService } from '@/lib/services/email';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { validatePassword, normalizeEmail, MAX_EMAIL_LENGTH, MAX_TOKEN_LENGTH } from '@/lib/validations/auth';
import { getTrustedApplicationUrl } from '@/lib/base-url';

/**
 * POST /api/auth/reset-password
 * Request a password reset link (for credential-based ORG_OWNER accounts)
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limit: 5 reset attempts per minute per IP
        const ip = getClientIP(request);
        const rateLimitResult = await checkRateLimit(strictRateLimit, `reset:${ip}`);
        if (!rateLimitResult.success) {
            if (rateLimitResult.status === 'unavailable') {
                return NextResponse.json(
                    { error: 'Password reset service temporarily unavailable. Please try again later.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'Too many reset attempts. Please try again later.' },
                { status: 429 }
            );
        }

        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const email = body?.email;

        if (!email || typeof email !== 'string' || email.trim().length === 0) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }

        const normalizedEmail = normalizeEmail(email);

        // Look up user — always return success to prevent email enumeration
        const user = await db.query.users.findFirst({
            where: eq(users.email, normalizedEmail),
        });

        // Only process credential users who have a password set
        if (user && user.passwordHash) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            // TOKEN-2 fix: store SHA-256 hash so DB exposure cannot reset passwords.
            const tokenHash = hashToken(rawToken);
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 1); // 1 hour expiry

            // Store token hash on user
            await db.update(users).set({
                passwordResetToken: tokenHash,
                passwordResetExpiry: expiry,
            }).where(eq(users.id, user.id));

            // PM-2E2.B4.F: Build reset URL with trusted canonical origin
            const baseUrl = getTrustedApplicationUrl();
            const resetUrl = new URL('/reset-password', baseUrl);
            resetUrl.searchParams.set('token', rawToken);

            // Send email
            await emailService.sendPasswordReset({
                email: user.email,
                name: user.firstName || user.name || 'there',
                resetUrl: resetUrl.toString(),
            });

            logger.info(`[PasswordReset] Reset link sent to ${normalizedEmail}`);
        } else {
            logger.info(`[PasswordReset] No credential account found for ${normalizedEmail} — silently succeeding`);
        }

        // Always return success
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[PasswordReset] Error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

/**
 * PATCH /api/auth/reset-password
 * Confirm token and update password
 */
export async function PATCH(request: NextRequest) {
    try {
        // Rate limit: 5 reset confirm attempts per minute per IP
        const ip = getClientIP(request);
        const rateLimitResult = await checkRateLimit(strictRateLimit, `reset-confirm:${ip}`);
        if (!rateLimitResult.success) {
            if (rateLimitResult.status === 'unavailable') {
                return NextResponse.json(
                    { error: 'Password reset service temporarily unavailable. Please try again later.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.' },
                { status: 429 }
            );
        }

        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const token = body?.token;
        const newPassword = body?.newPassword;

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        if (token.length > MAX_TOKEN_LENGTH) {
            return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
        }

        if (!newPassword || typeof newPassword !== 'string') {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }

        // PM-2E2.B4: Validate password minimum characters and bcrypt 72-byte limit
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
        }

        // Find user by reset token (hashed)
        // TOKEN-2 fix: compare hash of received token against stored hash.
        const user = await db.query.users.findFirst({
            where: eq(users.passwordResetToken, hashToken(token.trim())),
        });

        if (!user || !user.passwordResetExpiry) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        // Check token hasn't expired
        if (new Date() > new Date(user.passwordResetExpiry)) {
            return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await db.update(users).set({
            passwordHash,
            passwordResetToken: null,
            passwordResetExpiry: null,
            updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        logger.info(`[PasswordReset] Password updated for user ${user.email}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[PasswordReset] Error updating password:', error);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }
}
