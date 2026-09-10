import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { generateMagicLinkToken, hashToken } from '@/lib/magic-link';
import { EmailService } from '@/lib/services/email';
import { getBaseUrl } from '@/lib/base-url';
import { normalizeEmail, MAX_EMAIL_LENGTH } from '@/lib/validations/auth';

const GENERIC_PORTAL_LOGIN_MESSAGE = 'If an account exists with this email, a login link has been sent.';

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 5 login attempts per minute per IP
        const ip = getClientIP(req);
        const rateLimitResult = await checkRateLimit(strictRateLimit, `portal:${ip}`);
        if (!rateLimitResult.success) {
            if (rateLimitResult.status === 'unavailable') {
                return NextResponse.json(
                    { error: 'Login service temporarily unavailable. Please try again later.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.' },
                { status: 429 }
            );
        }

        let body: Record<string, unknown>;
        try {
            body = (await req.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { email } = body;
        if (!email || typeof email !== 'string' || email.trim().length === 0) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }

        const normalizedEmail = normalizeEmail(email);

        // Find parent
        const parent = await db.query.parents.findFirst({
            where: eq(parents.email, normalizedEmail),
        });

        if (!parent) {
            // Security (PM-2E2.B4): Don't reveal account existence.
            return NextResponse.json({ success: true, message: GENERIC_PORTAL_LOGIN_MESSAGE });
        }

        const rawToken = generateMagicLinkToken();
        const hashedToken = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await db.update(parents)
            .set({ magicLinkToken: hashedToken, magicLinkExpiresAt: expiresAt })
            .where(eq(parents.id, parent.id));

        const baseUrl = getBaseUrl();
        const magicLink = `${baseUrl}/portal/verify?token=${rawToken}`;

        const emailService = new EmailService();
        const emailResult = await emailService.sendMagicLink({
            email: normalizedEmail,
            name: parent.firstName,
            magicLink,
        });

        if (!emailResult.success) {
            logger.error('Portal login error: failed to send magic link email', emailResult.error);
            return NextResponse.json({ error: 'Failed to send login email. Please try again later.' }, { status: 500 });
        }

        // Only expose the link in development (never in production)
        const response: Record<string, any> = {
            success: true,
            message: GENERIC_PORTAL_LOGIN_MESSAGE,
        };
        if (process.env.NODE_ENV === 'development') {
            response.debugLink = magicLink;
        }

        return NextResponse.json(response);
    } catch (error) {
        logger.error('Portal login error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
