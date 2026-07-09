'use server';

import { db } from '@/db';
import { children } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export async function updateStudentSchedule(studentId: string, sessions: string[]) {
    const session = await auth();
    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    // Verify student belongs to user's organisation
    const student = await db.query.children.findFirst({
        where: eq(children.id, studentId),
    });

    if (!student || student.organisationId !== session.user.organisationId) {
        throw new Error('Student not found or unauthorized');
    }

    // Update registeredSessions
    await db.update(children)
        .set({
            registeredSessions: sessions,
            updatedAt: new Date(),
        })
        .where(eq(children.id, studentId));

    revalidatePath(`/dashboard/students/${studentId}`);
    revalidatePath(`/dashboard/attendance`);
}
