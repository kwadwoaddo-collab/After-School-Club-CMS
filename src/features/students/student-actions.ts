'use server';

import { db } from '@/db';
import { children } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
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

    // Verify student is active (not soft-deleted) and belongs to user's organisation
    const student = await db.query.children.findFirst({
        where: and(
            eq(children.id, studentId),
            children.deletedAt ? isNull(children.deletedAt) : undefined
        ),
    });

    if (
        !student ||
        (student as { deletedAt?: Date | null }).deletedAt != null ||
        student.organisationId !== session.user.organisationId
    ) {
        throw new Error('Student not found or unauthorized');
    }

    if (userRole !== 'ORG_OWNER') {
        if (!student.centreId) {
            throw new Error('Forbidden: No access to unassigned student');
        }
        const accessibleIds = await permissions.getUserAccessibleCentreIds(session.user.id);
        if (!accessibleIds.includes(student.centreId)) {
            throw new Error('Forbidden: No access to this centre');
        }
    }

    // Update registeredSessions on non-deleted student
    await db.update(children)
        .set({
            registeredSessions: sessions,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(children.id, studentId),
                eq(children.organisationId, session.user.organisationId),
                children.deletedAt ? isNull(children.deletedAt) : undefined
            )
        );

    revalidatePath(`/dashboard/students/${studentId}`);
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/attendance`);
}
