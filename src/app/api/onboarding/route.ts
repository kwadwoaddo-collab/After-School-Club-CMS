import { logger } from '@/lib/logger';
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

        // 1. Execute database operations atomically in a transaction
        const org = await db.transaction(async (tx) => {
            // Create Organisation
            const [newOrg] = await tx.insert(organisations).values({
                name: data.organisationName,
                slug: orgSlug,
                brandColor: data.brandColor,
                logoUrl: data.logoUrl,
            }).returning();

            // Create Centre
            await tx.insert(centres).values({
                organisationId: newOrg.id,
                name: data.centreName,
                slug: centreSlug,
            });

            // Update User and verify update succeeded
            const [updatedUser] = await tx.update(users)
                .set({ organisationId: newOrg.id, role: 'ORG_OWNER' })
                .where(eq(users.id, session.user.id))
                .returning();

            if (!updatedUser) {
                throw new Error('User not found or update failed');
            }

            return newOrg;
        });

        return NextResponse.json({ success: true, orgId: org.id });
    } catch (error) {
        logger.error('Onboarding error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Validation failed',
                details: error.issues
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
