/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const patchSchema = z.object({
    role: z.enum(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']).optional(),
});

// ── PATCH /api/staff/[id] — update role ──────────────────────────────────────
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ORG_OWNER can change roles
    if ((session.user as any).role !== 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Cannot update your own role
    if (id === session.user.id) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Verify target user belongs to same org
    const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, id), eq(users.organisationId, session.user.organisationId)))
        .limit(1);

    if (!target) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const body = patchSchema.safeParse(await req.json());
    if (!body.success) {
        return NextResponse.json({ error: 'Invalid request', details: body.error.flatten() }, { status: 400 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.data.role) updates.role = body.data.role;

    const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning({ id: users.id, role: users.role });

    return NextResponse.json({ success: true, user: updated });
}

// ── DELETE /api/staff/[id] — remove from organisation ────────────────────────
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any).role !== 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.user.id) {
        return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, id), eq(users.organisationId, session.user.organisationId)))
        .limit(1);

    if (!target) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Prevent removing another ORG_OWNER
    if (target.role === 'ORG_OWNER') {
        return NextResponse.json({ error: 'Cannot remove another owner. Change their role first.' }, { status: 400 });
    }

    // Detach from org (nullify organisationId rather than hard-delete to preserve audit trail)
    await db
        .update(users)
        .set({ organisationId: null, updatedAt: new Date() })
        .where(eq(users.id, id));

    return NextResponse.json({ success: true });
}
