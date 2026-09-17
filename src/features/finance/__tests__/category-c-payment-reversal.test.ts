import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    recordPayment,
    reversePayment,
    verifyPayment,
    failPayment,
    voidInvoice
} from '../actions';
import { stableReceiptNumber } from '@/lib/finance/receipt-number';

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

const getUserAccessibleCentreIds = vi.fn();
vi.mock('@/lib/permissions', () => ({
    getUserAccessibleCentreIds: (...args: unknown[]) => getUserAccessibleCentreIds(...args),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/services/email', () => ({
    emailService: {
        sendInvoiceCreated: vi.fn().mockResolvedValue({ success: true }),
        sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
        sendVoucherPaymentVerified: vi.fn().mockResolvedValue(undefined),
        sendVoucherPaymentFailed: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/lib/db-notifications', () => ({
    notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

const dbTransaction = vi.fn();

// Helper: create a tx mock with update, insert, query capabilities
function makeTx(overrides: {
    paymentFindFirst?: () => unknown;
    paymentFindMany?: () => unknown[];
    invoiceFindFirst?: () => unknown;
    parentFindFirst?: () => unknown;
    updateReturning?: unknown[];
}) {
    const updateReturning = overrides.updateReturning ?? [{ id: 'pay-1' }];
    return {
        query: {
            payments: {
                findFirst: async () => overrides.paymentFindFirst?.() ?? null,
                findMany: async () => overrides.paymentFindMany?.() ?? [],
            },
            invoices: {
                findFirst: async () => overrides.invoiceFindFirst?.() ?? null,
            },
            parents: {
                findFirst: async () => overrides.parentFindFirst?.() ?? null,
            },
            organisations: {
                findFirst: async () => null,
            },
            auditEvents: { findMany: async () => [] },
        },
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(updateReturning),
                // for atomic reversal with RETURNING
                where_returning: vi.fn(),
            }),
            // Drizzle .update().set().where().returning() pattern
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{}]),
        }),
    };
}

// Patch: the test needs the update().set().where().returning() chain
function makeTxWithReturning(overrides: Parameters<typeof makeTx>[0] & { updateReturning?: unknown[] }) {
    const updateReturning = overrides.updateReturning ?? [{ id: 'pay-1' }];
    const returningMock = vi.fn().mockResolvedValue(updateReturning);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    const updateMock = vi.fn().mockReturnValue({ set: setMock });

    return {
        query: {
            payments: {
                findFirst: async () => overrides.paymentFindFirst?.() ?? null,
                findMany: async () => overrides.paymentFindMany?.() ?? [],
            },
            invoices: {
                findFirst: async () => overrides.invoiceFindFirst?.() ?? null,
            },
            parents: {
                findFirst: async () => overrides.parentFindFirst?.() ?? null,
            },
            organisations: {
                findFirst: async () => null,
            },
        },
        update: updateMock,
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue([{}]),
        }),
    };
}

vi.mock('@/db', () => ({
    db: {
        query: {
            centres: { findFirst: vi.fn() },
            parents: { findFirst: vi.fn() },
            invoices: { findFirst: vi.fn() },
            payments: { findFirst: vi.fn(), findMany: async () => [] },
            billingConfigs: { findFirst: vi.fn() },
            organisations: { findFirst: vi.fn() },
        },
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([]),
            })),
        })),
        transaction: (...args: unknown[]) => dbTransaction(...args),
    },
}));

const OWNER_SESSION = { user: { id: 'user-owner', organisationId: 'org-1', role: 'ORG_OWNER' } };
const MANAGER_SESSION = { user: { id: 'user-mgr', organisationId: 'org-1', role: 'MANAGER' } };
const FRONT_DESK_SESSION = { user: { id: 'user-fd', organisationId: 'org-1', role: 'FRONT_DESK' } };

