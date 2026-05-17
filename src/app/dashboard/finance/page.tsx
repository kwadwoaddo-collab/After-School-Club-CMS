import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices, centres, children, payments } from '@/db/schema';
import { eq, desc, and, sum, count, ne, lt, sql } from 'drizzle-orm';
import { 
    TrendingUp, 
    CreditCard, 
    Clock, 
    FileText, 
    ArrowUpRight,
    ArrowDownRight,
    AlertCircle,
} from 'lucide-react';
import { Suspense } from 'react';
import Link from 'next/link';
import FinanceDashboardClient, { InvoiceTable, OverdueInvoiceTable, InvoiceAgingSummary, ParentBalanceTable } from '@/features/finance/components/FinanceDashboardClient';
import FinanceDashboardFilters from '@/features/finance/components/FinanceDashboardFilters';
import { normalizeString } from '@/lib/search-params';

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

    // Extract centre filter and validate
    let centreId = normalizeString(searchParams?.centre, 'all');
    if (centreId !== 'all' && !orgCentres.some(c => c.id === centreId)) {
        centreId = 'all';
    }
    const centreFilter = centreId !== 'all' ? eq(invoices.centreId, centreId) : undefined;

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
              ${centreId !== 'all' ? sql`AND i.centre_id = ${centreId}` : sql``}
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
              ${centreId !== 'all' ? sql`AND i.centre_id = ${centreId}` : sql``}
            GROUP BY p.id, p.first_name, p.last_name, p.email
        )
        SELECT * FROM ParentBalances
        WHERE balance > 0
        ORDER BY balance DESC
        LIMIT 10
    `);

    const stats = [
        { name: 'Total Billed', value: `£${totalRevenue.toLocaleString()}`, change: '+0%', changeType: 'increase', icon: TrendingUp },
        { name: 'Collections', value: `£${collections.toLocaleString()}`, change: '+0%', changeType: 'increase', icon: CreditCard },
        { name: 'Outstanding', value: `£${outstandingBalance.toLocaleString()}`, change: '0', changeType: 'neutral', icon: FileText },
        { name: 'Pending', value: pendingInvoices.toString(), change: '0', changeType: 'neutral', icon: Clock },
        { name: 'Overdue', value: overdueCount.toString(), change: overdueCount > 0 ? 'Action Req' : '0', changeType: overdueCount > 0 ? 'decrease' : 'neutral', icon: AlertCircle },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Finance Ledger</h1>
                    <p className="text-on-surface-variant font-medium mt-1">
                        Manage invoices, payments, and financial health
                    </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <Suspense fallback={<div className="w-[180px] h-[44px] bg-[#14161b] rounded-2xl animate-pulse" />}>
                        <FinanceDashboardFilters centres={orgCentres} />
                    </Suspense>
                    <FinanceDashboardClient 
                        students={orgStudents} 
                        recentInvoices={recentInvoices} 
                        centres={orgCentres}
                        isOwner={userRole === 'ORG_OWNER'}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {stats.map((stat) => (
                    <div key={stat.name} className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-6 relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                                <stat.icon className="w-6 h-6 text-primary" />
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                                stat.changeType === 'increase' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                            }`}>
                                {stat.changeType === 'increase' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {stat.change}
                            </div>
                        </div>
                        <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">{stat.name}</p>
                        <h3 className="text-3xl font-black text-white mt-1">{stat.value}</h3>
                        
                        {/* Decorative background pulse */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                    </div>
                ))}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Invoices */}
                <div className="lg:col-span-2 space-y-6">
                    <InvoiceAgingSummary buckets={agingBuckets} />

                    {parentBalancesResult.length > 0 && (
                        <div className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-6">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Parent Balances
                                </h3>
                            </div>
                            <ParentBalanceTable balances={parentBalancesResult} />
                        </div>
                    )}

                    {overdueCount > 0 && (
                        <div className="bg-error/5 border border-error/20 rounded-[32px] p-6 relative overflow-hidden">
                            <div className="absolute -right-12 -top-12 w-40 h-40 bg-error/10 rounded-full blur-3xl" />
                            <div className="flex items-center justify-between mb-6 px-2 relative z-10">
                                <h3 className="text-xl font-bold text-error flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Overdue Invoices Action Required
                                </h3>
                                <Link href="/dashboard/finance/invoices" className="text-sm font-bold text-error hover:underline">
                                    View All
                                </Link>
                            </div>
                            <div className="relative z-10 bg-surface-container-highest/50 rounded-2xl overflow-hidden backdrop-blur-sm border border-outline-variant/10">
                                <OverdueInvoiceTable invoices={overdueInvoices} />
                            </div>
                        </div>
                    )}

                    <div className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-6">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Recent Invoices
                            </h3>
                            <Link href="/dashboard/finance/invoices" className="text-sm font-bold text-primary hover:underline">
                                View All
                            </Link>
                        </div>

                        <InvoiceTable invoices={recentInvoices} isOwner={userRole === 'ORG_OWNER'} />
                    </div>
                </div>

                {/* Sidebar Cards */}
                <div className="space-y-6">
                    {/* Bank & Payment Info */}
                    <div className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-8 bg-gradient-to-br from-primary/5 to-transparent">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-primary" />
                            Billing Settings
                        </h3>
                        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                            Configure your bank details and fee structures to ensure professional invoice generation.
                        </p>
                        <Link 
                            href="/dashboard/settings/finance"
                            className="block w-full text-center py-4 bg-white/5 border border-outline-variant/20 rounded-2xl text-sm font-bold text-white hover:bg-white/10 transition-all"
                        >
                            Configure Billing
                        </Link>
                    </div>

                    {/* Quick Tools */}
                    <div className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-6">
                        <h3 className="text-lg font-bold text-white mb-4 px-2">Quick Tools</h3>
                        <div className="space-y-2">
                            <a href="/api/finance/export" target="_blank" className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all text-sm font-medium text-white group">
                                <span>Export Ledger (CSV)</span>
                                <ArrowUpRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                            </a>
                            <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all text-sm font-medium text-white group">
                                <span>Tax Summary Report</span>
                                <ArrowUpRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
