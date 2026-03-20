'use server';

import { db } from '@/db';
import { studentNotes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getStudentNotes(childId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const notes = await db.query.studentNotes.findMany({
        where: eq(studentNotes.childId, childId),
        orderBy: [desc(studentNotes.createdAt)],
    });

    return notes;
}

export async function addStudentNote(childId: string, content: string, category: string = 'General') {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

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
    });

    // Revalidate paths where this might be used
    revalidatePath('/dashboard/bookings/[bookingId]', 'page');
    revalidatePath('/dashboard/students/[id]', 'page');
    revalidatePath('/dashboard', 'layout');
    
    return { success: true };
}

export async function deleteStudentNote(noteId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const note = await db.query.studentNotes.findFirst({
        where: eq(studentNotes.id, noteId)
    });

    if (!note) throw new Error('Note not found');

    const userRole = (session.user as any).role;
    if (note.userId !== session.user.id && userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Unauthorized: Only the author or an Admin can delete this note');
    }

    await db.delete(studentNotes).where(eq(studentNotes.id, noteId));

    revalidatePath('/dashboard/bookings/[bookingId]', 'page');
    revalidatePath('/dashboard/students/[id]', 'page');
    revalidatePath('/dashboard', 'layout');
    
    return { success: true };
}

export async function toggleStudentNotePin(noteId: string, pinned: boolean) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        // Just enforcing that only admins can pin/unpin for robust security, OR could allow authors too.
        // Task 26 says pinning is for high priority. Let's let authors or admins pin.
        const note = await db.query.studentNotes.findFirst({
            where: eq(studentNotes.id, noteId)
        });
        
        if (!note || note.userId !== session.user.id) {
            throw new Error('Unauthorized: Only the author or an Admin can pin/unpin notes');
        }
    }

    await db.update(studentNotes)
        .set({ pinnedAt: pinned ? new Date() : null })
        .where(eq(studentNotes.id, noteId));

    revalidatePath('/dashboard/bookings/[bookingId]', 'page');
    revalidatePath('/dashboard/students/[id]', 'page');
    revalidatePath('/dashboard', 'layout');

    return { success: true };
}
