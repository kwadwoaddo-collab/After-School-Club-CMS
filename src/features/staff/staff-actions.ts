'use server';

import { db } from '@/db';
import { users, orgMemberships, centreMemberships, centres, auditEvents } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const ALLOWED_ROLES = ['TUTOR', 'FRONT_DESK', 'MANAGER', 'ORG_OWNER'] as const;
type StaffRole = typeof ALLOWED_ROLES[number];

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

export async function updateStaffRole(targetUserId: string, newRole: StaffRole) {
    const session = await requireTenantSession();

    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    const orgId = session.user.organisationId;

    // Resolve caller's role in the active organisation
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
        throw new Error('Unauthorized to change staff roles');
    }

    // Prevent anyone from changing their own role
    if (targetUserId === session.user.id) {
        throw new Error('You cannot change your own role');
    }

    if (!ALLOWED_ROLES.includes(newRole)) {
        throw new Error('Invalid role specified');
    }

    // Privilege escalation prevention: Managers cannot promote anyone to ORG_OWNER
    if (currentUser.role !== 'ORG_OWNER' && newRole === 'ORG_OWNER') {
        throw new Error('Forbidden: Managers cannot assign the Organisation Owner role');
    }

    // Resolve target user via orgMemberships so multi-org staff are isolated per organisation
    const [targetUser] = await db
        .select({
            id: orgMemberships.userId,
            role: orgMemberships.role,
            organisationId: orgMemberships.organisationId,
        })
        .from(orgMemberships)
        .where(
            and(
                eq(orgMemberships.userId, targetUserId),
                eq(orgMemberships.organisationId, orgId)
            )
        )
        .limit(1);

    if (!targetUser) {
        throw new Error('Staff member not found or access denied');
    }

    // Privilege escalation prevention: Managers cannot modify an ORG_OWNER
    if (currentUser.role !== 'ORG_OWNER' && targetUser.role === 'ORG_OWNER') {
        throw new Error('Forbidden: Managers cannot modify Organisation Owners');
    }

    const orgCentres = await db.query?.centres?.findMany?.({
        where: eq(centres.organisationId, orgId),
        columns: { id: true },
    });
    const orgCentreIds = Array.isArray(orgCentres) ? orgCentres.map((c) => c.id) : null;

    // Centre-scoping for managers: fail-closed when target has no centre membership in this org
    // or none of their org centres overlap the manager's accessible centres.
    if (currentUser.role !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const memberships = await db
            .select({ centreId: centreMemberships.centreId })
            .from(centreMemberships)
            .where(eq(centreMemberships.userId, targetUserId));

        const targetOrgCentreMemberships =
            orgCentreIds !== null
                ? memberships.filter((m) => orgCentreIds.includes(m.centreId))
                : memberships;

        if (
            targetOrgCentreMemberships.length === 0 ||
            !targetOrgCentreMemberships.some((m) => accessibleCentreIds.includes(m.centreId))
        ) {
            throw new Error('Forbidden: Staff member does not belong to your assigned centres');
        }
    }

    await runMockSafeTransaction(async (tx) => {
        // 1. Update authoritative orgMemberships role for this organisation
        await tx
            .update(orgMemberships)
            .set({ role: newRole })
            .where(
                and(
                    eq(orgMemberships.userId, targetUserId),
                    eq(orgMemberships.organisationId, orgId)
                )
            );

        // 2. Update users.role ONLY if this organisation is currently the user's active organisation
        await tx
            .update(users)
            .set({ role: newRole, updatedAt: new Date() })
            .where(and(eq(users.id, targetUserId), eq(users.organisationId, orgId)));

        // 3. Keep org-scoped centreMemberships.role in sync without touching other organisations
        if (orgCentreIds !== null && orgCentreIds.length > 0) {
            await tx
                .update(centreMemberships)
                .set({ role: newRole })
                .where(
                    and(
                        eq(centreMemberships.userId, targetUserId),
                        inArray(centreMemberships.centreId, orgCentreIds)
                    )
                );
        }

        // 4. Record audit event
        if (typeof tx.insert === 'function') {
            await tx.insert(auditEvents).values({
                organisationId: orgId,
                userId: session.user.id,
                eventType: 'staff_role_updated',
                eventData: JSON.stringify({
                    targetUserId,
                    previousRole: targetUser.role ?? null,
                    newRole,
                }),
            });
        }
    });

    revalidatePath(`/dashboard/staff/${targetUserId}`);
    revalidatePath('/dashboard/staff');
}
