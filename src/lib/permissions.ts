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
import { users, centres, centreMemberships, children, orgMemberships } from '@/db/schema';
import { eq, and, inArray, or, sql } from 'drizzle-orm';

/** Match auth(): the active organisation must have a live membership.
 * users.role is a legacy field and cannot preserve owner access after demotion. */
async function activeOrganisationUser(userId: string) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.organisationId) return null;
    const membership = await db.query.orgMemberships.findFirst({
        where: and(eq(orgMemberships.userId, userId), eq(orgMemberships.organisationId, user.organisationId)),
    });
    if (!membership) return null;
    return { ...user, role: membership.role, organisationId: user.organisationId };
}

/**
 * Get all centres a user has access to
 * 
 * ORG_OWNER: Returns all centres in the organization
 * Other roles: Returns only assigned centres
 */
export async function getUserAccessibleCentres(userId: string) {
    const user = await activeOrganisationUser(userId);
    if (!user) return [];
    if (user.role === 'ORG_OWNER') {
        return db.query.centres.findMany({
            where: eq(centres.organisationId, user.organisationId),
            orderBy: (centres, { asc }) => [asc(centres.name)],
        });
    }
    const memberships = await db.query.centreMemberships.findMany({
        where: eq(centreMemberships.userId, userId), with: { centre: true },
    });
    return memberships.map(membership => membership.centre)
        .filter(centre => Boolean(centre) && centre.organisationId === user.organisationId);
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
export async function canUserAccessCentre(userId: string, centreId: string): Promise<boolean> {
    const user = await activeOrganisationUser(userId);
    if (!user) return false;
    if (user.role === 'ORG_OWNER') {
        return !!(await db.query.centres.findFirst({
            where: and(eq(centres.id, centreId), eq(centres.organisationId, user.organisationId)),
        }));
    }
    const membership = await db.query.centreMemberships.findFirst({
        where: and(eq(centreMemberships.userId, userId), eq(centreMemberships.centreId, centreId)),
        with: { centre: true },
    });
    return !!membership?.centre && membership.centre.organisationId === user.organisationId;
}

/**
 * Check if a user can access safeguarding records (MANAGER or ORG_OWNER only)
 */
export async function canUserAccessSafeguardingRecords(
    userId: string,
    centreId: string
): Promise<boolean> {
    const role = await getUserRoleForCentre(userId, centreId);
    return role === 'ORG_OWNER' || role === 'MANAGER';
}

/**
 * Check if user is an organization owner
 */
export async function isOrgOwner(userId: string): Promise<boolean> {
    return (await activeOrganisationUser(userId))?.role === 'ORG_OWNER';
}

/**
 * Get user's role for a specific centre
 * Returns the role from centreMemberships, or user's org-level role if ORG_OWNER
 */
export async function getUserRoleForCentre(userId: string, centreId: string): Promise<string | null> {
    const user = await activeOrganisationUser(userId);
    if (!user) return null;
    if (user.role === 'ORG_OWNER') {
        const centre = await db.query.centres.findFirst({
            where: and(eq(centres.id, centreId), eq(centres.organisationId, user.organisationId)),
        });
        return centre ? 'ORG_OWNER' : null;
    }
    const membership = await db.query.centreMemberships.findFirst({
        where: and(eq(centreMemberships.userId, userId), eq(centreMemberships.centreId, centreId)),
        with: { centre: true },
    });
    return membership?.centre?.organisationId === user.organisationId ? membership.role : null;
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
    const user = await activeOrganisationUser(userId);
    if (!user || user.organisationId !== orgId) return [];
    if (user.role === 'ORG_OWNER') return null; // only within the verified active organisation

    const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
    if (accessibleCentreIds.length === 0) return [];

    // Direct column query — no join required after the migration backfill.
    // children.centreId is populated by all write paths from Phase 5 onward,
    // and backfilled for historical records by the Phase 2-4 SQL scripts.

    const rows = await db
        .select({ id: children.id })
        .from(children)
        .where(
            and(
                eq(children.organisationId, orgId),
                or(
                    inArray(children.centreId, accessibleCentreIds),
                    sql`${children.centreId} IS NULL`
                )
            )
        );

    return rows.map((r) => r.id);
}

/**
 * Role hierarchy, lowest to highest privilege. `requirePermission(role)` allows
 * `role` and anything above it — e.g. requirePermission('MANAGER') allows
 * MANAGER and ORG_OWNER, matching the ORG_OWNER/MANAGER safeguarding pairing
 * used throughout the app (see canUserAccessSafeguardingRecords above).
 */
const ROLE_HIERARCHY: Array<'TUTOR' | 'FRONT_DESK' | 'MANAGER' | 'ORG_OWNER'> = [
    'TUTOR',
    'FRONT_DESK',
    'MANAGER',
    'ORG_OWNER',
];

/**
 * Require a specific role (or higher) globally. Used in server actions.
 *
 * Fails closed: any requiredRole this function doesn't recognise throws,
 * rather than silently allowing the request through. Previously this checked
 * only 'ORG_OWNER' and 'MANAGER' explicitly and returned successfully for any
 * other value (including two real call sites that passed the non-existent
 * literal 'MANAGE_ORG') — see architecture-decisions.md for the incident this
 * caused (safeguarding-record read/write access effectively unrestricted).
 */
export async function requirePermission(requiredRole: 'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR') {
    const session = await import('@/lib/auth').then(m => m.auth());
    if (!session?.user?.id || !session.user.organisationId) throw new Error('Unauthorized');

    const role = (session.user.role || 'TUTOR') as (typeof ROLE_HIERARCHY)[number];
    const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
    const userIndex = ROLE_HIERARCHY.indexOf(role);

    if (requiredIndex === -1) {
        // Defensive: an unrecognised requiredRole must never silently pass.
        throw new Error(`Forbidden: unknown required role "${requiredRole}"`);
    }

    if (userIndex < requiredIndex) {
        throw new Error(`Forbidden: ${requiredRole} or higher required`);
    }

    return session.user;
}


