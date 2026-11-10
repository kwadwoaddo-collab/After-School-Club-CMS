import { db } from '@/db';
import { centres, children, invoices, parents, payments } from '@/db/schema';
import { isOrgOwner } from '@/lib/permissions';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  buildCashReceiptsLedger,
  type CashReceiptPaymentInput,
  type CashReceiptsLedgerResult,
  type CashReceiptStudentRef,
  type CentreRef,
} from './domain/cash-receipts-ledger';

export function extractInvoiceStudents(
  coveredChildrenJson: unknown,
  childId: string | null,
  childFirstName: string | null,
  childLastName: string | null
): CashReceiptStudentRef[] {
  if (Array.isArray(coveredChildrenJson) && coveredChildrenJson.length > 0) {
    const parsed = coveredChildrenJson.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const id =
        typeof record.id === 'string'
          ? record.id
          : typeof record.childId === 'string'
            ? record.childId
            : '';
      const name =
        typeof record.name === 'string' && record.name.trim().length > 0
          ? record.name.trim()
          : [record.firstName, record.lastName]
              .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
              .join(' ')
              .trim();
      return id && name ? [{ id, name }] : [];
    });
    if (parsed.length > 0) {
      return parsed;
    }
  }

  if (childId && (childFirstName || childLastName)) {
    const fullName = [childFirstName, childLastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      return [{ id: childId, name: fullName }];
    }
  }

  return [];
}

/**
 * Queries verified, unreversed cash receipts across the organisation and builds the
 * Owner Cash Receipts Ledger (Weekly Mon–Sun breakdown, Rolling Monthly Tally, MoM/YoY comparisons).
 *
 * Enforces:
 * - INV-1: Live `isOrgOwner(userId)` check
 * - INV-2: `payments INNER JOIN invoices` for tenant and centre isolation
 * - INV-3: Qualifying payment predicate (verified, unreversed, non-draft/void invoice, non-CREDIT-* ref)
 * - INV-7: `LEFT JOIN children` + `coveredChildrenJson` so multi-child family invoices with null `childId` are never dropped
 */
export async function fetchOwnerCashReceiptsLedger(params: {
  userId: string;
  organisationId: string;
  centres: CentreRef[];
  activeCentreId?: string | null;
  selectedMonth?: string | null;
  today?: Date;
}): Promise<CashReceiptsLedgerResult> {
  const { userId, organisationId, centres: orgCentres, activeCentreId, selectedMonth, today } = params;

  const ownerVerified = await isOrgOwner(userId);
  if (!ownerVerified) {
    throw new Error('Forbidden: ORG_OWNER role required to view the cash receipts ledger.');
  }

  const rows = await db
    .select({
      paymentId: payments.id,
      amount: payments.amount,
      method: payments.method,
      paymentStatus: payments.status,
      reversedAt: payments.reversedAt,
      transactionReference: payments.transactionReference,
      recordedAt: payments.recordedAt,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceStatus: invoices.status,
      centreId: invoices.centreId,
      centreName: centres.name,
      parentId: invoices.parentId,
      parentFirstName: parents.firstName,
      parentLastName: parents.lastName,
      childId: invoices.childId,
      childFirstName: children.firstName,
      childLastName: children.lastName,
      coveredChildrenJson: invoices.coveredChildrenJson,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(parents, eq(invoices.parentId, parents.id))
    .leftJoin(centres, eq(invoices.centreId, centres.id))
    .leftJoin(children, eq(invoices.childId, children.id))
    .where(
      and(
        eq(invoices.organisationId, organisationId),
        inArray(invoices.status, ['sent', 'partially_paid', 'paid']),
        eq(payments.status, 'verified'),
        isNull(payments.reversedAt),
        sql`(${payments.transactionReference} IS NULL OR UPPER(${payments.transactionReference}) NOT LIKE 'CREDIT-%')`
      )
    )
    .orderBy(desc(payments.recordedAt));

  const paymentInputs: CashReceiptPaymentInput[] = rows.map((row) => {
    const parentName =
      [row.parentFirstName, row.parentLastName].filter(Boolean).join(' ').trim() || 'Family account';
    const students = extractInvoiceStudents(
      row.coveredChildrenJson,
      row.childId,
      row.childFirstName,
      row.childLastName
    );

    return {
      id: row.paymentId,
      amount: row.amount,
      method: row.method,
      status: row.paymentStatus,
      reversedAt: row.reversedAt,
      transactionReference: row.transactionReference,
      recordedAt: row.recordedAt,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      invoiceStatus: row.invoiceStatus,
      centreId: row.centreId,
      centreName: row.centreName ?? 'Centre',
      parentId: row.parentId,
      parentName,
      students,
    };
  });

  return buildCashReceiptsLedger({
    payments: paymentInputs,
    centres: orgCentres,
    selectedMonth,
    activeCentreId,
    today,
  });
}
