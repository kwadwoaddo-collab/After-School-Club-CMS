'use server';

import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

/**
 * Soft deletes a parent and all their children.
 * Items will remain in the database with a deleted_at timestamp.
 */
export async function softDeleteParent(parentId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        throw new Error('Unauthorized');
    }

    // Verify parent belongs to organisation
    const parent = await db.query.parents.findFirst({
        where: and(
            eq(parents.id, parentId),
            eq(parents.organisationId, session.user.organisationId)
        ),
    });

    if (!parent) {
        throw new Error('Parent not found');
    }

    const now = new Date();

    await db.transaction(async (tx) => {
        // Soft delete parent
        await tx.update(parents)
            .set({ deletedAt: now })
            .where(eq(parents.id, parentId));

        // Soft delete children
        await tx.update(children)
            .set({ deletedAt: now })
            .where(eq(children.parentId, parentId));
    });

    revalidatePath('/dashboard/parents');
    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/parents/bin');
    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Restores a soft-deleted parent and their children from the bin.
 */
export async function restoreParent(parentId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        throw new Error('Unauthorized');
    }

    await db.transaction(async (tx) => {
        // Restore parent
        await tx.update(parents)
            .set({ deletedAt: null })
            .where(eq(parents.id, parentId));

        // Restore children
        await tx.update(children)
            .set({ deletedAt: null })
            .where(eq(children.parentId, parentId));
    });

    revalidatePath('/dashboard/parents');
    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/parents/bin');
    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Permanently deletes a parent from the database.
 * Cascades to children, notes, and registrations.
 */
export async function hardDeleteParent(parentId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        throw new Error('Unauthorized');
    }

    // Drizzle handles cascade deletion for children via foreign keys
    await db.delete(parents).where(eq(parents.id, parentId));

    revalidatePath('/dashboard/parents');
    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/parents/bin');
    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Purges any items in the bin older than 30 days.
 * This should be called lazily or via a cron job.
 */
export async function purgeStaleBinItems() {
    const session = await auth();
    if (!session?.user?.organisationId) return;

    // Delete parents where deleted_at < NOW() - 30 days
    // Drizzle will cascade delete the children
    await db.execute(sql`
        DELETE FROM parents 
        WHERE organisation_id = ${session.user.organisationId} 
        AND deleted_at IS NOT NULL 
        AND deleted_at < NOW() - INTERVAL '30 days'
    `);
}
