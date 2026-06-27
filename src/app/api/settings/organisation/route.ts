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
        const { name, slug: customSlug, contactEmail, contactPhone, address } = body;

        const updateData: any = {};

        // Contact details — allow empty string to clear the field
        if (contactEmail !== undefined) updateData.contactEmail = contactEmail.trim() || null;
        if (contactPhone !== undefined) updateData.contactPhone = contactPhone.trim() || null;
        if (address !== undefined) updateData.address = address.trim() || null;

        if (name && typeof name === 'string' && name.trim() !== '') {
            updateData.name = name.trim();
        }

        if (customSlug && typeof customSlug === 'string' && customSlug.trim() !== '') {
            // Validate slug format
            const sanitizedSlug = customSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            if (sanitizedSlug !== customSlug) {
                return NextResponse.json({ error: 'Slug must be lowercase alphanumeric with hyphens' }, { status: 400 });
            }

            // Check uniqueness
            const existingOrg = await db.query.organisations.findFirst({
                where: (org, { and, eq, not }) => and(
                    eq(org.slug, sanitizedSlug),
                    not(eq(org.id, organisationId))
                )
            });

            if (existingOrg) {
                return NextResponse.json({ error: 'Slug is already taken' }, { status: 400 });
            }

            updateData.slug = sanitizedSlug;
        } else if (updateData.name && !customSlug) {
            // Only generate new slug from name if the user didn't provide a custom one
            // and we are updating the name.
            const baseSlug = updateData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            let newSlug = baseSlug;
            let suffix = 1;

            while (true) {
                const existingOrg = await db.query.organisations.findFirst({
                    where: (org, { and, eq, not }) => and(
                        eq(org.slug, newSlug),
                        not(eq(org.id, organisationId))
                    )
                });

                if (!existingOrg) {
                    break;
                }
                newSlug = `${baseSlug}-${suffix}`;
                suffix++;
            }
            updateData.slug = newSlug;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid data provided' }, { status: 400 });
        }

        // Update organisation
        const [updatedOrg] = await db
            .update(organisations)
            .set(updateData)
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
