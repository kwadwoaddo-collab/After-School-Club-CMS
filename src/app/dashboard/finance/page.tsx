import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices, centres, children, payments } from '@/db/schema';
import { eq, desc, and, sum, count, ne, lt } from 'drizzle-orm';
import { 
    TrendingUp, 
    CreditCard, 
    Clock, 
    FileText, 
    ArrowUpRight,
    ArrowDownRight,
    AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import FinanceDashboardClient, { InvoiceTable, OverdueInvoiceTable } from '@/features/finance/components/FinanceDashboardClient';

export default async function FinancePage() {
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

    // Fetch summary data
    const recentInvoices = await db.query.invoices.findMany({
        where: eq(invoices.organisationId, session.user.organisationId),
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
        .where(eq(invoices.organisationId, orgId));
    
    const [pendingInvoicesResult] = await db
        .select({ count: count() })
        .from(invoices)
        .where(and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid')
        ));
        
    const [collectionsResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(eq(invoices.organisationId, orgId));

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
            lt(invoices.dueDate, today)
        ));
        
    const overdueInvoices = await db.query.invoices.findMany({
        where: and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            lt(invoices.dueDate, today)
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
            ne(invoices.status, 'void')
        ));
        
    const [outstandingPaymentsResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(and(
            eq(invoices.organisationId, orgId),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void')
        ));

    const totalOutstandingInvoices = Number(outstandingInvoicesResult?.total || 0);
    const totalOutstandingPayments = Number(outstandingPaymentsResult?.total || 0);
    const outstandingBalance = totalOutstandingInvoices - totalOutstandingPayments;

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
                <FinanceDashboardClient 
                    students={orgStudents} 
                    recentInvoices={recentInvoices} 
                    centres={orgCentres}
                    isOwner={userRole === 'ORG_OWNER'}
                />
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
