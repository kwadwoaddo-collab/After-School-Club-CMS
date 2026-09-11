import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * NextAuth.js Configuration
 * 
 * Magic link email authentication for organisation owners and staff.
 */

import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { users, accounts, sessions, verificationTokens, orgMemberships, organisations } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { hashToken } from '@/lib/magic-link';
// Precomputed cost-10 bcrypt hash for computational symmetry and timing-attack elimination (PM-2E2.B4)
export const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * PM-2E2.B4.F: Determines whether a credential user account is subject to
 * mandatory email verification before credentials authentication is permitted.
 *
 * Invariant:
 * - If user.emailVerified is populated (Date), email ownership is established -> false (eligible).
 * - If user.emailVerified is null:
 *   - If AUTH_VERIFICATION_ROLLOUT_BOUNDARY is configured:
 *     - If user.createdAt < boundary -> false (historical legacy account exempt from lockout).
 *     - If user.createdAt >= boundary -> true (modern account, strictly required).
 *   - If AUTH_VERIFICATION_ROLLOUT_BOUNDARY is not configured:
 *     - Strict fail-closed default -> true (all unverified accounts must verify).
 */
export function isEmailVerificationRequired(user: {
  emailVerified?: Date | null;
  createdAt?: Date | null;
}): boolean {
  if (user.emailVerified) {
    return false;
  }

  const boundaryStr = process.env.AUTH_VERIFICATION_ROLLOUT_BOUNDARY;
  if (boundaryStr) {
    const boundaryDate = new Date(boundaryStr);
    if (!isNaN(boundaryDate.getTime()) && user.createdAt) {
      const userCreated = new Date(user.createdAt);
      if (!isNaN(userCreated.getTime()) && userCreated < boundaryDate) {
        return false;
      }
    }
  }

  // Strict fail-closed default: emailVerified is mandatory
  return true;
}

export const authConfig: any = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens as any,
  } as any) as any, // Type assertion needed for drizzle-orm compatibility

  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // re-issue token once per day max
  },



  pages: {
    signIn: '/login',
    // New Google OAuth users have no organisationId yet — send them to
    // onboarding directly. Sending to /dashboard causes the layout to
    // immediately redirect them back to /onboarding (double redirect).
    newUser: '/onboarding',
    error: '/login',
  },

  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),

    // Email Magic Link
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
    }),

    // Credentials (email/password) for staff login
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
          return null;
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();
        if (normalizedEmail.length > 255) {
          return null;
        }

        // PM-2E2.B4: If password exceeds bcrypt 72-byte limit, fail safely with computational symmetry
        if (Buffer.byteLength(credentials.password, 'utf8') > 72) {
          await bcrypt.compare('dummy-pass', DUMMY_PASSWORD_HASH);
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, normalizedEmail),
          with: { organisation: true },
        });

        if (!user || !user.passwordHash) {
          // PM-2E2.B4: Perform dummy bcrypt comparison to eliminate timing side-channel oracle
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          return null;
        }

        // PM-2E2.B4.F: Durable email verification gate
        // An unverified credential account must never authenticate before email ownership
        // is established, regardless of token state (active, expired, deleted, or absent).
        if (isEmailVerificationRequired(user)) {
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: user.role,
          organisationId: user.organisationId,
        };
      },
    }),

    // Magic link / invite token login for staff
    CredentialsProvider({
      id: 'inviteToken',
      name: 'Invite Token',
      credentials: {
        token: { label: 'Invite Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const { staffInvites } = await import('@/db/schema');

        const [invite] = await db
          .select()
          .from(staffInvites)
          .where(eq(staffInvites.token, hashToken(credentials.token as string)))
          .limit(1);

        if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, invite.email),
        });

        if (!user) return null;

        // Mark invite as used and email as verified
        await db
          .update(staffInvites)
          .set({ usedAt: new Date() })
          .where(eq(staffInvites.id, invite.id));

        await db
          .update(users)
          .set({ emailVerified: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: user.role,
          organisationId: user.organisationId,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }: any) {
      // Always allow sign-in — the jwt callback will handle org/onboarding state.
      // Previously we did a DB lookup here which caused a race on first Google login.
      return true;
    },

    async jwt({ token, user, account }: any) {
      // ── Initial sign in only ─────────────────────────────────────────────
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? null;
        token.organisationId = (user as any).organisationId ?? null;
        token.needsOnboarding = false;

        // For Google OAuth: the `createUser` event that sets role='ORG_OWNER' fires
        // AFTER the jwt callback, so on a brand-new account the DB row has role=null.
        // We set role optimistically here — the DB write happens in the createUser event.
        if (account?.provider === 'google' && !token.role) {
          token.role = 'ORG_OWNER';
        }

        // Fetch from DB to get org/role if still missing (returning users, email provider, etc.)
        if (user.id && (!token.role || !token.organisationId)) {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, user.id as string),
          });
          if (dbUser) {
            token.role = dbUser.role ?? token.role; // keep optimistic value if DB still null
            token.organisationId = dbUser.organisationId ?? null;
            token.needsOnboarding = !dbUser.organisationId;
          }
        }

        // Load all org memberships for this user
        if (user.id) {
          try {
            const memberships = await db
              .select({
                id: orgMemberships.organisationId,
                name: organisations.name,
                slug: organisations.slug,
                role: orgMemberships.role,
              })
              .from(orgMemberships)
              .innerJoin(organisations, eq(orgMemberships.organisationId, organisations.id))
              .where(eq(orgMemberships.userId, user.id as string));
            token.userOrgs = memberships;
          } catch {
            token.userOrgs = [];
          }
        }

        return token;
      }

      // ── Subsequent requests: only poll DB while onboarding is pending ────
      if (token.needsOnboarding && token.id) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.id as string),
        });
        if (dbUser?.organisationId) {
          token.organisationId = dbUser.organisationId;
          token.role = dbUser.role;
          token.needsOnboarding = false;
        }
      }

      return token;
    },

    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id as string;
        (session as any).user.role = token.role;
        (session as any).user.organisationId = token.organisationId;
        (session as any).user.needsOnboarding = token.needsOnboarding;
        (session as any).user.userOrgs = token.userOrgs ?? [];
      }
      return session;
    },
  },

  events: {
    async createUser({ user }: any) {
      // For Google OAuth users: set role to ORG_OWNER but do NOT create an org.
      // They will be redirected to /onboarding to set up their org and first centre.
      if (user.id) {
        try {
          await db
            .update(users)
            .set({ role: 'ORG_OWNER' })
            .where(eq(users.id, user.id));
        } catch (error) {
          logger.error('Failed to set role for new user:', error);
        }
      }
    },
  },
};

