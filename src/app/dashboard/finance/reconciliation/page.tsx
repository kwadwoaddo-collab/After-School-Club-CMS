import { db } from '@/db';
import { invoices, parents, children, payments, centres } from '@/db/schema';
import { eq, and, sql, notInArray, desc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { ReconciliationClient } from './reconciliation-client';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = {
  title: 'Payment Reconciliation',
};

export default async function ReconciliationPage(props: {
  searchParams: Promise<{
    centre?: string;
  }>
}) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (!session?.user) return redirect('/login');
  if (!session.user.organisationId) return redirect('/onboarding');

  const organisationId = session.user.organisationId;
  
  const orgCentresRaw = await db.query.centres.findMany({
    where: eq(centres.organisationId, organisationId)
  });
  const validCentreIds = orgCentresRaw.map((c: { id: string }) => c.id);
  const activeCentreId = await resolveActiveCentreId(searchParams.centre, validCentreIds);

  // Find all invoices that are pending (sent or partially_paid)
  const pendingInvoices = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    amount: invoices.amount,
    status: invoices.status,
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
      eq(invoices.centreId, activeCentreId),
      notInArray(invoices.status, ['draft', 'paid', 'void'])
    )
  )
  .orderBy(desc(invoices.createdAt));

  // Also fetch payments to calculate remaining balances
  const allInvoiceIds = pendingInvoices.map(i => i.id);
  
  let paymentsByInvoice: Record<string, number> = {};
  if (allInvoiceIds.length > 0) {
    const existingPayments = await db.select({
      invoiceId: payments.invoiceId,
      amount: payments.amount,
    })
    .from(payments)
    .where(inArray(payments.invoiceId, allInvoiceIds));
    
    paymentsByInvoice = existingPayments.reduce((acc, p) => {
      acc[p.invoiceId] = (acc[p.invoiceId] || 0) + parseFloat(p.amount as string);
      return acc;
    }, {} as Record<string, number>);
  }

  const enhancedInvoices = pendingInvoices.map(i => {
    const totalAmount = parseFloat(i.amount as string);
    const paid = paymentsByInvoice[i.id] || 0;
    return {
      ...i,
      totalAmount,
      remainingBalance: Math.max(0, totalAmount - paid),
    };
  }).filter(i => i.remainingBalance > 0);

  return (
    <div className="flex flex-col h-full bg-[--color-background]">
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
            icon="CheckCircle"
          />
        ) : (
          <ReconciliationClient invoices={enhancedInvoices} organisationId={organisationId} />
        )}
      </div>
    </div>
  );
}
