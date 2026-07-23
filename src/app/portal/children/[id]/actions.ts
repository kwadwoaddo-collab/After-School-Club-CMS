'use server';
import { logger } from '@/lib/logger';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { studentNotes, children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function addMedicalNote(childId: string, content: string) {
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        // Verify child belongs to parent
        const child = await db.query.children.findFirst({
            where: and(
                eq(children.id, childId),
                eq(children.parentId, parent.id)
            )
        });

        if (!child) return { success: false, error: 'Child not found' };

        if (!content.trim()) return { success: false, error: 'Note content cannot be empty' };

        await db.insert(studentNotes).values({
            childId: child.id,
            content: content.trim(),
            authorName: `${parent.firstName} ${parent.lastName} (Parent)`,
            category: 'Medical',
        });

        revalidatePath(`/portal/children/${childId}`);
        return { success: true };
    } catch (e) {
        logger.error('Failed to add medical note:', e);
        return { success: false, error: 'An error occurred while attempting to save the note' };
    }
}
