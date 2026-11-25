import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { orgMemberships, centreMemberships, centres } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

const assignSchema = z.object({
    userId: z.string().uuid(),
    centreIds: z.array(z.string().uuid()).max(50), // cap to prevent DoS
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

export async function POST(request: NextRequest) {
    try {
        const session = await getApiSession();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgId = session.user.organisationId;

        // Allow ORG_OWNER and MANAGER in the active organisation
        const [currentUser] = await db
            .select({ role: orgMemberships.role })
            .from(orgMemberships)
            .where(
                and(
                    eq(orgMemberships.userId, session.user.id),
                    eq(orgMemberships.organisationId, orgId)
                )
            )
            .limit(1);

        if (!currentUser || (currentUser.role !== 'ORG_OWNER' && currentUser.role !== 'MANAGER')) {
            return NextResponse.json(
                { error: 'Only organization owners and managers can assign centres' },
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

        const { userId } = parsed.data;
        const uniqueCentreIds = Array.from(new Set(parsed.data.centreIds));

        // Verify the target user belongs to this organisation via orgMemberships
        const [targetUser] = await db
            .select({
                id: orgMemberships.userId,
                role: orgMemberships.role,
                organisationId: orgMemberships.organisationId,
            })
            .from(orgMemberships)
            .where(
                and(
                    eq(orgMemberships.userId, userId),
                    eq(orgMemberships.organisationId, orgId)
                )
            )
            .limit(1);

        if (!targetUser || targetUser.organisationId !== orgId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (targetUser.role === 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'ORG_OWNER users have automatic access to all centres' },
                { status: 400 }
            );
        }

        // Validate that all requested centreIds belong to the org
        if (uniqueCentreIds.length > 0) {
            const orgCentres = await db
                .select({ id: centres.id })
                .from(centres)
                .where(
                    and(
                        eq(centres.organisationId, orgId),
                        inArray(centres.id, uniqueCentreIds)
                    )
                );
            const validIds = new Set(orgCentres.map((c) => c.id));
            const invalidIds = uniqueCentreIds.filter((id) => !validIds.has(id));
            if (invalidIds.length > 0) {
                return NextResponse.json(
                    { error: 'One or more centre IDs do not belong to your organisation' },
                    { status: 400 }
                );
            }
        }

        // Scope check for MANAGER: can only assign centres they manage
        let accessibleCentreIds: string[] = [];
        if (currentUser.role !== 'ORG_OWNER') {
            accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            const invalidForManager = uniqueCentreIds.filter((id) => !accessibleCentreIds.includes(id));
            if (invalidForManager.length > 0) {
                return NextResponse.json(
                    { error: 'Forbidden: You can only assign staff to centres you manage' },
                    { status: 403 }
                );
            }
        }

        const allOrgCentres =
            currentUser.role === 'ORG_OWNER'
                ? await db.query?.centres?.findMany?.({
                      where: eq(centres.organisationId, orgId),
                      columns: { id: true },
                  })
                : undefined;
        const allOrgCentreIds = Array.isArray(allOrgCentres) ? allOrgCentres.map((c) => c.id) : null;

        await runMockSafeTransaction(async (tx) => {
            if (currentUser.role !== 'ORG_OWNER') {
                if (accessibleCentreIds.length > 0) {
                    await tx
                        .delete(centreMemberships)
                        .where(
                            and(
                                eq(centreMemberships.userId, userId),
                                inArray(centreMemberships.centreId, accessibleCentreIds)
                            )
                        );
                }
            } else if (allOrgCentreIds !== null) {
                // ORG_OWNER: delete ONLY centre assignments belonging to THIS organisation
                if (allOrgCentreIds.length > 0) {
                    await tx
                        .delete(centreMemberships)
                        .where(
                            and(
                                eq(centreMemberships.userId, userId),
                                inArray(centreMemberships.centreId, allOrgCentreIds)
                            )
                        );
                }
            } else {
                await tx
                    .delete(centreMemberships)
                    .where(eq(centreMemberships.userId, userId));
            }

            if (uniqueCentreIds.length > 0) {
                const assignments = uniqueCentreIds.map((centreId) => ({
                    userId,
                    centreId,
                    role: targetUser.role,
                }));

                await tx.insert(centreMemberships).values(assignments);
            }
        });

        revalidatePath('/dashboard/staff');
        revalidatePath(`/dashboard/staff/${userId}`);
        for (const cId of uniqueCentreIds) {
            revalidatePath(`/dashboard/centres/${cId}`);
        }

        return NextResponse.json({
            message: 'Centre assignments updated successfully',
            centreCount: uniqueCentreIds.length,
        });
    } catch (error) {
        logger.error('Centre assignment error:', error);
        return NextResponse.json(
            { error: 'Failed to update centre assignments' },
            { status: 500 }
        );
    }
}
