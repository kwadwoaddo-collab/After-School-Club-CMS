'use server';

import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { eq, isNull, and, sql, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireApiAuth } from '@/lib/require-auth';

// Same role rule as the rest of the People module (Students PATCH/DELETE,
// Parents' own PATCH /api/parents/[id]) — see
// project-notes/milestone-3b-parents-audit.md §4. None of the four actions
// below had a role check before this milestone (org-membership only), which
// let any authenticated org member — including TUTOR — archive, restore, or
// permanently delete a family record.
const PARENTS_MUTATION_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] as const;

/**
 * Soft deletes a parent and all their children.
 * Items will remain in the database with a deleted_at timestamp.
 */
export async function softDeleteParent(parentId: string) {
    const authResult = await requireApiAuth({ roles: [...PARENTS_MUTATION_ROLES] });
    if (!authResult) {
        throw new Error('Unauthorized');
    }
    const session = { user: { organisationId: authResult.organisationId } };

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
    const authResult = await requireApiAuth({ roles: [...PARENTS_MUTATION_ROLES] });
    if (!authResult) {
        throw new Error('Unauthorized');
    }

    // Verify parent belongs to organisation (same check softDeleteParent
    // already applied — this action and hardDeleteParent were missing it,
    // which let a valid parentId from any organisation be restored /
    // permanently deleted by any authenticated org member. See
    // project-notes/milestone-3b-parents-audit.md §4.)
    const owned = await db.query.parents.findFirst({
        where: and(eq(parents.id, parentId), eq(parents.organisationId, authResult.organisationId)),
        columns: { id: true },
    });
    if (!owned) {
        throw new Error('Parent not found');
    }

    await db.transaction(async (tx) => {
        // Get parent's deletedAt timestamp
        const parentToRestore = await tx.query.parents.findFirst({
            where: eq(parents.id, parentId),
            columns: { deletedAt: true }
        });

        // Restore parent
        await tx.update(parents)
            .set({ deletedAt: null })
            .where(eq(parents.id, parentId));

        // Only restore children deleted at the SAME TIME as the parent (not before)
        if (parentToRestore?.deletedAt) {
            await tx.update(children)
                .set({ deletedAt: null })
                .where(
                    and(
                        eq(children.parentId, parentId),
                        gte(children.deletedAt, parentToRestore.deletedAt)
                    )
                );
        }
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
 * Restricted strictly to Organisation Owners (ORG_OWNER) for least-privilege data safety.
 */
export async function hardDeleteParent(parentId: string) {
    const authResult = await requireApiAuth({ roles: ['ORG_OWNER'] });
    if (!authResult) {
        throw new Error('Unauthorized');
    }

    // Verify parent belongs to organisation — see restoreParent above.
    const owned = await db.query.parents.findFirst({
        where: and(eq(parents.id, parentId), eq(parents.organisationId, authResult.organisationId)),
        columns: { id: true },
    });
    if (!owned) {
        throw new Error('Parent not found');
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
    const authResult = await requireApiAuth({ roles: [...PARENTS_MUTATION_ROLES] });
    if (!authResult) return;

    // Delete parents where deleted_at < NOW() - 30 days
    // Drizzle will cascade delete the children
    await db.execute(sql`
        DELETE FROM parents
        WHERE organisation_id = ${authResult.organisationId}
        AND deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
    `);
}
