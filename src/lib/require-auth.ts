/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-side Auth Helpers
 * 
 * Eliminates the 6-line auth-check boilerplate repeated 15+ times across dashboard pages.
 * 
 * Usage:
 *   const { session, user, organisationId } = await requireAuth();
 *   // If we reach here, user is authenticated with a valid org
 * 
 *   const { session, user, organisationId } = await requireAuth({ role: 'ORG_OWNER' });
 *   // Also checks role
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface AuthResult {
  session: any; // Raw NextAuth session object
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    organisationId: string;
    needsOnboarding?: boolean;
  };
  organisationId: string;
}

interface RequireAuthOptions {
  /** If set, also checks that the user has this role */
  role?: 'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR';
  /** Where to redirect if not authenticated (default: /login) */
  loginRedirect?: string;
  /** Where to redirect if no org (default: /onboarding) */
  onboardingRedirect?: string;
}

/**
 * Require authentication for a server component or server action.
 * Redirects to login/onboarding if not authenticated.
 * 
 * @throws Redirect (never returns if auth fails)
 */
export async function requireAuth(options: RequireAuthOptions = {}): Promise<AuthResult> {
  const {
    role,
    loginRedirect = '/login',
    onboardingRedirect = '/onboarding',
  } = options;

  const session = await auth();

  if (!session?.user?.id) {
    redirect(loginRedirect);
  }

  const user = session.user as any;

  if (!user.organisationId) {
    redirect(onboardingRedirect);
  }

  if (role && user.role !== role) {
    redirect('/dashboard');
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
 * Require authentication for an API route handler.
 * Returns null if not authenticated (caller should return 401).
 * Does NOT redirect — intended for API routes.
 */
export async function requireApiAuth(options: { role?: string } = {}): Promise<AuthResult | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = session.user as any;

  if (!user.organisationId) {
    return null;
  }

  if (options.role && user.role !== options.role) {
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
