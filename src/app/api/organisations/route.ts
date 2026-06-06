import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organisations, users, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

const registrationSchema = z.object({
    organisationName: z.string().min(2).max(255),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    contactEmail: z.string().email(),
    password: z.string().min(8).max(128),
    contactPhone: z.string().max(20).optional(),
    website: z.string().url().max(255).optional().or(z.literal('')),
    privacyPolicyUrl: z.string().url().max(500).optional().or(z.literal('')),
    address: z.string().max(1000).optional(),
    description: z.string().max(5000).optional(),
    logoUrl: z.string().url().max(500).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 10 registration attempts per minute per IP
        const ip = getClientIP(req);
        const { success: allowed } = await checkRateLimit(authRateLimit, `org-register:${ip}`);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.' },
                { status: 429 }
            );
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const parsed = registrationSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const {
            organisationName,
            firstName,
            lastName,
            contactEmail,
            password,
            contactPhone,
            website,
            privacyPolicyUrl,
            address,
            description,
            logoUrl,
        } = parsed.data;

        // Check if user email already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, contactEmail),
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already in use' },
                { status: 409 }
            );
        }

        // Check if org name already exists (slug collision check)
        const slug = organisationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const existingOrg = await db.query.organisations.findFirst({
            where: eq(organisations.slug, slug),
        });

        if (existingOrg) {
            // Simple slug deduplication for MVP
            // In real app we might append numbers or ask user to choose
            return NextResponse.json(
                { error: 'Organisation name is taken (slug collision)' },
                { status: 409 }
            );
        }

        // Hash Password
        const passwordHash = await bcrypt.hash(password, 10);

        // 1. Create Organisation
        const [newOrg] = await db.insert(organisations).values({
            name: organisationName,
            slug: slug,
            contactEmail: contactEmail,
            contactPhone: contactPhone || null,
            website: website || null,
            privacyPolicyUrl: privacyPolicyUrl || null,
            address: address || null,
            description: description || null,
            logoUrl: logoUrl || null,
        }).returning();

        // 2. Create User (Org Owner)
        await db.insert(users).values({
            organisationId: newOrg.id,
            email: contactEmail,
            firstName: firstName,
            lastName: lastName,
            role: 'ORG_OWNER',
            passwordHash: passwordHash,
        });

        // 3. Create Default Centre
        await db.insert(centres).values({
            organisationId: newOrg.id,
            name: `${organisationName} Main`,
            slug: slug, // Default centre slug matches org slug for simplicity in standard URLs
            address: address || null,
            operatingHours: JSON.stringify({
                monday: { start: '11:00', end: '18:30' },
                tuesday: { start: '11:00', end: '18:30' },
                wednesday: { start: '11:00', end: '18:30' },
                thursday: { start: '11:00', end: '18:30' },
                friday: { start: '11:00', end: '18:30' },
                saturday: { start: '11:00', end: '18:30' },
                sunday: { start: '11:00', end: '18:30' },
            })
        });

        const response = NextResponse.json({
            success: true,
            redirectUrl: '/login?registered=true'
        }, { status: 201 });

        // Set a simple cookie for MVP session management
        response.cookies.set('org_slug', slug, {
            path: '/',
            httpOnly: true, // Never expose cookies to client-side JS
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });

        return response;

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
