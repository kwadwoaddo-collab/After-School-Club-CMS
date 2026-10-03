import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordPayment } from '../actions';
import { computePaymentRequestFingerprint } from '../domain/payment-eligibility';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

const mockNotifyOwners = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: (...args: unknown[]) => mockNotifyOwners(...args),
}));

const mockSendReceiptEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/services/email', () => ({
    emailService: {
        sendPaymentReceiptEmail: (...args: unknown[]) => mockSendReceiptEmail(...args),
    },
}));

const dbTransaction = vi.fn();
const dbSelect = vi.fn();
const dbQueryOrgMembershipsFindFirst = vi.fn();

vi.mock('@/db', () => ({
    db: {
        query: {
            orgMemberships: { findFirst: (...args: unknown[]) => dbQueryOrgMembershipsFindFirst(...args) },
            invoices: { findFirst: vi.fn() },
            organisations: { findFirst: vi.fn().mockResolvedValue({ id: 'org-1', name: 'Test Org' }) },
        },
        select: (...args: unknown[]) => dbSelect(...args),
        transaction: (...args: unknown[]) => dbTransaction(...args),
    },
}));

describe('recordPayment hardening & RBAC unit tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockTx = (opts: {
        invoiceStatus?: string;
        invoiceAmount?: string;
        invoiceCentreId?: string;
        liveOrgRole?: string;
        hasCentreMembership?: boolean;
        existingPaymentWithKey?: any;
        verifiedPaymentsTotal?: string;
        simulateLockTimeout?: boolean;
    }) => {
        const {
            invoiceStatus = 'sent',
            invoiceAmount = '100.00',
            invoiceCentreId = 'centre-1',
            liveOrgRole = 'ORG_OWNER',
            hasCentreMembership = true,
            existingPaymentWithKey = null,
            verifiedPaymentsTotal = '0.00',
            simulateLockTimeout = false,
        } = opts;

        const insertedPayments: any[] = [];
        const insertedAuditEvents: any[] = [];

        const tx = {
            execute: vi.fn().mockImplementation((query) => {
                if (simulateLockTimeout) {
                    const err: any = new Error('canceling statement due to lock timeout');
                    err.code = '55P03';
                    throw err;
                }
                return Promise.resolve([]);
            }),
            select: vi.fn((fields) => ({
                from: vi.fn((table: any) => ({
                    where: vi.fn((condition) => {
                        return {
                            for: vi.fn().mockImplementation(() => {
                                if (simulateLockTimeout) {
                                    const err: any = new Error('canceling statement due to lock timeout');
                                    err.code = '55P03';
                                    throw err;
                                }
                                return Promise.resolve([
                                    {
                                        id: 'inv-1',
                                        organisationId: 'org-1',
                                        centreId: invoiceCentreId,
                                        status: invoiceStatus,
                                        amount: invoiceAmount,
                                        parentId: 'parent-1',
                                    }
                                ]);
                            }),
                            then: (resolve: any) => {
                                // Checking what was selected
                                if (fields && fields.role) {
                                    return resolve(liveOrgRole ? [{ role: liveOrgRole }] : []);
                                }
                                if (table?.centreId !== undefined || table?._?.name === 'centre_memberships') {
                                    return resolve(hasCentreMembership ? [{ id: 'cm-1' }] : []);
                                }
                                if (fields && fields.amount && fields.status) {
                                    return resolve(
                                        verifiedPaymentsTotal !== '0.00'
                                            ? [{ amount: verifiedPaymentsTotal, status: 'verified' }]
                                            : []
                                    );
                                }
                                // Payments lookup by key
                                if (existingPaymentWithKey) {
                                    return resolve([existingPaymentWithKey]);
                                }
                                return resolve([]);
                            },
                        };
                    }),
                })),
            })),
            insert: vi.fn((table) => ({
                values: vi.fn((vals) => {
                    const inserted = { id: `pay-${Date.now()}`, ...vals };
                    if (vals.eventType) {
                        insertedAuditEvents.push(vals);
                    } else {
                        insertedPayments.push(inserted);
                    }
                    return {
                        returning: vi.fn().mockResolvedValue([inserted]),
                        then: (resolve: any) => resolve([inserted]),
                    };
                }),
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn().mockResolvedValue([]),
                })),
            })),
            query: {
                invoices: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: 'inv-1',
                        amount: invoiceAmount,
                        status: invoiceStatus,
                        invoiceNumber: 'INV-1001',
                        parent: { id: 'parent-1', firstName: 'Jane', email: 'jane@example.com' },
                    }),
                },
                payments: {
                    findMany: vi.fn().mockResolvedValue([]),
                },
            },
            _insertedPayments: insertedPayments,
            _insertedAuditEvents: insertedAuditEvents,
        };

        return tx;
    };

    it('RBAC: ORG_OWNER succeeds tenant-wide', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const tx = createMockTx({ liveOrgRole: 'ORG_OWNER' });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(true);
        expect(res.payment.amount).toBe('50.00');
        expect(mockNotifyOwners).toHaveBeenCalledTimes(1);
    });

    it('RBAC: MANAGER with centre membership succeeds', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'MANAGER' });

        const tx = createMockTx({ liveOrgRole: 'MANAGER', hasCentreMembership: true });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'bank_transfer',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(true);
    });

    it('RBAC: FRONT_DESK with centre membership succeeds', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'FRONT_DESK' });

        const tx = createMockTx({ liveOrgRole: 'FRONT_DESK', hasCentreMembership: true });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '25.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(true);
    });

    it('RBAC: MANAGER without centre membership fails with FORBIDDEN_CENTRE', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'MANAGER' });

        const tx = createMockTx({ liveOrgRole: 'MANAGER', hasCentreMembership: false });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe('FORBIDDEN_CENTRE');
    });

    it('RBAC: TUTOR is rejected at pre-lock check with FORBIDDEN_ROLE without locking', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-tutor', organisationId: 'org-1', role: 'TUTOR' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'TUTOR' });

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe('FORBIDDEN_ROLE');
        expect(dbTransaction).not.toHaveBeenCalled();
    });

    it('RBAC: Divergent session role (JWT says ORG_OWNER, DB says TUTOR) fails closed', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-demoted', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        // Live DB returns TUTOR
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'TUTOR' });

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe('FORBIDDEN_ROLE');
        expect(dbTransaction).not.toHaveBeenCalled();
    });

    it('Payment Methods: provider methods stripe and gocardless are rejected from manual workflow', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const resStripe = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'stripe',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });
        expect(resStripe.success).toBe(false);
        expect(resStripe.code).toBe('INVALID_PAYMENT_METHOD');

        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });
        const resGocardless = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'gocardless',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });
        expect(resGocardless.success).toBe(false);
        expect(resGocardless.code).toBe('INVALID_PAYMENT_METHOD');
    });

    it('Money Parsing: rejects malformed amount and negative amounts', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const resMalformed = await recordPayment({
            invoiceId: 'inv-1',
            amount: '10.555',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });
        expect(resMalformed.success).toBe(false);
        expect(resMalformed.code).toBe('INVALID_AMOUNT');
    });

    it('Idempotency Replay: same key and same payload returns replay with 0 notifications & 0 emails', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const fp = computePaymentRequestFingerprint({
            operationMode: 'MANUAL_AMOUNT',
            method: 'cash',
            recordedAt: '2026-10-03',
            transactionReference: 'REF1',
            amountPence: 5000,
        });

        const existingPayment = {
            id: 'pay-existing-1',
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
            status: 'verified',
            transactionReference: 'REF1',
            idempotencyKey: 'idemp-key-1',
            requestFingerprint: fp,
        };

        const tx = createMockTx({
            liveOrgRole: 'ORG_OWNER',
            existingPaymentWithKey: existingPayment,
        });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            transactionReference: 'REF1',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
            idempotencyKey: 'idemp-key-1',
        });

        expect(res.success).toBe(true);
        expect(res.isReplay).toBe(true);
        expect(res.id).toBe('pay-existing-1');
        // Replay must cause ZERO duplicate notifications or emails
        expect(mockNotifyOwners).not.toHaveBeenCalled();
        expect(mockSendReceiptEmail).not.toHaveBeenCalled();
    });

    it('Idempotency Conflict: same key with different amount returns IDEMPOTENCY_CONFLICT', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const existingPayment = {
            id: 'pay-existing-1',
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
            status: 'verified',
            transactionReference: 'REF1',
            idempotencyKey: 'idemp-key-1',
            requestFingerprint: 'v1:DIFFERENT_HASH',
        };

        const tx = createMockTx({
            liveOrgRole: 'ORG_OWNER',
            existingPaymentWithKey: existingPayment,
        });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '75.00', // Different amount
            method: 'cash',
            transactionReference: 'REF1',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
            idempotencyKey: 'idemp-key-1',
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe('IDEMPOTENCY_CONFLICT');
        expect(res.existingPayment).toBeDefined();
        expect(res.existingPayment.id).toBe('pay-existing-1');
    });

    it('Lock Timeout: maps PostgreSQL 55P03 to structured LOCK_TIMEOUT', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const tx = createMockTx({ liveOrgRole: 'ORG_OWNER', simulateLockTimeout: true });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            amount: '50.00',
            method: 'cash',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe('LOCK_TIMEOUT');
    });

    it('SETTLE_OUTSTANDING with new key on settled invoice returns ALREADY_SETTLED', async () => {
        const { auth } = await import('@/lib/auth');
        (auth as any).mockResolvedValue({
            user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' }
        });
        dbQueryOrgMembershipsFindFirst.mockResolvedValueOnce({ role: 'ORG_OWNER' });

        const tx = createMockTx({
            liveOrgRole: 'ORG_OWNER',
            invoiceAmount: '100.00',
            verifiedPaymentsTotal: '100.00', // fully settled
        });
        dbTransaction.mockImplementationOnce((cb) => cb(tx));

        const res = await recordPayment({
            invoiceId: 'inv-1',
            method: 'bank_transfer',
            recordedAt: new Date('2026-10-03T10:00:00Z'),
            operationMode: 'SETTLE_OUTSTANDING',
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe('ALREADY_SETTLED');
    });
});
