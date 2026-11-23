import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { vi } from 'vitest'

vi.mock('next-auth', () => ({
    useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
    signIn: vi.fn(),
    signOut: vi.fn(),
    default: vi.fn(() => ({ auth: vi.fn() }))
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
    // PM-1.2: redirect() in App Router throws a special error to terminate execution.
    // In tests, we throw a plain RedirectError so requireTenantSession terminates
    // correctly (unauthenticated → doesn't proceed to the action body).
    // Tests that need to assert on redirect behaviour: use try/catch or rejects.toThrow('REDIRECT').
    redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
    notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

/**
 * PM-1.2 — Pure DB-free global mock for org-approval-guard.
 *
 * Avoids calling importOriginal() so unit tests that do not mock @/db never
 * evaluate src/db/index.ts (assertTestDatabaseIsolation) via dynamic import in session.ts.
 * Tests that explicitly verify real org-approval-guard logic use vi.importActual() directly.
 */
vi.mock('@/lib/org-approval-guard', () => {
    class OrgNotActiveError extends Error {
        constructor(
            public readonly orgId: string,
            public readonly approvalStatus: string,
        ) {
            super(`Organisation ${orgId} is not ACTIVE (current status: ${approvalStatus})`);
            this.name = 'OrgNotActiveError';
        }
    }

    class PlatformAdminRequiredError extends Error {
        constructor() {
            super('Platform administrator access required');
            this.name = 'PlatformAdminRequiredError';
        }
    }

    function isPlatformAdmin(email: string | null | undefined): boolean {
        if (!email) return false;
        const raw = process.env.PLATFORM_ADMIN_EMAILS ?? '';
        if (!raw.trim()) return false;
        const allowlist = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        return allowlist.includes(email.toLowerCase());
    }

    return {
        OrgNotActiveError,
        PlatformAdminRequiredError,
        isPlatformAdmin,
        assertOrgActive: vi.fn().mockResolvedValue(undefined),
        requirePlatformAdmin: vi.fn().mockResolvedValue({ email: 'admin@test.com', userId: 'admin-1' }),
    };
})
