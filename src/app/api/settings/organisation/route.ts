import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq, not } from 'drizzle-orm';

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const organisationId = session.user.organisationId;

        // Only org owners should update this, check if user is ORG_OWNER
        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 });
        }

        const newName = name.trim();

        // Generate a base slug from the name
        let baseSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        let newSlug = baseSlug;
        let suffix = 1;

        // Ensure the generated slug is unique across other organisations
        while (true) {
            const existingOrg = await db.query.organisations.findFirst({
                where: (org, { and, eq, not }) => and(
                    eq(org.slug, newSlug),
                    not(eq(org.id, organisationId))
                )
            });

            if (!existingOrg) {
                break; // Slug is unique
            }
            // If conflict, append a number
            newSlug = `${baseSlug}-${suffix}`;
            suffix++;
        }

        // Update organisation
        const [updatedOrg] = await db
            .update(organisations)
            .set({ name: newName, slug: newSlug })
            .where(eq(organisations.id, organisationId))
            .returning();

        if (!updatedOrg) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, org: updatedOrg });
    } catch (error) {
        console.error('Update organisation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
