'use server';

import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function submitVoucherPayment(invoiceId: string, amount: number, reference: string) {
    try {
        const parent = await getCurrentParent();
        if (!parent) return { success: false, error: 'Unauthorized' };

        // Verify invoice belongs to parent
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.parentId, parent.id)
            )
        });

        if (!invoice) return { success: false, error: 'Invoice not found' };
        if (invoice.status === 'paid' || invoice.status === 'void') {
            return { success: false, error: 'Invoice cannot be paid in its current status' };
        }

        if (amount <= 0 || !reference.trim()) {
            return { success: false, error: 'Invalid payment amount or reference' };
        }

        // Wrap in transaction
        await db.transaction(async (tx) => {
            // Log payment
            await tx.insert(payments).values({
                invoiceId: invoice.id,
                amount: amount.toString(),
                method: 'voucher',
                transactionReference: reference.trim()
            });
            // Update invoice status (Vouchers take time to clear, so we leave it as partially_paid or let staff mark as Paid)
            // But for this MVP, we will mark it as partially_paid to reflect a pending payment
            await tx.update(invoices)
                .set({ status: 'partially_paid', updatedAt: new Date() })
                .where(eq(invoices.id, invoice.id));
        });

        revalidatePath('/portal/billing');
        return { success: true };
    } catch (e) {
        console.error('Failed to submit voucher payment:', e);
        return { success: false, error: 'Internal server error processing payment' };
    }
}
