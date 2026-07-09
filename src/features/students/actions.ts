'use server';

import { db } from '@/db';
import { children, parents, organisations } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function getStudentExportData() {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Tutors are not allowed to export data
    if ((session.user as any).role === 'TUTOR') {
        throw new Error('Forbidden: Tutors cannot export reports');
    }

    return await db
        .select({
            studentId: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            parentFirstName: parents.firstName,
            parentLastName: parents.lastName,
            parentEmail: parents.email,
            parentPhone: parents.phone,
            createdAt: children.createdAt,
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .where(eq(parents.organisationId, session.user.organisationId))
        .orderBy(desc(children.createdAt));
}

