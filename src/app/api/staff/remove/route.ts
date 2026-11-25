import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { users, centreMemberships, orgMemberships, centres } from '@/db/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';

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
        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let body: { userId?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { userId } = body;

        if (!userId || typeof userId !== 'string') {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        if (!isValidUuid(userId)) {
            return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
        }

        // Prevent removing yourself
        if (userId === session.user.id) {
            return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
        }

        // Verify the user belongs to this org via orgMemberships
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

        if (!targetUser) {
            return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        // Prevent removing another ORG_OWNER
        if (targetUser.role === 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Cannot remove another owner. Change their role first.' },
                { status: 400 }
            );
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
                .where(eq(centreMemberships.userId, userId));

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
                                eq(centreMemberships.userId, userId),
                                inArray(centreMemberships.centreId, accessibleCentreIds)
                            )
                        );
                });
            }

            return NextResponse.json({ success: true });
        }

        // ORG_OWNER full removal from THIS organisation only
        await runMockSafeTransaction(async (tx) => {
            if (orgCentreIds !== null) {
                if (orgCentreIds.length > 0) {
                    await tx
                        .delete(centreMemberships)
                        .where(
                            and(
                                eq(centreMemberships.userId, userId),
                                inArray(centreMemberships.centreId, orgCentreIds)
                            )
                        );
                }
            } else {
                await tx
                    .delete(centreMemberships)
                    .where(eq(centreMemberships.userId, userId));
            }

            const remainingMembership =
                (await (tx.query?.orgMemberships?.findFirst ?? db.query?.orgMemberships?.findFirst)?.({
                    where: and(
                        eq(orgMemberships.userId, userId),
                        ne(orgMemberships.organisationId, orgId)
                    ),
                })) ?? null;

            await tx
                .delete(orgMemberships)
                .where(
                    and(
                        eq(orgMemberships.userId, userId),
                        eq(orgMemberships.organisationId, orgId)
                    )
                );

            // Repoint users.organisationId ONLY if it currently points to this organisation
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
                .where(and(eq(users.id, userId), eq(users.organisationId, orgId)));
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[POST /api/staff/remove]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
