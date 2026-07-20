import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, and, gte, lt, sql, inArray } from 'drizzle-orm';
import { startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/components/ui/utils';
import { PoundSterling, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface RevenueWidgetProps {
  organisationId: string;
}

export async function RevenueWidget({ organisationId }: RevenueWidgetProps) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let revenue = {
    thisMonth: 0,
    outstanding: 0,
    overdueCount: 0,
  };

  try {
    const [stats] = await db
      .select({
        thisMonth: sql<number>`
          coalesce(sum(${invoices.amount}) filter (
            where ${invoices.status} = 'paid'
            and ${invoices.invoiceDate} >= ${monthStart.toISOString()}
            and ${invoices.invoiceDate} <= ${monthEnd.toISOString()}
          ), 0)::float
        `,
        outstanding: sql<number>`
          coalesce(sum(${invoices.amount}) filter (
            where ${invoices.status} in ('sent', 'partially_paid', 'draft')
          ), 0)::float
        `,
        overdueCount: sql<number>`
          count(*) filter (
            where ${invoices.status} in ('sent', 'partially_paid')
            and ${invoices.dueDate} < ${now.toISOString()}
          )::int
        `,
      })
      .from(invoices)
      .where(eq(invoices.organisationId, organisationId));

    revenue = {
      thisMonth: Number(stats?.thisMonth ?? 0),
      outstanding: Number(stats?.outstanding ?? 0),
      overdueCount: Number(stats?.overdueCount ?? 0),
    };
  } catch {
    // silently degrade — don't break the dashboard
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

  const items = [
    {
      label: 'Revenue This Month',
      value: formatCurrency(revenue.thisMonth),
      icon: PoundSterling,
      color: 'text-success',
      iconBg: 'bg-success/10',
      description: 'Paid invoices',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(revenue.outstanding),
      icon: Clock,
      color: 'text-warning',
      iconBg: 'bg-warning/10',
      description: 'Unpaid invoices',
    },
    {
      label: 'Overdue Invoices',
      value: revenue.overdueCount.toString(),
      icon: AlertCircle,
      color: revenue.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground',
      iconBg: revenue.overdueCount > 0 ? 'bg-destructive/10' : 'bg-secondary/40',
      description: 'Past due date',
    },
  ];

  return (
    <div className="glassmorphic-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-outline-variant/10">
        <PoundSterling className="w-4 h-4 text-success" />
        <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
          Finance Overview
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/10">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-4 p-6">
            <div className={cn('p-3 rounded-xl flex-shrink-0', item.iconBg)}>
              <item.icon className={cn('w-5 h-5', item.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">
                {item.label}
              </p>
              {item.label === 'Overdue Invoices' && revenue.overdueCount > 0 ? (
                <Link href="/dashboard/finances?status=overdue" className={cn('text-2xl font-black tabular-nums hover:underline', item.color)}>
                  {item.value}
                </Link>
              ) : (
                <p className={cn('text-2xl font-black tabular-nums', item.color)}>
                  {item.value}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/40 font-medium mt-0.5">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
