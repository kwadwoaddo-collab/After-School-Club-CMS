import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            id: string
            organisationId?: string | null
            role?: string
        } & DefaultSession["user"]
    }

    interface User {
        organisationId?: string | null
        role?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        organisationId?: string | null
        role?: string
    }
}
