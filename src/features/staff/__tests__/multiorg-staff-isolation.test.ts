import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequireTenantSession = vi.fn();
const mockGetApiSession = vi.fn();
vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => mockRequireTenantSession(...args),
    getApiSession: (...args: unknown[]) => mockGetApiSession(...args),
}));

const mockGetUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: unknown[]) => mockGetUserAccessibleCentreIds(...args),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
    strictRateLimit: {},
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
    getClientIP: vi.fn(() => '127.0.0.1'),
}));

const mockSendMagicLink = vi.fn();
vi.mock('@/lib/services/email', () => ({
    emailService: {
        sendMagicLink: (...args: unknown[]) => mockSendMagicLink(...args),
    },
}));

vi.mock('@/lib/base-url', () => ({
    getTrustedApplicationUrl: vi.fn(() => 'https://app.sprintscaleit.co.uk'),
}));

const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
vi.mock('bcryptjs', () => ({
    default: {
        compare: (...args: unknown[]) => mockBcryptCompare(...args),
        hash: (...args: unknown[]) => mockBcryptHash(...args),
    },
}));

const mockCentresFindMany = vi.fn();
const mockUsersFindFirst = vi.fn();
const mockOrgMembershipsFindMany = vi.fn();
const mockOrgMembershipsFindFirst = vi.fn();
const mockVerificationTokensFindFirst = vi.fn();

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            centres: { findMany: (...args: unknown[]) => mockCentresFindMany(...args) },
            users: { findFirst: (...args: unknown[]) => mockUsersFindFirst(...args) },
            orgMemberships: {
                findMany: (...args: unknown[]) => mockOrgMembershipsFindMany(...args),
                findFirst: (...args: unknown[]) => mockOrgMembershipsFindFirst(...args),
            },
            verificationTokens: {
                findFirst: (...args: unknown[]) => mockVerificationTokensFindFirst(...args),
            },
        },
        select: (...args: unknown[]) => mockSelect(...args),
        insert: (...args: unknown[]) => mockInsert(...args),
        update: (...args: unknown[]) => mockUpdate(...args),
        delete: (...args: unknown[]) => mockDelete(...args),
        transaction: (...args: unknown[]) => mockTransaction(...args),
    },
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const CENTRE_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CENTRE_B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OWNER_B = '33333333-3333-4333-8333-333333333333';
const MANAGER_B = '44444444-4444-4444-8444-444444444444';
const SHARED_STAFF = '55555555-5555-4555-8555-555555555555';
const NOTIF_UUID = '66666666-6666-4666-8666-666666666666';

