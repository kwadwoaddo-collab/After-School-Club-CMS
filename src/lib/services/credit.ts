import { db } from '@/db';
import { parentCredits, payments, invoices } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export class CreditService {
  /**
   * Get the current credit balance for a parent.
   * Dynamically sums credits and subtracts debits.
   */
  async getBalance(parentId: string): Promise<number> {
    const records = await db.select({
      type: parentCredits.type,
      amount: parentCredits.amount,
    })
    .from(parentCredits)
    .where(eq(parentCredits.parentId, parentId));

    let balance = 0;
    for (const record of records) {
      const amount = parseFloat(record.amount as string);
      if (record.type === 'credit' || record.type === 'refund') {
        balance += amount;
      } else if (record.type === 'debit') {
        balance -= amount;
      }
    }
    
    // Safety check, balance should never be negative due to system rules
    return Math.max(0, balance);
  }

  /**
   * Add a credit to a parent's account.
   */
  async issueCredit(
    organisationId: string, 
    parentId: string, 
    amount: number, 
    reason: string
  ): Promise<void> {
    if (amount <= 0) return;

    await db.insert(parentCredits).values({
      organisationId,
      parentId,
      amount: amount.toFixed(2),
      type: 'credit',
      reason,
    });
    logger.info(`[CreditService] Issued £\${amount} credit to parent \${parentId}: \${reason}`);
  }

  /**
   * Applies available credit to an invoice, idempotently.
   * Limits the applied amount to the invoice's remaining balance or the available credit,
   * whichever is smaller.
   * 
   * Idempotency is handled by generating a unique transaction reference for this operation
   * based on the invoice ID. If a debit with that reference already exists, it aborts.
   */
  async applyCreditToInvoice(
    organisationId: string, 
    parentId: string, 
    invoiceId: string,
    requestedAmount?: number
  ): Promise<{ success: boolean; appliedAmount: number; error?: string }> {
    return await db.transaction(async (tx) => {
      // 1. Fetch invoice to ensure it exists and get its total amount
      const [invoice] = await tx.select({
        id: invoices.id,
        amount: invoices.amount,
        status: invoices.status,
      })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.parentId, parentId)));

      if (!invoice) {
        return { success: false, appliedAmount: 0, error: 'Invoice not found' };
      }
      
      if (invoice.status === 'paid' || invoice.status === 'void') {
        return { success: false, appliedAmount: 0, error: 'Invoice is already paid or void' };
      }

      const invoiceTotal = parseFloat(invoice.amount as string);

      // 2. Fetch existing payments against this invoice
      const existingPayments = await tx.select({
        amount: payments.amount,
      })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

      const totalPaid = existingPayments.reduce((sum, p) => sum + parseFloat(p.amount as string), 0);
      const remainingBalance = Math.max(0, invoiceTotal - totalPaid);

      if (remainingBalance <= 0) {
        return { success: true, appliedAmount: 0 }; // Already fully paid
      }

      // 3. Idempotency Check
      // We look for a debit record with reason starting with 'Applied to invoice {invoiceId}'
      const idempotencyReason = `Applied to invoice \${invoiceId}`;
      const [existingDebit] = await tx.select()
        .from(parentCredits)
        .where(
          and(
            eq(parentCredits.parentId, parentId),
            eq(parentCredits.type, 'debit'),
            sql`\${parentCredits.reason} LIKE \${idempotencyReason + '%'}`
          )
        );

      if (existingDebit) {
        // We already applied credit to this invoice in the past!
        // To keep things simple and strictly idempotent per invoice, we only allow 
        // automated credit application once per invoice.
        return { success: true, appliedAmount: 0 };
      }

      // 4. Calculate available credit balance
      const records = await tx.select({
        type: parentCredits.type,
        amount: parentCredits.amount,
      })
      .from(parentCredits)
      .where(eq(parentCredits.parentId, parentId));

      let availableCredit = 0;
      for (const record of records) {
        const amt = parseFloat(record.amount as string);
        if (record.type === 'credit' || record.type === 'refund') availableCredit += amt;
        else if (record.type === 'debit') availableCredit -= amt;
      }

      const creditToApply = Math.min(
        availableCredit, 
        remainingBalance, 
        requestedAmount ?? Infinity
      );

      if (creditToApply <= 0) {
        return { success: true, appliedAmount: 0 };
      }

      // 5. Create debit entry
      await tx.insert(parentCredits).values({
        organisationId,
        parentId,
        amount: creditToApply.toFixed(2),
        type: 'debit',
        reason: idempotencyReason,
      });

      // 6. Create payment record
      await tx.insert(payments).values({
        invoiceId,
        amount: creditToApply.toFixed(2),
        method: 'other',
        status: 'verified',
        transactionReference: `CREDIT-\${Date.now()}`,
      });

      // 7. Update invoice status if fully paid
      if (Math.abs(remainingBalance - creditToApply) < 0.01) {
        await tx.update(invoices)
          .set({ status: 'paid' })
          .where(eq(invoices.id, invoiceId));
      } else {
        await tx.update(invoices)
          .set({ status: 'partially_paid' })
          .where(eq(invoices.id, invoiceId));
      }

      logger.info(`[CreditService] Applied £\${creditToApply} credit to invoice \${invoiceId}`);
      return { success: true, appliedAmount: creditToApply };
    });
  }
}

export const creditService = new CreditService();
