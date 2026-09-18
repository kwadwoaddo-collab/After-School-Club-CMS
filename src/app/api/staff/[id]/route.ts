/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { users, centreMemberships, orgMemberships } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const patchSchema = z.object({
    role: z.enum(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']).optional(),
});

// ── PATCH /api/staff/[id] — update role ──────────────────────────────────────
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getApiSession();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
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

    // Privilege escalation guard: Managers cannot modify Organisation Owners
    if (userRole !== 'ORG_OWNER' && target.role === 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden: Managers cannot modify Organisation Owners' }, { status: 403 });
    }

    const body = patchSchema.safeParse(await req.json());
    if (!body.success) {
        return NextResponse.json({ error: 'Invalid request', details: body.error.flatten() }, { status: 400 });
    }

    // Privilege escalation guard: Managers cannot promote anyone to ORG_OWNER
    if (userRole !== 'ORG_OWNER' && body.data.role === 'ORG_OWNER') {
        return NextResponse.json({ error: 'Forbidden: Managers cannot assign the Organisation Owner role' }, { status: 403 });
    }

    // Centre-scoping guard: Managers can only modify staff in their accessible centres
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const targetMemberships = await db
            .select({ centreId: centreMemberships.centreId })
            .from(centreMemberships)
            .where(eq(centreMemberships.userId, id));
        if (targetMemberships.length > 0 && !targetMemberships.some(m => accessibleCentreIds.includes(m.centreId))) {
            return NextResponse.json({ error: 'Forbidden: Staff member does not belong to your assigned centres' }, { status: 403 });
        }
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.data.role) {
        updates.role = body.data.role;
        // Keep orgMemberships in sync
        await db
            .update(orgMemberships)
            .set({ role: body.data.role })
            .where(
                and(
                    eq(orgMemberships.userId, id),
                    eq(orgMemberships.organisationId, session.user.organisationId)
                )
            );
    }

    const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning({ id: users.id, role: users.role });

    revalidatePath('/dashboard/staff');
    revalidatePath(`/dashboard/staff/${id}`);

    return NextResponse.json({ success: true, user: updated });
}

// ── DELETE /api/staff/[id] — remove from organisation ────────────────────────
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getApiSession();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
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

    // Prevent removing an ORG_OWNER
    if (target.role === 'ORG_OWNER') {
        return NextResponse.json({ error: 'Cannot remove an owner' }, { status: 400 });
    }

    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const targetMemberships = await db
            .select({ centreId: centreMemberships.centreId })
            .from(centreMemberships)
            .where(eq(centreMemberships.userId, id));

        const isInAccessibleCentre = targetMemberships.some(m => accessibleCentreIds.includes(m.centreId));
        if (targetMemberships.length > 0 && !isInAccessibleCentre) {
            return NextResponse.json({ error: 'Forbidden: Staff member does not belong to your assigned centres' }, { status: 403 });
        }

        // Remove only accessible centre memberships
        if (accessibleCentreIds.length > 0) {
            await db
                .delete(centreMemberships)
                .where(and(eq(centreMemberships.userId, id), inArray(centreMemberships.centreId, accessibleCentreIds)));
        }

        revalidatePath('/dashboard/staff');
        revalidatePath(`/dashboard/staff/${id}`);
        return NextResponse.json({ success: true });
    }

    // ORG_OWNER full removal: Remove all centre memberships and org memberships
    await db
        .delete(centreMemberships)
        .where(eq(centreMemberships.userId, id));

    await db
        .delete(orgMemberships)
        .where(
            and(
                eq(orgMemberships.userId, id),
                eq(orgMemberships.organisationId, session.user.organisationId)
            )
        );

    // Detach from org (nullify organisationId rather than hard-delete to preserve audit trail)
    await db
        .update(users)
        .set({ organisationId: null, updatedAt: new Date() })
        .where(eq(users.id, id));

    revalidatePath('/dashboard/staff');
    revalidatePath(`/dashboard/staff/${id}`);

    return NextResponse.json({ success: true });
}