describe('Multi-Org Staff Isolation, Invites & Notification Scoping (w4-be-03)', () => {
    let updateWhereCalls: unknown[];
    let deleteWhereCalls: unknown[];
    let insertValuesCalls: unknown[];

    beforeEach(() => {
        vi.clearAllMocks();
        updateWhereCalls = [];
        deleteWhereCalls = [];
        insertValuesCalls = [];
        mockOrgMembershipsFindMany.mockResolvedValue([]);

        mockUpdate.mockImplementation(() => ({
            set: vi.fn(() => ({
                where: vi.fn((cond: unknown) => {
                    updateWhereCalls.push(cond);
                    return Promise.resolve(undefined);
                }),
            })),
        }));

        mockDelete.mockImplementation(() => ({
            where: vi.fn((cond: unknown) => {
                deleteWhereCalls.push(cond);
                return Promise.resolve(undefined);
            }),
        }));

        mockInsert.mockImplementation(() => ({
            values: vi.fn((vals: unknown) => {
                insertValuesCalls.push(vals);
                return {
                    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
                };
            }),
        }));

        mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
                query: {
                    orgMemberships: {
                        findFirst: (...args: unknown[]) => mockOrgMembershipsFindFirst(...args),
                    },
                },
                update: mockUpdate,
                delete: mockDelete,
                insert: mockInsert,
            })
        );
    });

    it('exports only async functions from src/features/staff/staff-actions ("use server" rule)', async () => {
        const mod = await import('@/features/staff/staff-actions');
        const entries = Object.entries(mod);
        expect(entries.length).toBeGreaterThan(0);
        for (const [, fn] of entries) {
            expect(typeof fn).toBe('function');
            expect(fn.constructor.name).toBe('AsyncFunction');
        }
    });

    it('updateStaffRole resolves multi-org staff via orgMemberships, syncs org-scoped centreMemberships, and records auditEvents', async () => {
        mockRequireTenantSession.mockResolvedValue({
            user: { id: OWNER_B, organisationId: ORG_B, role: 'ORG_OWNER' },
        });
        mockSelect
            .mockReturnValueOnce({
                from: () => ({
                    where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'ORG_OWNER' }]) }),
                }),
            })
            .mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            { id: SHARED_STAFF, role: 'TUTOR', organisationId: ORG_B },
                        ]),
                    }),
                }),
            });
        mockCentresFindMany.mockResolvedValue([{ id: CENTRE_B1 }]);

        const { updateStaffRole } = await import('@/features/staff/staff-actions');
        await expect(updateStaffRole(SHARED_STAFF, 'FRONT_DESK')).resolves.toBeUndefined();

        // 3 updates: orgMemberships, users (guarded by orgId), and org-scoped centreMemberships
        expect(mockUpdate).toHaveBeenCalledTimes(3);
        expect(insertValuesCalls).toHaveLength(1);
        expect(insertValuesCalls[0]).toMatchObject({
            organisationId: ORG_B,
            userId: OWNER_B,
            eventType: 'staff_role_updated',
        });
    });

    it('updateStaffRole fails closed for MANAGER when target staff only has centre memberships in another org', async () => {
        mockRequireTenantSession.mockResolvedValue({
            user: { id: MANAGER_B, organisationId: ORG_B, role: 'MANAGER' },
        });
        mockGetUserAccessibleCentreIds.mockResolvedValue([CENTRE_B1]);
        mockCentresFindMany.mockResolvedValue([{ id: CENTRE_B1 }]);

        mockSelect
            .mockReturnValueOnce({
                from: () => ({
                    where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'MANAGER' }]) }),
                }),
            })
            .mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            { id: SHARED_STAFF, role: 'TUTOR', organisationId: ORG_B },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: () => ({
                    // Target only belongs to CENTRE_A1 (Org A), 0 centres in Org B
                    where: vi.fn().mockResolvedValue([{ centreId: CENTRE_A1 }]),
                }),
            });

        const { updateStaffRole } = await import('@/features/staff/staff-actions');
        await expect(updateStaffRole(SHARED_STAFF, 'FRONT_DESK')).rejects.toThrow(
            /Forbidden: Staff member does not belong to your assigned centres/
        );
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('POST /api/staff/remove scopes centreMemberships deletion to active org and repoints users.organisationId to remaining org', async () => {
        mockGetApiSession.mockResolvedValue({
            user: { id: OWNER_B, organisationId: ORG_B, role: 'ORG_OWNER' },
        });
        mockSelect.mockReturnValueOnce({
            from: () => ({
                where: () => ({
                    limit: vi.fn().mockResolvedValue([
                        { id: SHARED_STAFF, role: 'TUTOR', organisationId: ORG_B },
                    ]),
                }),
            }),
        });
        mockCentresFindMany.mockResolvedValue([{ id: CENTRE_B1 }]);
        mockOrgMembershipsFindFirst.mockResolvedValue({
            userId: SHARED_STAFF,
            organisationId: ORG_A,
            role: 'MANAGER',
        });

        let capturedUserSet: Record<string, unknown> | undefined;
        mockUpdate.mockImplementation(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
                capturedUserSet = vals;
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        }));

        const { POST } = await import('@/app/api/staff/remove/route');
        const res = await POST(
            new NextRequest('http://localhost/api/staff/remove', {
                method: 'POST',
                body: JSON.stringify({ userId: SHARED_STAFF }),
            })
        );

        expect(res.status).toBe(200);
        // Deletes org-scoped centreMemberships + orgMemberships (2 deletes)
        expect(deleteWhereCalls).toHaveLength(2);
        // Repoints users.organisationId to ORG_A instead of nulling it out!
        expect(capturedUserSet).toMatchObject({
            organisationId: ORG_A,
            role: 'MANAGER',
        });
    });

    it('DELETE /api/staff/[id] and DELETE /api/staff/invites/[id] reject non-UUID params with 400', async () => {
        mockGetApiSession.mockResolvedValue({
            user: { id: OWNER_B, organisationId: ORG_B, role: 'ORG_OWNER' },
        });
        const { DELETE: deleteStaff } = await import('@/app/api/staff/[id]/route');
        const { DELETE: deleteInvite } = await import('@/app/api/staff/invites/[id]/route');

        const staffRes = await deleteStaff(new Request('http://localhost/api/staff/not-a-uuid'), {
            params: Promise.resolve({ id: 'not-a-uuid' }),
        });
        expect(staffRes.status).toBe(400);

        const inviteRes = await deleteInvite(
            new Request('http://localhost/api/staff/invites/not-a-uuid'),
            { params: Promise.resolve({ id: 'not-a-uuid' }) }
        );
        expect(inviteRes.status).toBe(400);
    });

    it('POST /api/staff/assign-centres scopes ORG_OWNER centre deletion strictly to active org centres', async () => {
        mockGetApiSession.mockResolvedValue({
            user: { id: OWNER_B, organisationId: ORG_B, role: 'ORG_OWNER' },
        });
        mockSelect
            .mockReturnValueOnce({
                from: () => ({
                    where: () => ({ limit: vi.fn().mockResolvedValue([{ role: 'ORG_OWNER' }]) }),
                }),
            })
            .mockReturnValueOnce({
                from: () => ({
                    where: () => ({
                        limit: vi.fn().mockResolvedValue([
                            { id: SHARED_STAFF, role: 'TUTOR', organisationId: ORG_B },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: () => ({
                    where: vi.fn().mockResolvedValue([{ id: CENTRE_B1 }]),
                }),
            });
        mockCentresFindMany.mockResolvedValue([{ id: CENTRE_B1 }]);

        const { POST } = await import('@/app/api/staff/assign-centres/route');
        const res = await POST(
            new NextRequest('http://localhost/api/staff/assign-centres', {
                method: 'POST',
                body: JSON.stringify({ userId: SHARED_STAFF, centreIds: [CENTRE_B1] }),
            })
        );

        expect(res.status).toBe(200);
        expect(mockCentresFindMany).toHaveBeenCalledTimes(1);
        expect(deleteWhereCalls).toHaveLength(1);
        expect(insertValuesCalls).toEqual([
            [{ userId: SHARED_STAFF, centreId: CENTRE_B1, role: 'TUTOR' }],
        ]);
    });

    it('POST /api/staff/accept-invite enforces validatePassword on new accounts and switches active org on existing accounts', async () => {
        const { POST } = await import('@/app/api/staff/accept-invite/route');

        // 1. Short password (< 8 chars) on new placeholder invitee -> 400
        mockSelect.mockReturnValueOnce({
            from: () => ({
                where: () => ({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: 'inv-1',
                            token: 'hash',
                            email: 'new@org.uk',
                            role: 'TUTOR',
                            organisationId: ORG_B,
                            usedAt: null,
                            expiresAt: new Date(Date.now() + 60_000),
                        },
                    ]),
                }),
            }),
        });
        mockUsersFindFirst.mockResolvedValueOnce({
            id: 'new-user',
            email: 'new@org.uk',
            organisationId: null,
            role: 'TUTOR',
            passwordHash: null,
            emailVerified: null,
        });

        const shortPwRes = await POST(
            new NextRequest('http://localhost/api/staff/accept-invite', {
                method: 'POST',
                body: JSON.stringify({ token: 'raw-tok', password: 'short' }),
            })
        );
        expect(shortPwRes.status).toBe(400);
        expect(mockBcryptHash).not.toHaveBeenCalled();

        // 2. Existing verified user accepting invite to ORG_B switches active organisationId & role without touching passwordHash
        let capturedUserSwitch: Record<string, unknown> | undefined;
        mockUpdate.mockImplementationOnce(() => ({
            set: vi.fn((vals: Record<string, unknown>) => {
                capturedUserSwitch = vals;
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        }));
        mockSelect.mockReturnValueOnce({
            from: () => ({
                where: () => ({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: 'inv-2',
                            token: 'hash-2',
                            email: 'existing@org.uk',
                            role: 'MANAGER',
                            organisationId: ORG_B,
                            usedAt: null,
                            expiresAt: new Date(Date.now() + 60_000),
                        },
                    ]),
                }),
            }),
        });
        mockUsersFindFirst.mockResolvedValueOnce({
            id: SHARED_STAFF,
            email: 'existing@org.uk',
            organisationId: ORG_A,
            role: 'ORG_OWNER',
            passwordHash: 'keep-this-hash',
            emailVerified: new Date('2026-01-01T00:00:00Z'),
        });
        mockOrgMembershipsFindMany.mockResolvedValueOnce([
            { userId: SHARED_STAFF, organisationId: ORG_A, role: 'ORG_OWNER' },
        ]);
        mockGetApiSession.mockResolvedValueOnce({
            user: { id: SHARED_STAFF, email: 'existing@org.uk', organisationId: ORG_A },
        });
        mockVerificationTokensFindFirst.mockResolvedValueOnce(null);

        const existingRes = await POST(
            new NextRequest('http://localhost/api/staff/accept-invite', {
                method: 'POST',
                body: JSON.stringify({ token: 'raw-tok-2' }),
            })
        );
        expect(existingRes.status).toBe(200);
        expect(mockBcryptHash).not.toHaveBeenCalled();
        expect(capturedUserSwitch).toMatchObject({
            organisationId: ORG_B,
            role: 'MANAGER',
        });
        expect(capturedUserSwitch).not.toHaveProperty('passwordHash');
    });

    it('POST /api/staff/request-magic-link appends mode=login and returns generic 200 on email send failure', async () => {
        mockCheckRateLimit.mockResolvedValue({ success: true });
        mockUsersFindFirst.mockResolvedValue({
            id: SHARED_STAFF,
            email: 'tutor@org.uk',
            role: 'TUTOR',
            organisationId: ORG_B,
            name: 'Alex Tutor',
        });
        mockSelect.mockReturnValue({
            from: () => ({
                where: () => ({ limit: vi.fn().mockResolvedValue([{ name: 'SprintScale Club' }]) }),
            }),
        });
        mockSendMagicLink.mockResolvedValueOnce({ success: false, error: 'SMTP down' });

        const { POST } = await import('@/app/api/staff/request-magic-link/route');
        const res = await POST(
            new NextRequest('http://localhost/api/staff/request-magic-link', {
                method: 'POST',
                body: JSON.stringify({ email: 'tutor@org.uk' }),
            })
        );

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true });
        expect(mockSendMagicLink).toHaveBeenCalledTimes(1);
        const sentUrl = new URL(mockSendMagicLink.mock.calls[0][0].magicLink);
        expect(sentUrl.pathname).toBe('/accept-invite');
        expect(sentUrl.searchParams.get('mode')).toBe('login');
        expect(sentUrl.searchParams.get('token')).toBeTruthy();
    });

    it('notifyOwners restricts recipients to ORG_OWNER + centre-scoped MANAGER (never TUTOR/FRONT_DESK)', async () => {
        mockSelect
            // 1. orgMemberships (returns ORG_OWNER + 2 MANAGERs)
            .mockReturnValueOnce({
                from: () => ({
                    where: vi.fn().mockResolvedValue([
                        { userId: OWNER_B, role: 'ORG_OWNER' },
                        { userId: MANAGER_B, role: 'MANAGER' },
                        { userId: 'mgr-other-centre', role: 'MANAGER' },
                    ]),
                }),
            })
            // 2. centreMemberships for CENTRE_B1 (only MANAGER_B assigned)
            .mockReturnValueOnce({
                from: () => ({
                    where: vi.fn().mockResolvedValue([{ userId: MANAGER_B }]),
                }),
            });

        const { notifyOwners } = await import('@/lib/db-notifications');
        await notifyOwners({
            orgId: ORG_B,
            centreId: CENTRE_B1,
            type: 'booking_created',
            title: 'New Booking',
            message: 'Booking created at Centre B1',
        });

        expect(insertValuesCalls).toHaveLength(1);
        const insertedRows = insertValuesCalls[0] as Array<{ userId: string; organisationId: string }>;
        expect(insertedRows.map((r) => r.userId)).toEqual([OWNER_B, MANAGER_B]);
    });

    it('GET & PATCH /api/notifications require organisationId and reject non-UUID notificationId with 400', async () => {
        const { GET, PATCH } = await import('@/app/api/notifications/route');

        // Missing organisationId -> 401
        mockGetApiSession.mockResolvedValueOnce({ user: { id: SHARED_STAFF, organisationId: null } });
        const unauthGet = await GET();
        expect(unauthGet.status).toBe(401);

        // Invalid notificationId UUID -> 400
        mockGetApiSession.mockResolvedValueOnce({
            user: { id: SHARED_STAFF, organisationId: ORG_B },
        });
        const badUuidPatch = await PATCH(
            new Request('http://localhost/api/notifications', {
                method: 'PATCH',
                body: JSON.stringify({ notificationId: 'not-a-uuid' }),
            })
        );
        expect(badUuidPatch.status).toBe(400);

        // Valid UUID PATCH -> 200
        mockGetApiSession.mockResolvedValueOnce({
            user: { id: SHARED_STAFF, organisationId: ORG_B },
        });
        const okPatch = await PATCH(
            new Request('http://localhost/api/notifications', {
                method: 'PATCH',
                body: JSON.stringify({ notificationId: NOTIF_UUID }),
            })
        );
        expect(okPatch.status).toBe(200);
    });
});
