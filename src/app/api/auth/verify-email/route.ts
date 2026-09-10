import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { hashToken } from '@/lib/magic-link';
import { normalizeEmail } from '@/lib/validations/auth';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

/**
 * GET /api/auth/verify-email
 * Validates the email verification token, activates user account by setting emailVerified,
 * consumes the single-use verification token, and redirects to login with confirmation.
 */
export async function GET(request: NextRequest) {
    try {
        const ip = getClientIP(request);
        const rateLimitResult = await checkRateLimit(authRateLimit, `verify-email:${ip}`);
        if (!rateLimitResult.success) {
            return NextResponse.redirect(new URL('/login?error=RateLimited', request.url));
        }

        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const email = searchParams.get('email');

        if (!token || !email || typeof token !== 'string' || typeof email !== 'string') {
            return NextResponse.redirect(new URL('/login?error=InvalidVerificationToken', request.url));
        }

        const normalizedEmail = normalizeEmail(email);
        const hashedToken = hashToken(token);

        // Find active verification token for this email identifier
        const [record] = await db
            .select()
            .from(verificationTokens)
            .where(
                and(
                    eq(verificationTokens.identifier, normalizedEmail),
                    eq(verificationTokens.token, hashedToken),
                    gt(verificationTokens.expires, new Date())
                )
            )
            .limit(1);

        if (!record) {
            logger.warn(`[VerifyEmail] Verification token invalid or expired for ${normalizedEmail}`);
            return NextResponse.redirect(new URL('/login?error=ExpiredOrInvalidToken', request.url));
        }

        // Atomically set emailVerified on user and delete the consumed token (single-use)
        await db.transaction(async (tx) => {
            await tx
                .update(users)
                .set({
                    emailVerified: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(users.email, normalizedEmail));

            await tx
                .delete(verificationTokens)
                .where(
                    and(
                        eq(verificationTokens.identifier, normalizedEmail),
                        eq(verificationTokens.token, hashedToken)
                    )
                );
        });

        logger.info(`[VerifyEmail] Email successfully verified for ${normalizedEmail}`);
        return NextResponse.redirect(new URL('/login?verified=true', request.url));
    } catch (error) {
        logger.error('[VerifyEmail] Error verifying email:', error);
        return NextResponse.redirect(new URL('/login?error=VerificationFailed', request.url));
    }
}
