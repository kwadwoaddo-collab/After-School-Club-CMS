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

import { studentNotes, users } from '@/db/schema';
import { revalidatePath } from 'next/cache';

export async function addStudentNote(childId: string, content: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const [author] = await db
        .select({ name: users.name, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, session.user.id));
    
    if (!author) throw new Error('Author not found');

    const authorName = (author.firstName && author.lastName) ? `${author.firstName} ${author.lastName}` : (author.name || 'Unknown User');

    await db.insert(studentNotes).values({
        childId,
        userId: session.user.id,
        authorName,
        content,
    });

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/students');
}

export async function deleteStudentNote(noteId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const [note] = await db.select().from(studentNotes).where(eq(studentNotes.id, noteId));
    if (!note) throw new Error('Note not found');

    if (note.userId !== session.user.id && (session.user as any).role !== 'ORG_OWNER' && (session.user as any).role !== 'MANAGER') {
        throw new Error('Unauthorized to delete this note');
    }

    await db.delete(studentNotes).where(eq(studentNotes.id, noteId));

    revalidatePath('/dashboard/bookings');
    revalidatePath('/dashboard/students');
}
