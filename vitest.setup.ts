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
}))

/**
 * PM-1.2 — Global mock for org-approval-guard.
 *
 * assertOrgActive always resolves (no-op) in the test environment.
 * All existing tests assume an ACTIVE organisation — this preserves that assumption
 * without requiring 26 test files to add per-test DB mocking.
 *
 * To test a non-ACTIVE org path in a specific test:
 *   import { assertOrgActive, OrgNotActiveError } from '@/lib/org-approval-guard';
 *   vi.mocked(assertOrgActive).mockRejectedValueOnce(new OrgNotActiveError('org-1', 'PENDING'));
 */
vi.mock('@/lib/org-approval-guard', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/org-approval-guard')>();
    return {
        ...actual,
        assertOrgActive: vi.fn().mockResolvedValue(undefined),
        requirePlatformAdmin: vi.fn().mockResolvedValue({ email: 'admin@test.com', userId: 'admin-1' }),
    };
})
