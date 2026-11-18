import { invoices, payments } from '@/db/schema';
import { parseStoredDecimalToPence } from '@/features/finance/domain/payment-eligibility';
import { eq } from 'drizzle-orm';

/**
 * Category C — Authoritative invoice status recalculation.
 *
 * Recalculates invoice status from ONLY verified, unreversed payments using integer pence math.
 * Must be called inside a db.transaction() tx.
 *
 * - draft: untouched (not payment-driven)
 * - void: untouched (terminal; reversal is allowed but doesn't change void)
 * - verified total >= invoice amount → paid
 * - verified total > 0 → partially_paid
 * - verified total === 0 → sent
 */
export async function recalculateInvoiceStatus(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    invoiceId: string
): Promise<void> {
    const invoice = await tx.query.invoices.findFirst({
        where: eq(invoices.id, invoiceId),
        columns: { status: true, amount: true },
    });
    if (!invoice) return;
    if (invoice.status === 'draft' || invoice.status === 'void') return;

    const allPayments = await tx.query.payments.findMany({
        where: eq(payments.invoiceId, invoiceId),
        columns: { status: true, amount: true, reversedAt: true },
    });
    const totalVerifiedPence = allPayments
        .filter((p: { status: string; amount: string | number; reversedAt?: Date | string | null }) => p.status === 'verified' && !p.reversedAt)
        .reduce((s: number, p: { status: string; amount: string | number }) => s + parseStoredDecimalToPence(p.amount), 0);

    const invoiceAmountPence = parseStoredDecimalToPence(invoice.amount);

    let newStatus: 'sent' | 'partially_paid' | 'paid';
    if (totalVerifiedPence >= invoiceAmountPence) {
        newStatus = 'paid';
    } else if (totalVerifiedPence > 0) {
        newStatus = 'partially_paid';
    } else {
        newStatus = 'sent';
    }

    if (newStatus !== invoice.status) {
        await tx.update(invoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(invoices.id, invoiceId));
    }
}
