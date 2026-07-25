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
import FinanceDataGridClient from '@/features/finance/components/FinanceDataGridClient';
import FinanceDashboardFilters from '@/features/finance/components/FinanceDashboardFilters';
import { normalizeString } from '@/lib/search-params';
import BillingCyclesTab from '@/features/billing/components/BillingCyclesTab';
import { fetchBillingCycles } from '@/features/billing/queries';



export default async function FinancePage(props: {
    searchParams: Promise<{
        centre?: string;
        page?: string;
        status?: string;
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

    const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));

    // Fetch centres for the modal
    const orgCentresRaw = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId)
    });
    const orgCentres = serialize(orgCentresRaw);

    const validCentreIds = orgCentres.map((c: any) => c.id);
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

    const page = Number(searchParams.page) || 1;
    const pageSize = 50;
    const statusFilter = searchParams.status || 'all';

    let dbStatusFilter = undefined;
    if (statusFilter === 'paid') {
        dbStatusFilter = eq(invoices.status, 'paid');
    } else if (statusFilter === 'overdue') {
        dbStatusFilter = and(
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void'),
            lt(invoices.dueDate, new Date())
        );
    }

    const combinedFilter = and(
        eq(invoices.organisationId, session.user.organisationId),
        centreFilter,
        dbStatusFilter
    );

    const [countResult] = await db.select({ count: count() }).from(invoices).where(combinedFilter);
    const totalInvoices = Number(countResult?.count || 0);

    const paginatedInvoices = await db.query.invoices.findMany({
        where: combinedFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: [desc(invoices.createdAt)],
        with: {
            centre: true,
            child: true,
            parent: true,
            payments: true,
            lineItems: true
        }
    });

    const serializedInvoices = serialize(paginatedInvoices);

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    return (
        <div className="space-y-6 animate-in fade-in duration-700 max-w-full">
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
                        <FinanceDashboardFilters centres={serialize(orgCentres)} />
                    </Suspense>
                    <a
                        href={`/api/export/finance?from=${monthStart}&to=${todayStr}`}
                        download={`finance-${monthStart}-to-${todayStr}.csv`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-success/10 border border-success/20 text-success text-sm font-bold hover:bg-success/20 transition-all active:scale-95 duration-100"
                        title="Download finance CSV for current month"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </a>
                </div>
            </div>

            <FinanceDataGridClient 
                invoices={serialize(serializedInvoices)}
                totalCount={serialize(totalInvoices)}
                page={serialize(page)}
                pageSize={serialize(pageSize)}
                statusFilter={serialize(statusFilter)}
                centres={serialize(orgCentres)}
            />

            {/* Billing Cycles Section */}
            <div className="bg-card/80 backdrop-blur-md border border-border/60 shadow-sm rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom-4 duration-500 delay-150">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Billing Cycles
                    </h2>
                </div>
                <BillingCyclesTab
                    cycles={serialize(billingCycles)}
                    centreId={activeCentreId}
                />
            </div>
        </div>
    );
}
