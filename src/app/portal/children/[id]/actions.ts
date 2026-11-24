'use server';
import { logger } from '@/lib/logger';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { studentNotes, children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { notifyOwners } from '@/lib/db-notifications';

const ALLOWED_PARENT_NOTE_CATEGORIES = new Set([
    'Medical',
    'Dietary',
    'Allergy',
    'Health',
    'Medication',
]);

export async function addMedicalNote(childId: string, content: string, category: string = 'Medical') {
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        const noteCategory = category?.trim() || 'Medical';
        if (!ALLOWED_PARENT_NOTE_CATEGORIES.has(noteCategory)) {
            return { success: false, error: 'Invalid note category' };
        }

        // Verify child belongs to parent
        const child = await db.query.children.findFirst({
            where: and(
                eq(children.id, childId),
                eq(children.parentId, parent.id)
            )
        });

        if (!child) return { success: false, error: 'Child not found' };

        const trimmedContent = content.trim();
        if (!trimmedContent) return { success: false, error: 'Note content cannot be empty' };

        await db.insert(studentNotes).values({
            childId: child.id,
            userId: null,
            content: trimmedContent,
            authorName: `${parent.firstName} ${parent.lastName} (Parent)`,
            category: noteCategory,
        });

        // Notify club owners in-app (never block saving the parent's note; never send external parent emails)
        const orgId = child.organisationId || parent.organisationId;
        if (orgId && ALLOWED_PARENT_NOTE_CATEGORIES.has(noteCategory)) {
            try {
                await notifyOwners({
                    orgId,
                    type: 'system',
                    title: `Parent Added ${noteCategory} Note`,
                    message: `${parent.firstName} ${parent.lastName} submitted a ${noteCategory.toLowerCase()} note for ${child.firstName} ${child.lastName}.`,
                });
            } catch (err) {
                logger.warn('[portal] Failed to notify club owners about parent medical note:', err);
            }
        }

        revalidatePath(`/portal/children/${childId}`);
        revalidatePath(`/dashboard/students/${childId}`);
        revalidatePath('/dashboard/students');
        return { success: true };
    } catch (e) {
        logger.error('Failed to add medical note:', e);
        return { success: false, error: 'An error occurred while attempting to save the note' };
    }
}
