import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { CURRENT_TERMS_VERSION } from '@/lib/constants/legal';
import { validatePassword, normalizeEmail, MAX_EMAIL_LENGTH, MAX_NAME_LENGTH } from '@/lib/validations/auth';

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

        // Create user — no org yet, that happens in /onboarding
        await db.insert(users).values({
            email: normalizedEmail,
            passwordHash: hashedPassword,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            name: fullName,
            role: 'ORG_OWNER',
            organisationId: null,
            termsAcceptedAt: new Date(),
            termsVersion: CURRENT_TERMS_VERSION,
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
