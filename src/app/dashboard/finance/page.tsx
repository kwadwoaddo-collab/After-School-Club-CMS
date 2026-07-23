import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices, centres, children, payments } from '@/db/schema';
import { eq, desc, and, sum, count, ne, lt, sql } from 'drizzle-orm';
import { 
    TrendingUp, 
    Clock, 
    FileText, 
    AlertCircle,
    Download,
    ArrowUpRight,
    CreditCard,
} from 'lucide-react';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { Suspense } from 'react';
import Link from 'next/link';
import FinanceDashboardClient, { OverdueInvoiceTable, InvoiceAgingSummary, ParentBalanceTable } from '@/features/finance/components/FinanceDashboardClient';
import FilterableInvoiceSection from '@/features/finance/components/FilterableInvoiceSection';
import FinanceDashboardFilters from '@/features/finance/components/FinanceDashboardFilters';
import { normalizeString } from '@/lib/search-params';
import BillingCyclesTab from '@/features/billing/components/BillingCyclesTab';
import { fetchBillingCycles } from '@/features/billing/queries';



export default async function FinancePage(props: {
    searchParams: Promise<{
        centre?: string;
    }>
}) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    
    // Check role access - Strictly ORG_OWNER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }

    // Fetch centres for the modal
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId)
    });

    const validCentreIds = orgCentres.map(c => c.id);
    const activeCentreId = await resolveActiveCentreId(searchParams.centre, validCentreIds);

    const centreFilter = activeCentreId !== 'all' ? eq(invoices.centreId, activeCentreId) : undefined;

    // Fetch summary data
    const recentInvoices = await db.query.invoices.findMany({
        where: and(
            eq(invoices.organisationId, session.user.organisationId),
            centreFilter
        ),
        limit: 10,
        orderBy: [desc(invoices.createdAt)],
        with: {
            centre: true,
            child: true,
            parent: true
        }
    });

    // Fetch students for the invoice creation modal
    const students = await db.query.children.findMany({
        with: {
            parent: true
        },
    });
    
    const orgStudents = students.filter(s => s.parent?.organisationId === session.user.organisationId);

    // Fetch billing cycles for the Billing Cycles tab — wrapped in try-catch for resilience
    let billingCycles: import('@/features/billing/queries').BillingCycleRow[] = [];
    try {
        billingCycles = await fetchBillingCycles(session.user.organisationId, activeCentreId);
    } catch (err) {
        logger.error('[finance] fetchBillingCycles failed:', err);
    }

    // Calculate real stats with database-level aggregations
    const orgId = session.user.organisationId;

    const [totalBilledResult] = await db
        .select({ total: sum(invoices.amount) })
        .from(invoices)
        .where(and(
            eq(invoices.organisationId, orgId),
            centreFilter
        ));
    
    const [pendingInvoicesResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            centreFilter
        ));
        
    const [collectionsResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(and(
            eq(invoices.organisationId, orgId),
            centreFilter
        ));

    const totalRevenue = Number(totalBilledResult?.total || 0);
    const pendingInvoices = Number(pendingInvoicesResult?.count || 0);
    const collections = Number(collectionsResult?.total || 0);

    const today = new Date();
    // For export button — current month range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const [overdueResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            lt(invoices.dueDate, today),
            centreFilter
        ));
        
    const overdueInvoices = await db.query.invoices.findMany({
        where: and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            lt(invoices.dueDate, today),
            centreFilter
        ),
        limit: 10,
        orderBy: [desc(invoices.dueDate)],
        with: {
            parent: true,
            child: true,
            payments: true
        }
    });

    const overdueCount = Number(overdueResult?.count || 0);
    
    // Calculate strict outstanding balance (excluding void and fully paid)
    const [outstandingInvoicesResult] = await db
        .select({ total: sum(invoices.amount) })
        .from(invoices)
        .where(and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            centreFilter
        ));
        
    const [outstandingPaymentsResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            centreFilter
        ));

    const totalOutstandingInvoices = Number(outstandingInvoicesResult?.total || 0);
    const totalOutstandingPayments = Number(outstandingPaymentsResult?.total || 0);
    const outstandingBalance = totalOutstandingInvoices - totalOutstandingPayments;

    // Database-level query for invoice aging buckets
    const [agingResult] = await db.execute(sql`
        WITH InvoicePayments AS (
            SELECT invoice_id, SUM(amount) as paid_amount
            FROM payments
            GROUP BY invoice_id
        ),
        InvoiceStats AS (
            SELECT 
                i.id,
                i.amount,
                COALESCE(p.paid_amount, 0) as paid_amount,
                i.amount - COALESCE(p.paid_amount, 0) as outstanding_balance,
                CURRENT_DATE - i.due_date::date as days_overdue
            FROM invoices i
            LEFT JOIN InvoicePayments p ON i.id = p.invoice_id
            WHERE i.organisation_id = ${orgId}
              AND i.status != 'paid'
              AND i.status != 'void'
              ${activeCentreId !== 'all' ? sql`AND i.centre_id = ${activeCentreId}` : sql``}
        )
        SELECT
            COUNT(*) FILTER (WHERE days_overdue <= 0) as current_count,
            COALESCE(SUM(outstanding_balance) FILTER (WHERE days_overdue <= 0), 0) as current_amount,
            
            COUNT(*) FILTER (WHERE days_overdue >= 1 AND days_overdue <= 7) as days_1_7_count,
            COALESCE(SUM(outstanding_balance) FILTER (WHERE days_overdue >= 1 AND days_overdue <= 7), 0) as days_1_7_amount,
            
            COUNT(*) FILTER (WHERE days_overdue >= 8 AND days_overdue <= 30) as days_8_30_count,
            COALESCE(SUM(outstanding_balance) FILTER (WHERE days_overdue >= 8 AND days_overdue <= 30), 0) as days_8_30_amount,
            
            COUNT(*) FILTER (WHERE days_overdue >= 31 AND days_overdue <= 60) as days_31_60_count,
            COALESCE(SUM(outstanding_balance) FILTER (WHERE days_overdue >= 31 AND days_overdue <= 60), 0) as days_31_60_amount,
            
            COUNT(*) FILTER (WHERE days_overdue > 60) as days_60_plus_count,
            COALESCE(SUM(outstanding_balance) FILTER (WHERE days_overdue > 60), 0) as days_60_plus_amount
        FROM InvoiceStats
    `);

    const agingBuckets = {
        current: { count: Number(agingResult?.current_count || 0), amount: Number(agingResult?.current_amount || 0) },
        days_1_7: { count: Number(agingResult?.days_1_7_count || 0), amount: Number(agingResult?.days_1_7_amount || 0) },
        days_8_30: { count: Number(agingResult?.days_8_30_count || 0), amount: Number(agingResult?.days_8_30_amount || 0) },
        days_31_60: { count: Number(agingResult?.days_31_60_count || 0), amount: Number(agingResult?.days_31_60_amount || 0) },
        days_60_plus: { count: Number(agingResult?.days_60_plus_count || 0), amount: Number(agingResult?.days_60_plus_amount || 0) },
    };

    const parentBalancesResult = await db.execute(sql`
        WITH InvoicePayments AS (
            SELECT invoice_id, SUM(amount) as paid_amount
            FROM payments
            GROUP BY invoice_id
        ),
        ParentBalances AS (
            SELECT 
                p.id as parent_id,
                COALESCE(p.first_name, '') as first_name,
                COALESCE(p.last_name, '') as last_name,
                COALESCE(p.email, '') as email,
                COUNT(i.id) as unpaid_invoice_count,
                SUM(i.amount) as total_invoiced,
                SUM(COALESCE(ip.paid_amount, 0)) as total_paid,
                GREATEST(0, SUM(i.amount) - SUM(COALESCE(ip.paid_amount, 0))) as balance
            FROM invoices i
            INNER JOIN parents p ON i.parent_id = p.id
            LEFT JOIN InvoicePayments ip ON i.id = ip.invoice_id
            WHERE i.organisation_id = ${orgId}
              AND i.status != 'paid'
              AND i.status != 'void'
              ${activeCentreId !== 'all' ? sql`AND i.centre_id = ${activeCentreId}` : sql``}
            GROUP BY p.id, p.first_name, p.last_name, p.email
        )
        SELECT * FROM ParentBalances
        WHERE balance > 0
        ORDER BY balance DESC
        LIMIT 10
    `);

    const stats = [
        { 
            name: 'Total Billed', 
            value: `£${totalRevenue.toLocaleString()}`, 
            sublabel: 'all time', 
            icon: TrendingUp,
            variant: 'default' as const,
        },
        { 
            name: 'Collections', 
            value: `£${collections.toLocaleString()}`, 
            sublabel: 'payments received', 
            icon: CreditCard,
            variant: 'default' as const,
        },
        { 
            name: 'Outstanding Balance', 
            value: `£${outstandingBalance.toLocaleString()}`, 
            sublabel: `${pendingInvoices} unpaid invoice${pendingInvoices !== 1 ? 's' : ''}`, 
            icon: FileText,
            variant: outstandingBalance > 0 ? 'destructive' as const : 'default' as const,
            hero: true,
        },
        { 
            name: 'Pending Invoices', 
            value: pendingInvoices.toString(), 
            sublabel: 'awaiting payment', 
            icon: Clock,
            variant: 'default' as const,
        },
        { 
            name: 'Overdue', 
            value: overdueCount.toString(), 
            sublabel: overdueCount > 0 ? 'action required' : 'none overdue', 
            icon: AlertCircle,
            variant: overdueCount > 0 ? 'destructive' as const : 'default' as const,
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Finance Ledger</h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Manage invoices, payments, and financial health
                    </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <Suspense fallback={<div className="w-[180px] h-[44px] bg-secondary/60 rounded-2xl animate-pulse" />}>
                        <FinanceDashboardFilters centres={orgCentres} />
                    </Suspense>
                    {/* Export current-month finance CSV — direct download, no JS required */}
                    <a
                        href={`/api/export/finance?from=${monthStart}&to=${todayStr}`}
                        download={`finance-${monthStart}-to-${todayStr}.csv`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-success/10 border border-success/20 text-success text-sm font-bold hover:bg-success/20 transition-all active:scale-95 duration-100"
                        title="Download finance CSV for current month"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </a>
                    <FinanceDashboardClient 
                        students={orgStudents} 
                        recentInvoices={recentInvoices} 
                        centres={orgCentres}
                        isOwner={userRole === 'ORG_OWNER'}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {stats.map((stat) => {
                    const isDestructive = stat.variant === 'destructive';
                    return (
                        <div
                            key={stat.name}
                            className={`relative overflow-hidden group shadow-sm rounded-3xl p-6 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.985] cursor-pointer ${
                                stat.hero ? 'lg:col-span-2' : ''
                            } ${
                                isDestructive
                                    ? 'bg-destructive/5 border-destructive/20 hover:border-destructive/40'
                                    : 'bg-card border-border hover:border-primary/20'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 ${
                                    isDestructive
                                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                                        : 'bg-primary/10 border-primary/20 text-primary'
                                }`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{stat.name}</p>
                                <h3 className={`font-black mt-1 tracking-tight tabular-nums ${stat.hero ? 'text-4xl' : 'text-3xl'} ${isDestructive ? 'text-destructive' : 'text-foreground'}`}>
                                    {stat.value}
                                </h3>
                                <p className="text-xs font-medium text-muted-foreground mt-3 pt-3 border-t border-border/30">{stat.sublabel}</p>
                            </div>

                            {/* Decorative background pulse */}
                            <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl transition-colors pointer-events-none ${
                                isDestructive
                                    ? 'bg-destructive/5 group-hover:bg-destructive/15'
                                    : 'bg-primary/5 group-hover:bg-primary/15'
                            }`} />
                        </div>
                    );
                })}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Recent Invoices */}
                <div className="lg:col-span-2 space-y-6">
                    <InvoiceAgingSummary buckets={agingBuckets} />

                    {overdueCount > 0 && (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-[32px] p-6 relative overflow-hidden">
                            <div className="absolute -right-12 -top-12 w-40 h-40 bg-destructive/10 rounded-full blur-3xl" />
                            <div className="flex items-center justify-between mb-6 px-2 relative z-10">
                                <h3 className="text-xl font-bold text-destructive flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Overdue Invoices — Action Required
                                </h3>
                                <Link href="/dashboard/finance/invoices?status=overdue" className="text-sm font-bold text-destructive hover:underline">
                                    View All
                                </Link>
                            </div>
                            <div className="relative z-10 bg-secondary/50 rounded-2xl overflow-hidden backdrop-blur-sm border border-border">
                                <OverdueInvoiceTable invoices={overdueInvoices} />
                            </div>
                        </div>
                    )}

                    <FilterableInvoiceSection
                        initialInvoices={recentInvoices}
                        isOwner={userRole === 'ORG_OWNER'}
                    />

                    {parentBalancesResult.length > 0 && (
                        <div className="bg-card border border-border shadow-sm rounded-[32px] p-6">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Parent Balances
                                </h3>
                            </div>
                            <ParentBalanceTable balances={parentBalancesResult} />
                        </div>
                    )}

                    {/* Billing Cycles — weekly task, placed last */}
                    <div className="bg-card border border-border shadow-sm rounded-[32px] p-6">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" />
                                Billing Cycles
                            </h3>
                        </div>
                        <BillingCyclesTab
                            cycles={billingCycles as any}
                            centreId={activeCentreId}
                        />
                    </div>
                </div>

                {/* Sidebar Cards */}
                <div className="space-y-6">
                    {/* Bank & Payment Info */}
                    <div className="bg-card border border-border shadow-sm rounded-[32px] p-8 bg-gradient-to-br from-primary/5 to-transparent">
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-primary" />
                            Billing Settings
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                            Configure your bank details and fee structures to ensure professional invoice generation.
                        </p>
                        <Link 
                            href="/dashboard/settings/finance"
                            className="block w-full text-center py-4 bg-secondary/60 border border-border rounded-2xl text-sm font-bold text-foreground hover:bg-secondary transition-all active:scale-95 duration-100"
                        >
                            Configure Billing
                        </Link>
                    </div>

                    {/* Quick Tools */}
                    <div className="bg-card border border-border shadow-sm rounded-[32px] p-6">
                        <h3 className="text-lg font-bold text-foreground mb-4 px-2">Quick Tools</h3>
                        <div className="space-y-2">
                            <Link href="/dashboard/finance/receipt" className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-secondary/60 transition-all text-sm font-medium text-foreground group">
                                <span>Cash Receipt Tool</span>
                                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                            <Link href="/dashboard/reports" className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-secondary/60 transition-all text-sm font-medium text-foreground group">
                                <span>Tax Summary Report</span>
                                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
