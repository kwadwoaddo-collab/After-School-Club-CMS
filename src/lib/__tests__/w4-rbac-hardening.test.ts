import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireTenantSession = vi.fn();
const mockGetApiSession = vi.fn();

vi.mock('@/lib/session', () => ({
    requireTenantSession: (...args: unknown[]) => mockRequireTenantSession(...args),
    getApiSession: (...args: unknown[]) => mockGetApiSession(...args),
}));

const mockCanUserAccessCentre = vi.fn();
const mockGetUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
    canUserAccessCentre: (...args: unknown[]) => mockCanUserAccessCentre(...args),
    getUserAccessibleCentreIds: (...args: unknown[]) => mockGetUserAccessibleCentreIds(...args),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        after: vi.fn(),
    };
});

vi.mock('@/lib/finance/recalculate-invoice-status', () => ({
    recalculateInvoiceStatus: vi.fn(),
}));

vi.mock('@/lib/services/email-outbox', () => ({
    OUTBOX_PAYLOAD_VERSION: 1,
    captureEntryBudget: vi.fn(() => ({})),
    transitionBookingAndEnqueue: vi.fn(),
    registerFastPathAfterCommit: vi.fn(),
}));

vi.mock('@/lib/services/notifications', () => ({
    notificationService: {
        sendBookingReschedule: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

const mockInvoicesFindFirst = vi.fn();
const mockPaymentsFindFirst = vi.fn();
const mockBillingConfigsFindFirst = vi.fn();
const mockBookingsFindFirst = vi.fn();
const mockBookingsFindMany = vi.fn();
const mockBookingAttendeesFindFirst = vi.fn();
const mockCentresFindFirst = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbTransaction = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            invoices: { findFirst: (...args: unknown[]) => mockInvoicesFindFirst(...args) },
            payments: { findFirst: (...args: unknown[]) => mockPaymentsFindFirst(...args) },
            billingConfigs: { findFirst: (...args: unknown[]) => mockBillingConfigsFindFirst(...args) },
            bookings: {
                findFirst: (...args: unknown[]) => mockBookingsFindFirst(...args),
                findMany: (...args: unknown[]) => mockBookingsFindMany(...args),
            },
            bookingAttendees: { findFirst: (...args: unknown[]) => mockBookingAttendeesFindFirst(...args) },
            centres: { findFirst: (...args: unknown[]) => mockCentresFindFirst(...args) },
        },
        update: (...args: unknown[]) => mockDbUpdate(...args),
        delete: (...args: unknown[]) => mockDbDelete(...args),
        transaction: (...args: unknown[]) => mockDbTransaction(...args),
    },
}));

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const CENTRE_ID = '550e8400-e29b-41d4-a716-446655440001';
const BOOKING_ID = '550e8400-e29b-41d4-a716-446655440002';

function makeSession(role: string) {
    return {
        user: {
            id: `user-${role.toLowerCase()}`,
            organisationId: ORG_ID,
            role,
        },
    };
}

