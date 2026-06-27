/**
 * Centre-Based Access Control
 * 
 * This module provides helper functions for managing centre-level permissions.
 * 
 * Access Model:
 * - ORG_OWNER: Full access to all centres in the organization
 * - MANAGER/FRONT_DESK/TUTOR: Access only to assigned centres via centreMemberships
 */

import { db } from '@/db';
import { users, centres, centreMemberships } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Get all centres a user has access to
 * 
 * ORG_OWNER: Returns all centres in the organization
 * Other roles: Returns only assigned centres
 */
export async function getUserAccessibleCentres(userId: string) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            memberships: {
                with: {
                    centre: true,
                },
            },
        },
    });

    if (!user) {
        return [];
    }

    // ORG_OWNER has access to all centres in the organization
    if (user.role === 'ORG_OWNER' && user.organisationId) {
        const orgCentres = await db.query.centres.findMany({
            where: eq(centres.organisationId, user.organisationId),
            orderBy: (centres, { asc }) => [asc(centres.name)],
        });
        return orgCentres;
    }

    // Other roles: return only assigned centres
    return user.memberships.map((m) => m.centre);
}

/**
 * Get IDs of centres a user can access
 * Useful for filtering queries
 */
export async function getUserAccessibleCentreIds(userId: string): Promise<string[]> {
    const accessibleCentres = await getUserAccessibleCentres(userId);
    return accessibleCentres.map((c) => c.id);
}

/**
 * Check if a user can access a specific centre
 */
export async function canUserAccessCentre(
    userId: string,
    centreId: string
): Promise<boolean> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        return false;
    }

    // ORG_OWNER can access all centres in their org
    if (user.role === 'ORG_OWNER') {
        const centre = await db.query.centres.findFirst({
            where: and(
                eq(centres.id, centreId),
                eq(centres.organisationId, user.organisationId!)
            ),
        });
        return !!centre;
    }

    // Check if user has membership to this centre
    const membership = await db.query.centreMemberships.findFirst({
        where: and(
            eq(centreMemberships.userId, userId),
            eq(centreMemberships.centreId, centreId)
        ),
    });

    return !!membership;
}

/**
 * Check if user is an organization owner
 */
export async function isOrgOwner(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });
    return user?.role === 'ORG_OWNER';
}

/**
 * Get user's role for a specific centre
 * Returns the role from centreMemberships, or user's org-level role if ORG_OWNER
 */
export async function getUserRoleForCentre(
    userId: string,
    centreId: string
): Promise<string | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        return null;
    }

    // ORG_OWNER keeps their role
    if (user.role === 'ORG_OWNER') {
        return user.role;
    }

    // Get role from centre membership
    const membership = await db.query.centreMemberships.findFirst({
        where: and(
            eq(centreMemberships.userId, userId),
            eq(centreMemberships.centreId, centreId)
        ),
    });

    return membership?.role || null;
}

/**
 * Assign a user to a centre with a specific role
 * Only used for non-ORG_OWNER users
 */
export async function assignUserToCentre(
    userId: string,
    centreId: string,
    role: 'MANAGER' | 'FRONT_DESK' | 'TUTOR'
) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new Error('User not found');
    }

    if (user.role === 'ORG_OWNER') {
        throw new Error('ORG_OWNER users do not need centre assignments - they have access to all centres');
    }

    // Check if assignment already exists
    const existing = await db.query.centreMemberships.findFirst({
        where: and(
            eq(centreMemberships.userId, userId),
            eq(centreMemberships.centreId, centreId)
        ),
    });

    if (existing) {
        // Update existing membership
        await db
            .update(centreMemberships)
            .set({ role })
            .where(eq(centreMemberships.id, existing.id));
    } else {
        // Create new membership
        await db.insert(centreMemberships).values({
            userId,
            centreId,
            role,
        });
    }
}

/**
 * Remove user's access to a centre
 */
export async function removeUserFromCentre(userId: string, centreId: string) {
    await db
        .delete(centreMemberships)
        .where(
            and(
                eq(centreMemberships.userId, userId),
                eq(centreMemberships.centreId, centreId)
            )
        );
}

/**
 * Get all users with access to a centre
 */
export async function getCentreUsers(centreId: string) {
    const centre = await db.query.centres.findFirst({
        where: eq(centres.id, centreId),
    });

    if (!centre) {
        return [];
    }

    // Get users with direct centre membership
    const memberships = await db.query.centreMemberships.findMany({
        where: eq(centreMemberships.centreId, centreId),
        with: {
            user: true,
        },
    });

    // Get ORG_OWNERs (they have implicit access)
    const orgOwners = await db.query.users.findMany({
        where: and(
            eq(users.organisationId, centre.organisationId),
            eq(users.role, 'ORG_OWNER')
        ),
    });

    // Combine and deduplicate
    const allUsers = [
        ...memberships.map((m) => m.user),
        ...orgOwners,
    ];

    // Remove duplicates by ID
    const uniqueUsers = Array.from(
        new Map(allUsers.map((user) => [user.id, user])).values()
    );

    return uniqueUsers;
}

/**
 * Get the set of child IDs visible to a user, scoped to their accessible centres.
 *
 * Returns `null` for ORG_OWNER — callers interpret this as "no restriction".
 * Returns a (possibly empty) string[] for all other roles.
 *
 * After the Phase 1-4 migration, children.centreId is populated directly,
 * so this is now a simple WHERE children.centre_id IN (...) query with no joins.
 *
 * This is the single source of truth for centre-scoped student visibility.
 */
export async function getVisibleChildIds(
    userId: string,
    orgId: string
): Promise<string[] | null> {
    // Avoid an extra DB call for ORG_OWNER — they see all children in the org.
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { role: true },
    });

    if (!user) return [];
    if (user.role === 'ORG_OWNER') return null; // null = "no restriction"

    const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
    if (accessibleCentreIds.length === 0) return [];

    // Direct column query — no join required after the migration backfill.
    // children.centreId is populated by all write paths from Phase 5 onward,
    // and backfilled for historical records by the Phase 2-4 SQL scripts.
    const { children } = await import('@/db/schema');

    const rows = await db
        .select({ id: children.id })
        .from(children)
        .where(
            and(
                eq(children.organisationId, orgId),
                inArray(children.centreId, accessibleCentreIds)
            )
        );

    return rows.map((r) => r.id);
}


