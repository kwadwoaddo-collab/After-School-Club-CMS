'use server';

import { db } from '@/db';
import { invoices, payments, children, parents } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const ReconcileSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['tax_free_childcare', 'voucher', 'bank_transfer', 'cash', 'other']),
  reference: z.string().min(1),
});

/**
 * Milestone 3G, L1: this action previously took `organisationId` and
 * `staffId` as caller-supplied arguments and never called `auth()` at all —
 * any request that could reach this endpoint could reconcile a payment
 * against an arbitrary organisation, with the audit trail permanently
 * recording the literal string 'staff-user' rather than a real user id (see
 * project-notes/milestone-3g-finance-audit.md, L1). Both values are now
 * derived from the session, matching the org/centre-check pattern already
 * established for every other Finance mutation in this codebase
 * (src/features/finance/actions.ts's recordPayment et al.).
 */
export async function reconcilePayment(
  input: z.infer<typeof ReconcileSchema>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.organisationId) {
    return { success: false, error: 'Unauthorized' };
  }
  const organisationId = session.user.organisationId;
  const staffId = session.user.id;

  try {
    const data = ReconcileSchema.parse(input);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session.user.role isn't in the base NextAuth type; same cast pattern used throughout src/features/finance/actions.ts
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
      const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
      const targetInvoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, data.invoiceId), eq(invoices.organisationId, organisationId)),
        columns: { centreId: true },
      });
      if (!targetInvoice || !accessibleCentreIds.includes(targetInvoice.centreId)) {
        return { success: false, error: 'Unauthorized: No access to this centre' };
      }
    }

    return await db.transaction(async (tx) => {
      // 1. Check idempotency: does this reference already exist for this invoice?
      const [existing] = await tx.select()
        .from(payments)
        .where(
          and(
            eq(payments.invoiceId, data.invoiceId),
            eq(payments.transactionReference, data.reference)
          )
        );

      if (existing) {
        logger.info(`[Reconcile] Idempotency hit: Payment ${data.reference} already applied to ${data.invoiceId}`);
        return { success: true };
      }

      // 2. Fetch Invoice
      const [invoice] = await tx.select()
        .from(invoices)
        .where(and(eq(invoices.id, data.invoiceId), eq(invoices.organisationId, organisationId)));

      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status === 'paid' || invoice.status === 'void') {
        return { success: false, error: 'Invoice is already paid or void' };
      }

      // 3. Add Payment
      await tx.insert(payments).values({
        invoiceId: data.invoiceId,
        amount: data.amount.toFixed(2),
        method: data.method,
        status: 'verified',
        transactionReference: data.reference,
      });

      // 4. Recalculate invoice status
      const existingPayments = await tx.select({ amount: payments.amount })
        .from(payments)
        .where(eq(payments.invoiceId, data.invoiceId));
      
      const totalPaid = existingPayments.reduce((sum, p) => sum + parseFloat(p.amount as string), 0) + data.amount;
      const invoiceTotal = parseFloat(invoice.amount as string);

      if (totalPaid >= invoiceTotal - 0.01) {
        await tx.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, data.invoiceId));
      } else {
        await tx.update(invoices).set({ status: 'partially_paid' }).where(eq(invoices.id, data.invoiceId));
      }

      logger.info(`[Reconcile] Staff ${staffId} reconciled £${data.amount} via ${data.method} to invoice ${data.invoiceId}`);
      return { success: true };
    });
  } catch (err) {
    logger.error('[Reconcile] Error reconciling payment:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
