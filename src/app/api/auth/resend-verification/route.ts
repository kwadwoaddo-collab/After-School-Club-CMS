import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { normalizeEmail, MAX_EMAIL_LENGTH } from '@/lib/validations/auth';
import { hashToken } from '@/lib/magic-link';
import { emailService } from '@/lib/services/email';
import { DUMMY_PASSWORD_HASH } from '@/lib/auth';
import { getTrustedApplicationUrl } from '@/lib/base-url';

/**
 * POST /api/auth/resend-verification
 * 
 * Resends email verification link for unverified accounts.
 * Returns a generic success response regardless of whether the email exists,
 * is already verified, or was sent a new token, eliminating account enumeration.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request);
        const rateLimitResult = await checkRateLimit(authRateLimit, `resend-verify:${ip}`);
        if (!rateLimitResult.success) {
            if (rateLimitResult.status === 'unavailable') {
                return NextResponse.json(
                    { error: 'Authentication service temporarily unavailable. Please try again later.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
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
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }

        if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }

        const normalizedEmail = normalizeEmail(email);

        // Find candidate user
        const [targetUser] = await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.email, normalizedEmail),
                    isNull(users.emailVerified)
                )
            )
            .limit(1);

        if (targetUser && targetUser.passwordHash) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashToken(rawToken);
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 24); // 24-hour expiration

            // Invalidate existing tokens and insert fresh verification token
            await db.transaction(async (tx) => {
                await tx
                    .delete(verificationTokens)
                    .where(eq(verificationTokens.identifier, normalizedEmail));

                await tx.insert(verificationTokens).values({
                    identifier: normalizedEmail,
                    token: tokenHash,
                    expires: expiry,
                });
            });

            // PM-2E2.B4.F: Build verification URL with trusted canonical origin
            const baseUrl = getTrustedApplicationUrl();
            const verificationUrl = new URL('/api/auth/verify-email', baseUrl);
            verificationUrl.searchParams.set('token', rawToken);
            verificationUrl.searchParams.set('email', normalizedEmail);

            await emailService.sendEmailVerification({
                email: normalizedEmail,
                name: targetUser.firstName || targetUser.name || 'User',
                verificationUrl: verificationUrl.toString(),
            });

            logger.info('[ResendVerification] Dispatched verification link for unverified account');
        } else {
            // Constant-time execution symmetry to prevent account enumeration
            await bcrypt.compare('dummy', DUMMY_PASSWORD_HASH);
            logger.info('[ResendVerification] Neutral response for non-eligible or non-existent email');
        }

        return NextResponse.json(
            {
                success: true,
                message: 'If an unverified account exists for this email, a new verification link has been sent.',
            },
            { status: 200 }
        );
    } catch (error) {
        logger.error('[ResendVerification] Error processing resend verification:', error);
        return NextResponse.json(
            { error: 'Failed to process request. Please try again.' },
            { status: 500 }
        );
    }
}
