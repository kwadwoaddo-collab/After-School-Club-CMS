import { db } from '@/db';
import { invoices, parents, children, payments } from '@/db/schema';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';
import { ReconciliationClient } from './reconciliation-client';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2, CheckCircle } from 'lucide-react';
import { extractInvoiceStudents } from '@/features/finance/cash-receipts-queries';

export const metadata = {
  title: 'Payment Reconciliation',
};

export default async function ReconciliationPage(props: {
  searchParams: Promise<{
    centre?: string;
  }>
}) {
  const searchParams = await props.searchParams;
  const session = await requireTenantSession();

  if (!session?.user) return redirect('/login');
  if (!session.user.organisationId) return redirect('/onboarding');

  // Check role access - ORG_OWNER or MANAGER
  const userRole = session.user.role;
  if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
    return redirect('/dashboard');
  }

  const organisationId = session.user.organisationId;

  const orgCentres = await getUserAccessibleCentres(session.user.id);
  const validCentreIds = orgCentres
    .map((c: { id: string }) => c.id)
    .filter(isValidUuid);

  if (userRole !== 'ORG_OWNER' && validCentreIds.length === 0) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-6 pb-0">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Payment Reconciliation</h1>
          <p className="text-muted-foreground font-medium mt-1 text-sm sm:text-base">
            Match incoming Tax-Free Childcare and voucher payments to pending invoices.
          </p>
        </div>
        <div className="p-6 flex-1">
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="No centres assigned"
            description="You are not currently assigned to any centres. Ask an organisation owner to grant centre access to reconcile payments."
          />
        </div>
      </div>
    );
  }

  const activeCentreId = validCentreIds.length > 0
    ? await resolveActiveCentreId(searchParams.centre, validCentreIds)
    : 'all';

  const centreFilter = activeCentreId !== 'all' && isValidUuid(activeCentreId)
    ? eq(invoices.centreId, activeCentreId)
    : validCentreIds.length > 0
      ? inArray(invoices.centreId, validCentreIds)
      : undefined;

  // Find all payable invoices (sent or partially_paid — overdue is derived from dueDate, not an enum status)
  const pendingInvoices = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    billingPeriodStart: invoices.billingPeriodStart,
    billingPeriodEnd: invoices.billingPeriodEnd,
    amount: invoices.amount,
    status: invoices.status,
    parentId: invoices.parentId,
    childId: invoices.childId,
    coveredChildrenJson: invoices.coveredChildrenJson,
    parentFirstName: parents.firstName,
    parentLastName: parents.lastName,
    parentEmail: parents.email,
    childTfcRef: children.tfcReference,
    childFirstName: children.firstName,
    childLastName: children.lastName,
  })
  .from(invoices)
  .leftJoin(parents, eq(invoices.parentId, parents.id))
  .leftJoin(children, eq(invoices.childId, children.id))
  .where(
    and(
      eq(invoices.organisationId, organisationId),
      centreFilter,
      inArray(invoices.status, ['sent', 'partially_paid'])
    )
  )
  .orderBy(desc(invoices.createdAt));

  // Fetch verified, unreversed payments to calculate remaining balances in pence
  const allInvoiceIds = pendingInvoices.map(i => i.id).filter(isValidUuid);

  let verifiedPaidPenceByInvoice: Record<string, number> = {};
  if (allInvoiceIds.length > 0) {
    const existingPayments = await db.select({
      invoiceId: payments.invoiceId,
      amount: payments.amount,
    })
    .from(payments)
    .where(
      and(
        inArray(payments.invoiceId, allInvoiceIds),
        eq(payments.status, 'verified'),
        isNull(payments.reversedAt)
      )
    );

    verifiedPaidPenceByInvoice = existingPayments.reduce((acc, p) => {
      const amountPence = Math.round(parseFloat(p.amount as string) * 100);
      acc[p.invoiceId] = (acc[p.invoiceId] || 0) + (Number.isFinite(amountPence) ? amountPence : 0);
      return acc;
    }, {} as Record<string, number>);
  }

  const enhancedInvoices = pendingInvoices.map(i => {
    const amountDuePence = Math.round(parseFloat(i.amount as string) * 100);
    const paidAmountPence = verifiedPaidPenceByInvoice[i.id] || 0;
    const remainingBalancePence = Math.max(0, amountDuePence - paidAmountPence);
    const students = extractInvoiceStudents(
      i.coveredChildrenJson,
      i.childId,
      i.childFirstName,
      i.childLastName
    );
    return {
      ...i,
      students,
      amountDuePence,
      paidAmountPence,
      remainingBalancePence,
      totalAmount: amountDuePence / 100,
      remainingBalance: remainingBalancePence / 100,
    };
  }).filter(i => i.remainingBalancePence > 0);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-0">
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Payment Reconciliation</h1>
        <p className="text-muted-foreground font-medium mt-1 text-sm sm:text-base">
          Match incoming Tax-Free Childcare and voucher payments to pending invoices.
        </p>
      </div>

      <div className="p-6 flex-1">
        {enhancedInvoices.length === 0 ? (
          <EmptyState
            title="All caught up!"
            description="There are no pending invoices to reconcile."
            icon={<CheckCircle className="w-8 h-8" />}
          />
        ) : (
          <ReconciliationClient invoices={enhancedInvoices} />
        )}
      </div>
    </div>
  );
}
