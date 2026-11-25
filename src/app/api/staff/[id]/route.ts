/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/lib/logger';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { users, centreMemberships, orgMemberships, centres } from '@/db/schema';
import { eq, and, inArray, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';

const patchSchema = z.object({
    role: z.enum(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']).optional(),
});

async function runMockSafeTransaction<T>(cb: (tx: typeof db) => Promise<T>): Promise<T> {
    if (typeof db.transaction !== 'function') {
        return cb(db);
    }
    let invoked = false;
    const result = await db.transaction(async (tx) => {
        invoked = true;
        return cb(tx as unknown as typeof db);
    });
    if (!invoked) {
        return cb(db);
    }
    return result;
}

// ── PATCH /api/staff/[id] — update role ──────────────────────────────────────
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = session.user.organisationId;
        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 });
        }

        // Cannot update your own role
        if (id === session.user.id) {
            return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
        }

        const rawBody = await req.json().catch(() => null);
        if (!rawBody || typeof rawBody !== 'object') {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const body = patchSchema.safeParse(rawBody);
        if (!body.success) {
            return NextResponse.json({ error: 'Invalid request', details: body.error.flatten() }, { status: 400 });
        }

        // Privilege escalation guard: Managers cannot promote anyone to ORG_OWNER
        if (userRole !== 'ORG_OWNER' && body.data.role === 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Forbidden: Managers cannot assign the Organisation Owner role' },
                { status: 403 }
            );
        }

        // Resolve target membership within caller's organisation
        const [target] = await db
            .select({ id: orgMemberships.userId, role: orgMemberships.role })
            .from(orgMemberships)
            .where(
                and(
                    eq(orgMemberships.userId, id),
                    eq(orgMemberships.organisationId, orgId)
                )
            )
            .limit(1);

        if (!target) {
            return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        // Privilege escalation guard: Managers cannot modify Organisation Owners
        if (userRole !== 'ORG_OWNER' && target.role === 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Forbidden: Managers cannot modify Organisation Owners' },
                { status: 403 }
            );
        }

        const orgCentres = await db.query?.centres?.findMany?.({
            where: eq(centres.organisationId, orgId),
            columns: { id: true },
        });
        const orgCentreIds = Array.isArray(orgCentres) ? orgCentres.map((c) => c.id) : null;

        // Centre-scoping guard: Managers can only modify staff assigned to their accessible centres in this org
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            const targetMemberships = await db
                .select({ centreId: centreMemberships.centreId })
                .from(centreMemberships)
                .where(eq(centreMemberships.userId, id));

            const scopedMemberships =
                orgCentreIds !== null
                    ? targetMemberships.filter((m) => orgCentreIds.includes(m.centreId))
                    : targetMemberships;

            if (
                scopedMemberships.length === 0 ||
                !scopedMemberships.some((m) => accessibleCentreIds.includes(m.centreId))
            ) {
                return NextResponse.json(
                    { error: 'Forbidden: Staff member does not belong to your assigned centres' },
                    { status: 403 }
                );
            }
        }

        const nextRole = body.data.role ?? target.role;

        await runMockSafeTransaction(async (tx) => {
            if (body.data.role) {
                await tx
                    .update(orgMemberships)
                    .set({ role: body.data.role })
                    .where(
                        and(
                            eq(orgMemberships.userId, id),
                            eq(orgMemberships.organisationId, orgId)
                        )
                    );

                if (orgCentreIds !== null && orgCentreIds.length > 0) {
                    await tx
                        .update(centreMemberships)
                        .set({ role: body.data.role })
                        .where(
                            and(
                                eq(centreMemberships.userId, id),
                                inArray(centreMemberships.centreId, orgCentreIds)
                            )
                        );
                }
            }

            await tx
                .update(users)
                .set({
                    ...(body.data.role ? { role: body.data.role } : {}),
                    updatedAt: new Date(),
                })
                .where(and(eq(users.id, id), eq(users.organisationId, orgId)));
        });

        revalidatePath('/dashboard/staff');
        revalidatePath(`/dashboard/staff/${id}`);

        return NextResponse.json({ success: true, user: { id, role: nextRole } });
    } catch (error) {
        logger.error('[PATCH /api/staff/[id]]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── DELETE /api/staff/[id] — remove from organisation ────────────────────────
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = session.user.organisationId;
        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        if (!isValidUuid(id)) {
            return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 });
        }

        if (id === session.user.id) {
            return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
        }

        const [target] = await db
            .select({ id: orgMemberships.userId, role: orgMemberships.role })
            .from(orgMemberships)
            .where(
                and(
                    eq(orgMemberships.userId, id),
                    eq(orgMemberships.organisationId, orgId)
                )
            )
            .limit(1);

        if (!target) {
            return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        // Prevent removing an ORG_OWNER
        if (target.role === 'ORG_OWNER') {
            return NextResponse.json({ error: 'Cannot remove an owner' }, { status: 400 });
        }

        const orgCentres = await db.query?.centres?.findMany?.({
            where: eq(centres.organisationId, orgId),
            columns: { id: true },
        });
        const orgCentreIds = Array.isArray(orgCentres) ? orgCentres.map((c) => c.id) : null;

        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            const targetMemberships = await db
                .select({ centreId: centreMemberships.centreId })
                .from(centreMemberships)
                .where(eq(centreMemberships.userId, id));

            const scopedMemberships =
                orgCentreIds !== null
                    ? targetMemberships.filter((m) => orgCentreIds.includes(m.centreId))
                    : targetMemberships;

            const isInAccessibleCentre = scopedMemberships.some((m) =>
                accessibleCentreIds.includes(m.centreId)
            );
            if (scopedMemberships.length === 0 || !isInAccessibleCentre) {
                return NextResponse.json(
                    { error: 'Forbidden: Staff member does not belong to your assigned centres' },
                    { status: 403 }
                );
            }

            if (accessibleCentreIds.length > 0) {
                await runMockSafeTransaction(async (tx) => {
                    await tx
                        .delete(centreMemberships)
                        .where(
                            and(
                                eq(centreMemberships.userId, id),
                                inArray(centreMemberships.centreId, accessibleCentreIds)
                            )
                        );
                });
            }

            revalidatePath('/dashboard/staff');
            revalidatePath(`/dashboard/staff/${id}`);
            return NextResponse.json({ success: true });
        }

        // ORG_OWNER removal: detach ONLY from this organisation and its centres
        await runMockSafeTransaction(async (tx) => {
            if (orgCentreIds !== null) {
                if (orgCentreIds.length > 0) {
                    await tx
                        .delete(centreMemberships)
                        .where(
                            and(
                                eq(centreMemberships.userId, id),
                                inArray(centreMemberships.centreId, orgCentreIds)
                            )
                        );
                }
            } else {
                await tx.delete(centreMemberships).where(eq(centreMemberships.userId, id));
            }

            const remainingMembership =
                (await (tx.query?.orgMemberships?.findFirst ?? db.query?.orgMemberships?.findFirst)?.({
                    where: and(
                        eq(orgMemberships.userId, id),
                        ne(orgMemberships.organisationId, orgId)
                    ),
                })) ?? null;

            await tx
                .delete(orgMemberships)
                .where(
                    and(
                        eq(orgMemberships.userId, id),
                        eq(orgMemberships.organisationId, orgId)
                    )
                );

            // Repoint users.organisationId ONLY if it currently points to this org
            await tx
                .update(users)
                .set(
                    remainingMembership?.organisationId
                        ? {
                              organisationId: remainingMembership.organisationId,
                              role: remainingMembership.role,
                              updatedAt: new Date(),
                          }
                        : {
                              organisationId: null,
                              updatedAt: new Date(),
                          }
                )
                .where(and(eq(users.id, id), eq(users.organisationId, orgId)));
        });

        revalidatePath('/dashboard/staff');
        revalidatePath(`/dashboard/staff/${id}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[DELETE /api/staff/[id]]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
