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
import { users, accounts, sessions, verificationTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const nextAuthResult = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens as any,
  } as any) as any, // Type assertion needed for drizzle-orm compatibility

  session: {
    strategy: 'jwt',
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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
          with: { organisation: true },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
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
          .where(eq(staffInvites.token, credentials.token as string))
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
    async signIn({ user, account }) {
      // Always allow sign-in — the jwt callback will handle org/onboarding state.
      // Previously we did a DB lookup here which caused a race on first Google login.
      return true;
    },

    async jwt({ token, user, account }) {
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

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session as any).user.role = token.role;
        (session as any).user.organisationId = token.organisationId;
        (session as any).user.needsOnboarding = token.needsOnboarding;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // For Google OAuth users: set role to ORG_OWNER but do NOT create an org.
      // They will be redirected to /onboarding to set up their org and first centre.
      if (user.id) {
        try {
          await db
            .update(users)
            .set({ role: 'ORG_OWNER' })
            .where(eq(users.id, user.id));
        } catch (error) {
          console.error('Failed to set role for new user:', error);
        }
      }
    },
  },
});

export const { handlers, signIn, signOut } = nextAuthResult;

export const auth = async (...args: any[]) => {
  const session = await nextAuthResult.auth(...args);

  if (session?.user?.id && !(session.user as any).organisationId) {
    try {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      if (dbUser?.organisationId) {
        (session.user as any).organisationId = dbUser.organisationId;
        (session.user as any).role = dbUser.role ?? (session.user as any).role;
        (session.user as any).needsOnboarding = false;
      }
    } catch (e) {
      console.error('Failed to fetch user organisation in auth wrapper:', e);
    }
  }

  return session;
};

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
