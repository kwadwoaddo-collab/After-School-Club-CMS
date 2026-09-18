'use server';
import { logger } from '@/lib/logger';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function submitVoucherPayment(invoiceId: string, amount: number, reference: string) {
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        // Verify invoice belongs to parent and get current state
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.parentId, parent.id),
                ne(invoices.status, 'draft')
            ),
            with: {
                payments: true
            }
        });

        if (!invoice) return { success: false, error: 'Invoice not found' };
        if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'draft') {
            return { success: false, error: 'Invoice cannot be paid in its current status' };
        }

        // Calculate outstanding balance
        const totalPaid = invoice.payments
            .filter(p => p.status === 'verified' || p.status === 'pending')
            .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        
        const outstandingBalance = parseFloat(invoice.amount) - totalPaid;

        if (amount <= 0 || !reference.trim()) {
            return { success: false, error: 'Invalid payment amount or reference' };
        }

        if (amount > outstandingBalance) {
            return { success: false, error: 'Payment amount exceeds outstanding balance' };
        }

        // Wrap in transaction
        await db.transaction(async (tx) => {
            // Log payment
            await tx.insert(payments).values({
                invoiceId: invoice.id,
                amount: amount.toString(),
                method: 'voucher',
                status: 'pending',
                transactionReference: reference.trim()
            });
        });

        revalidatePath('/portal/billing');
        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/invoices');
        revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
        if (invoice.parentId) {
            revalidatePath(`/dashboard/parents/${invoice.parentId}`);
        }
        return { success: true };
    } catch (e) {
        logger.error('Failed to submit voucher payment:', e);
        return { success: false, error: 'Internal server error processing payment' };
    }
}
