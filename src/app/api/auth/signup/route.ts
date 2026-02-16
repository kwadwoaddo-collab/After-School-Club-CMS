import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, organisations } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, password, phone } = body;

        // Validation
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existingUser.length > 0) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate slug from organisation name
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        // Create organisation
        const [organisation] = await db
            .insert(organisations)
            .values({
                name: name,
                slug: slug,
                contactEmail: email,
                contactPhone: phone || '',
            })
            .returning();

        //Create user
        await db.insert(users).values({
            email: email,
            passwordHash: hashedPassword,
            name: email.split('@')[0], // Use email prefix as name
            role: 'ORG_OWNER',
            organisationId: organisation.id,
        });

        return NextResponse.json(
            { message: 'Account created successfully' },
            { status: 201 }
        );
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Failed to create account. Please try again.' },
            { status: 500 }
        );
    }
}
