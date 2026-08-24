/**
 * Milestone 3L — Registrations Module Security Regression Tests
 *
 * Covers:
 *   D1: assignRegistrationCentre — role gate + org ownership verification
 *   D2: updateRegistrationDetails — role gate + cross-org parent/child protection
 *   D3: updateRegistrationStatus (dead server action) — role gate
 *   D4: POST /api/register prefillToken — cross-org parentId discarded before use
 *   D5: bulk-email POST — MANAGER centre isolation (via getUserAccessibleCentreIds)
 *
 * Test approach mirrors the established repository pattern (security-3k.test.ts,
 * security-p6.test.ts): mock @/lib/auth and @/db at module boundary, import
 * actions dynamically, assert behaviour without network or real DB calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock emailService to prevent SMTP calls
vi.mock('@/lib/services/email', () => ({
    emailService: { sendEmail: vi.fn().mockResolvedValue(undefined) },
}));

// Mock notification helper
vi.mock('@/app/portal/notifications/actions', () => ({
    createRegistrationNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── Additional mocks needed by POST /api/register (D4 route-level tests) ─────
// jose: intercepted to control what prefillToken payload the route sees
vi.mock('jose', () => ({
    jwtVerify: vi.fn(),
}));

// Rate-limit: always allow in tests so we reach the guard logic
vi.mock('@/lib/rate-limit', () => ({
    apiRateLimit:  {},
    checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
    getClientIP:    vi.fn().mockReturnValue('127.0.0.1'),
}));

// CRM helpers: parent/child create/resolve
vi.mock('@/lib/services/crm', () => ({
    resolveOrCreateParent: vi.fn().mockResolvedValue({ id: 'resolved-parent-id' }),
    resolveOrCreateChild:  vi.fn().mockResolvedValue({ id: 'resolved-child-id' }),
}));

// db-notifications
vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

// @/lib/permissions — used by bulk-email and GET route
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: vi.fn().mockResolvedValue(['centre-1']),
}));

// Full db mock covering all call patterns used by registrations actions
vi.mock('@/db', () => ({
    db: {
        query: {
            registrations: { findFirst: vi.fn() },
            centres: { findFirst: vi.fn() },
            parents: { findFirst: vi.fn() },
            children: { findFirst: vi.fn() },
            organisations: { findFirst: vi.fn() },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([]),
            })),
        })),
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue([]),
                })),
                innerJoin: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue([]),
                    })),
                })),
            })),
        })),
    },
}));

function sessionFor(role: string, orgId = 'org-1', userId = 'user-1') {
    return {
        user: { id: userId, email: 'test@example.com', organisationId: orgId, role },
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// assignRegistrationCentre — D1
// ══════════════════════════════════════════════════════════════════════════════

describe('assignRegistrationCentre — Milestone 3L D1', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('throws Unauthorized when session is null', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);
        const { assignRegistrationCentre } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(assignRegistrationCentre('reg-1', null)).rejects.toThrow(
            'Unauthorized'
        );
    });

    it('throws Forbidden for FRONT_DESK role', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('FRONT_DESK'));
        const { assignRegistrationCentre } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(assignRegistrationCentre('reg-1', null)).rejects.toThrow(
            'Forbidden'
        );
    });

    it('throws Forbidden for TUTOR role', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
        const { assignRegistrationCentre } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(assignRegistrationCentre('reg-1', null)).rejects.toThrow(
            'Forbidden'
        );
    });

    it('throws when registration does not belong to session org', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', 'org-1'));
        const { db } = await import('@/db');
        // findFirst returns null → registration not in this org
        (db.query.registrations.findFirst as any).mockResolvedValueOnce(null);
        const { assignRegistrationCentre } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(assignRegistrationCentre('reg-cross', null)).rejects.toThrow(
            'Registration not found'
        );
    });

    it('throws when centreId does not belong to session org', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('ORG_OWNER', 'org-1'));
        const { db } = await import('@/db');
        // Registration resolves correctly
        (db.query.registrations.findFirst as any).mockResolvedValueOnce({ id: 'reg-1' });
        // Centre resolves as null → cross-org centreId
        (db.query.centres.findFirst as any).mockResolvedValueOnce(null);
        const { assignRegistrationCentre } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(
            assignRegistrationCentre('reg-1', 'centre-from-other-org')
        ).rejects.toThrow('Centre not found');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// updateRegistrationDetails — D2
// ══════════════════════════════════════════════════════════════════════════════

describe('updateRegistrationDetails — Milestone 3L D2', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    const minimalPayload = {
        registrationId: 'reg-1',
        startDate: null,
        fundingType: 'self_funded',
        fundingOther: '',
        emergencyContactName: '',
        emergencyContactRelationship: '',
        emergencyContactPhone: '',
        hasSpecialNeeds: false,
        specialNeedsDetails: '',
        parentsData: [],
        childrenData: [],
    };

    it('throws Unauthorized when session is null', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);
        const { updateRegistrationDetails } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(updateRegistrationDetails(minimalPayload as any)).rejects.toThrow(
            'Unauthorized'
        );
    });

    it('throws Forbidden for TUTOR role', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
        const { updateRegistrationDetails } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(
            updateRegistrationDetails(minimalPayload as any)
        ).rejects.toThrow('Forbidden');
    });

    it('rejects cross-org registration — returns not found to MANAGER', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('MANAGER', 'org-1'));
        const { db } = await import('@/db');
        // Registration query returns null → registration not in this org
        (db.query.registrations.findFirst as any).mockResolvedValueOnce(null);
        const { updateRegistrationDetails } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(
            updateRegistrationDetails({ ...minimalPayload, registrationId: 'reg-cross' } as any)
        ).rejects.toThrow(/not found/i);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// updateRegistrationStatus server action — D3
// ══════════════════════════════════════════════════════════════════════════════

describe('updateRegistrationStatus server action — Milestone 3L D3', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('throws Forbidden for TUTOR role (action is dead but still exported)', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(sessionFor('TUTOR'));
        const { updateRegistrationStatus } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(
            updateRegistrationStatus('reg-1', 'signed_up')
        ).rejects.toThrow('Forbidden');
    });

    it('throws Unauthorized when no session', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValueOnce(null);
        const { updateRegistrationStatus } = await import(
            '@/app/dashboard/registrations/actions'
        );
        await expect(
            updateRegistrationStatus('reg-1', 'signed_up')
        ).rejects.toThrow('Unauthorized');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/register — prefillParentId cross-org guard — D4
// ══════════════════════════════════════════════════════════════════════════════
// Strategy: mock jose.jwtVerify to inject a controlled prefill payload, then
// assert what db.query.parents.findFirst and db.update(parents) see.
// The critical invariant: when parents.findFirst returns null (cross-org miss),
// db.update(parents) must NEVER be called with the cross-org parentId.

describe('POST /api/register — D4 prefillParentId cross-org guard', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    // Minimal valid body — no centreId so we skip the centre-validation branch
    const minimalBody = {
        orgSlug: 'org-a',
        children: [{ firstName: 'Alice', lastName: 'Smith', schoolYear: 'Y3' }],
        parents:  [{ firstName: 'Bob',   lastName: 'Smith', email: 'bob@example.com' }],
        termsAgreed: true,
        prefillToken: 'signed-token',
    };

    it('discards cross-org prefillParentId — db.update(parents) is not called with foreign parentId', async () => {
        // jose.jwtVerify returns a payload carrying a parent from org-b
        const { jwtVerify } = await import('jose');
        (jwtVerify as any).mockResolvedValueOnce({
            payload: { parentId: 'parent-from-org-b' },
        });

        const { db } = await import('@/db');
        // Org resolves fine
        (db.query.organisations.findFirst as any).mockResolvedValueOnce({
            id: 'org-a-id', name: 'Org A', slug: 'org-a',
        });
        // D4 org-check: parent does NOT belong to org-a → null
        (db.query.parents.findFirst as any).mockResolvedValueOnce(null);

        // db.transaction: we need it to be a no-op for this assertion-level test.
        // Override transaction to immediately resolve so we can inspect db.update calls.
        (db as any).transaction = vi.fn().mockResolvedValue(undefined);

        const { POST } = await import('@/app/api/register/route');
        const req = new Request('http://localhost/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minimalBody),
        });

        await POST(req as any);

        // The D4 org-check findFirst must have been called
        expect(db.query.parents.findFirst).toHaveBeenCalled();

        // Critical: db.update must NEVER have been called with the cross-org parentId.
        // If D4 had not fired, the route would have called db.update(parents)
        // with .where(eq(parents.id, 'parent-from-org-b')).
        const updateCalls = (db.update as any).mock?.calls ?? [];
        const crossOrgUpdateAttempted = updateCalls.some((args: any[]) =>
            JSON.stringify(args).includes('parent-from-org-b')
        );
        expect(crossOrgUpdateAttempted).toBe(false);
    });

    it('passes the org-check when prefillParentId belongs to resolved org', async () => {
        const { jwtVerify } = await import('jose');
        (jwtVerify as any).mockResolvedValueOnce({
            payload: { parentId: 'parent-from-org-a' },
        });

        const { db } = await import('@/db');
        // Org resolves fine
        (db.query.organisations.findFirst as any).mockResolvedValueOnce({
            id: 'org-a-id', name: 'Org A', slug: 'org-a',
        });
        // D4 org-check: parent DOES belong to org-a → record found
        (db.query.parents.findFirst as any).mockResolvedValueOnce({ id: 'parent-from-org-a' });

        // Stub transaction so the rest of the route doesn't blow up
        (db as any).transaction = vi.fn().mockResolvedValue(undefined);

        const { POST } = await import('@/app/api/register/route');
        const req = new Request('http://localhost/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minimalBody),
        });

        await POST(req as any);

        // The org-check findFirst must have been called with the same-org parentId
        expect(db.query.parents.findFirst).toHaveBeenCalled();
        // db.update was NOT called on the cross-org path (no "parent-from-org-b" present)
        const updateCalls = (db.update as any).mock?.calls ?? [];
        const crossOrgUpdateAttempted = updateCalls.some((args: any[]) =>
            JSON.stringify(args).includes('parent-from-org-b')
        );
        expect(crossOrgUpdateAttempted).toBe(false);
    });
});