export const nextAuthResult = NextAuth(authConfig);

export const { handlers, signIn, signOut } = nextAuthResult;

export interface SessionWithOrg {
  user: {
    id: string;
    organisationId?: string | null;
    role?: string;
    needsOnboarding?: boolean;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    userOrgs?: { id: string; name: string; slug: string; role: string }[];
  };
  expires: string;
}

export function auth(): Promise<SessionWithOrg | null>;
export function auth(req: any, ctx: any): any;
export async function auth(...args: unknown[]) {
  const session = await (nextAuthResult.auth as any)(...args);

  if (session?.user?.id) {
    try {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      if (!dbUser) {
        // Security Invariant (Milestone PM-2E2.B3): If user was deleted or disabled in DB,
        // revoke session immediately rather than honoring stale cryptographic JWT claims.
        return null;
      }

      // Revalidate live organisation membership entitlement from database source-of-truth (Milestone PM-2E2.B3.F)
      if (dbUser.organisationId) {
        const membership = await db.query.orgMemberships.findFirst({
          where: and(
            eq(orgMemberships.userId, dbUser.id),
            eq(orgMemberships.organisationId, dbUser.organisationId)
          ),
        });

        if (membership) {
          // Authoritative membership exists for this organisation
          session.user.organisationId = dbUser.organisationId;
          session.user.role = membership.role ?? dbUser.role ?? 'TUTOR';
          session.user.needsOnboarding = false;
        } else {
          // Security Invariant (Milestone PM-2E2.B3.F): users.organisationId without an
          // authoritative orgMemberships record does NOT grant tenant access.
          session.user.organisationId = null;
          session.user.role = 'TUTOR';
          session.user.needsOnboarding = true;
        }
      } else {
        session.user.organisationId = null;
        session.user.role = 'TUTOR';
        session.user.needsOnboarding = true;
      }

      if (dbUser.name) session.user.name = dbUser.name;
      if (dbUser.email) session.user.email = dbUser.email;
    } catch (e) {
      logger.error('Failed to fetch authoritative user in auth wrapper:', e);
      // Security Invariant (Milestone PM-2E2.B3): Database failure must fail closed (return null),
      // never silently fall back to trusting unverified JWT claims.
      return null;
    }
  }

  return session;
}

// Helper to get current user with organisation
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: { organisation: true },
  });

  return user;
}
