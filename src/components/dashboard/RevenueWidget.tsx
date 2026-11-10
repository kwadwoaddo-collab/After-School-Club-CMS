import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  parseStoredDecimalToPence,
  toEuropeLondonBusinessDate,
} from '@/features/finance/domain/payment-eligibility';
import {
  endOfMondayWeek,
  formatPenceToGBP,
  formatShortDateRange,
  formatYearMonthShort,
  startOfMondayWeek,
} from '@/features/finance/domain/cash-receipts-ledger';

interface RevenueWidgetProps {
  organisationId: string;
  activeCentreId?: string;
  accessibleCentreIds?: string[];
}

export async function RevenueWidget({
  organisationId,
  activeCentreId = 'all',
  accessibleCentreIds,
}: RevenueWidgetProps) {
  const now = new Date();
  const todayBusinessDate = toEuropeLondonBusinessDate(now);
  const currentMonth = todayBusinessDate.slice(0, 7);
  const weekStart = startOfMondayWeek(todayBusinessDate);
  const weekEnd = endOfMondayWeek(todayBusinessDate);

  let receivedThisWeekPence = 0;
  let receivedThisWeekCount = 0;
  let receivedThisMonthPence = 0;
  let receivedThisMonthCount = 0;
  let outstandingPence = 0;
  let openInvoiceCount = 0;
  let overdueCount = 0;

  try {
    const centreCondition =
      activeCentreId && activeCentreId !== 'all'
        ? eq(invoices.centreId, activeCentreId)
        : Array.isArray(accessibleCentreIds)
          ? accessibleCentreIds.length > 0
            ? inArray(invoices.centreId, accessibleCentreIds)
            : sql`false`
          : undefined;

    const [verifiedPayments, openInvoices] = await Promise.all([
      db
        .select({
          id: payments.id,
          amount: payments.amount,
          recordedAt: payments.recordedAt,
          invoiceId: payments.invoiceId,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
          and(
            eq(invoices.organisationId, organisationId),
            centreCondition,
            inArray(invoices.status, ['sent', 'partially_paid', 'paid']),
            eq(payments.status, 'verified'),
            isNull(payments.reversedAt),
            sql`(${payments.transactionReference} IS NULL OR UPPER(${payments.transactionReference}) NOT LIKE 'CREDIT-%')`
          )
        ),
      db
        .select({
          id: invoices.id,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.organisationId, organisationId),
            centreCondition,
            inArray(invoices.status, ['sent', 'partially_paid'])
          )
        ),
    ]);

    const paidByInvoiceId = new Map<string, number>();

    for (const p of verifiedPayments) {
      const pence = parseStoredDecimalToPence(p.amount);
      if (pence <= 0) continue;

      paidByInvoiceId.set(p.invoiceId, (paidByInvoiceId.get(p.invoiceId) ?? 0) + pence);

      const businessDate = toEuropeLondonBusinessDate(p.recordedAt);
      if (businessDate >= weekStart && businessDate <= weekEnd) {
        receivedThisWeekPence += pence;
        receivedThisWeekCount += 1;
      }
      if (businessDate.slice(0, 7) === currentMonth) {
        receivedThisMonthPence += pence;
        receivedThisMonthCount += 1;
      }
    }

    for (const inv of openInvoices) {
      const totalPence = parseStoredDecimalToPence(inv.amount);
      const paidPence = paidByInvoiceId.get(inv.id) ?? 0;
      const remaining = Math.max(0, totalPence - paidPence);
      if (remaining > 0) {
        outstandingPence += remaining;
        openInvoiceCount += 1;
        const dueBusinessDate = toEuropeLondonBusinessDate(inv.dueDate);
        if (dueBusinessDate < todayBusinessDate) {
          overdueCount += 1;
        }
      }
    }
  } catch {
    // Silently degrade on transient DB issues so the main dashboard remains available
  }

  const centreQuery: Record<string, string> =
    activeCentreId && activeCentreId !== 'all' ? { centre: activeCentreId } : {};
  const cashflowHref = `/dashboard/finance?${new URLSearchParams({
    ...centreQuery,
    view: 'cashflow',
  }).toString()}`;
  const awaitingPaymentHref = `/dashboard/finance?${new URLSearchParams({
    ...centreQuery,
    task: 'payments',
  }).toString()}`;
  const overdueHref = `/dashboard/finance?${new URLSearchParams({
    ...centreQuery,
    task: 'payments',
    status: 'overdue',
  }).toString()}`;

  return (
    <section
      aria-labelledby="dashboard-finance-heading"
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2
          id="dashboard-finance-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Cash received & outstanding balances
        </h2>
        <Link
          href={cashflowHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span>Open weekly cash tally</span>
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <div className="p-6">
          <dt className="text-sm font-medium text-muted-foreground">
            Received This Week (Mon–Sun)
          </dt>
          <dd className="mt-2">
            <Link
              href={cashflowHref}
              className="text-2xl font-semibold tracking-tight text-foreground tabular-nums hover:text-primary hover:underline"
            >
              {formatPenceToGBP(receivedThisWeekPence)}
            </Link>
          </dd>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {formatShortDateRange(weekStart, weekEnd, false)} · {receivedThisWeekCount} verified
            payment{receivedThisWeekCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="p-6">
          <dt className="text-sm font-medium text-muted-foreground">
            Received in {formatYearMonthShort(currentMonth)} (Rolling Tally)
          </dt>
          <dd className="mt-2">
            <Link
              href={cashflowHref}
              className="text-2xl font-semibold tracking-tight text-foreground tabular-nums hover:text-primary hover:underline"
            >
              {formatPenceToGBP(receivedThisMonthPence)}
            </Link>
          </dd>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {receivedThisMonthCount} verified payment{receivedThisMonthCount === 1 ? '' : 's'} month
            to date
          </p>
        </div>

        <div className="p-6">
          <dt className="text-sm font-medium text-muted-foreground">Outstanding Balances</dt>
          <dd className="mt-2">
            <Link
              href={awaitingPaymentHref}
              className="text-2xl font-semibold tracking-tight text-foreground tabular-nums hover:text-primary hover:underline"
            >
              {formatPenceToGBP(outstandingPence)}
            </Link>
          </dd>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            Across {openInvoiceCount} issued unpaid invoice{openInvoiceCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="p-6">
          <dt className="text-sm font-medium text-muted-foreground">Overdue Invoices</dt>
          <dd className="mt-2">
            <Link
              href={overdueHref}
              className={`text-2xl font-semibold tracking-tight tabular-nums hover:underline ${
                overdueCount > 0
                  ? 'text-amber-800 dark:text-amber-200'
                  : 'text-foreground'
              }`}
            >
              {overdueCount}
            </Link>
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            {overdueCount > 0 ? 'Past due date — follow up' : 'No overdue issued invoices'}
          </p>
        </div>
      </dl>
    </section>
  );
}
