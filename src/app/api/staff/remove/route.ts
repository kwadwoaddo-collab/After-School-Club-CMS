import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centreMemberships } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any).role !== 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await request.json();

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Prevent removing yourself
    if (userId === session.user.id) {
        return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
    }

    // Verify the user belongs to this org
    const [targetUser] = await db
        .select()
        .from(users)
        .where(
            and(
                eq(users.id, userId),
                eq(users.organisationId, session.user.organisationId)
            )
        )
        .limit(1);

    if (!targetUser) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Remove all centre memberships
    await db
        .delete(centreMemberships)
        .where(eq(centreMemberships.userId, userId));

    // Detach from organisation — they lose access on their next page load
    await db
        .update(users)
        .set({ organisationId: null })
        .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
}
