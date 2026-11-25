'use server';

import { db } from '@/db';
import { auditEvents, invoices, payments } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { recalculateInvoiceStatus } from '@/lib/finance/recalculate-invoice-status';
import {
  formatPenceToDecimal,
  parseStoredDecimalToPence,
} from '@/features/finance/domain/payment-eligibility';
import { revalidatePath } from 'next/cache';

const ReconcileSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['tax_free_childcare', 'voucher', 'bank_transfer', 'cash', 'other']),
  reference: z.string().trim().min(1),
});

/**
 * Milestone 3G, L1 & JC-05:
 * - Derives `organisationId` and `staffId` strictly from the authenticated session.
 * - Locks and verifies the target invoice's tenant ownership and status FIRST
 *   before inspecting any payment references (eliminating cross-tenant reference probing).
 * - Filters out reversed payment rows (`reversedAt IS NULL` and `status !== 'reversed'`).
 * - Treats ONLY an existing non-reversed `status === 'verified'` row on `(invoiceId, reference)`
 *   as an idempotent replay no-op.
 * - Promotes an existing non-reversed `status === 'pending'` voucher/TFC row in-place to
 *   `status === 'verified'` ONLY when `existing.amount` matches `data.amount` in exact pence;
 *   otherwise rejects cleanly with zero ledger mutation.
 */
