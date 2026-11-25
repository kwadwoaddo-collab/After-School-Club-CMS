import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { assertOrgActive, OrgNotActiveError } from '@/lib/org-approval-guard';

const mockCookiesGet = vi.fn();
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        get: (...args: unknown[]) => mockCookiesGet(...args),
    })),
}));

vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        after: vi.fn((fn: () => unknown) => fn()),
    };
});

const sendMagicLink = vi.fn();
vi.mock('@/lib/services/email', () => ({
    EmailService: class {
        sendMagicLink(...args: unknown[]) {
            return sendMagicLink(...args);
        }
    },
}));

vi.mock('@/lib/base-url', () => ({
    getBaseUrl: () => 'https://app.sprintscaleit.co.uk',
    getTrustedApplicationUrl: () => 'https://app.sprintscaleit.co.uk',
}));

vi.mock('@/lib/services/email-outbox', () => ({
    captureEntryBudget: vi.fn(() => ({ startedAtMs: Date.now(), budgetMs: 8000 })),
    enqueueBookingEmail: vi.fn(async () => ({ outboxId: 'outbox-1' })),
    registerFastPathAfterCommit: vi.fn(),
    supersedeOldBookingForReplacement: vi.fn(async () => ({
        replaced: true,
        oldStartAt: new Date(Date.now() + 48 * 3600 * 1000),
        hadUnsentConfirmation: false,
    })),
    OUTBOX_PAYLOAD_VERSION: 1,
}));

const parentsFindFirst = vi.fn();
const parentsFindMany = vi.fn();
const childrenFindFirst = vi.fn();
const centresFindFirst = vi.fn();
const bookingsFindFirst = vi.fn();
const dbInsertValues = vi.fn();
const dbReturning = vi.fn();

vi.mock('@/db', () => {
    const txMock = {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                innerJoin: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue([]),
                    })),
                })),
            })),
        })),
        query: {
            bookings: {
                findFirst: (...args: unknown[]) => bookingsFindFirst(...args),
            },
        },
        insert: vi.fn(() => ({
            values: (...args: unknown[]) => {
                dbInsertValues(...args);
                return {
                    returning: () => dbReturning(),
                };
            },
        })),
    };

    return {
        db: {
            query: {
                parents: {
                    findFirst: (...args: unknown[]) => parentsFindFirst(...args),
                    findMany: (...args: unknown[]) => parentsFindMany(...args),
                },
                children: {
                    findFirst: (...args: unknown[]) => childrenFindFirst(...args),
                },
                centres: {
                    findFirst: (...args: unknown[]) => centresFindFirst(...args),
                },
                bookings: {
                    findFirst: (...args: unknown[]) => bookingsFindFirst(...args),
                },
            },
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: () => dbReturning(),
                    })),
                })),
            })),
            insert: vi.fn(() => ({
                values: (...args: unknown[]) => dbInsertValues(...args),
            })),
            transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txMock)),
        },
    };
});

