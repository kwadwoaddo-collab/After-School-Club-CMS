/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetApiSession = vi.fn();
const mockRequireTenantSession = vi.fn();
const mockCanUserAccessCentre = vi.fn();
const mockGetUserAccessibleCentreIds = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();

const mockDb: any = {
    query: {
        centres: { findFirst: vi.fn(), findMany: vi.fn() },
        centreAvailabilityRules: { findMany: vi.fn() },
        bookings: { findFirst: vi.fn(), findMany: vi.fn() },
        slotHolds: { findMany: vi.fn() },
        organisations: { findFirst: vi.fn() },
        users: { findFirst: vi.fn() },
        orgMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
        verificationTokens: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(() => ({
        values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        })),
    })),
    update: vi.fn(() => ({
        set: vi.fn(() => ({
            where: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([]),
            })),
        })),
    })),
    delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
    })),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (cb: any) => cb(mockDb)),
};

vi.mock('@auth/drizzle-adapter', () => ({
    DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock('next-auth', () => ({
    default: vi.fn((cfg: any) => ({
        handlers: {},
        signIn: vi.fn(),
        signOut: vi.fn(),
        auth: vi.fn(),
        _cfg: cfg,
    })),
}));

vi.mock('@/db', () => ({
    db: mockDb,
}));

vi.mock('@/lib/session', () => ({
    getApiSession: (...args: any[]) => mockGetApiSession(...args),
    requireTenantSession: (...args: any[]) => mockRequireTenantSession(...args),
}));

vi.mock('@/lib/permissions', () => ({
    canUserAccessCentre: (...args: any[]) => mockCanUserAccessCentre(...args),
    getUserAccessibleCentreIds: (...args: any[]) => mockGetUserAccessibleCentreIds(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
    apiRateLimit: { name: 'api' },
    authRateLimit: { name: 'auth' },
    strictRateLimit: { name: 'strict' },
    checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
    getClientIP: vi.fn(() => '127.0.0.1'),
}));

vi.mock('bcryptjs', () => ({
    default: {
        compare: (...args: any[]) => mockBcryptCompare(...args),
        hash: (...args: any[]) => mockBcryptHash(...args),
    },
    compare: (...args: any[]) => mockBcryptCompare(...args),
    hash: (...args: any[]) => mockBcryptHash(...args),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const VALID_CENTRE_UUID = '550e8400-e29b-41d4-a716-446655440010';
const UUID_V7_BOOKING = '019364a0-1234-7000-8000-111122223333';

function futureIsoDate(daysAhead: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('Wave 5 Branch 1 — Availability DoS & Urgent Security/RBAC Guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckRateLimit.mockResolvedValue({ success: true, status: 'allowed' });
    });

    describe('GET /api/availability & AvailabilityService (W5-BE-01 / W5-SEC-01)', () => {
        it('passes { localLimit: 60, localWindowMs: 60_000 } to checkRateLimit and rejects 429 when throttled', async () => {
            const { GET } = await import('@/app/api/availability/route');
            mockCheckRateLimit.mockResolvedValueOnce({ success: false, status: 'limited' });

            const dateStr = futureIsoDate(2);
            const req = new NextRequest(
                `http://localhost/api/availability?centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=60`
            );
            const res = await GET(req);
            expect(res.status).toBe(429);
            expect(mockCheckRateLimit).toHaveBeenCalledWith(
                expect.anything(),
                'avail:127.0.0.1',
                { localLimit: 60, localWindowMs: 60_000 }
            );
        });

        it('blocks duration=0, negative duration, float, non-UUID centreId, invalid modality, and rollover dates with 400', async () => {
            const { GET } = await import('@/app/api/availability/route');
            const dateStr = futureIsoDate(3);

            for (const badQuery of [
                `centreId=not-a-uuid&date=${dateStr}&duration=60`,
                `centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=0`,
                `centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=-15`,
                `centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=30.5`,
                `centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=abc`,
                `centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=480`,
                `centreId=${VALID_CENTRE_UUID}&date=2026-02-31&duration=60`,
                `centreId=${VALID_CENTRE_UUID}&date=${futureIsoDate(400)}&duration=60`,
                `centreId=${VALID_CENTRE_UUID}&date=${dateStr}&duration=60&modality=vr`,
            ]) {
                const res = await GET(new NextRequest(`http://localhost/api/availability?${badQuery}`));
                expect(res.status).toBe(400);
            }
        });

        it('returns 200 { slots: [] } immediately on ancient dates like 0001-01-01 and 404 on SUSPENDED org', async () => {
            const { GET } = await import('@/app/api/availability/route');

            const pastRes = await GET(
                new NextRequest(
                    `http://localhost/api/availability?centreId=${VALID_CENTRE_UUID}&date=0001-01-01&duration=60`
                )
            );
            expect(pastRes.status).toBe(200);
            expect(await pastRes.json()).toEqual({ slots: [] });

            mockDb.query.centres.findFirst.mockResolvedValueOnce({
                id: VALID_CENTRE_UUID,
                organisationId: 'org-suspended',
                organisation: { approvalStatus: 'SUSPENDED' },
            });
            const suspendedRes = await GET(
                new NextRequest(
                    `http://localhost/api/availability?centreId=${VALID_CENTRE_UUID}&date=${futureIsoDate(2)}&duration=60`
                )
            );
            expect(suspendedRes.status).toBe(404);
        });

        it('AvailabilityService.getAvailableSlots throws on invalid duration and safely handles inverted hours', async () => {
            const { AvailabilityService } = await import('@/lib/services/availability');
            const svc = new AvailabilityService();

            await expect(
                svc.getAvailableSlots({
                    centreId: VALID_CENTRE_UUID,
                    modality: 'in_person',
                    date: new Date(),
                    duration: 0,
                })
            ).rejects.toThrow('Invalid slot duration');

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            mockDb.query.centres.findFirst.mockResolvedValueOnce({
                id: VALID_CENTRE_UUID,
                organisationId: 'org-1',
                organisation: { approvalStatus: 'ACTIVE' },
            });
            mockDb.query.centreAvailabilityRules.findMany.mockResolvedValueOnce([
                { dayOfWeek: tomorrow.getDay(), startTime: '22:00', endTime: '08:00' },
            ]);

            const invertedSlots = await svc.getAvailableSlots({
                centreId: VALID_CENTRE_UUID,
                modality: 'in_person',
                date: tomorrow,
                duration: 30,
            });
            expect(invertedSlots).toEqual([]);
        });

        it('updateAvailability rejects malformed or inverted HH:MM operating hours when isOpen is true', async () => {
            const { updateAvailability } = await import('@/app/dashboard/availability/actions');
            mockRequireTenantSession.mockResolvedValue({
                user: { id: 'u1', organisationId: 'org-1', role: 'MANAGER' },
            });
            mockCanUserAccessCentre.mockResolvedValue(true);

            const badFormat = await updateAvailability(VALID_CENTRE_UUID, [
                { dayOfWeek: 1, isOpen: true, startTime: '9am', endTime: '17:00' },
            ]);
            expect(badFormat.success).toBe(false);

            const inverted = await updateAvailability(VALID_CENTRE_UUID, [
                { dayOfWeek: 1, isOpen: true, startTime: '18:00', endTime: '09:00' },
            ]);
            expect(inverted.success).toBe(false);
        });
    });

    describe('Booking Cancel, Status, Outcome & Delete Guards (W5-BE-03)', () => {
        it('denies TUTOR with 403 on POST /cancel and PATCH /status, and validates bookingId UUIDs + JSON', async () => {
            const { POST: cancelBooking } = await import('@/app/api/bookings/[bookingId]/cancel/route');
            const { PATCH: patchStatus } = await import('@/app/api/bookings/[bookingId]/status/route');
            const { PATCH: patchOutcome } = await import('@/app/api/bookings/[bookingId]/outcome/route');
            const { DELETE: deleteBooking } = await import('@/app/api/bookings/[bookingId]/route');

            mockGetApiSession.mockResolvedValue({
                user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR' },
            });

            const cancelTutorRes = await cancelBooking(
                new Request('http://localhost/api/bookings/cancel', { method: 'POST' }),
                { params: Promise.resolve({ bookingId: UUID_V7_BOOKING }) }
            );
            expect(cancelTutorRes.status).toBe(403);

            const statusTutorRes = await patchStatus(
                new Request('http://localhost/api/bookings/status', {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'cancelled' }),
                }),
                { params: Promise.resolve({ bookingId: UUID_V7_BOOKING }) }
            );
            expect(statusTutorRes.status).toBe(403);

            // Switch to FRONT_DESK: non-UUID must return 400 across all 4 routes, UUIDv7 must pass UUID check (404 when missing)
            mockGetApiSession.mockResolvedValue({
                user: { id: 'fd-1', organisationId: 'org-1', role: 'FRONT_DESK' },
            });
            mockDb.query.bookings.findFirst.mockResolvedValue(null);

            for (const fn of [
                () => cancelBooking(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ bookingId: 'bad-id' }) }),
                () => patchStatus(new Request('http://localhost', { method: 'PATCH', body: '{}' }), { params: Promise.resolve({ bookingId: 'bad-id' }) }),
                () => patchOutcome(new Request('http://localhost', { method: 'PATCH', body: '{}' }), { params: Promise.resolve({ bookingId: 'bad-id' }) }),
                () => deleteBooking(new NextRequest('http://localhost', { method: 'DELETE' }), { params: Promise.resolve({ bookingId: 'bad-id' }) }),
            ]) {
                const res = await fn();
                expect(res.status).toBe(400);
            }

            // Malformed JSON on PATCH /status returns 400 (not 500)
            const badJsonRes = await patchStatus(
                new Request('http://localhost', { method: 'PATCH', body: '{not-json' }),
                { params: Promise.resolve({ bookingId: UUID_V7_BOOKING }) }
            );
            expect(badJsonRes.status).toBe(400);

            // UUIDv7 passes UUID validation on DELETE (reaches DB lookup -> 404)
            const v7DeleteRes = await deleteBooking(
                new NextRequest('http://localhost', { method: 'DELETE' }),
                { params: Promise.resolve({ bookingId: UUID_V7_BOOKING }) }
            );
            expect(v7DeleteRes.status).toBe(404);
        });
    });

    describe('Staff Invite, Accept-Invite, Magic-Login & NextAuth inviteToken (W5-SEC-03 / W5-BE-02)', () => {
        it('accept-invite blocks >72-byte password without bcrypt.compare and blocks SUSPENDED orgs', async () => {
            const { POST: acceptInvite } = await import('@/app/api/staff/accept-invite/route');

            mockDb.select.mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: 'inv-1',
                                token: 'hashed',
                                email: 'user@example.com',
                                role: 'TUTOR',
                                organisationId: 'org-1',
                                usedAt: null,
                                expiresAt: new Date(Date.now() + 60_000),
                            },
                        ]),
                    }),
                }),
            });
            mockDb.query.organisations.findFirst.mockResolvedValueOnce({
                id: 'org-1',
                approvalStatus: 'ACTIVE',
            });
            mockDb.query.users.findFirst.mockResolvedValueOnce({
                id: 'u1',
                email: 'user@example.com',
                organisationId: 'other-org',
                role: 'ORG_OWNER',
                passwordHash: '$2a$10$existinghash',
            });
            mockDb.query.orgMemberships.findMany.mockResolvedValueOnce([]);
            mockGetApiSession.mockResolvedValueOnce(null);

            const overlongPassword = 'A'.repeat(80);
            const res = await acceptInvite(
                new NextRequest('http://localhost/api/staff/accept-invite', {
                    method: 'POST',
                    body: JSON.stringify({ token: 'raw-tok', password: overlongPassword }),
                })
            );
            expect(res.status).toBe(403);
            expect(mockBcryptCompare).not.toHaveBeenCalled();

            // SUSPENDED org blocked with 403
            mockDb.select.mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: 'inv-2',
                                token: 'hashed-2',
                                email: 'user2@example.com',
                                role: 'TUTOR',
                                organisationId: 'org-susp',
                                usedAt: null,
                                expiresAt: new Date(Date.now() + 60_000),
                            },
                        ]),
                    }),
                }),
            });
            mockDb.query.organisations.findFirst.mockResolvedValueOnce({
                id: 'org-susp',
                approvalStatus: 'SUSPENDED',
            });
            const suspRes = await acceptInvite(
                new NextRequest('http://localhost/api/staff/accept-invite', {
                    method: 'POST',
                    body: JSON.stringify({ token: 'raw-tok-2' }),
                })
            );
            expect(suspRes.status).toBe(403);
        });

        it('magic-login and authConfig inviteToken reject SUSPENDED organisations', async () => {
            const { GET: magicLogin } = await import('@/app/api/staff/magic-login/route');
            const { authConfig } = await import('@/lib/auth');

            mockDb.select.mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: 'inv-m',
                                token: 'hashed',
                                email: 'staff@example.com',
                                role: 'TUTOR',
                                organisationId: 'org-susp',
                                usedAt: null,
                                expiresAt: new Date(Date.now() + 60_000),
                            },
                        ]),
                    }),
                }),
            });
            mockDb.query.organisations.findFirst.mockResolvedValueOnce({
                id: 'org-susp',
                approvalStatus: 'SUSPENDED',
            });

            const res = await magicLogin(
                new NextRequest('http://localhost/api/staff/magic-login?token=raw-tok')
            );
            expect(res.status).toBe(403);

            const inviteProvider = authConfig.providers.find(
                (p: any) => p.id === 'inviteToken' || p.options?.id === 'inviteToken'
            );
            const authorizeFn = inviteProvider?.authorize ?? inviteProvider?.options?.authorize;
            expect(typeof authorizeFn).toBe('function');

            mockDb.select.mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: 'inv-a',
                                token: 'hashed',
                                email: 'staff@example.com',
                                role: 'TUTOR',
                                organisationId: 'org-susp',
                                usedAt: null,
                                expiresAt: new Date(Date.now() + 60_000),
                            },
                        ]),
                    }),
                }),
            });
            mockDb.query.organisations.findFirst.mockResolvedValueOnce({
                id: 'org-susp',
                approvalStatus: 'SUSPENDED',
            });
            const authUser = await authorizeFn({ token: 'raw-tok' });
            expect(authUser).toBeNull();
        });

        it('POST /api/staff/invite blocks multi-org caller whose legacy users.role is ORG_OWNER in Org A but TUTOR in active Org B', async () => {
            const { POST: inviteStaff } = await import('@/app/api/staff/invite/route');

            mockGetApiSession.mockResolvedValueOnce({
                user: { id: 'multi-u1', organisationId: 'org-b', role: 'TUTOR' },
            });
            mockDb.select.mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: 'multi-u1',
                                organisationId: 'org-a',
                                role: 'ORG_OWNER',
                                firstName: 'Multi',
                                lastName: 'User',
                            },
                        ]),
                    }),
                }),
            });
            mockDb.query.orgMemberships.findFirst.mockResolvedValueOnce({
                userId: 'multi-u1',
                organisationId: 'org-b',
                role: 'TUTOR',
            });

            const res = await inviteStaff(
                new NextRequest('http://localhost/api/staff/invite', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: 'target@example.com',
                        role: 'TUTOR',
                        centreId: VALID_CENTRE_UUID,
                    }),
                })
            );
            expect(res.status).toBe(403);
        });
    });

    describe('Discount Settings Zod Validation & 2-Decimal GBP Clamp (W5-BE-06 / W5-SEC-04)', () => {
        it('rejects >100% percent discounts, negative values, and extra properties in PATCH /api/settings/discounts', async () => {
            const { PATCH } = await import('@/app/api/settings/discounts/route');

            mockGetApiSession.mockResolvedValue({
                user: { id: 'm1', organisationId: 'org-1', role: 'MANAGER' },
            });

            const over100Res = await PATCH(
                new NextRequest('http://localhost/api/settings/discounts', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        discountRules: [
                            {
                                id: 'r1',
                                type: 'percentage',
                                label: 'Bad 150%',
                                value: 150,
                                valueType: 'percent',
                                active: true,
                            },
                        ],
                    }),
                })
            );
            expect(over100Res.status).toBe(400);

            const negativeRes = await PATCH(
                new NextRequest('http://localhost/api/settings/discounts', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        discountRules: [
                            {
                                id: 'r2',
                                type: 'fixed',
                                label: 'Negative',
                                value: -10,
                                valueType: 'fixed',
                                active: true,
                            },
                        ],
                    }),
                })
            );
            expect(negativeRes.status).toBe(400);

            const validRes = await PATCH(
                new NextRequest('http://localhost/api/settings/discounts', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        discountRules: [
                            {
                                id: 'r3',
                                type: 'pupil_premium',
                                label: 'Pupil Premium £12.50',
                                value: 12.5,
                                valueType: 'fixed',
                                active: true,
                            },
                        ],
                    }),
                })
            );
            expect(validRes.status).toBe(200);
        });

        it('calculateDiscount preserves 2-decimal GBP (£12.50) precision and ignores negative/NaN rules', async () => {
            const { calculateDiscount } = await import('@/lib/services/discount');

            expect(
                calculateDiscount(
                    [
                        {
                            id: '1',
                            type: 'fixed',
                            label: '£12.50 off',
                            value: 12.5,
                            valueType: 'fixed',
                            active: true,
                        },
                        {
                            id: '2',
                            type: 'fixed',
                            label: 'Corrupt negative',
                            value: -50,
                            valueType: 'fixed',
                            active: true,
                        },
                    ],
                    100,
                    1
                )
            ).toBe(12.5);

            expect(
                calculateDiscount(
                    [
                        {
                            id: '3',
                            type: 'percentage',
                            label: '12.55% off £33',
                            value: 12.55,
                            valueType: 'percent',
                            active: true,
                        },
                    ],
                    33,
                    1
                )
            ).toBe(4.14);
        });
    });
});
