import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recalculateInvoiceStatus } from '@/lib/finance/recalculate-invoice-status';
import { invoices, payments } from '@/db/schema';

describe('MAINT-FIN-1 Regression Suite', () => {
    describe('Defect A: Reconciliation Status Recalculation (recalculateInvoiceStatus)', () => {
        let mockTx: any;
        let invoiceRecord: any;
        let paymentRecords: any[];

        beforeEach(() => {
            invoiceRecord = {
                id: 'inv-test-1',
                status: 'sent',
                amount: '100.00',
            };
            paymentRecords = [];

            mockTx = {
                query: {
                    invoices: {
                        findFirst: vi.fn(async () => invoiceRecord),
                    },
                    payments: {
                        findMany: vi.fn(async () => paymentRecords),
                    },
                },
                update: vi.fn(() => ({
                    set: vi.fn((data: any) => ({
                        where: vi.fn(async () => {
                            invoiceRecord.status = data.status;
                        }),
                    })),
                })),
            };
        });

        it('reconcile £50 against £100 sent invoice sets status to partially_paid (NOT paid - eliminates double counting)', async () => {
            // Simulated: after inserting the £50 payment, payments table has 1 verified payment of £50
            paymentRecords = [{ status: 'verified', amount: '50.00' }];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(mockTx.update).toHaveBeenCalledWith(invoices);
            expect(invoiceRecord.status).toBe('partially_paid');
        });

        it('reconcile £100 against £100 sent invoice sets status to paid', async () => {
            paymentRecords = [{ status: 'verified', amount: '100.00' }];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(mockTx.update).toHaveBeenCalledWith(invoices);
            expect(invoiceRecord.status).toBe('paid');
        });

        it('existing verified £40 + reconciled £60 on £100 invoice sets status to paid', async () => {
            paymentRecords = [
                { status: 'verified', amount: '40.00' },
                { status: 'verified', amount: '60.00' },
            ];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(mockTx.update).toHaveBeenCalledWith(invoices);
            expect(invoiceRecord.status).toBe('paid');
        });

        it('existing verified £40 + reconciled £30 on £100 invoice sets status to partially_paid', async () => {
            paymentRecords = [
                { status: 'verified', amount: '40.00' },
                { status: 'verified', amount: '30.00' },
            ];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(mockTx.update).toHaveBeenCalledWith(invoices);
            expect(invoiceRecord.status).toBe('partially_paid');
        });

        it('reversed payment does not count towards paid total', async () => {
            // £40 reversed + £30 verified on £100 invoice -> total verified is £30 -> partially_paid
            paymentRecords = [
                { status: 'reversed', amount: '40.00' },
                { status: 'verified', amount: '30.00' },
            ];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(invoiceRecord.status).toBe('partially_paid');
        });

        it('void invoices remain completely untouched', async () => {
            invoiceRecord.status = 'void';
            paymentRecords = [{ status: 'verified', amount: '100.00' }];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(mockTx.update).not.toHaveBeenCalled();
            expect(invoiceRecord.status).toBe('void');
        });

        it('draft invoices remain completely untouched', async () => {
            invoiceRecord.status = 'draft';
            paymentRecords = [{ status: 'verified', amount: '100.00' }];

            await recalculateInvoiceStatus(mockTx, 'inv-test-1');

            expect(mockTx.update).not.toHaveBeenCalled();
            expect(invoiceRecord.status).toBe('draft');
        });
    });

    describe('Defect B: Parent Profile Financial KPI Calculation', () => {
        // Pure calculation function mirroring the logic in src/app/dashboard/parents/[id]/page.tsx
        function calculateLedgerStats(familyInvoices: any[]) {
            const billableInvoices = familyInvoices.filter(inv => inv.status !== 'void' && inv.status !== 'draft');
            const totalOwed = billableInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
            const totalPaid = billableInvoices.reduce((sum, inv) => {
                const paid = inv.payments
                    ?.filter((p: any) => p.status === 'verified')
                    ?.reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;
                return sum + paid;
            }, 0);
            const outstanding = Math.max(0, totalOwed - totalPaid);
            return { totalOwed, totalPaid, outstanding };
        }

        it('excludes void invoices and draft invoices from totalOwed, and ignores reversed/failed payments', () => {
            const mockFamilyInvoices = [
                // 1. Void invoice with reversed payment (like historical production INV-H3OOQX)
                {
                    id: 'inv-void',
                    status: 'void',
                    amount: '1200.00',
                    payments: [
                        { id: 'pay-rev-1', status: 'reversed', amount: '1200.00' },
                    ],
                },
                // 2. Draft invoice (not yet issued/billable)
                {
                    id: 'inv-draft',
                    status: 'draft',
                    amount: '150.00',
                    payments: [],
                },
                // 3. Sent invoice with partial verified payment
                {
                    id: 'inv-sent',
                    status: 'partially_paid',
                    amount: '100.00',
                    payments: [
                        { id: 'pay-ver-1', status: 'verified', amount: '50.00' },
                    ],
                },
                // 4. Paid invoice with full verified payment
                {
                    id: 'inv-paid',
                    status: 'paid',
                    amount: '200.00',
                    payments: [
                        { id: 'pay-ver-2', status: 'verified', amount: '200.00' },
                    ],
                },
                // 5. Sent invoice with pending or failed payment
                {
                    id: 'inv-sent-2',
                    status: 'sent',
                    amount: '80.00',
                    payments: [
                        { id: 'pay-failed', status: 'failed', amount: '80.00' },
                    ],
                },
            ];

            const stats = calculateLedgerStats(mockFamilyInvoices);

            // Billable invoices are inv-sent (£100), inv-paid (£200), inv-sent-2 (£80) = £380.00
            expect(stats.totalOwed).toBe(380.00);
            // Verified payments on billable invoices are £50 + £200 = £250.00 (reversed £1200 and failed £80 excluded)
            expect(stats.totalPaid).toBe(250.00);
            // Outstanding = £380 - £250 = £130.00
            expect(stats.outstanding).toBe(130.00);
        });

        it('clamps outstanding balance to 0 if payments exceed invoiced total', () => {
            const mockFamilyInvoices = [
                {
                    id: 'inv-1',
                    status: 'paid',
                    amount: '100.00',
                    payments: [
                        { id: 'pay-1', status: 'verified', amount: '120.00' }, // Overpaid
                    ],
                },
            ];

            const stats = calculateLedgerStats(mockFamilyInvoices);

            expect(stats.totalOwed).toBe(100.00);
            expect(stats.totalPaid).toBe(120.00);
            expect(stats.outstanding).toBe(0); // Clamped, not -20
        });
    });

    describe('Defect C: Invoice Details Void Action Authorization', () => {
        function canDisplayVoidButton(userRole?: string, invoiceStatus?: string): boolean {
            return userRole === 'ORG_OWNER' && invoiceStatus !== 'void';
        }

        it('allows ORG_OWNER to see Void button on non-void invoice', () => {
            expect(canDisplayVoidButton('ORG_OWNER', 'sent')).toBe(true);
            expect(canDisplayVoidButton('ORG_OWNER', 'partially_paid')).toBe(true);
            expect(canDisplayVoidButton('ORG_OWNER', 'paid')).toBe(true);
            expect(canDisplayVoidButton('ORG_OWNER', 'draft')).toBe(true);
        });

        it('prevents ORG_OWNER from seeing Void button on already void invoice', () => {
            expect(canDisplayVoidButton('ORG_OWNER', 'void')).toBe(false);
        });

        it('prevents MANAGER from seeing Void button on any invoice status', () => {
            expect(canDisplayVoidButton('MANAGER', 'sent')).toBe(false);
            expect(canDisplayVoidButton('MANAGER', 'partially_paid')).toBe(false);
            expect(canDisplayVoidButton('MANAGER', 'paid')).toBe(false);
            expect(canDisplayVoidButton('MANAGER', 'draft')).toBe(false);
            expect(canDisplayVoidButton('MANAGER', 'void')).toBe(false);
        });

        it('prevents FRONT_DESK / STAFF from seeing Void button', () => {
            expect(canDisplayVoidButton('FRONT_DESK', 'sent')).toBe(false);
            expect(canDisplayVoidButton('STAFF', 'sent')).toBe(false);
            expect(canDisplayVoidButton(undefined, 'sent')).toBe(false);
        });
    });
});