export async function reconcilePayment(
  input: z.infer<typeof ReconcileSchema>
): Promise<{ success: boolean; error?: string }> {
  // PM-1.2: requireTenantSession throws a redirect for unauthenticated/no-org
  // callers. Since this action returns a structured result (not throws), we
  // catch the redirect and convert it to the expected error shape.
  let session: Awaited<ReturnType<typeof requireTenantSession>>;
  try {
    session = await requireTenantSession();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }
  // requireTenantSession() redirects if organisationId is null, so this is always a string here.
  const organisationId = session.user.organisationId!;
  const staffId = session.user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session.user.role isn't in the base NextAuth type; same cast pattern used throughout src/features/finance/actions.ts
  const userRole = (session.user as any).role as string | undefined;
  if (!userRole || !['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)) {
    return { success: false, error: 'Forbidden: Insufficient permissions' };
  }

  try {
    const data = ReconcileSchema.parse(input);
    const normalizedReference = data.reference.trim();

    let accessibleCentreIds: string[] | null = null;
    if (userRole !== 'ORG_OWNER') {
      accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
      const targetInvoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, data.invoiceId), eq(invoices.organisationId, organisationId)),
        columns: { centreId: true },
      });
      if (!targetInvoice || !accessibleCentreIds.includes(targetInvoice.centreId)) {
        return { success: false, error: 'Unauthorized: No access to this centre' };
      }
    }

    const txResult = await db.transaction(async (tx) => {
      if (typeof (tx as { execute?: unknown }).execute === 'function') {
        await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
      }

      // 1. Tenant & Invoice Guard First: fetch & lock invoice BEFORE inspecting payments by reference
      const invoiceSelect = tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, data.invoiceId), eq(invoices.organisationId, organisationId)));
      const [invoice] = await (
        typeof (invoiceSelect as { for?: unknown }).for === 'function'
          ? invoiceSelect.for('update')
          : invoiceSelect
      );

      if (!invoice) {
        return { success: false, error: 'Invoice not found' } as const;
      }

      if (accessibleCentreIds !== null && invoice.centreId && !accessibleCentreIds.includes(invoice.centreId)) {
        return { success: false, error: 'Unauthorized: No access to this centre' } as const;
      }

      const invoiceStatus = String(invoice.status);
      if (invoiceStatus === 'void' || invoiceStatus === 'cancelled' || invoiceStatus === 'draft') {
        return {
          success: false,
          error: invoiceStatus === 'void'
            ? 'Invoice is already paid or void'
            : `Cannot reconcile payment against a ${invoiceStatus} invoice`,
        } as const;
      }

      // 2. Inspect non-reversed payments matching (invoiceId, reference)
      const existingCandidates =
        (await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.invoiceId, data.invoiceId),
              eq(payments.transactionReference, normalizedReference),
              isNull(payments.reversedAt)
            )
          )) ?? [];

      const activeCandidates = Array.isArray(existingCandidates)
        ? existingCandidates.filter(
            (row: { reversedAt?: Date | string | null; status?: string | null }) =>
              !row.reversedAt && row.status !== 'reversed'
          )
        : [];

      // 3. True Idempotency Hit: ONLY when a non-reversed matching row already has status === 'verified'
      const existingVerified = activeCandidates.find(
        (row: { status?: string | null }) => row.status === 'verified'
      );
      if (existingVerified) {
        logger.info(`[Reconcile] Idempotency hit: Verified payment ${normalizedReference} already applied to ${data.invoiceId}`);
        return { success: true, isIdempotentHit: true } as const;
      }

      // 4. Paid/Void guard before promoting pending payment or inserting new payment
      if (invoice.status === 'paid' || invoice.status === 'void') {
        return { success: false, error: 'Invoice is already paid or void' } as const;
      }

      const reconciledAmountStr = data.amount.toFixed(2);
      const reconciledPence = parseStoredDecimalToPence(reconciledAmountStr);
      const now = new Date();

      // 5. Pending Voucher Promotion (Exact Amount Match Only) vs New Verified Payment Insert
      const existingPending = activeCandidates.find(
        (row: { status?: string | null }) => row.status === 'pending'
      );

      if (existingPending) {
        const pendingPence = parseStoredDecimalToPence(existingPending.amount);
        if (pendingPence !== reconciledPence) {
          return {
            success: false,
            error: `Pending payment reference "${normalizedReference}" was logged for £${formatPenceToDecimal(pendingPence)}, which does not match reconciled amount £${formatPenceToDecimal(reconciledPence)}. Review or adjust on the invoice first.`,
          } as const;
        }

        await tx
          .update(payments)
          .set({
            status: 'verified',
            method: data.method,
            recordedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(payments.id, existingPending.id),
              eq(payments.status, 'pending'),
              isNull(payments.reversedAt)
            )
          );

        await tx.insert(auditEvents).values({
          organisationId,
          userId: staffId,
          eventType: 'payment_verified',
          eventData: JSON.stringify({
            paymentId: existingPending.id,
            invoiceId: data.invoiceId,
            amount: formatPenceToDecimal(reconciledPence),
            method: data.method,
            reference: normalizedReference,
            promotedFromPending: true,
          }),
        });
      } else {
        await tx.insert(payments).values({
          invoiceId: data.invoiceId,
          amount: reconciledAmountStr,
          method: data.method,
          status: 'verified',
          transactionReference: normalizedReference,
          recordedAt: now,
        });

        await tx.insert(auditEvents).values({
          organisationId,
          userId: staffId,
          eventType: 'payment_reconciled',
          eventData: JSON.stringify({
            invoiceId: data.invoiceId,
            amount: reconciledAmountStr,
            method: data.method,
            reference: normalizedReference,
          }),
        });
      }

      // 6. Query verified non-reversed payments for the invoice and recalculate invoice status
      const verifiedPayments =
        (await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.invoiceId, data.invoiceId),
              eq(payments.status, 'verified'),
              isNull(payments.reversedAt)
            )
          )) ?? [];
      const existingVerifiedPence = Array.isArray(verifiedPayments)
        ? verifiedPayments
            .filter(
              (p: { reversedAt?: Date | string | null; status?: string | null }) =>
                !p.reversedAt && p.status !== 'reversed'
            )
            .reduce(
              (sum: number, p: { amount?: string | number }) => sum + parseStoredDecimalToPence(p.amount),
              0
            )
        : 0;
      const includesCurrent =
        Array.isArray(verifiedPayments) &&
        verifiedPayments.some(
          (p: { transactionReference?: string | null }) => p.transactionReference === normalizedReference
        );
      const totalVerifiedPence = includesCurrent
        ? existingVerifiedPence
        : existingVerifiedPence + reconciledPence;
      const invoiceRecord = invoice as unknown as { amountDuePence?: number };
      const invoiceAmountDuePence =
        typeof invoiceRecord.amountDuePence === 'number'
          ? invoiceRecord.amountDuePence
          : parseStoredDecimalToPence(invoice.amount);
      const nextStatus = totalVerifiedPence >= invoiceAmountDuePence ? 'paid' : 'partially_paid';

      if (typeof tx.update === 'function') {
        await tx
          .update(invoices)
          .set({
            status: nextStatus,
            updatedAt: now,
          })
          .where(eq(invoices.id, data.invoiceId));
      }

      // Also invoke authoritative Category C helper
      await recalculateInvoiceStatus(tx, data.invoiceId);

      logger.info(`[Reconcile] Staff ${staffId} reconciled £${formatPenceToDecimal(reconciledPence)} via ${data.method} to invoice ${data.invoiceId}`);
      return { success: true, isIdempotentHit: false, parentId: invoice.parentId } as const;
    });

    if (txResult.success) {
      if (!txResult.isIdempotentHit) {
        revalidatePath(`/dashboard/finance/invoices/${data.invoiceId}`);
        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/reconciliation');
        revalidatePath('/portal/billing');
        if ('parentId' in txResult && txResult.parentId) {
          revalidatePath(`/dashboard/parents/${txResult.parentId}`);
        }
      }
      return { success: true };
    }

    return txResult;
  } catch (err) {
    logger.error('[Reconcile] Error reconciling payment:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
