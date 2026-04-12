import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations, centres, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
    organisationName: z.string().min(2, "Organisation name must be at least 2 characters"),
    centreName: z.string().min(2, "Centre name must be at least 2 characters"),
    brandColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
    logoUrl: z.string().optional(),
});

function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check DB directly — session token may be stale right after Google OAuth
    const existingUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
    });

    if (existingUser?.organisationId) {
        return NextResponse.json({ error: 'Organisation already set up' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const data = schema.parse(body);

        const orgSlug = generateSlug(data.organisationName);
        const centreSlug = generateSlug(data.centreName);

        // 1. Create Organisation
        const [org] = await db.insert(organisations).values({
            name: data.organisationName,
            slug: orgSlug,
            brandColor: data.brandColor,
            logoUrl: data.logoUrl,
        }).returning();

        // 2. Create Centre
        await db.insert(centres).values({
            organisationId: org.id,
            name: data.centreName,
            slug: centreSlug,
        });

        // 3. Update User
        await db.update(users)
            .set({ organisationId: org.id, role: 'ORG_OWNER' })
            .where(eq(users.id, session.user.id));

        return NextResponse.json({ success: true, orgId: org.id });
    } catch (error: any) {
        console.error('Onboarding error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Validation failed',
                details: error.errors
            }, { status: 400 });
        }

        const pgErrorCode = error?.code || error?.cause?.code;
        if (pgErrorCode === '23505') {
            return NextResponse.json({
                error: 'An organisation with this name already exists. Please choose a different name.'
            }, { status: 409 });
        }

        return NextResponse.json({
            error: 'Failed to create organisation.',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
