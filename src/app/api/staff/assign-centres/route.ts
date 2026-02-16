import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centreMemberships } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

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

        const body = await request.json();
        const { userId, centreIds } = body as { userId: string; centreIds: string[] };

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

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
        console.error('Centre assignment error:', error);
        return NextResponse.json(
            { error: 'Failed to update centre assignments' },
            { status: 500 }
        );
    }
}
