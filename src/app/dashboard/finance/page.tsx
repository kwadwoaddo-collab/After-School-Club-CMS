import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices, centres } from '@/db/schema';
import { eq, desc, and, count, ne, lt } from 'drizzle-orm';
import { Download, CreditCard, Receipt } from 'lucide-react';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { Suspense } from 'react';
import Link from 'next/link';
import FinanceDataGridClient from '@/features/finance/components/FinanceDataGridClient';
import FinanceDashboardFilters from '@/features/finance/components/FinanceDashboardFilters';
import BillingCyclesTab from '@/features/billing/components/BillingCyclesTab';
import { fetchBillingCycles } from '@/features/billing/queries';
import { logger } from '@/lib/logger';

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
    const userRole = session.user.role;
    if (userRole !== 'ORG_OWNER') {
        return redirect('/dashboard');
    }

    const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? Number(value) : value));

    const page = Number(searchParams.page) || 1;
    const pageSize = 50;
    const statusFilter = searchParams.status || 'all';

    let orgCentres: any[] = [];
    let activeCentreId = 'all';
    let totalInvoices = 0;
    let paginatedInvoices: any[] = [];
    let hasFetchError = false;

    try {
        let orgCentresRaw: any[] = [];
        try {
            orgCentresRaw = await db.query.centres.findMany({
                where: eq(centres.organisationId, session.user.organisationId)
            });
        } catch (e) {
            orgCentresRaw = [];
        }
        orgCentres = serialize(orgCentresRaw);

        const validCentreIds = orgCentres.map((c: { id: string }) => c.id);
        activeCentreId = await resolveActiveCentreId(searchParams.centre, validCentreIds);

        const centreFilter = activeCentreId !== 'all' ? eq(invoices.centreId, activeCentreId) : undefined;

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
        totalInvoices = Number(countResult?.count || 0);

        paginatedInvoices = await db.query.invoices.findMany({
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
    } catch (err) {
        logger.error('[finance] fetchInvoices failed:', err);
        hasFetchError = true;
    }

    const serializedInvoices = serialize(paginatedInvoices);

    // Fetch billing cycles for the Billing Cycles tab — wrapped in try-catch for resilience
    let billingCycles: import('@/features/billing/queries').BillingCycleRow[] = [];
    try {
        billingCycles = await fetchBillingCycles(session.user.organisationId, activeCentreId);
    } catch (err) {
        logger.error('[finance] fetchBillingCycles failed:', err);
    }
    const serializedBillingCycles = serialize(billingCycles);

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Finance Ledger</h1>
                    <p className="text-muted-foreground font-medium mt-1 text-sm sm:text-base">
                        Manage invoices, payments, and financial health
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <Suspense fallback={<div className="w-[180px] h-[44px] bg-secondary/60 rounded-2xl animate-pulse" />}>
                        <FinanceDashboardFilters centres={orgCentres} />
                    </Suspense>
                    <Link
                        href="/dashboard/finance/receipt"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 shadow-sm transition-all active:scale-95 duration-150"
                    >
                        <Receipt className="w-4 h-4" />
                        Receipts
                    </Link>
                    <a
                        href={`/api/export/finance?from=${monthStart}&to=${todayStr}`}
                        download={`finance-${monthStart}-to-${todayStr}.csv`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 shadow-sm transition-all active:scale-95 duration-150"
                        title="Download finance CSV for current month"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </a>
                </div>
            </div>

            {hasFetchError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-6 py-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <p className="text-sm font-semibold">Unable to load finance data — please refresh</p>
                </div>
            )}

            {/* Main Finance Data Grid & KPI Summary */}
            <Suspense fallback={<div className="h-[400px] bg-secondary/20 rounded-3xl animate-pulse border border-border/60" />}>
                <FinanceDataGridClient 
                    invoices={serializedInvoices}
                    totalCount={totalInvoices}
                    page={page}
                    pageSize={pageSize}
                    statusFilter={statusFilter}
                    centres={orgCentres}
                />
            </Suspense>

            {/* Billing Cycles Section */}
            <div className="bg-card/80 backdrop-blur-md border border-border/60 shadow-sm rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom-4 duration-500 delay-150">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Billing Cycles
                    </h2>
                </div>
                <BillingCyclesTab
                    cycles={serializedBillingCycles as any}
                    centreId={activeCentreId}
                />
            </div>
        </div>
    );
}
