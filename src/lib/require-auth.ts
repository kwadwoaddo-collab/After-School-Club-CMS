/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-side Auth Helpers — the authoritative authorisation mechanism.
 *
 * Milestone 1: this replaces the dashboard layout's route-permission map,
 * which derived the current path from undocumented, unset request headers
 * (`x-invoke-path` / `x-pathname` / `next-url`) and therefore never reliably
 * denied access — see architecture-decisions.md ("Dashboard authorisation
 * enforcement pattern") for the full reasoning.
 *
 * The fix is standard Next.js App Router practice: each protected page knows
 * its own route by definition, so the check belongs in the page itself
 * (or a server action), not in a layout trying to infer the current path.
 * A layout is shared across every route beneath it and cannot reliably know
 * which one is being rendered without exactly the kind of header-sniffing
 * that caused this bug.
 *
 * Usage in a Server Component page:
 *   const { session, user, organisationId } = await requireAuth();
 *   // any authenticated user with an organisation
 *
 *   const { session, user, organisationId } = await requireAuth({ roles: ['ORG_OWNER'] });
 *   // only ORG_OWNER; any other authenticated role is redirected to /dashboard
 *
 * Usage in an API route handler (does not redirect — returns null so the
 * caller can respond with 401/403):
 *   const result = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER'] });
 *   if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * Both fail closed: any unauthenticated, org-less, or role-mismatched request
 * is denied. There is no code path that falls through to "allow" on a check
 * it couldn't evaluate.
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { userRoleEnum } from '@/db/schema';

export type UserRole = (typeof userRoleEnum.enumValues)[number];

interface AuthResult {
  session: any; // Raw NextAuth session object
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: UserRole;
    organisationId: string;
    needsOnboarding?: boolean;
  };
  organisationId: string;
}

interface RequireAuthOptions {
  /** If set, requires the user's role to be one of these. Omit to allow any authenticated, onboarded user. */
  roles?: UserRole[];
  /** @deprecated use `roles` — accepted for backward compatibility, treated as `roles: [role]`. */
  role?: UserRole;
  /** Where to redirect if not authenticated (default: /login) */
  loginRedirect?: string;
  /** Where to redirect if no org (default: /onboarding) */
  onboardingRedirect?: string;
  /** Where to redirect if authenticated but role doesn't match (default: /dashboard) */
  deniedRedirect?: string;
}

function resolveAllowedRoles(options: RequireAuthOptions): UserRole[] | null {
  if (options.roles) return options.roles;
  if (options.role) return [options.role];
  return null;
}

/**
 * Require authentication (and optionally a role) for a server component.
 * Redirects if the check fails — never returns to the caller in that case.
 *
 * @throws Redirect (Next.js's redirect() throws internally; never wrap this
 *         call in a try/catch that could swallow that throw)
 */
export async function requireAuth(options: RequireAuthOptions = {}): Promise<AuthResult> {
  const {
    loginRedirect = '/login',
    onboardingRedirect = '/onboarding',
    deniedRedirect = '/dashboard',
  } = options;

  const session = await auth();

  if (!session?.user?.id) {
    redirect(loginRedirect);
  }

  const user = session.user as any;

  if (!user.organisationId) {
    redirect(onboardingRedirect);
  }

  const allowedRoles = resolveAllowedRoles(options);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(deniedRedirect);
  }

  return {
    session,
    user: {
      id: user.id,
      email: user.email ?? '',
      name: user.name,
      role: user.role,
      organisationId: user.organisationId,
      needsOnboarding: user.needsOnboarding,
    },
    organisationId: user.organisationId,
  };
}

/**
 * Require authentication (and optionally a role) for an API route handler.
 * Returns null if the check fails — does NOT redirect. Caller responds with
 * 401 (no/invalid session or org) or 403 (wrong role) as appropriate; this
 * helper doesn't distinguish the two in its return value so callers that
 * need to pick a specific status should check session/role themselves, but
 * for the common case a plain null → 401 is fine.
 */
export async function requireApiAuth(
  options: { roles?: UserRole[]; role?: UserRole } = {}
): Promise<AuthResult | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = session.user as any;

  if (!user.organisationId) {
    return null;
  }

  const allowedRoles = resolveAllowedRoles(options);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return {
    session,
    user: {
      id: user.id,
      email: user.email ?? '',
      name: user.name,
      role: user.role,
      organisationId: user.organisationId,
    },
    organisationId: user.organisationId,
  };
}
