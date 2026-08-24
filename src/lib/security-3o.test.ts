/**
 * Milestone 3O — Public & Parent Portal Security Regression Tests
 *
 * Covers:
 *   AUTH-2: verifyParentToken() — UUID fallback removed; only JWT accepted
 *   S-2:    getCurrentParent() — soft-deleted parent → null (DB-level)
 *   S-4:    getCurrentParent() — soft-deleted child excluded from result
 *   S-3:    BookingService.createBooking() — rescheduleId ownership verification
 *   S-1:    GET /api/register/prefill — cross-org prefill token → 404
 *
 * AUTH-1 regression is covered in src/lib/magic-link.test.ts:
 *   - raw tokens are always stored hashed; only hash comparison is used in verify
 *
 * Test approach: mock @/db and jose at module boundary; import targets and
 * assert behaviour without network or real DB calls. Mirrors the established
 * pattern from security-3l.test.ts / security-3k.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Global mocks (must be declared before any imports that reference them) ──

vi.mock('@/lib/logger', () => ({
    logger: {
        info:  vi.fn(),
        warn:  vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        query: {
            parents:  { findFirst: vi.fn() },
            centres:  { findFirst: vi.fn() },
            bookings: { findFirst: vi.fn() },
            children: { findFirst: vi.fn(), findMany: vi.fn() },
        },
        update:      vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        insert:      vi.fn(() => ({ values: vi.fn(() => Promise.resolve([{ id: 'new-booking-id' }])) })),
        transaction: vi.fn(),
    },
}));

vi.mock('@/lib/services/crm', () => ({
    resolveOrCreateParent: vi.fn(),
    resolveOrCreateChild:  vi.fn(),
}));

vi.mock('@/lib/services/google-calendar', () => ({
    googleCalendarService:    { deleteCalendarEvent: vi.fn().mockResolvedValue(undefined) },
    buildBookingEventDetails: vi.fn(),
}));

vi.mock('@/lib/services/notifications', () => ({
    notificationService: {
        sendBookingConfirmation: vi.fn().mockResolvedValue({ success: true }),
    },
}));

vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/stripe', () => ({
    stripeService: { createCheckoutSession: vi.fn() },
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'TESTCODE01'),
}));

vi.mock('@/lib/magic-link', () => ({
    generateMagicLinkToken: vi.fn(() => 'raw-test-token'),
    hashToken:              vi.fn((t: string) => `hashed-${t}`),
}));

vi.mock('jose', async (importOriginal) => {
    const actual = await importOriginal<typeof import('jose')>();
    return {
        ...actual,
        jwtVerify: vi.fn(),
    };
});

// ── Static imports (after all vi.mock declarations) ──

import { signParentToken, verifyParentToken } from './parent-auth';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { jwtVerify } from 'jose';
import { resolveOrCreateParent, resolveOrCreateChild } from '@/lib/services/crm';
import { logger } from '@/lib/logger';
import { BookingService } from '@/lib/services/booking';
import { GET as prefillGET } from '../app/api/register/prefill/route';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-2: verifyParentToken — UUID fallback removed
// ─────────────────────────────────────────────────────────────────────────────

describe('AUTH-2: verifyParentToken — UUID cookie fallback removed', () => {
    it('returns null for a raw UUID cookie (no JWT signature)', async () => {
        const rawUuid = '123e4567-e89b-12d3-a456-426614174000';
        const result = await verifyParentToken(rawUuid);
        // Previously returned the UUID as parentId; AUTH-2 fix: must return null
        expect(result).toBeNull();
    });

    it('returns null for a forged arbitrary UUID cookie', async () => {
        const forgedUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const result = await verifyParentToken(forgedUuid);
        expect(result).toBeNull();
    });

    it('returns null for a malformed / non-JWT string', async () => {
        const result = await verifyParentToken('not.a.jwt.and.not.a.uuid');
        expect(result).toBeNull();
    });

    it('returns null for an empty string cookie', async () => {
        const result = await verifyParentToken('');
        expect(result).toBeNull();
    });

    it('returns parentId for a legitimately signed JWT (positive path, with mocked jose)', async () => {
        // In this test file, jose is mocked globally. Set the mock to return
        // a valid payload to simulate successful JWT verification.
        (jwtVerify as any).mockResolvedValueOnce({ payload: { parentId: '123e4567-e89b-12d3-a456-426614174001' } });
        const result = await verifyParentToken('some-signed-jwt-token');
        expect(result).toBe('123e4567-e89b-12d3-a456-426614174001');
    });

    it('returns null for a tampered JWT signature (jwtVerify throws)', async () => {
        // jwtVerify is mocked; ensure it throws for bad input
        (jwtVerify as any).mockRejectedValueOnce(new Error('JWSInvalidSignature'));
        const result = await verifyParentToken('tampered.jwt.token');
        expect(result).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S-2: getCurrentParent — soft-deleted parent excluded
// ─────────────────────────────────────────────────────────────────────────────

describe('S-2: getCurrentParent — soft-deleted parent excluded', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null when the DB excludes the parent due to soft deletion', async () => {
        // Set jose mock to return a valid parentId so verifyParentToken passes
        (jwtVerify as any).mockResolvedValue({ payload: { parentId: 'parent-soft-deleted-id' } });
        (cookies as any).mockResolvedValue({ get: () => ({ value: 'mock-jwt-token' }) });
        // DB returns null because the query now includes isNull(parents.deletedAt)
        (db.query.parents.findFirst as any).mockResolvedValue(null);

        const { getCurrentParent } = await import('./parent-auth');
        const result = await getCurrentParent();
        expect(result).toBeNull();
    });

    it('returns parent when active (DB returns row with deletedAt: null)', async () => {
        (jwtVerify as any).mockResolvedValue({ payload: { parentId: 'parent-active-id' } });
        (cookies as any).mockResolvedValue({ get: () => ({ value: 'mock-jwt-token' }) });

        const activeParent = {
            id: 'parent-active-id',
            firstName: 'Jane',
            deletedAt: null,
            children: [],
            bookings: [],
        };
        (db.query.parents.findFirst as any).mockResolvedValue(activeParent);

        const { getCurrentParent } = await import('./parent-auth');
        const result = await getCurrentParent();
        expect(result).toEqual(activeParent);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S-4: getCurrentParent — soft-deleted children excluded
// ─────────────────────────────────────────────────────────────────────────────

describe('S-4: getCurrentParent — soft-deleted children excluded from result', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not include soft-deleted children in the returned parent record', async () => {
        (jwtVerify as any).mockResolvedValue({ payload: { parentId: 'parent-id-with-deleted-child' } });
        (cookies as any).mockResolvedValue({ get: () => ({ value: 'mock-jwt-token' }) });

        // DB mock: query has already applied isNull(children.deletedAt);
        const parentRecord = {
            id: 'parent-id-with-deleted-child',
            firstName: 'John',
            deletedAt: null,
            children: [
                { id: 'child-active', firstName: 'Alice', deletedAt: null },
                // Deleted child is absent because DB query filters it out
            ],
            bookings: [],
        };
        (db.query.parents.findFirst as any).mockResolvedValue(parentRecord);

        const { getCurrentParent } = await import('./parent-auth');
        const result = await getCurrentParent();
        expect(result?.children).toHaveLength(1);
        expect(result?.children[0].id).toBe('child-active');
    });

    it('returns empty children array when all children are soft-deleted', async () => {
        (jwtVerify as any).mockResolvedValue({ payload: { parentId: 'parent-id-all-deleted' } });
        (cookies as any).mockResolvedValue({ get: () => ({ value: 'mock-jwt-token' }) });

        const parentRecord = {
            id: 'parent-id-all-deleted',
            firstName: 'Bob',
            deletedAt: null,
            children: [],  // DB returns no children after isNull filter
            bookings: [],
        };
        (db.query.parents.findFirst as any).mockResolvedValue(parentRecord);

        const { getCurrentParent } = await import('./parent-auth');
        const result = await getCurrentParent();
        expect(result?.children).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S-3: rescheduleId ownership verification in BookingService
// ─────────────────────────────────────────────────────────────────────────────

describe('S-3: rescheduleId ownership verification', () => {
    const baseInput = {
        parent: { firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', phone: '' },
        appointment: {
            centreId: 'centre-org-a',
            modality: 'in_person',
            startAt: new Date(Date.now() + 86_400_000).toISOString(),
            duration: 60,
        },
        children: [{ firstName: 'Alice', lastName: 'Doe', schoolYear: 'Y3', subjects: ['Maths'], notes: '' }],
        consent: { communications: true },
    };

    const resolvedParent = { id: 'parent-jane', organisationId: 'org-a' };

    beforeEach(() => {
        vi.clearAllMocks();

        (resolveOrCreateParent as any).mockResolvedValue(resolvedParent);
        (resolveOrCreateChild as any).mockResolvedValue({ id: 'child-alice' });

        (db.query.centres.findFirst as any).mockResolvedValue({
            organisationId: 'org-a',
            name: 'Centre A',
            address: 'A St',
        });

        // Full transaction mock: supports all queries and inserts used by BookingService.createBooking()
        const makeTxInsert = () => vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(() => Promise.resolve([{
                    id: 'new-booking-id',
                    centreId: 'centre-org-a',
                    parentId: 'parent-jane',
                    status: 'confirmed',
                    confirmationCode: 'TESTCODE01',
                }])),
            })),
        }));

        (db.transaction as any).mockImplementation(async (fn: any) => {
            const tx = {
                query: {
                    bookings:       { findFirst: db.query.bookings.findFirst },
                    childSubjects:  { findFirst: vi.fn().mockResolvedValue(null) },
                    studentNotes:   { findFirst: vi.fn().mockResolvedValue(null) },
                    bookingAttendees: { findFirst: vi.fn().mockResolvedValue(null) },
                },
                update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
                insert: makeTxInsert(),
            };
            return fn(tx);
        });
    });

    it('does NOT cancel a booking belonging to a different parent (same org)', async () => {
        // rescheduleId booking belongs to parent-bob, not parent-jane
        (db.query.bookings.findFirst as any).mockResolvedValue({
            id: 'bobs-booking',
            parentId: 'parent-bob',      // NOT jane
            centre: { organisationId: 'org-a' },
            googleCalendarEventId: null,
        });

        const service = new BookingService();
        await expect(
            service.createBooking({ ...baseInput, rescheduleId: 'bobs-booking' } as any)
        ).resolves.toBeDefined();

        expect((logger.warn as any)).toHaveBeenCalledWith(
            expect.stringContaining('S-3')
        );
    });

    it('does NOT cancel a booking belonging to a parent in a different organisation', async () => {
        (db.query.bookings.findFirst as any).mockResolvedValue({
            id: 'cross-org-booking',
            parentId: 'parent-org-b',
            centre: { organisationId: 'org-b' }, // different org
            googleCalendarEventId: null,
        });

        const service = new BookingService();
        await expect(
            service.createBooking({ ...baseInput, rescheduleId: 'cross-org-booking' } as any)
        ).resolves.toBeDefined();

        expect((logger.warn as any)).toHaveBeenCalledWith(
            expect.stringContaining('S-3')
        );
    });

    it('does NOT cancel when rescheduleId booking does not exist (null)', async () => {
        (db.query.bookings.findFirst as any).mockResolvedValue(null);

        const service = new BookingService();
        await expect(
            service.createBooking({ ...baseInput, rescheduleId: 'nonexistent-id' } as any)
        ).resolves.toBeDefined();

        expect((logger.warn as any)).toHaveBeenCalledWith(
            expect.stringContaining('S-3')
        );
    });

    it('DOES cancel a legitimate owner reschedule (same parent, same org)', async () => {
        (db.query.bookings.findFirst as any).mockResolvedValue({
            id: 'janes-own-booking',
            parentId: 'parent-jane',       // same parent
            centre: { organisationId: 'org-a' }, // same org
            googleCalendarEventId: null,
        });

        const service = new BookingService();
        await expect(
            service.createBooking({ ...baseInput, rescheduleId: 'janes-own-booking' } as any)
        ).resolves.toBeDefined();

        // No S-3 warning — ownership check passed
        expect((logger.warn as any)).not.toHaveBeenCalledWith(
            expect.stringContaining('S-3')
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S-1: Cross-org prefill API isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('S-1: GET /api/register/prefill — cross-org isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (db.query.children.findMany as any).mockResolvedValue([]);
    });

    it('returns 404 when parent organisationId does not match centre organisationId', async () => {
        // Token: parentId=parent-org-a, centreId=centre-org-b (cross-org)
        (jwtVerify as any).mockResolvedValue({
            payload: { parentId: 'parent-org-a', centreId: 'centre-org-b', childIds: [] },
        });

        // Centre is in org-b
        (db.query.centres.findFirst as any).mockResolvedValue({
            id: 'centre-org-b',
            organisationId: 'org-b',
        });

        // S-1 fix: DB query now includes eq(parents.organisationId, 'org-b')
        // which excludes parent-org-a → findFirst returns null
        (db.query.parents.findFirst as any).mockResolvedValue(null);

        const req = new Request('http://localhost/api/register/prefill?token=valid-token');
        const response = await prefillGET(req as any);

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toBeDefined();
        // No PII returned
        expect(body.parents).toBeUndefined();
        expect(body.children).toBeUndefined();
    });

    it('returns 404 when the centre does not exist', async () => {
        (jwtVerify as any).mockResolvedValue({
            payload: { parentId: 'parent-a', centreId: 'nonexistent-centre', childIds: [] },
        });

        (db.query.centres.findFirst as any).mockResolvedValue(null);

        const req = new Request('http://localhost/api/register/prefill?token=valid-token');
        const response = await prefillGET(req as any);

        expect(response.status).toBe(404);
    });

    it('returns 400 for an invalid or expired token', async () => {
        (jwtVerify as any).mockRejectedValue(new Error('JWTExpired'));

        const req = new Request('http://localhost/api/register/prefill?token=bad-token');
        const response = await prefillGET(req as any);

        expect(response.status).toBe(400);
    });

    it('returns 400 when no token query param is provided', async () => {
        const req = new Request('http://localhost/api/register/prefill');
        const response = await prefillGET(req as any);

        expect(response.status).toBe(400);
    });

    it('returns parent PII when parent and centre are in the same organisation', async () => {
        (jwtVerify as any).mockResolvedValue({
            payload: { parentId: 'parent-a', centreId: 'centre-a', childIds: [] },
        });

        (db.query.centres.findFirst as any).mockResolvedValue({
            id: 'centre-a',
            organisationId: 'org-a',
        });

        (db.query.parents.findFirst as any).mockResolvedValue({
            id: 'parent-a',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@test.com',
            phone: '+44 1234 567890',
            relationship: 'mother',
            addressLine1: '1 Main St',
            addressLine2: '',
            city: 'London',
            postcode: 'EC1A 1BB',
            organisationId: 'org-a',
            deletedAt: null,
        });

        const req = new Request('http://localhost/api/register/prefill?token=valid-token');
        const response = await prefillGET(req as any);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.parents).toHaveLength(1);
        expect(body.parents[0].firstName).toBe('Jane');
        expect(body.parents[0].email).toBe('jane@test.com');
    });
});
