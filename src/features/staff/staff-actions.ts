'use server';

import { db } from '@/db';
import { users, orgMemberships, centreMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const ALLOWED_ROLES = ['TUTOR', 'FRONT_DESK', 'MANAGER', 'ORG_OWNER'] as const;
type StaffRole = typeof ALLOWED_ROLES[number];

export async function updateStaffRole(targetUserId: string, newRole: StaffRole) {
    const session = await requireTenantSession();

    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    // Allow ORG_OWNER and MANAGER
    const [currentUser] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, session.user.id))
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

    // Verify target user belongs to the same organisation
    const [targetUser] = await db
        .select({ id: users.id, role: users.role, organisationId: users.organisationId })
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.organisationId, session.user.organisationId)))
        .limit(1);

    if (!targetUser) {
        throw new Error('Staff member not found or access denied');
    }

    // Privilege escalation prevention: Managers cannot modify an ORG_OWNER
    if (currentUser.role !== 'ORG_OWNER' && targetUser.role === 'ORG_OWNER') {
        throw new Error('Forbidden: Managers cannot modify Organisation Owners');
    }

    // Centre-scoping for managers: target user must belong to manager's accessible centres (if assigned)
    if (currentUser.role !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const memberships = await db
            .select({ centreId: centreMemberships.centreId })
            .from(centreMemberships)
            .where(eq(centreMemberships.userId, targetUserId));
        if (memberships.length > 0 && !memberships.some(m => accessibleCentreIds.includes(m.centreId))) {
            throw new Error('Forbidden: Staff member does not belong to your assigned centres');
        }
    }

    await db
        .update(users)
        .set({ role: newRole, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

    // Keep orgMemberships in sync
    await db
        .update(orgMemberships)
        .set({ role: newRole })
        .where(
            and(
                eq(orgMemberships.userId, targetUserId),
                eq(orgMemberships.organisationId, session.user.organisationId)
            )
        );

    revalidatePath(`/dashboard/staff/${targetUserId}`);
    revalidatePath('/dashboard/staff');
}
