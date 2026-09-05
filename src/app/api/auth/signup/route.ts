import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { CURRENT_TERMS_VERSION } from '@/lib/constants/legal';

export async function POST(request: NextRequest) {
    try {
        // Rate limit: 10 signup attempts per minute per IP
        const ip = getClientIP(request);
        const { success: allowed } = await checkRateLimit(authRateLimit, `signup:${ip}`);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many signup attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { firstName, lastName, email, password, acceptedTerms } = body;

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

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        if (existingUser.length > 0) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
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
