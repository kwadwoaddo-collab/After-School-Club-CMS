/**
 * PM-1.2 — Organisation Approval Guard
 *
 * Provides three independent authorization primitives:
 *
 *   isPlatformAdmin(email)       — checks PLATFORM_ADMIN_EMAILS allowlist
 *   assertOrgActive(orgId)       — throws OrgNotActiveError if org is not ACTIVE
 *   requirePlatformAdmin()       — session identity + platform admin check,
 *                                  completely independent of tenant membership/status
 *
 * Authorization source of truth: the database (queried at request time).
 * JWTs and sessions are NEVER used as the authorization source for org status.
 */

import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTypedSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';

// ─── Error Types ─────────────────────────────────────────────────────────────

export class OrgNotActiveError extends Error {
  constructor(
    public readonly orgId: string,
    public readonly approvalStatus: string
  ) {
    super(`Organisation ${orgId} is not ACTIVE (current status: ${approvalStatus})`);
    this.name = 'OrgNotActiveError';
  }
}

export class PlatformAdminRequiredError extends Error {
  constructor() {
    super('Platform administrator access required');
    this.name = 'PlatformAdminRequiredError';
  }
}

// ─── Platform Admin Allowlist ─────────────────────────────────────────────────

/**
 * Check whether the given email address is in the PLATFORM_ADMIN_EMAILS allowlist.
 *
 * - Reads PLATFORM_ADMIN_EMAILS from the environment (comma-separated, trimmed).
 * - Returns false if the env var is absent or empty (fail-closed).
 * - Case-insensitive comparison.
 * - Never logs the allowlist contents.
 *
 * @param email  The authenticated user's email address.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? '';
  if (!raw.trim()) return false;
  const allowlist = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

// ─── Org Active Guard ─────────────────────────────────────────────────────────

/**
 * Assert that the organisation with the given ID has approval_status = 'ACTIVE'.
 *
 * Always queries the database — never reads JWT/session for this decision.
 * Throws OrgNotActiveError for PENDING, SUSPENDED, and REJECTED orgs.
 *
 * @param organisationId  The organisation UUID from the authenticated session.
 */
export async function assertOrgActive(organisationId: string): Promise<void> {
  const org = await db
    .select({ approvalStatus: organisations.approvalStatus })
    .from(organisations)
    .where(eq(organisations.id, organisationId))
    .limit(1);

  if (!org.length) {
    // Org not found — treat as inactive to fail closed
    throw new OrgNotActiveError(organisationId, 'NOT_FOUND');
  }

  const { approvalStatus } = org[0];

  if (approvalStatus !== 'ACTIVE') {
    throw new OrgNotActiveError(organisationId, approvalStatus);
  }
}

// ─── Platform Admin Primitive ─────────────────────────────────────────────────

/**
 * Require platform administrator identity.
 *
 * Checks ONLY:
 *   1. Valid authenticated session (via getTypedSession)
 *   2. Email is in PLATFORM_ADMIN_EMAILS
 *
 * Does NOT require:
 *   - organisationId to be set
 *   - organisation to be ACTIVE
 *   - any tenant role
 *   - centre membership
 *
 * For server components: throws PlatformAdminRequiredError → call redirect().
 * For server actions: throws PlatformAdminRequiredError → return error response.
 *
 * Returns the authenticated identity on success.
 */
export async function requirePlatformAdmin(): Promise<{ email: string; userId: string }> {
  const session = await getTypedSession();

  if (!session) {
    redirect('/login');
    // TypeScript doesn't know redirect() throws
    return undefined as never;
  }

  if (!isPlatformAdmin(session.user.email)) {
    logger.warn('[PlatformAdmin] Access denied for email — not in allowlist');
    // Redirect to dashboard rather than 401 to avoid leaking the admin route
    redirect('/dashboard');
    return undefined as never;
  }

  return { email: session.user.email, userId: session.user.id };
}