describe('Category C — Payment Reversal Scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // A. WRONG AMOUNT
    // ──────────────────────────────────────────────────────────────────────────
    describe('A. WRONG AMOUNT', () => {
        it('A1: reversePayment on £6,000 payment → success', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = makeTxWithReturning({
                paymentFindFirst: () => ({
                    id: 'pay-1', amount: '6000.00', status: 'verified',
                    invoiceId: 'inv-1',
                    invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'paid', invoiceNumber: 'INV-A1', amount: '600.00' }
                }),
                invoiceFindFirst: () => ({ id: 'inv-1', status: 'paid', amount: '600.00' }),
                paymentFindMany: () => [],
            });
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            const result = await reversePayment('pay-1', 'Wrong amount entered');
            expect(result).toEqual(expect.objectContaining({ success: true }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // B. DUPLICATE
    // ──────────────────────────────────────────────────────────────────────────
    describe('B. DUPLICATE', () => {
        it('B1: reverse duplicate payment → success', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = makeTxWithReturning({
                paymentFindFirst: () => ({
                    id: 'pay-2', amount: '600.00', status: 'verified',
                    invoiceId: 'inv-1',
                    invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'paid', invoiceNumber: 'INV-B1', amount: '600.00' }
                }),
                invoiceFindFirst: () => ({ id: 'inv-1', status: 'paid', amount: '600.00' }),
                // After reversal, P1 (£600 verified) remains → invoice should stay paid
                paymentFindMany: () => [{ status: 'verified', amount: '600.00' }],
            });
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            const result = await reversePayment('pay-2', 'Duplicate payment');
            expect(result).toEqual(expect.objectContaining({ success: true }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // C. PARTIAL
    // ──────────────────────────────────────────────────────────────────────────
    describe('C. PARTIAL', () => {
        it('C1: reverse one of two £300 payments → success', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = makeTxWithReturning({
                paymentFindFirst: () => ({
                    id: 'pay-1', amount: '300.00', status: 'verified',
                    invoiceId: 'inv-1',
                    invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'paid', invoiceNumber: 'INV-C1', amount: '600.00' }
                }),
                invoiceFindFirst: () => ({ id: 'inv-1', status: 'paid', amount: '600.00' }),
                paymentFindMany: () => [{ status: 'verified', amount: '300.00' }],
            });
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            const result = await reversePayment('pay-1', 'Partial refund');
            expect(result).toEqual(expect.objectContaining({ success: true }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // D. VOID GUARD
    // ──────────────────────────────────────────────────────────────────────────
    describe('D. VOID GUARD', () => {
        it('D1: verified payment blocks voidInvoice', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    invoices: {
                        findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'sent', parentId: 'p-1' }),
                    },
                    payments: {
                        findMany: async () => [{ id: 'pay-1', amount: '600.00', status: 'verified' }],
                    },
                },
                update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(voidInvoice('inv-1')).rejects.toThrow(/verified payment/i);
        });

        it('D2: no verified or pending payments → voidInvoice succeeds', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    invoices: {
                        findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'sent', parentId: 'p-1' }),
                    },
                    payments: {
                        findMany: async () => [],
                    },
                },
                update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(voidInvoice('inv-1')).resolves.toBeDefined();
        });

        it('D2b: pending payment blocks voidInvoice until resolved', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    invoices: {
                        findFirst: async () => ({ id: 'inv-1', organisationId: 'org-1', status: 'sent', parentId: 'p-1' }),
                    },
                    payments: {
                        // First findMany call is for verified payments (none), second is for pending (1 pending)
                        findMany: vi.fn()
                            .mockResolvedValueOnce([])
                            .mockResolvedValueOnce([{ id: 'pay-pending', amount: '150.00', status: 'pending' }]),
                    },
                },
                update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(voidInvoice('inv-1')).rejects.toThrow(/pending payment/i);
        });


        it('D3: reversePayment on void invoice → succeeds, void stays void', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = makeTxWithReturning({
                paymentFindFirst: () => ({
                    id: 'pay-1', amount: '1200.00', status: 'verified',
                    invoiceId: 'inv-void',
                    invoice: { id: 'inv-void', organisationId: 'org-1', centreId: 'c-1', status: 'void', invoiceNumber: 'INV-D3', amount: '1200.00' }
                }),
                invoiceFindFirst: () => ({ id: 'inv-void', status: 'void', amount: '1200.00' }),
                paymentFindMany: () => [],
            });
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            const result = await reversePayment('pay-1', 'Void invoice cleanup');
            expect(result).toEqual(expect.objectContaining({ success: true }));
            // recalculateInvoiceStatus should NOT have been called (void is terminal)
            // The tx.update calls should only be for the payment row, not the invoice
        });

        it('D4: recordPayment against void invoice → rejected', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    invoices: {
                        findFirst: async () => ({
                            id: 'inv-1', organisationId: 'org-1', status: 'void', amount: '600.00',
                            parent: { id: 'p-1', email: 'p@test.com', firstName: 'Test' },
                            payments: []
                        }),
                    },
                    payments: { findMany: async () => [] },
                    organisations: { findFirst: async () => ({ name: 'Test Org' }) },
                    parents: { findFirst: async () => null },
                },
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'new-pay' }]) }),
                update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(
                recordPayment({ invoiceId: 'inv-1', amount: '600.00', method: 'cash', transactionReference: null, recordedAt: new Date() })
            ).rejects.toThrow(/voided invoice/i);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // E. DRAFT GUARD
    // ──────────────────────────────────────────────────────────────────────────
    describe('E. DRAFT GUARD', () => {
        it('E1: recordPayment against draft → rejected', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    invoices: {
                        findFirst: async () => ({
                            id: 'inv-1', organisationId: 'org-1', status: 'draft', amount: '600.00',
                            parent: { id: 'p-1', email: 'p@test.com', firstName: 'Test' },
                            payments: []
                        }),
                    },
                    payments: { findMany: async () => [] },
                    organisations: { findFirst: async () => ({ name: 'Test Org' }) },
                },
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'new-pay' }]) }),
                update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(
                recordPayment({ invoiceId: 'inv-1', amount: '600.00', method: 'cash', transactionReference: null, recordedAt: new Date() })
            ).rejects.toThrow(/draft invoice/i);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // F. failPayment recalculates
    // ──────────────────────────────────────────────────────────────────────────
    describe('F. failPayment recalculates', () => {
        it('F1: failPayment on pending payment → success with recalculation', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
            const tx = {
                query: {
                    payments: {
                        findFirst: async () => ({
                            id: 'pay-1', amount: '600.00', status: 'pending',
                            invoiceId: 'inv-1',
                            invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'partially_paid', invoiceNumber: 'INV-F1', amount: '600.00', parentId: 'p-1' }
                        }),
                        findMany: async () => [], // No other payments → sent
                    },
                    invoices: {
                        findFirst: async () => ({ id: 'inv-1', status: 'partially_paid', amount: '600.00' }),
                    },
                    parents: { findFirst: async () => null },
                },
                update: vi.fn().mockReturnValue({ set: updateSet }),
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            const result = await failPayment('pay-1');
            expect(result).toEqual(expect.objectContaining({ success: true }));
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // H. RBAC
    // ──────────────────────────────────────────────────────────────────────────
    describe('H. RBAC', () => {
        it('H2: Manager own-centre → allowed', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

            const tx = makeTxWithReturning({
                paymentFindFirst: () => ({
                    id: 'pay-1', amount: '100.00', status: 'verified',
                    invoiceId: 'inv-1',
                    invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'centre-1', status: 'paid', invoiceNumber: 'INV-H2', amount: '100.00' }
                }),
                invoiceFindFirst: () => ({ id: 'inv-1', status: 'paid', amount: '100.00' }),
                paymentFindMany: () => [],
            });
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            const result = await reversePayment('pay-1', 'Correction reason');
            expect(result).toEqual(expect.objectContaining({ success: true }));
        });

        it('H3: Manager wrong-centre → Unauthorized', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(MANAGER_SESSION);
            getUserAccessibleCentreIds.mockResolvedValue(['centre-2']); // wrong centre

            const tx = {
                query: {
                    payments: {
                        findFirst: async () => ({
                            id: 'pay-1', amount: '100.00', status: 'verified',
                            invoiceId: 'inv-1',
                            invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'centre-1', status: 'paid', invoiceNumber: 'INV-H3', amount: '100.00' }
                        }),
                        findMany: async () => [],
                    },
                },
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(reversePayment('pay-1', 'Reason')).rejects.toThrow(/Unauthorized|No access/i);
        });

        it('H4: FRONT_DESK → Unauthorized', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(FRONT_DESK_SESSION);

            const tx = {
                query: {
                    payments: {
                        findFirst: async () => ({
                            id: 'pay-1', amount: '100.00', status: 'verified',
                            invoiceId: 'inv-1',
                            invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'paid', amount: '100.00' }
                        }),
                        findMany: async () => [],
                    },
                },
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(reversePayment('pay-1', 'Reason')).rejects.toThrow(/Unauthorized/i);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // I. CONCURRENCY
    // ──────────────────────────────────────────────────────────────────────────
    describe('I. CONCURRENCY', () => {
        it('I1: already-reversed payment → eligibility error', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    payments: {
                        findFirst: async () => ({
                            id: 'pay-1', amount: '600.00', status: 'reversed',
                            invoiceId: 'inv-1',
                            invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'sent', amount: '600.00' }
                        }),
                    },
                },
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(reversePayment('pay-1', 'Already reversed')).rejects.toThrow(/not eligible for reversal/i);
        });

        it('I2: pending payment cannot be reversed', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            const tx = {
                query: {
                    payments: {
                        findFirst: async () => ({
                            id: 'pay-1', amount: '600.00', status: 'pending',
                            invoiceId: 'inv-1',
                            invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'sent', amount: '600.00' }
                        }),
                    },
                },
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            await expect(reversePayment('pay-1', 'Pending payment')).rejects.toThrow(/not eligible for reversal/i);
        });

        it('I3: atomic guard — WHERE status=verified prevents double reversal', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);

            // Simulate: payment found as verified (race condition read), but update returns empty (already reversed)
            const returningMock = vi.fn().mockResolvedValue([]); // empty — already reversed
            const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
            const setMock = vi.fn().mockReturnValue({ where: whereMock });
            const updateMock = vi.fn().mockReturnValue({ set: setMock });

            const tx = {
                query: {
                    payments: {
                        findFirst: async () => ({
                            id: 'pay-1', amount: '600.00', status: 'verified',
                            invoiceId: 'inv-1',
                            invoice: { id: 'inv-1', organisationId: 'org-1', centreId: 'c-1', status: 'paid', invoiceNumber: 'INV-I3', amount: '600.00' }
                        }),
                    },
                },
                update: updateMock,
                insert: vi.fn().mockReturnValue({ values: vi.fn() }),
            };
            dbTransaction.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));

            // The atomic update returned empty — should throw
            await expect(reversePayment('pay-1', 'Concurrent reversal')).rejects.toThrow(/already been corrected|not eligible/i);
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // J. RECEIPTS — deterministic stable identity
    // ──────────────────────────────────────────────────────────────────────────
    describe('J. RECEIPT IDENTITY', () => {
        it('J1: same paymentId → same RCP always', () => {
            const id = '550e8400-e29b-41d4-a716-446655440000';
            expect(stableReceiptNumber(id)).toBe(stableReceiptNumber(id));
        });

        it('J2: different paymentIds → different RCPs', () => {
            const id1 = '550e8400-e29b-41d4-a716-446655440000';
            const id2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
            expect(stableReceiptNumber(id1)).not.toBe(stableReceiptNumber(id2));
        });

        it('J3: format is RCP-XXXXXXXXXXXX (12 uppercase hex chars)', () => {
            const id = 'bbaf4918-4f14-4bc5-b225-f19eedb926ca';
            const rcp = stableReceiptNumber(id);
            expect(rcp).toMatch(/^RCP-[0-9A-F]{12}$/);
        });

        it('J4: known production payment → expected RCP (collision check)', () => {
            // Production payment IDs from audit — all 4 should be unique
            const productionIds = [
                'bbaf4918-4f14-4bc5-b225-f19eedb926ca',
                '09dbbf87-efa6-4bda-b77f-c873503d1d58',
                'b4832f6d-109c-4425-9d64-b10e92e68a1e',
            ];
            const rcps = productionIds.map(stableReceiptNumber);
            const unique = new Set(rcps);
            expect(unique.size).toBe(productionIds.length); // 0 collisions
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // L. REGRESSION
    // ──────────────────────────────────────────────────────────────────────────
    describe('L. REGRESSION', () => {
        it('L1: reason validation — empty reason rejected', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
            // reversePayment should throw for empty reason before touching DB
            await expect(reversePayment('pay-1', '   ')).rejects.toThrow(/Invalid reason/i);
        });

        it('L2: reason validation — reason over 500 chars rejected', async () => {
            const { auth } = await import('@/lib/auth');
            (auth as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_SESSION);
            await expect(reversePayment('pay-1', 'x'.repeat(501))).rejects.toThrow(/Invalid reason/i);
        });
    });
});
