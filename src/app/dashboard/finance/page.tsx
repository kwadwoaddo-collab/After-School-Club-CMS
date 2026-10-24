import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc, and, count, ne, lt, inArray } from 'drizzle-orm';
import { Download, CreditCard, Receipt } from 'lucide-react';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { Suspense } from 'react';
import Link from 'next/link';
import FinanceDataGridClient from '@/features/finance/components/FinanceDataGridClient';
import type { FinanceInvoice } from '@/features/finance/components/FinanceDataGridClient';
import FinanceDashboardFilters from '@/features/finance/components/FinanceDashboardFilters';
import BillingCyclesTab from '@/features/billing/components/BillingCyclesTab';
import { fetchBillingCycles } from '@/features/billing/queries';
import { logger } from '@/lib/logger';
import { formerStudentOutstandingSql, activeStudentInvoiceSql, draftLifecycleReviewSql } from '@/features/finance/domain/former-balances';

type OrgCentre = Awaited<ReturnType<typeof getUserAccessibleCentres>>[number];

export default async function FinancePage(props: {
    searchParams: Promise<{
        centre?: string;
        page?: string;
        status?: string;
        view?: string;
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

    function serialize<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? Number(value) : value));
    }

    const page = Number(searchParams.page) || 1;
    const pageSize = 50;
    const statusFilter = searchParams.status || 'all';
    const formerBalancesView = searchParams.view === 'former';
    const invoiceHistoryView = searchParams.view === 'history';

    let orgCentres: OrgCentre[] = [];
    let activeCentreId = 'all';
    let totalInvoices = 0;
    let paginatedInvoices: FinanceInvoice[] = [];
    let hasFetchError = false;

    try {
        let orgCentresRaw: OrgCentre[] = [];
        try {
            orgCentresRaw = await getUserAccessibleCentres(session.user.id);
        } catch (e) {
            orgCentresRaw = [];
        }
        orgCentres = serialize(orgCentresRaw);

        const validCentreIds = orgCentres.map((c: { id: string }) => c.id);
        activeCentreId = await resolveActiveCentreId(searchParams.centre, validCentreIds);

        const centreFilter = activeCentreId !== 'all'
            ? eq(invoices.centreId, activeCentreId)
            : validCentreIds.length > 0
                ? inArray(invoices.centreId, validCentreIds)
                : eq(invoices.centreId, 'unauthorized_centre_id');

        const todayMidnightUtc = new Date();
        todayMidnightUtc.setUTCHours(0, 0, 0, 0);

        let dbStatusFilter = undefined;
        if (statusFilter === 'paid') {
            dbStatusFilter = eq(invoices.status, 'paid');
        } else if (statusFilter === 'draft') {
            dbStatusFilter = eq(invoices.status, 'draft');
        } else if (statusFilter === 'overdue') {
            dbStatusFilter = and(
                inArray(invoices.status, ['sent', 'partially_paid']),
                lt(invoices.dueDate, todayMidnightUtc)
            );
        }

        const combinedFilter = and(
            eq(invoices.organisationId, session.user.organisationId),
            centreFilter,
            dbStatusFilter,
            formerBalancesView ? formerStudentOutstandingSql() : invoiceHistoryView ? undefined : activeStudentInvoiceSql(),
        );

        const [countResult] = await db.select({ count: count() }).from(invoices).where(combinedFilter);
        totalInvoices = Number(countResult?.count || 0);

        paginatedInvoices = await db.query.invoices.findMany({
            where: combinedFilter,
            extras: { needsBillingReview: draftLifecycleReviewSql().as('needs_billing_review') },
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
        if (userRole !== 'ORG_OWNER') {
            const accessibleIds = orgCentres.map((c: { id: string }) => c.id);
            billingCycles = billingCycles.filter(c => accessibleIds.includes(c.config.centreId));
        }
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
                    <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{formerBalancesView ? 'Former / Paused Students Outstanding Balances' : invoiceHistoryView ? 'All Invoice History' : 'Active Finance Ledger'}</h1>
                    <p className="text-muted-foreground font-medium mt-1 text-sm sm:text-base">
                        {formerBalancesView ? 'Follow up issued unpaid invoices without reactivating student billing.' : 'Manage invoices, payments, and financial health'}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <nav aria-label="Finance views" className="flex flex-wrap gap-3 text-sm font-semibold">
                        <Link href="/dashboard/finance" aria-current={!formerBalancesView && !invoiceHistoryView ? 'page' : undefined} className="text-primary underline underline-offset-4">Active ledger</Link>
                        <Link href="/dashboard/finance?view=former" aria-current={formerBalancesView ? 'page' : undefined} className="text-primary underline underline-offset-4">Former / paused outstanding</Link>
                        <Link href="/dashboard/finance?view=history" aria-current={invoiceHistoryView ? 'page' : undefined} className="text-primary underline underline-offset-4">All invoice history</Link>
                    </nav>
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

            {formerBalancesView && <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                These are existing issued balances, including shared family invoices where a covered student has paused or stopped. Payments and receipts remain available. Pausing a student does not void a debt, create a credit or issue another invoice.
            </p>}
            {!formerBalancesView && !invoiceHistoryView && <p className="text-sm text-muted-foreground">
                Invoices for active students are shown here. A shared family invoice remains here while any covered child is active, and can also appear in former / paused outstanding balances. All original records remain in All invoice history.
            </p>}

            <nav aria-label="Finance workflow" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {!formerBalancesView && <a href="#family-billing-overview" className="font-semibold text-primary underline underline-offset-4">Family overview</a>}
                <a href="#invoice-list" className="font-semibold text-primary underline underline-offset-4">Invoice list</a>
                {!formerBalancesView && <Link href={`/dashboard/finance?${new URLSearchParams({...(activeCentreId !== 'all' ? {centre:activeCentreId} : {}),...(formerBalancesView ? {view:'former'} : invoiceHistoryView ? {view:'history'} : {}),status:'draft',page:'1'}).toString()}#invoice-list`} className="font-semibold text-primary underline underline-offset-4">Review drafts</Link>}
                <span className="text-muted-foreground">Open a draft, check its period and amount, then choose Issue Invoice.</span>
            </nav>

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
            {!formerBalancesView && <div id="family-billing-overview" className="scroll-mt-24 bg-card/80 backdrop-blur-md border border-border/60 shadow-sm rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom-4 duration-500 delay-150">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Family overview
                    </h2>
                </div>
                <BillingCyclesTab
                    cycles={serializedBillingCycles}
                    centreId={activeCentreId}
                />
            </div>}
        </div>
    );
}
