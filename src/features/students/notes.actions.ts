'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { db } from '@/db';
import { studentNotes, children, parents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

async function assertChildAccess(childId: string, session: any) {
    const [student] = await db
        .select({
            id: children.id,
            parentId: children.parentId,
            centreId: children.centreId,
            organisationId: children.organisationId,
        })
        .from(children)
        .where(eq(children.id, childId))
        .limit(1);

    if (!student) {
        throw new Error('Student not found');
    }

    let studentOrgId = student.organisationId;
    if (!studentOrgId && student.parentId) {
        const [parent] = await db
            .select({ organisationId: parents.organisationId })
            .from(parents)
            .where(eq(parents.id, student.parentId))
            .limit(1);
        studentOrgId = parent?.organisationId ?? null;
    }

    if (!studentOrgId || studentOrgId !== session.user.organisationId) {
        throw new Error('Forbidden');
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (accessibleCentreIds.length === 0 || (student.centreId && !accessibleCentreIds.includes(student.centreId))) {
            throw new Error('Forbidden');
        }
    }
}

export async function getStudentNotes(childId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    try {
        await assertChildAccess(childId, session);
    } catch {
        return [];
    }

    const notes = await db.query.studentNotes.findMany({
        where: eq(studentNotes.childId, childId),
        orderBy: [desc(studentNotes.createdAt)],
    });

    return notes;
}

export async function addStudentNote(
    childId: string,
    content: string,
    category: string = 'General',
    options?: {
        noteType?: 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical';
        subject?: string;
        rating?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
    }
) {
    const session = await requireTenantSession();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    await assertChildAccess(childId, session);

    // Try to get name from session user Object
    let authorName = 'Staff Member';
    if (session.user.name) {
        authorName = session.user.name;
    } else if ((session.user as any).firstName || (session.user as any).lastName) {
        authorName = `${(session.user as any).firstName || ''} ${(session.user as any).lastName || ''}`.trim();
    }

    await db.insert(studentNotes).values({
        childId,
        userId: session.user.id,
        content,
        authorName,
        category,
        noteType: options?.noteType ?? 'general',
        subject: options?.subject ?? null,
        rating: options?.rating ?? null,
    });

    // Revalidate paths where this might be used
    revalidatePath(`/dashboard/students/${childId}`);
    revalidatePath('/dashboard/students');
    
    return { success: true };
}


async function authorizeNoteMutation(noteId: string, actionLabel: string = 'modify this note') {
    const session = await requireTenantSession();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const note = await db.query.studentNotes.findFirst({
        where: eq(studentNotes.id, noteId),
    });
    if (!note) {
        throw new Error('Note not found');
    }

    await assertChildAccess(note.childId, session);

    const userRole = (session.user as any).role;
    const isAuthor = note.userId === session.user.id;
    const isAdmin = userRole === 'ORG_OWNER' || userRole === 'MANAGER';
    if (!isAuthor && !isAdmin) {
        throw new Error(`Unauthorized: Only the author or an Admin can ${actionLabel}`);
    }

    return note;
}

export async function deleteStudentNote(noteId: string) {
    const note = await authorizeNoteMutation(noteId, 'delete this note');

    await db.delete(studentNotes).where(eq(studentNotes.id, noteId));

    revalidatePath(`/dashboard/students/${note.childId}`);
    revalidatePath('/dashboard/students');
    
    return { success: true };
}

export async function toggleStudentNotePin(noteId: string, pinned: boolean) {
    const note = await authorizeNoteMutation(noteId, 'pin/unpin notes');

    await db.update(studentNotes)
        .set({ pinnedAt: pinned ? new Date() : null })
        .where(eq(studentNotes.id, noteId));

    revalidatePath(`/dashboard/students/${note.childId}`);
    revalidatePath('/dashboard/students');

    return { success: true };
}

export async function editStudentNote(
    noteId: string,
    content: string,
    category: string = 'General',
    options?: {
        noteType?: 'general' | 'progress' | 'behaviour' | 'subject_feedback' | 'attendance_concern' | 'medical';
        subject?: string;
        rating?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
    }
) {
    if (!content || !content.trim()) {
        const session = await requireTenantSession();
        if (!session?.user?.id) {
            throw new Error('Unauthorized');
        }
        throw new Error('Note content cannot be empty');
    }

    const note = await authorizeNoteMutation(noteId, 'edit this note');

    // Perform the database update safely preserving non-updated optional fields
    await db.update(studentNotes)
        .set({
            content: content.trim(),
            category,
            noteType: options?.noteType ?? note.noteType,
            subject: options?.subject !== undefined ? options.subject : note.subject,
            rating: options?.rating !== undefined ? options.rating : note.rating,
            updatedAt: new Date(),
        })
        .where(eq(studentNotes.id, noteId));

    revalidatePath(`/dashboard/students/${note.childId}`);
    revalidatePath('/dashboard/students');

    return { success: true };
}
