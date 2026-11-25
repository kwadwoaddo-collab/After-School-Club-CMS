'use server';

import { db } from '@/db';
import { auditEvents, bookings, parents, children } from '@/db/schema';
import { eq, and, sql, gte, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireApiAuth } from '@/lib/require-auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const PARENTS_MUTATION_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] as const;

function resolveActorContext(authResult: unknown): {
    userId: string | undefined;
    role: string | undefined;
    organisationId: string;
} {
    const raw = authResult as {
        user?: { id?: string; role?: string };
        userId?: string;
        role?: string;
        organisationId: string;
    };
    return {
        userId: raw.user?.id ?? raw.userId,
        role: raw.user?.role ?? raw.role,
        organisationId: raw.organisationId,
    };
}

async function recordAuditEventSafe(
    executor: unknown,
    payload: {
        organisationId: string;
        userId?: string;
        eventType: string;
        eventData: string;
    }
): Promise<void> {
    const ex = executor as { insert?: (table: typeof auditEvents) => { values?: (val: unknown) => unknown } } | null;
    if (!ex || typeof ex.insert !== 'function') return;
    const builder = ex.insert(auditEvents);
    if (builder && typeof builder.values === 'function') {
        await builder.values(payload);
    }
}

async function assertCentreAccessToParent(
    userId: string | undefined,
    role: string | undefined,
    parentId: string
): Promise<void> {
    if (role === 'ORG_OWNER') return;
    if (!userId) {
        throw new Error('Unauthorized');
    }

    // Fail-closed: any error or missing centre assignment denies access
    const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
    if (!Array.isArray(accessibleCentreIds) || accessibleCentreIds.length === 0) {
        throw new Error('Unauthorized');
    }

    const parentChildren = await db.query.children.findMany({
        where: eq(children.parentId, parentId),
    });

    const hasAccessibleChild =
        Array.isArray(parentChildren) &&
        parentChildren.some(
            (c) => Boolean(c.centreId) && accessibleCentreIds.includes(c.centreId as string)
        );

    if (hasAccessibleChild) {
        return;
    }

    // Fallback check: allow if parent has an accessible centre booking
    const bookingsQuery = (db.query as { bookings?: { findFirst?: (args: unknown) => Promise<unknown> } })?.bookings;
    if (typeof bookingsQuery?.findFirst === 'function') {
        const accessibleBooking = await bookingsQuery.findFirst({
            where: and(
                eq(bookings.parentId, parentId),
                inArray(bookings.centreId, accessibleCentreIds)
            ),
            columns: { id: true },
        });
        if (accessibleBooking) {
            return;
        }
    }

    throw new Error('Unauthorized');
}

/**
 * Soft deletes a parent and all their children.
 * Items will remain in the database with a deleted_at timestamp.
 */
export async function softDeleteParent(parentId: string) {
    const authResult = await requireApiAuth({ roles: [...PARENTS_MUTATION_ROLES] });
    if (!authResult) {
        throw new Error('Unauthorized');
    }
    const actor = resolveActorContext(authResult);

    // Verify parent belongs to organisation
    const parent = await db.query.parents.findFirst({
        where: and(
            eq(parents.id, parentId),
            eq(parents.organisationId, actor.organisationId)
        ),
    });

    if (!parent) {
        throw new Error('Parent not found');
    }

    await assertCentreAccessToParent(actor.userId, actor.role, parentId);

    const now = new Date();

    await db.transaction(async (tx) => {
        // Soft delete parent
        await tx.update(parents)
            .set({ deletedAt: now })
            .where(and(eq(parents.id, parentId), eq(parents.organisationId, actor.organisationId)));

        // Soft delete children
        await tx.update(children)
            .set({ deletedAt: now })
            .where(and(eq(children.parentId, parentId), eq(children.organisationId, actor.organisationId)));

        await recordAuditEventSafe(tx, {
            organisationId: actor.organisationId,
            userId: actor.userId,
            eventType: 'parent_soft_deleted',
            eventData: JSON.stringify({
                parentId,
                deletedAt: now.toISOString(),
            }),
        });
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
    const actor = resolveActorContext(authResult);

    const owned = await db.query.parents.findFirst({
        where: and(eq(parents.id, parentId), eq(parents.organisationId, actor.organisationId)),
        columns: { id: true },
    });
    if (!owned) {
        throw new Error('Parent not found');
    }

    await assertCentreAccessToParent(actor.userId, actor.role, parentId);

    await db.transaction(async (tx) => {
        // Get parent's deletedAt timestamp
        const parentToRestore = await tx.query.parents.findFirst({
            where: eq(parents.id, parentId),
            columns: { deletedAt: true }
        });

        // Restore parent
        await tx.update(parents)
            .set({ deletedAt: null })
            .where(and(eq(parents.id, parentId), eq(parents.organisationId, actor.organisationId)));

        // Only restore children deleted at the SAME TIME as the parent (not before)
        if (parentToRestore?.deletedAt) {
            await tx.update(children)
                .set({ deletedAt: null })
                .where(
                    and(
                        eq(children.parentId, parentId),
                        eq(children.organisationId, actor.organisationId),
                        gte(children.deletedAt, parentToRestore.deletedAt)
                    )
                );
        }

        await recordAuditEventSafe(tx, {
            organisationId: actor.organisationId,
            userId: actor.userId,
            eventType: 'parent_restored',
            eventData: JSON.stringify({
                parentId,
                restoredAt: new Date().toISOString(),
            }),
        });
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
    const actor = resolveActorContext(authResult);

    // Verify parent belongs to organisation
    const owned = await db.query.parents.findFirst({
        where: and(eq(parents.id, parentId), eq(parents.organisationId, actor.organisationId)),
        columns: { id: true },
    });
    if (!owned) {
        throw new Error('Parent not found');
    }

    // Drizzle handles cascade deletion for children via foreign keys
    await db.delete(parents).where(and(eq(parents.id, parentId), eq(parents.organisationId, actor.organisationId)));

    await recordAuditEventSafe(db, {
        organisationId: actor.organisationId,
        userId: actor.userId,
        eventType: 'parent_hard_deleted',
        eventData: JSON.stringify({
            parentId,
            purgedAt: new Date().toISOString(),
        }),
    });

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
    const authResult = await requireApiAuth({ roles: ['ORG_OWNER'] });
    if (!authResult) return;
    const actor = resolveActorContext(authResult);

    // Delete parents where deleted_at < NOW() - 30 days
    // Drizzle will cascade delete the children
    await db.execute(sql`
        DELETE FROM parents
        WHERE organisation_id = ${actor.organisationId}
        AND deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
    `);

    await recordAuditEventSafe(db, {
        organisationId: actor.organisationId,
        userId: actor.userId,
        eventType: 'stale_bin_items_purged',
        eventData: JSON.stringify({
            retentionDays: 30,
            purgedAt: new Date().toISOString(),
        }),
    });
}
