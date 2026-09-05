/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type-Safe Session Utilities
 * 
 * Provides a typed wrapper around NextAuth's session to eliminate `as any` casts
 * throughout the codebase. All dashboard/API code should use `getTypedSession()`
 * instead of raw `auth()`.
 */

import { auth } from '@/lib/auth';

export type UserRole = 'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR';

export interface TypedUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  role: UserRole;
  organisationId: string | null;
  needsOnboarding: boolean;
}

export interface TypedSession {
  user: TypedUser;
  expires: string;
}

/**
 * Get the current session with proper TypeScript types.
 * Returns null if not authenticated.
 * 
 * Usage:
 * ```ts
 * const session = await getTypedSession();
 * if (!session) return redirect('/login');
 * session.user.role       // UserRole — no cast needed
 * session.user.organisationId  // string | null — no cast needed
 * ```
 */
export async function getTypedSession(): Promise<TypedSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? '',
      image: session.user.image,
      role: ((session.user as any).role as UserRole) || 'TUTOR',
      organisationId: ((session.user as any).organisationId as string) ?? null,
      needsOnboarding: !!((session.user as any).needsOnboarding),
    },
    expires: session.expires,
  };
}

/**
 * Get the current session or throw a redirect.
 * Convenience wrapper for pages that always require auth.
 */
export async function requireTypedSession(): Promise<TypedSession> {
  const session = await getTypedSession();
  if (!session) {
    // Dynamic import to avoid circular dependency with next/navigation
    const { redirect } = await import('next/navigation');
    redirect('/login');
    // TypeScript doesn't know redirect() throws — this satisfies the return type
    return undefined as never;
  }
  return session;
}

/**
 * PM-1.2 — Require authenticated identity only.
 *
 * Use for surfaces that must establish user identity but must NOT enforce
 * ACTIVE organisation status:
 *   - /pending-approval (status experience page)
 *   - /platform/* (platform admin — independent of tenant status)
 *   - /onboarding (user has no org yet)
 *
 * Redirects unauthenticated users to /login.
 * Does NOT check organisation approval_status.
 */
export async function requireAuthenticatedIdentity(): Promise<TypedSession> {
  return requireTypedSession();
}

/**
 * PM-1.2 — Require authenticated session AND an ACTIVE organisation.
 *
 * Use for ALL tenant-operational surfaces:
 *   - /dashboard/* pages
 *   - /features/* server actions
 *   - /app/api/* tenant routes
 *
 * Authorization source of truth: the database (queried at call time via assertOrgActive).
 * Never reads JWT/session fields for the org-status decision.
 *
 * Throws OrgNotActiveError → callers redirect to /pending-approval.
 * For API routes: catch OrgNotActiveError and return 403.
 */
export async function requireTenantSession(options?: { redirectOnInactive?: boolean }): Promise<TypedSession> {
  const session = await requireTypedSession();

  if (!session.user.organisationId) {
    // User has no org — redirect to onboarding
    const { redirect } = await import('next/navigation');
    redirect('/onboarding');
    return undefined as never;
  }

  // Dynamic import avoids circular dependency: session.ts → org-approval-guard.ts → session.ts
  const { assertOrgActive, OrgNotActiveError } = await import('@/lib/org-approval-guard');
  try {
    await assertOrgActive(session.user.organisationId);
  } catch (err) {
    if (err instanceof OrgNotActiveError && options?.redirectOnInactive !== false) {
      const { redirect } = await import('next/navigation');
      redirect('/pending-approval');
      return undefined as never;
    }
    throw err;
  }

  return session;
}

/**
 * PM-1.2 — API-route variant of requireTenantSession.
 *
 * Returns null instead of throwing a redirect, so API route handlers can
 * return proper 401/403 HTTP responses rather than triggering a redirect.
 *
 * Use this in any `src/app/api/**\/route.ts` file as a drop-in for the
 * old `const session = await auth()` pattern:
 *
 * ```ts
 * const session = await getApiSession();
 * if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * ```
 *
 * Returns null when:
 *   - Not authenticated (no valid session)
 *   - Authenticated but no organisationId (not yet onboarded)
 *   - Organisation is not ACTIVE (PENDING/SUSPENDED/REJECTED)
 *
 * For the last case callers may wish to return 403 rather than 401 if they
 * need to distinguish, but a plain 401 is fine for most API consumers.
 */
export async function getApiSession(): Promise<TypedSession | null> {
  const session = await getTypedSession();
  if (!session?.user?.id) return null;
  if (!session.user.organisationId) return null;

  try {
    const { assertOrgActive } = await import('@/lib/org-approval-guard');
    await assertOrgActive(session.user.organisationId);
  } catch {
    return null;
  }

  return session;
}