describe('Wave 4B — Portal Active-Org Gates, Booking Validation & Server Action Exports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(assertOrgActive).mockResolvedValue(undefined);
        sendMagicLink.mockResolvedValue({ success: true });
        dbReturning.mockResolvedValue([{ id: 'booking-new-1' }]);
    });

    it('getCurrentParent returns null when parent organisation is SUSPENDED', async () => {
        const { signParentToken, getCurrentParent } = await import('@/lib/parent-auth');
        const jwt = await signParentToken('parent-suspended-1');
        mockCookiesGet.mockReturnValue({ value: jwt });
        parentsFindFirst.mockResolvedValueOnce({
            id: 'parent-suspended-1',
            organisationId: 'org-suspended',
            firstName: 'Sam',
            deletedAt: null,
            children: [],
            bookings: [],
        });
        vi.mocked(assertOrgActive).mockRejectedValueOnce(new OrgNotActiveError('org-suspended', 'SUSPENDED'));

        const result = await getCurrentParent();
        expect(result).toBeNull();
    });

    it('POST /api/portal/login skips newer SUSPENDED org row and authenticates sibling ACTIVE org row', async () => {
        parentsFindFirst.mockResolvedValueOnce({
            id: 'parent-suspended-org',
            organisationId: 'org-suspended',
            firstName: 'SuspendedClubParent',
            email: 'multi@example.com',
            deletedAt: null,
        });
        parentsFindMany.mockResolvedValueOnce([
            {
                id: 'parent-active-org',
                organisationId: 'org-active',
                firstName: 'ActiveClubParent',
                email: 'multi@example.com',
                deletedAt: null,
            },
        ]);
        vi.mocked(assertOrgActive)
            .mockRejectedValueOnce(new OrgNotActiveError('org-suspended', 'SUSPENDED'))
            .mockResolvedValueOnce(undefined);

        const { POST } = await import('@/app/api/portal/login/route');
        const req = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'multi@example.com' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(sendMagicLink).toHaveBeenCalledTimes(1);
        expect(sendMagicLink).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'multi@example.com',
                name: 'ActiveClubParent',
            })
        );
    });

    it('POST /api/portal/login returns generic 200 without sending email when all matching orgs are inactive', async () => {
        parentsFindFirst.mockResolvedValueOnce({
            id: 'parent-suspended-only',
            organisationId: 'org-suspended',
            firstName: 'Jane',
            email: 'suspended@example.com',
            deletedAt: null,
        });
        parentsFindMany.mockResolvedValueOnce([]);
        vi.mocked(assertOrgActive).mockRejectedValueOnce(new OrgNotActiveError('org-suspended', 'SUSPENDED'));

        const { POST } = await import('@/app/api/portal/login/route');
        const req = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'suspended@example.com' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(sendMagicLink).not.toHaveBeenCalled();
    });

    it('POST /portal/verify redirects 303 to /portal/login?error=AccountSuspended without setting cookie when org is inactive', async () => {
        dbReturning.mockResolvedValueOnce([
            { id: 'parent-uuid-suspended', organisationId: 'org-suspended' },
        ]);
        vi.mocked(assertOrgActive).mockRejectedValueOnce(new OrgNotActiveError('org-suspended', 'SUSPENDED'));

        const { POST } = await import('@/app/portal/verify/route');
        const form = new FormData();
        form.append('token', 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90');

        const res = await POST(
            new Request('https://app.sprintscaleit.co.uk/portal/verify', {
                method: 'POST',
                body: form,
            })
        );

        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toBe(
            'https://app.sprintscaleit.co.uk/portal/login?error=AccountSuspended'
        );
        expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('portal/book/actions enforces duration allowlist, future dates, 24h reschedule window, entropy, consent preservation, and SQL error sanitization', async () => {
        const { signParentToken } = await import('@/lib/parent-auth');
        const jwt = await signParentToken('parent-book-1');
        mockCookiesGet.mockReturnValue({ value: jwt });

        const parentFixture = {
            id: 'parent-book-1',
            organisationId: 'org-1',
            firstName: 'Grace',
            lastName: 'Hopper',
            email: 'grace@example.com',
            deletedAt: null,
            children: [],
            bookings: [{ id: 'prev-bk', communicationsConsent: true, createdAt: new Date() }],
        };

        const { createPortalBooking, reschedulePortalBooking } = await import('@/app/portal/book/actions');

        // 1. Disallowed duration rejected
        parentsFindFirst.mockResolvedValue(parentFixture);
        const badDuration = await createPortalBooking({
            childId: 'child-1',
            centreId: 'centre-1',
            startAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
            duration: 45,
        });
        expect(badDuration).toEqual({ success: false, error: 'Invalid booking duration' });

        // 2. Past date rejected
        const pastBooking = await createPortalBooking({
            childId: 'child-1',
            centreId: 'centre-1',
            startAt: new Date(Date.now() - 3600 * 1000).toISOString(),
            duration: 60,
        });
        expect(pastBooking).toEqual({ success: false, error: 'Booking date must be in the future' });

        // 3. <24h reschedule rejected
        bookingsFindFirst.mockResolvedValueOnce({
            id: 'old-bk-soon',
            parentId: 'parent-book-1',
            status: 'confirmed',
            startAt: new Date(Date.now() + 12 * 3600 * 1000),
            communicationsConsent: true,
        });
        const lateReschedule = await reschedulePortalBooking({
            oldBookingId: 'old-bk-soon',
            childId: 'child-1',
            centreId: 'centre-1',
            startAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
            duration: 60,
        });
        expect(lateReschedule).toEqual({
            success: false,
            error: 'Bookings must be rescheduled at least 24 hours in advance.',
        });

        // 4. Two bookings under frozen Date.now() generate distinct BK-...-<6hex> codes and preserve communicationsConsent: true
        const frozenNow = Date.now();
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(frozenNow);
        try {
            childrenFindFirst.mockResolvedValue({
                id: 'child-1',
                parentId: 'parent-book-1',
                firstName: 'Ada',
                lastName: 'Hopper',
                deletedAt: null,
            });
            centresFindFirst.mockResolvedValue({
                id: 'centre-1',
                organisationId: 'org-1',
                name: 'Sydenham Centre',
                address: '1 High St',
            });
            bookingsFindFirst.mockResolvedValue(undefined);

            const first = await createPortalBooking({
                childId: 'child-1',
                centreId: 'centre-1',
                startAt: new Date(frozenNow + 72 * 3600 * 1000).toISOString(),
                duration: 60,
            });
            const second = await createPortalBooking({
                childId: 'child-1',
                centreId: 'centre-1',
                startAt: new Date(frozenNow + 96 * 3600 * 1000).toISOString(),
                duration: 60,
            });

            expect(first.success).toBe(true);
            expect(second.success).toBe(true);
            expect(first.confirmationCode).toMatch(/^BK-[A-Z0-9]+-[A-F0-9]{6}$/);
            expect(second.confirmationCode).toMatch(/^BK-[A-Z0-9]+-[A-F0-9]{6}$/);
            expect(first.confirmationCode).not.toBe(second.confirmationCode);
            expect(dbInsertValues.mock.calls[0][0]).toMatchObject({ communicationsConsent: true });

            // 5. Raw Postgres error is sanitized
            dbReturning.mockRejectedValueOnce(
                new Error('duplicate key value violates unique constraint "bookings_confirmation_code_unique"')
            );
            const rawErrRes = await createPortalBooking({
                childId: 'child-1',
                centreId: 'centre-1',
                startAt: new Date(frozenNow + 120 * 3600 * 1000).toISOString(),
                duration: 60,
            });
            expect(rawErrRes.success).toBe(false);
            expect(rawErrRes.error).toBe('Failed to create booking. Please try again.');
            expect(rawErrRes.error).not.toContain('bookings_confirmation_code_unique');
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('every runtime export in touched portal "use server" files is an async function', async () => {
        const billingActions = await import('@/app/portal/billing/actions');
        const bookActions = await import('@/app/portal/book/actions');
        const childActions = await import('@/app/portal/children/[id]/actions');

        for (const mod of [billingActions, bookActions, childActions]) {
            const entries = Object.entries(mod);
            expect(entries.length).toBeGreaterThan(0);
            for (const [, value] of entries) {
                expect(typeof value).toBe('function');
                expect(value.constructor.name).toBe('AsyncFunction');
            }
        }
    });
});
