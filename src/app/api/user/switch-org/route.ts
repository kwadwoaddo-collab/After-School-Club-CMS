import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, orgMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const switchSchema = z.object({
    orgId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = switchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid orgId' }, { status: 400 });
    }

    const { orgId } = parsed.data;

    // Verify the user actually belongs to this org
    const membership = await db.query.orgMemberships.findFirst({
        where: and(
            eq(orgMemberships.userId, session.user.id),
            eq(orgMemberships.organisationId, orgId)
        ),
    });

    if (!membership) {
        return NextResponse.json(
            { error: 'You are not a member of this organisation' },
            { status: 403 }
        );
    }

    // Update users.organisationId (the "active org" pointer) and role
    await db
        .update(users)
        .set({
            organisationId: orgId,
            role: membership.role,
        })
        .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true, orgId, role: membership.role });
}
