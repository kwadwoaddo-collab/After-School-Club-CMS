/**
 * P3 Security Fix Tests — Centre-Scoped Student Visibility
 *
 * Tests for `getVisibleChildIds` in @/lib/permissions:
 *   - ORG_OWNER → null (no restriction)
 *   - Non-owner with accessible centres → child IDs from children.centreId
 *   - Non-owner with no centre access → empty array
 *   - Unknown user → empty array
 *
 * After the Phase 1-4 migration, getVisibleChildIds uses children.centreId
 * directly (db.select → .from(children).where(...)) instead of the old
 * bookingAttendees join. Tests mock db.select accordingly.
 *
 * All tests mock at the module boundary; no DB or network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/db', () => ({
    db: {
        query: {
            users:             { findFirst: vi.fn() },
            centres:           { findMany: vi.fn() },
            centreMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
        },
        selectDistinct: vi.fn(),
        select:         vi.fn(),
        update:         vi.fn(),
        insert:         vi.fn(),
        delete:         vi.fn(),
    },
}));

vi.mock('@/db/schema', () => ({
    users:              {},
    centres:            {},
    centreMemberships:  {},
    bookings:           {},
    bookingAttendees:   {},
    organisations:      {},
    children:           { id: 'id', organisationId: 'organisationId', centreId: 'centreId' },
    parents:            {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq:      vi.fn((col, val) => ({ col, val, op: 'eq' })),
        and:     vi.fn((...args) => ({ op: 'and', args })),
        inArray: vi.fn((col, vals) => ({ col, vals, op: 'inArray' })),
    };
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const USER_ID     = 'user-001';
const ORG_ID      = 'org-001';
const CENTRE_A_ID = 'centre-aaa';
const CHILD_1_ID  = 'child-111';
const CHILD_2_ID  = 'child-222';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build the mock chain for db.select → .from() → .where()
// This matches the new direct-column query in getVisibleChildIds.
// ─────────────────────────────────────────────────────────────────────────────

function mockSelectChain(db: any, returnRows: { id: string }[]) {
    const mockWhere = vi.fn().mockResolvedValueOnce(returnRows);
    const mockFrom  = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as any).mockReturnValue({ from: mockFrom });
    return { mockFrom, mockWhere };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getVisibleChildIds', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.resetAllMocks();
    });

    async function getHelper() {
        const { getVisibleChildIds } = await import('@/lib/permissions');
        return getVisibleChildIds;
    }

    it('returns null for ORG_OWNER (no restriction)', async () => {
        const { db } = await import('@/db');
        (db.query.users.findFirst as any).mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const fn = await getHelper();
        const result = await fn(USER_ID, ORG_ID);
        expect(result).toBeNull();

        // db.select must NOT be called — no DB query needed for ORG_OWNER
        expect(db.select).not.toHaveBeenCalled();
    });

    it('returns empty array when user is not found', async () => {
        const { db } = await import('@/db');
        (db.query.users.findFirst as any).mockResolvedValueOnce(null);

        const fn = await getHelper();
        const result = await fn(USER_ID, ORG_ID);
        expect(result).toEqual([]);
    });

    it('returns empty array when non-owner has no centre memberships', async () => {
        const { db } = await import('@/db');
        (db.query.users.findFirst as any)
            .mockResolvedValueOnce({ role: 'MANAGER' })
            .mockResolvedValueOnce({ role: 'MANAGER', organisationId: ORG_ID, memberships: [] });

        const fn = await getHelper();
        const result = await fn(USER_ID, ORG_ID);
        expect(result).toEqual([]);

        // db.select must NOT be called when accessibleCentreIds is empty
        expect(db.select).not.toHaveBeenCalled();
    });

    it('returns child IDs from children.centreId for non-owner with centre access', async () => {
        const { db } = await import('@/db');

        (db.query.users.findFirst as any)
            .mockResolvedValueOnce({ role: 'MANAGER' })
            .mockResolvedValueOnce({
                role: 'MANAGER',
                organisationId: ORG_ID,
                memberships: [{ centre: { id: CENTRE_A_ID } }],
            });

        // New query shape: db.select({ id }).from(children).where(...)
        mockSelectChain(db, [{ id: CHILD_1_ID }, { id: CHILD_2_ID }]);

        const fn = await getHelper();
        const result = await fn(USER_ID, ORG_ID);
        expect(result).toEqual([CHILD_1_ID, CHILD_2_ID]);
    });

    it('returns empty array when non-owner has centre access but no students there', async () => {
        const { db } = await import('@/db');

        (db.query.users.findFirst as any)
            .mockResolvedValueOnce({ role: 'FRONT_DESK' })
            .mockResolvedValueOnce({
                role: 'FRONT_DESK',
                organisationId: ORG_ID,
                memberships: [{ centre: { id: CENTRE_A_ID } }],
            });

        // No students at this centre
        mockSelectChain(db, []);

        const fn = await getHelper();
        const result = await fn(USER_ID, ORG_ID);
        expect(result).toEqual([]);
    });

    it('returns all matching child IDs including multiple students', async () => {
        const { db } = await import('@/db');

        (db.query.users.findFirst as any)
            .mockResolvedValueOnce({ role: 'TUTOR' })
            .mockResolvedValueOnce({
                role: 'TUTOR',
                organisationId: ORG_ID,
                memberships: [{ centre: { id: CENTRE_A_ID } }],
            });

        // Two distinct students at this centre
        mockSelectChain(db, [{ id: CHILD_1_ID }, { id: CHILD_2_ID }]);

        const fn = await getHelper();
        const result = await fn(USER_ID, ORG_ID);
        expect(result).toContain(CHILD_1_ID);
        expect(result).toContain(CHILD_2_ID);
        expect(result).toHaveLength(2);
    });
});
