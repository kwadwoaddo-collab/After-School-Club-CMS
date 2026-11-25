import type { DefaultSession } from 'next-auth';

export interface SessionUserOrgSummary {
    id: string;
    name: string;
    slug: string;
    role: string;
}

declare module 'next-auth' {
    /**
     * Returned by `useSession`, `getSession`, `auth()`, and received as a prop on `SessionProvider`.
     */
    interface Session {
        user: {
            id: string;
            organisationId?: string | null;
            role?: string;
            needsOnboarding?: boolean;
            userOrgs?: SessionUserOrgSummary[];
        } & DefaultSession['user'];
    }

    interface User {
        organisationId?: string | null;
        role?: string;
        needsOnboarding?: boolean;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        organisationId?: string | null;
        role?: string;
        needsOnboarding?: boolean;
    }
}
