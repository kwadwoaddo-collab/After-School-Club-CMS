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
import { users, organisations, accounts, sessions, verificationTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as any, // Type assertion needed for drizzle-orm compatibility

  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    newUser: '/dashboard',
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
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-in attempts
      // The database already has correct account linkages
      return true;
    },


    async session({ session, user }) {
      // With database sessions, user comes from the database
      if (user) {
        session.user.id = user.id;
        (session as any).user.role = (user as any).role;
        (session as any).user.organisationId = (user as any).organisationId;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // Auto-create organisation for new Google OAuth users
      if (user.email && user.id && !user.organisationId) {
        try {
          const orgName = user.name || user.email?.split('@')[0] || 'My Organisation';
          const slug = orgName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

          const [organisation] = await db
            .insert(organisations)
            .values({
              name: orgName,
              slug: slug,
              contactEmail: user.email,
            })
            .returning();

          // Update user with organisation
          await db
            .update(users)
            .set({
              organisationId: organisation.id,
              role: 'ORG_OWNER',
            })
            .where(eq(users.id, user.id));
        } catch (error) {
          console.error('Failed to create organisation for new user:', error);
        }
      }
    },
  },
});

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