describe('Wave 4 RBAC, Payment Integrity & Booking Bounds Hardening (w4-be-02)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbUpdate.mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            }),
        });
        mockDbDelete.mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
        });
    });

    describe('"use server" module export safety (Next.js 16.3.4)', () => {
        it('exports only async functions from finance, billing, reconcile-payment, and bookings action modules', async () => {
            const modules = await Promise.all([
                import('@/features/finance/actions'),
                import('@/features/billing/actions'),
                import('@/features/billing/actions/reconcile-payment'),
                import('@/features/bookings/actions'),
            ]);

            for (const mod of modules) {
                const entries = Object.entries(mod);
                expect(entries.length).toBeGreaterThan(0);
                for (const [, value] of entries) {
                    expect(typeof value).toBe('function');
                    expect(value.constructor.name).toBe('AsyncFunction');
                }
            }
        });
    });

    describe('finance/actions RBAC & failPayment verified-payment guard', () => {
        it('forbids TUTOR from reading getInvoiceDetails or verifying payments', async () => {
            mockRequireTenantSession.mockResolvedValue(makeSession('TUTOR'));
            const { getInvoiceDetails, verifyPayment } = await import('@/features/finance/actions');

            await expect(getInvoiceDetails('inv-1')).rejects.toThrow(/Forbidden/);
            await expect(verifyPayment('pay-1')).rejects.toThrow(/Forbidden/);
            expect(mockInvoicesFindFirst).not.toHaveBeenCalled();
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });

        it('forbids FRONT_DESK and TUTOR from mutating invoice date/notes or failing payments', async () => {
            const { updateInvoiceDate, updateInvoiceNotes, failPayment } = await import('@/features/finance/actions');

            for (const role of ['FRONT_DESK', 'TUTOR']) {
                mockRequireTenantSession.mockResolvedValue(makeSession(role));
                await expect(updateInvoiceDate('inv-1', new Date())).rejects.toThrow(/Forbidden/);
                await expect(updateInvoiceNotes('inv-1', 'Note')).rejects.toThrow(/Forbidden/);
                await expect(failPayment('pay-1')).rejects.toThrow(/Forbidden/);
            }
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });

        it('blocks failPayment on an already-verified payment and requires reversePayment instead', async () => {
            mockRequireTenantSession.mockResolvedValue(makeSession('ORG_OWNER'));
            mockPaymentsFindFirst.mockResolvedValue({
                id: 'pay-verified',
                invoiceId: 'inv-1',
                status: 'verified',
                amount: '120.00',
                invoice: {
                    id: 'inv-1',
                    organisationId: ORG_ID,
                    centreId: CENTRE_ID,
                    parentId: 'parent-1',
                },
            });
            mockDbTransaction.mockImplementation(async (cb: any) =>
                cb({
                    query: { payments: { findFirst: mockPaymentsFindFirst } },
                    update: mockDbUpdate,
                    insert: vi.fn(),
                })
            );

            const { failPayment } = await import('@/features/finance/actions');
            await expect(failPayment('pay-verified')).rejects.toThrow(
                /Verified payments cannot be marked failed\. Use reversePayment instead\./
            );
            expect(mockDbUpdate).not.toHaveBeenCalled();
        });
    });

    describe('billing/actions & reconcilePayment RBAC', () => {
        it('rejects FRONT_DESK and TUTOR at entry before DB lookup on billing config/cycle mutations', async () => {
            const {
                updateBillingConfig,
                addChildToConfig,
                removeChildFromConfig,
                skipBillingCycle,
                unskipBillingCycle,
            } = await import('@/features/billing/actions');

            for (const role of ['FRONT_DESK', 'TUTOR']) {
                mockRequireTenantSession.mockResolvedValue(makeSession(role));
                await expect(updateBillingConfig('cfg-1', { notes: 'hack' })).rejects.toThrow(/Owner or Manager/);
                await expect(addChildToConfig('cfg-1', 'child-1')).rejects.toThrow(/Owner or Manager/);
                await expect(removeChildFromConfig('cfg-1', 'child-1')).rejects.toThrow(/Owner or Manager/);
                await expect(skipBillingCycle('cfg-1', '2026-12-01', 'skip')).rejects.toThrow(/Owner or Manager/);
                await expect(unskipBillingCycle('cfg-1', '2026-12-01')).rejects.toThrow(/Owner or Manager/);
            }

            expect(mockBillingConfigsFindFirst).not.toHaveBeenCalled();
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });

        it('rejects TUTOR in reconcilePayment before querying invoices', async () => {
            mockRequireTenantSession.mockResolvedValue(makeSession('TUTOR'));
            const { reconcilePayment } = await import('@/features/billing/actions/reconcile-payment');

            const res = await reconcilePayment({
                invoiceId: BOOKING_ID,
                amount: 50,
                method: 'bank_transfer',
                reference: 'REF-1',
            });

            expect(res).toEqual({ success: false, error: 'Forbidden: Insufficient permissions' });
            expect(mockInvoicesFindFirst).not.toHaveBeenCalled();
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });
    });

    describe('bookings/actions saveAssessmentFeedback MIME, magic-byte & 2 MB cap', () => {
        beforeEach(() => {
            mockRequireTenantSession.mockResolvedValue(makeSession('TUTOR'));
            mockCanUserAccessCentre.mockResolvedValue(true);
            mockBookingAttendeesFindFirst.mockResolvedValue({
                id: 'att-1',
                bookingId: BOOKING_ID,
                feedbackStatus: 'DRAFT',
                booking: {
                    centre: { id: CENTRE_ID, organisationId: ORG_ID },
                },
            });
        });

        it('rejects disallowed MIME types (e.g. text/html or image/svg+xml)', async () => {
            const { saveAssessmentFeedback } = await import('@/features/bookings/actions');
            const htmlB64 = Buffer.from('<script>alert(1)</script>').toString('base64');

            await expect(
                saveAssessmentFeedback('att-1', { notes: 'x', base64: htmlB64, mime: 'text/html' })
            ).rejects.toThrow(/Invalid attachment type/);

            await expect(
                saveAssessmentFeedback('att-1', { notes: 'x', base64: htmlB64, mime: 'image/svg+xml' })
            ).rejects.toThrow(/Invalid attachment type/);

            expect(mockDbUpdate).not.toHaveBeenCalled();
        });

        it('rejects spoofed magic bytes disguised as application/pdf or image/png', async () => {
            const { saveAssessmentFeedback } = await import('@/features/bookings/actions');
            const spoofedB64 = Buffer.from('<html>not a pdf or png</html>').toString('base64');

            await expect(
                saveAssessmentFeedback('att-1', { base64: spoofedB64, mime: 'application/pdf' })
            ).rejects.toThrow(/does not match declared PDF type/);

            await expect(
                saveAssessmentFeedback('att-1', { base64: spoofedB64, mime: 'image/png' })
            ).rejects.toThrow(/does not match declared image type/);

            expect(mockDbUpdate).not.toHaveBeenCalled();
        });

        it('rejects base64 attachments exceeding 2 MB decoded size', async () => {
            const { saveAssessmentFeedback } = await import('@/features/bookings/actions');
            const oversizedPdf = Buffer.alloc(2 * 1024 * 1024 + 16, 0x20);
            Buffer.from('%PDF-1.4\n').copy(oversizedPdf, 0);

            await expect(
                saveAssessmentFeedback('att-1', {
                    base64: oversizedPdf.toString('base64'),
                    mime: 'application/pdf',
                })
            ).rejects.toThrow(/exceeds maximum size of 2 MB/);

            expect(mockDbUpdate).not.toHaveBeenCalled();
        });

        it('accepts valid PDF and PNG attachments (including data: URI prefix)', async () => {
            const { saveAssessmentFeedback } = await import('@/features/bookings/actions');
            const validPdfB64 = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n1 0 obj\n').toString('base64')}`;
            const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

            await expect(
                saveAssessmentFeedback('att-1', { notes: 'Good work', base64: validPdfB64, mime: 'application/pdf' })
            ).resolves.toBeUndefined();

            await expect(
                saveAssessmentFeedback('att-1', {
                    notes: 'Scan',
                    base64: pngBytes.toString('base64'),
                    mime: 'image/png',
                })
            ).resolves.toBeUndefined();

            expect(mockDbUpdate).toHaveBeenCalledTimes(2);
        });
    });

    describe('bookings API routes RBAC, JSON safety, bounds & reschedule guards', () => {
        it('bulk-delete and bulk-update reject TUTOR (403), invalid JSON (400), >200 IDs (400), while keeping [] idempotent (200)', async () => {
            const { DELETE } = await import('@/app/api/bookings/bulk-delete/route');
            const { PATCH } = await import('@/app/api/bookings/bulk-update/route');

            // TUTOR -> 403
            mockGetApiSession.mockResolvedValue(makeSession('TUTOR'));
            const tutorDel = await DELETE(
                new Request('http://localhost/api/bookings/bulk-delete', {
                    method: 'DELETE',
                    body: JSON.stringify({ bookingIds: [] }),
                }) as any
            );
            expect(tutorDel.status).toBe(403);

            const tutorPatch = await PATCH(
                new Request('http://localhost/api/bookings/bulk-update', {
                    method: 'PATCH',
                    body: JSON.stringify({ bookingIds: [], status: 'confirmed' }),
                }) as any
            );
            expect(tutorPatch.status).toBe(403);

            // Invalid JSON -> 400
            mockGetApiSession.mockResolvedValue(makeSession('ORG_OWNER'));
            const badJson = await DELETE(
                new Request('http://localhost/api/bookings/bulk-delete', {
                    method: 'DELETE',
                    body: '{broken-json',
                }) as any
            );
            expect(badJson.status).toBe(400);

            // Empty [] -> 200 { success: true, count: 0 }
            const emptyDel = await DELETE(
                new Request('http://localhost/api/bookings/bulk-delete', {
                    method: 'DELETE',
                    body: JSON.stringify({ bookingIds: [] }),
                }) as any
            );
            expect(emptyDel.status).toBe(200);
            await expect(emptyDel.json()).resolves.toEqual({ success: true, count: 0 });

            // 201 UUIDs -> 400
            const tooManyIds = Array.from({ length: 201 }, (_, i) =>
                `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`
            );
            const overLimitPatch = await PATCH(
                new Request('http://localhost/api/bookings/bulk-update', {
                    method: 'PATCH',
                    body: JSON.stringify({ bookingIds: tooManyIds, status: 'confirmed' }),
                }) as any
            );
            expect(overLimitPatch.status).toBe(400);
        });

        it('bulk-update skips per-ID revalidatePath fan-out when validBookingIds.length > 25', async () => {
            const { PATCH } = await import('@/app/api/bookings/bulk-update/route');
            mockGetApiSession.mockResolvedValue(makeSession('ORG_OWNER'));

            const ids = Array.from({ length: 30 }, (_, i) =>
                `550e8400-e29b-41d4-a716-${String(i + 1).padStart(12, '0')}`
            );
            mockBookingsFindMany.mockResolvedValue(
                ids.map((id) => ({
                    id,
                    centreId: CENTRE_ID,
                    centre: { id: CENTRE_ID, organisationId: ORG_ID },
                }))
            );

            const res = await PATCH(
                new Request('http://localhost/api/bookings/bulk-update', {
                    method: 'PATCH',
                    body: JSON.stringify({ bookingIds: ids, status: 'confirmed' }),
                }) as any
            );
            expect(res.status).toBe(200);
            expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
            expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
            expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/attendance');
        });

        it('booking centre route rejects TUTOR (403) and malformed JSON (400)', async () => {
            const { PATCH } = await import('@/app/api/bookings/[bookingId]/centre/route');
            const params = Promise.resolve({ bookingId: BOOKING_ID });

            mockGetApiSession.mockResolvedValue(makeSession('TUTOR'));
            const tutorRes = await PATCH(
                new Request(`http://localhost/api/bookings/${BOOKING_ID}/centre`, {
                    method: 'PATCH',
                    body: JSON.stringify({ centreId: CENTRE_ID }),
                }) as any,
                { params }
            );
            expect(tutorRes.status).toBe(403);

            mockGetApiSession.mockResolvedValue(makeSession('MANAGER'));
            const badJsonRes = await PATCH(
                new Request(`http://localhost/api/bookings/${BOOKING_ID}/centre`, {
                    method: 'PATCH',
                    body: 'not-json',
                }) as any,
                { params }
            );
            expect(badJsonRes.status).toBe(400);
        });

        it('reschedule route rejects TUTOR (403), Invalid Date (400), and cancelled bookings (400)', async () => {
            const { POST } = await import('@/app/api/bookings/[bookingId]/reschedule/route');
            const params = Promise.resolve({ bookingId: BOOKING_ID });
            const futureIso = new Date(Date.now() + 7 * 86_400_000).toISOString();

            // TUTOR -> 403
            mockGetApiSession.mockResolvedValue(makeSession('TUTOR'));
            const tutorRes = await POST(
                new Request(`http://localhost/api/bookings/${BOOKING_ID}/reschedule`, {
                    method: 'POST',
                    body: JSON.stringify({ newStartAt: futureIso }),
                }),
                { params }
            );
            expect(tutorRes.status).toBe(403);

            // Invalid Date -> 400
            mockGetApiSession.mockResolvedValue(makeSession('FRONT_DESK'));
            const badDateRes = await POST(
                new Request(`http://localhost/api/bookings/${BOOKING_ID}/reschedule`, {
                    method: 'POST',
                    body: JSON.stringify({ newStartAt: 'not-a-valid-date' }),
                }),
                { params }
            );
            expect(badDateRes.status).toBe(400);

            // Cancelled booking -> 400
            mockGetApiSession.mockResolvedValue(makeSession('ORG_OWNER'));
            mockBookingsFindFirst.mockResolvedValue({
                id: BOOKING_ID,
                centreId: CENTRE_ID,
                status: 'cancelled',
                startAt: new Date(),
                centre: { id: CENTRE_ID, name: 'Main Centre', organisationId: ORG_ID },
                parent: null,
                attendees: [],
            });
            const cancelledRes = await POST(
                new Request(`http://localhost/api/bookings/${BOOKING_ID}/reschedule`, {
                    method: 'POST',
                    body: JSON.stringify({ newStartAt: futureIso }),
                }),
                { params }
            );
            expect(cancelledRes.status).toBe(400);
            await expect(cancelledRes.json()).resolves.toEqual({
                error: 'Cannot reschedule a cancelled booking',
            });
            expect(mockDbTransaction).not.toHaveBeenCalled();
        });
    });
});
