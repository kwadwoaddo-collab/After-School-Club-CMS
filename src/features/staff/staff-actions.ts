'use server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

const ALLOWED_ROLES = ['TUTOR', 'FRONT_DESK', 'MANAGER', 'ORG_OWNER'] as const;
type StaffRole = typeof ALLOWED_ROLES[number];

export async function updateStaffRole(targetUserId: string, newRole: StaffRole) {
    const session = await auth();

    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    // Only ORG_OWNERs can change roles
    const [currentUser] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

    if (!currentUser || currentUser.role !== 'ORG_OWNER') {
        throw new Error('Only Organisation Owners can change staff roles');
    }

    // Prevent owners from changing their own role
    if (targetUserId === session.user.id) {
        throw new Error('You cannot change your own role');
    }

    if (!ALLOWED_ROLES.includes(newRole)) {
        throw new Error('Invalid role specified');
    }

    // Verify target user belongs to the same organisation
    const [targetUser] = await db
        .select({ id: users.id, organisationId: users.organisationId })
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.organisationId, session.user.organisationId)))
        .limit(1);

    if (!targetUser) {
        throw new Error('Staff member not found or access denied');
    }

    await db
        .update(users)
        .set({ role: newRole, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

    revalidatePath(`/dashboard/staff/${targetUserId}`);
    revalidatePath('/dashboard/staff');
}
