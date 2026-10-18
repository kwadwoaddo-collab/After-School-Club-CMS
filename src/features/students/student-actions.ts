'use server';

import { db } from '@/db';
import { children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireTenantSession } from '@/lib/session';
import * as permissions from '@/lib/permissions';

export async function updateStudentSchedule(studentId: string, sessions: string[]) {
    const session = await requireTenantSession();
    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole && !['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
        throw new Error('Forbidden: You do not have permission to update student schedules');
    }

    // Verify student belongs to user's organisation
    const student = await db.query.children.findFirst({
        where: eq(children.id, studentId),
    });

    if (!student || student.organisationId !== session.user.organisationId) {
        throw new Error('Student not found or unauthorized');
    }

    if (userRole !== 'ORG_OWNER') {
        if (!student.centreId) {
            throw new Error('Forbidden: No access to unassigned student');
        }
        if ('getUserAccessibleCentreIds' in permissions) {
            const accessibleIds = await permissions.getUserAccessibleCentreIds(session.user.id);
            if (!accessibleIds.includes(student.centreId)) {
                throw new Error('Forbidden: No access to this centre');
            }
        } else if ('canUserAccessCentre' in permissions) {
            const hasAccess = await permissions.canUserAccessCentre(session.user.id, student.centreId);
            if (!hasAccess) {
                throw new Error('Forbidden: No access to this centre');
            }
        }
    }

    // Update registeredSessions
    await db.update(children)
        .set({
            registeredSessions: sessions,
            updatedAt: new Date(),
        })
        .where(and(eq(children.id, studentId), eq(children.organisationId, session.user.organisationId)));

    revalidatePath(`/dashboard/students/${studentId}`);
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/attendance`);
}
