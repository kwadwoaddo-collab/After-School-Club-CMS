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
