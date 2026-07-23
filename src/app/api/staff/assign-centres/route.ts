import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centreMemberships, centres } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const assignSchema = z.object({
    userId: z.string().uuid(),
    centreIds: z.array(z.string().uuid()).max(50), // cap to prevent DoS
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is ORG_OWNER
        const [currentUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1);

        if (!currentUser || currentUser.role !== 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Only organization owners can assign centres' },
                { status: 403 }
            );
        }

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const parsed = assignSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { userId, centreIds } = parsed.data;

        // Verify the user belongs to the same organisation
        const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!targetUser || targetUser.organisationId !== session.user.organisationId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (targetUser.role === 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'ORG_OWNER users have automatic access to all centres' },
                { status: 400 }
            );
        }

        // Validate that all requested centreIds belong to the org
        if (centreIds.length > 0) {
            const orgCentres = await db
                .select({ id: centres.id })
                .from(centres)
                .where(
                    and(
                        eq(centres.organisationId, session.user.organisationId),
                        inArray(centres.id, centreIds)
                    )
                );
            const validIds = new Set(orgCentres.map((c) => c.id));
            const invalidIds = centreIds.filter((id) => !validIds.has(id));
            if (invalidIds.length > 0) {
                return NextResponse.json(
                    { error: 'One or more centre IDs do not belong to your organisation' },
                    { status: 400 }
                );
            }
        }

        // Remove all existing centre assignments for this user
        await db
            .delete(centreMemberships)
            .where(eq(centreMemberships.userId, userId));

        // Add new centre assignments
        if (centreIds && centreIds.length > 0) {
            const assignments = centreIds.map((centreId) => ({
                userId,
                centreId,
                role: targetUser.role,
            }));

            await db.insert(centreMemberships).values(assignments);
        }

        return NextResponse.json({
            message: 'Centre assignments updated successfully',
            centreCount: centreIds?.length || 0,
        });
    } catch (error) {
        logger.error('Centre assignment error:', error);
        return NextResponse.json(
            { error: 'Failed to update centre assignments' },
            { status: 500 }
        );
    }
}
