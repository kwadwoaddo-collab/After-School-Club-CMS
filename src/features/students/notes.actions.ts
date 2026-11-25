'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '@/db';
import { studentNotes, children, parents } from '@/db/schema';
import { and, eq, desc, ne } from 'drizzle-orm';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

const MAX_NOTE_CONTENT_LENGTH = 5000;

function canManageSafeguardingNotes(role: unknown): boolean {
    return role === 'ORG_OWNER' || role === 'MANAGER';
}

function isSafeguardingCategory(category: string | null | undefined): boolean {
    return (category ?? '').trim().toLowerCase() === 'safeguarding';
}

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
        if (userRole === 'TUTOR' && !student.centreId) {
            throw new Error('Forbidden');
        }
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

    const canViewSafeguarding = canManageSafeguardingNotes((session.user as any).role);

    const notes = await db.query.studentNotes.findMany({
        where: canViewSafeguarding
            ? eq(studentNotes.childId, childId)
            : and(eq(studentNotes.childId, childId), ne(studentNotes.category, 'Safeguarding')),
        orderBy: [desc(studentNotes.createdAt)],
    });

    return canViewSafeguarding
        ? notes
        : notes.filter((note) => !isSafeguardingCategory(note.category));
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

    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    if (!trimmedContent) {
        throw new Error('Note content cannot be empty');
    }
    if (trimmedContent.length > MAX_NOTE_CONTENT_LENGTH) {
        throw new Error(`Note content cannot exceed ${MAX_NOTE_CONTENT_LENGTH} characters`);
    }

    const normalizedCategory = isSafeguardingCategory(category) ? 'Safeguarding' : (category?.trim() || 'General');
    if (normalizedCategory === 'Safeguarding' && !canManageSafeguardingNotes((session.user as any).role)) {
        throw new Error('Forbidden: Only Managers and Organisation Owners can create safeguarding notes');
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
        category: normalizedCategory,
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
    if (isSafeguardingCategory(note.category) && !canManageSafeguardingNotes(userRole)) {
        throw new Error('Forbidden: Only Managers and Organisation Owners can access safeguarding notes');
    }

    const isAuthor = note.userId === session.user.id;
    const isAdmin = canManageSafeguardingNotes(userRole);
    if (!isAuthor && !isAdmin) {
        throw new Error(`Unauthorized: Only the author or an Admin can ${actionLabel}`);
    }

    return { note, userRole };
}

export async function deleteStudentNote(noteId: string) {
    const { note } = await authorizeNoteMutation(noteId, 'delete this note');

    await db.delete(studentNotes).where(eq(studentNotes.id, noteId));

    revalidatePath(`/dashboard/students/${note.childId}`);
    revalidatePath('/dashboard/students');

    return { success: true };
}

export async function toggleStudentNotePin(noteId: string, pinned: boolean) {
    const { note } = await authorizeNoteMutation(noteId, 'pin/unpin notes');

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
    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    if (!trimmedContent) {
        const session = await requireTenantSession();
        if (!session?.user?.id) {
            throw new Error('Unauthorized');
        }
        throw new Error('Note content cannot be empty');
    }
    if (trimmedContent.length > MAX_NOTE_CONTENT_LENGTH) {
        const session = await requireTenantSession();
        if (!session?.user?.id) {
            throw new Error('Unauthorized');
        }
        throw new Error(`Note content cannot exceed ${MAX_NOTE_CONTENT_LENGTH} characters`);
    }

    const { note, userRole } = await authorizeNoteMutation(noteId, 'edit this note');

    const normalizedCategory = isSafeguardingCategory(category) ? 'Safeguarding' : (category?.trim() || note.category || 'General');
    if (normalizedCategory === 'Safeguarding' && !canManageSafeguardingNotes(userRole)) {
        throw new Error('Forbidden: Only Managers and Organisation Owners can set safeguarding category');
    }

    // Perform the database update safely preserving non-updated optional fields
    await db.update(studentNotes)
        .set({
            content: trimmedContent,
            category: normalizedCategory,
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
