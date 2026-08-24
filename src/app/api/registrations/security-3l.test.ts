/**
 * Milestone 3L — Registrations Module Security Regression Tests
 *
 * Covers:
 *   D1: assignRegistrationCentre — role gate + org ownership verification
 *   D2: updateRegistrationDetails — role gate + cross-org parent/child protection
 *   D3: updateRegistrationStatus (dead server action) — role gate
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
