import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { CURRENT_TERMS_VERSION } from '@/lib/constants/legal';
import { validatePassword, normalizeEmail, MAX_EMAIL_LENGTH, MAX_NAME_LENGTH } from '@/lib/validations/auth';
import { hashToken } from '@/lib/magic-link';
import { emailService } from '@/lib/services/email';

export async function POST(request: NextRequest) {
    try {
        // Rate limit: 10 signup attempts per minute per IP
        const ip = getClientIP(request);
        const rateLimitResult = await checkRateLimit(authRateLimit, `signup:${ip}`);
        if (!rateLimitResult.success) {
            if (rateLimitResult.status === 'unavailable') {
                return NextResponse.json(
                    { error: 'Authentication service temporarily unavailable. Please try again later.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'Too many signup attempts. Please try again later.' },
                { status: 429 }
            );
        }

        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const firstName = body?.firstName;
        const lastName = body?.lastName;
        const email = body?.email;
        const password = body?.password;
        const acceptedTerms = body?.acceptedTerms;

        if (!email || !password || !firstName || !lastName) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // PM-1.3A: Mandatory server-side Terms of Service acceptance
        if (acceptedTerms !== true) {
            return NextResponse.json(
                { error: 'You must accept the Terms of Service to create an account' },
                { status: 400 }
            );
        }

        if (typeof firstName !== 'string' || firstName.trim().length === 0 || firstName.length > MAX_NAME_LENGTH) {
            return NextResponse.json(
                { error: `First name is required and must not exceed ${MAX_NAME_LENGTH} characters` },
                { status: 400 }
            );
        }

        if (typeof lastName !== 'string' || lastName.trim().length === 0 || lastName.length > MAX_NAME_LENGTH) {
            return NextResponse.json(
                { error: `Last name is required and must not exceed ${MAX_NAME_LENGTH} characters` },
                { status: 400 }
            );
        }

        if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return NextResponse.json(
                { error: 'A valid email address is required' },
                { status: 400 }
            );
        }

        if (typeof password !== 'string') {
            return NextResponse.json(
                { error: 'Password is required' },
                { status: 400 }
            );
        }

        // PM-2E2.B4: Validate password minimum characters and bcrypt 72-byte limit
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: passwordValidation.error },
                { status: 400 }
            );
        }

        const normalizedEmail = normalizeEmail(email);

        // Check if user already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        if (existingUser.length > 0) {
            // PM-2E2.B4 (F05 Resolution): Perform dummy bcrypt hash to maintain computational
            // timing symmetry and return normalized response to eliminate account enumeration oracle.
            await bcrypt.hash(password, 10);
            logger.info(`[Signup] Account registration requested for existing email — neutral response returned`);
            return NextResponse.json(
                { message: 'Account created successfully' },
                { status: 201 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

        // PM-2E2.B4.F: Generate secure verification token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24); // 24-hour expiration

        // Create unverified user and pending verification token
        await db.transaction(async (tx) => {
            await tx.insert(users).values({
                email: normalizedEmail,
                passwordHash: hashedPassword,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                name: fullName,
                role: 'ORG_OWNER',
                organisationId: null,
                emailVerified: null,
                termsAcceptedAt: new Date(),
                termsVersion: CURRENT_TERMS_VERSION,
            });

            await tx.insert(verificationTokens).values({
                identifier: normalizedEmail,
                token: tokenHash,
                expires: expiry,
            });
        });

        // Build verification URL with raw token
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const verificationUrl = `${protocol}://${host}/api/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

        // Send email verification asynchronously
        await emailService.sendEmailVerification({
            email: normalizedEmail,
            name: firstName.trim(),
            verificationUrl,
        });

        return NextResponse.json(
            { message: 'Account created successfully' },
            { status: 201 }
        );
    } catch (error) {
        logger.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Failed to create account. Please try again.' },
            { status: 500 }
        );
    }
}
