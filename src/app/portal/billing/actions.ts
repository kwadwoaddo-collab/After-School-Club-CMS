'use server';

import { logger } from '@/lib/logger';
import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { isValidUuid } from '@/lib/uuid';
import {
    formatPenceToDecimal,
    parseStoredDecimalToPence,
} from '@/features/finance/domain/payment-eligibility';

export async function submitVoucherPayment(invoiceId: string, amount: number, reference: string) {
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        if (!isValidUuid(invoiceId)) {
            return { success: false, error: 'Invalid invoice' };
        }

        const normalizedRef = typeof reference === 'string' ? reference.trim() : '';
        if (
            typeof amount !== 'number' ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !normalizedRef ||
            normalizedRef.length > 255
        ) {
            return { success: false, error: 'Invalid payment amount or reference' };
        }

        const scaledPence = amount * 100;
        const amountPence = Math.round(scaledPence);
        if (
            amountPence <= 0 ||
            !Number.isSafeInteger(amountPence) ||
            Math.abs(scaledPence - amountPence) > 1e-6
        ) {
            return { success: false, error: 'Invalid payment amount or reference' };
        }

        const txResult = await db.transaction(async (tx) => {
            if (typeof (tx as { execute?: unknown }).execute === 'function') {
                await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
            }

            let invoice:
                | {
                      id: string;
                      parentId: string | null;
                      status: string;
                      amount: string | number;
                      payments?: Array<{
                          amount: string | number;
                          status: string;
                          reversedAt?: Date | string | null;
                          transactionReference?: string | null;
                      }>;
                  }
                | undefined;

            let invoicePayments: Array<{
                amount: string | number;
                status: string;
                reversedAt?: Date | string | null;
                transactionReference?: string | null;
            }> = [];

            if (typeof (tx as { select?: unknown }).select === 'function') {
                const invSelect = tx
                    .select()
                    .from(invoices)
                    .where(and(eq(invoices.id, invoiceId), eq(invoices.parentId, parent.id)));
                const rows = await (
                    typeof (invSelect as { for?: unknown }).for === 'function'
                        ? invSelect.for('update')
                        : invSelect
                );
                invoice = rows[0];

                if (invoice) {
                    invoicePayments =
                        (await tx
                            .select()
                            .from(payments)
                            .where(eq(payments.invoiceId, invoiceId))) ?? [];
                }
            } else {
                const querySource =
                    typeof (tx as { query?: { invoices?: { findFirst?: unknown } } }).query?.invoices?.findFirst ===
                    'function'
                        ? tx.query.invoices
                        : db.query.invoices;
                invoice = await querySource.findFirst({
                    where: and(eq(invoices.id, invoiceId), eq(invoices.parentId, parent.id)),
                    with: { payments: true },
                });
                invoicePayments = invoice?.payments ?? [];
            }

            if (!invoice) {
                return { success: false, error: 'Invoice not found' } as const;
            }

            if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'draft') {
                return { success: false, error: 'Invoice cannot be paid in its current status' } as const;
            }

            const activePayments = (invoicePayments ?? []).filter(
                (p) => !p.reversedAt && p.status !== 'reversed'
            );

            // Prevent duplicate active (pending/verified) submissions for the same reference,
            // while intentionally omitting `idempotencyKey` so reversed references remain re-submittable.
            const duplicateActive = activePayments.find(
                (p) =>
                    (p.status === 'pending' || p.status === 'verified') &&
                    p.transactionReference?.trim() === normalizedRef
            );
            if (duplicateActive) {
                return {
                    success: false,
                    error: 'A payment with this voucher reference has already been submitted for this invoice',
                } as const;
            }

            const totalCommittedPence = activePayments
                .filter((p) => p.status === 'verified' || p.status === 'pending')
                .reduce((sum, p) => sum + parseStoredDecimalToPence(p.amount), 0);

            const outstandingPence = parseStoredDecimalToPence(invoice.amount) - totalCommittedPence;

            if (amountPence > outstandingPence) {
                return { success: false, error: 'Payment amount exceeds outstanding balance' } as const;
            }

            await tx.insert(payments).values({
                invoiceId: invoice.id,
                amount: formatPenceToDecimal(amountPence),
                method: 'voucher',
                status: 'pending',
                transactionReference: normalizedRef,
            });

            return { success: true, parentId: invoice.parentId } as const;
        });

        if (!txResult.success) {
            return { success: false, error: txResult.error };
        }

        revalidatePath('/portal/billing');
        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/invoices');
        revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
        if (txResult.parentId) {
            revalidatePath(`/dashboard/parents/${txResult.parentId}`);
        }
        return { success: true };
    } catch (e) {
        logger.error('Failed to submit voucher payment:', e);
        return { success: false, error: 'Internal server error processing payment' };
    }
}
