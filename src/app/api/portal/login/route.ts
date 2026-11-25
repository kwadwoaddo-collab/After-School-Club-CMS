import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '@/db';
import { parents } from '@/db/schema';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { generateMagicLinkToken, hashToken } from '@/lib/magic-link';
import { EmailService } from '@/lib/services/email';
import { getBaseUrl } from '@/lib/base-url';
import { normalizeEmail, MAX_EMAIL_LENGTH } from '@/lib/validations/auth';
import { assertOrgActive, OrgNotActiveError } from '@/lib/org-approval-guard';

const GENERIC_PORTAL_LOGIN_MESSAGE = 'If an account exists with this email, a login link has been sent.';

function isOrgNotActive(err: unknown): boolean {
    return err instanceof OrgNotActiveError || (err instanceof Error && err.name === 'OrgNotActiveError');
}

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

        // DC-05: Exclude soft-deleted parent records and order deterministically so
        // deleted rows cannot authenticate or shadow active parent accounts.
        const firstCandidate = await db.query.parents.findFirst({
            where: and(
                eq(parents.email, normalizedEmail),
                isNull(parents.deletedAt),
            ),
            orderBy: [desc(parents.updatedAt), desc(parents.createdAt)],
        });

        if (!firstCandidate) {
            // Security (PM-2E2.B4): Don't reveal account existence.
            return NextResponse.json({ success: true, message: GENERIC_PORTAL_LOGIN_MESSAGE });
        }

        // SEC-W4-04: Prefer an ACTIVE organisation row when multiple parent rows share an email,
        // and silently return the generic 200 response without emailing if no org is ACTIVE.
        let parent: typeof firstCandidate | null = null;
        try {
            await assertOrgActive(firstCandidate.organisationId);
            parent = firstCandidate;
        } catch (orgErr) {
            if (!isOrgNotActive(orgErr)) {
                throw orgErr;
            }

            if (typeof db.query.parents.findMany === 'function') {
                const siblingCandidates = await db.query.parents.findMany({
                    where: and(
                        eq(parents.email, normalizedEmail),
                        isNull(parents.deletedAt),
                        ne(parents.id, firstCandidate.id),
                    ),
                    orderBy: [desc(parents.updatedAt), desc(parents.createdAt)],
                });

                for (const candidate of siblingCandidates) {
                    try {
                        await assertOrgActive(candidate.organisationId);
                        parent = candidate;
                        break;
                    } catch (candidateErr) {
                        if (!isOrgNotActive(candidateErr)) {
                            throw candidateErr;
                        }
                    }
                }
            }
        }

        if (!parent) {
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
