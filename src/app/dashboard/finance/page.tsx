import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc, and, count, lt, inArray } from 'drizzle-orm';
import { Download, CreditCard } from 'lucide-react';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { Suspense } from 'react';
import Link from 'next/link';
import FinanceDataGridClient from '@/features/finance/components/FinanceDataGridClient';
import type { FinanceInvoice } from '@/features/finance/components/FinanceDataGridClient';
import FinanceWorkspace from '@/features/finance/components/FinanceWorkspace';
import { isFinanceWorkspaceView, type WorkspaceInvoice } from '@/features/finance/domain/finance-workspace';
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
        family?: string;
        task?: string;
        create?: string;
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
    const familyView = searchParams.view === 'families';
    const workspaceView = isFinanceWorkspaceView(searchParams);
    let workspaceInvoices: WorkspaceInvoice[] = [];

    let orgCentres: OrgCentre[] = [];
    let activeCentreId = 'all';
    let totalInvoices = 0;
    let paginatedInvoices: FinanceInvoice[] = [];
    let hasFetchError = false;

    try {
        let orgCentresRaw: OrgCentre[] = [];
        try {
            orgCentresRaw = await getUserAccessibleCentres(session.user.id);
        } catch (error) {
            throw error;
        }
        orgCentres = serialize(orgCentresRaw);

        const validCentreIds = orgCentres.map((c: { id: string }) => c.id);
        activeCentreId = await resolveActiveCentreId(searchParams.centre, validCentreIds);

        const centreFilter = activeCentreId !== 'all'
            ? eq(invoices.centreId, activeCentreId)
            : validCentreIds.length > 0
                ? inArray(invoices.centreId, validCentreIds)
                : inArray(invoices.centreId, []);

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

        if (workspaceView) {
            // Read-only action projection: lifecycle-independent so paused/stopped and legacy debts remain visible.
            // Fetch a thin full-centre set before deriving counts; pagination never changes queue totals.
            workspaceInvoices = await db.query.invoices.findMany({
                where: and(eq(invoices.organisationId, session.user.organisationId), centreFilter),
                columns: { id:true, invoiceNumber:true, organisationId:true, centreId:true, parentId:true, childId:true, billingConfigId:true, amount:true, status:true, invoiceDate:true, dueDate:true, billingPeriodStart:true, billingPeriodEnd:true, createdAt:true, coveredChildrenJson:true },
                extras: { needsBillingReview: draftLifecycleReviewSql().as('needs_billing_review') },
                with: {
                    centre: { columns: { id:true, name:true } },
                    child: { columns: { id:true, firstName:true, lastName:true } },
                    parent: { columns: { id:true, firstName:true, lastName:true } },
                    payments: { columns: { id:true, amount:true, status:true, reversedAt:true, recordedAt:true } },
                },
            });
        } else if (!familyView) {
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
        }
    } catch (err) {
        logger.error('[finance] fetchInvoices failed:', err);
        hasFetchError = true;
    }

    const serializedInvoices = serialize(paginatedInvoices);

    // Fetch billing cycles for the Billing Cycles tab — wrapped in try-catch for resilience
    let cycleFetchError = false;
    let billingCycles: import('@/features/billing/queries').BillingCycleRow[] = [];
    try {
        billingCycles = await fetchBillingCycles(session.user.organisationId, activeCentreId);
        {
            const accessibleIds = orgCentres.map((c: { id: string }) => c.id);
            billingCycles = billingCycles.filter(c => accessibleIds.includes(c.config.centreId));
        }
    } catch (err) {
        logger.error('[finance] fetchBillingCycles failed:', err);
        cycleFetchError = true;
    }
    const serializedBillingCycles = serialize(billingCycles);

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-foreground tracking-tight">{formerBalancesView ? 'Former / Paused Students Outstanding Balances' : invoiceHistoryView ? 'All Invoice History' : familyView ? 'Family accounts' : 'Finance'}</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {formerBalancesView ? 'Follow up issued unpaid invoices without reactivating student billing.' : 'Review invoices and record money received.'}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <nav aria-label="Finance views" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        {!workspaceView && <Link href={`/dashboard/finance?${new URLSearchParams({...(activeCentreId !== 'all' ? {centre:activeCentreId} : {})})}`} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">Daily tasks</Link>}
                        {[['history', 'All invoices'], ['families', 'Family accounts']].map(([view,label]) => <Link key={view} href={`/dashboard/finance?${new URLSearchParams({ ...(activeCentreId !== 'all' ? {centre:activeCentreId} : {}), view })}`} aria-current={searchParams.view === view ? 'page' : undefined} className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">{label}</Link>)}
                        <Link href="/dashboard/finance/receipt" className="inline-flex min-h-10 items-center font-medium text-primary hover:underline">Receipts</Link>
                        <details className="relative"><summary className="flex min-h-10 cursor-pointer items-center text-muted-foreground">More</summary><div className="absolute right-0 top-10 z-20 w-64 rounded-lg border border-border bg-card p-3 shadow-lg"><Link href={`/dashboard/finance?${new URLSearchParams({ ...(activeCentreId !== 'all' ? {centre:activeCentreId} : {}), view:'former' })}`} className="block py-2 text-primary hover:underline">Paused / stopped balances</Link></div></details>
                    </nav>
                    <Suspense fallback={<div className="w-[180px] h-[44px] bg-secondary/60 rounded-2xl animate-pulse" />}>
                        <FinanceDashboardFilters centres={orgCentres} />
                    </Suspense>
                    {!workspaceView && <a
                        href={`/api/export/finance?from=${monthStart}&to=${todayStr}`}
                        download={`finance-${monthStart}-to-${todayStr}.csv`}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 shadow-sm transition-all active:scale-95 duration-150"
                        title="Download finance CSV for current month"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </a>}
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
            {workspaceView && <FinanceWorkspace key={activeCentreId} invoices={serialize(workspaceInvoices)} cycles={serializedBillingCycles} today={new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())} invoiceError={hasFetchError} cycleError={cycleFetchError}/>}

            {/* Main Finance Data Grid & KPI Summary */}
            {!workspaceView && !familyView && <Suspense fallback={<div className="h-[400px] bg-secondary/20 rounded-3xl animate-pulse border border-border/60" />}>
                <FinanceDataGridClient 
                    invoices={serializedInvoices}
                    totalCount={totalInvoices}
                    page={page}
                    pageSize={pageSize}
                    statusFilter={statusFilter}
                    centres={orgCentres}
                />
            </Suspense>}

            {/* Billing Cycles Section */}
            {familyView && <div id="family-billing-overview" className="scroll-mt-24 bg-card/80 backdrop-blur-md border border-border/60 shadow-sm rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom-4 duration-500 delay-150">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Family accounts
                    </h2>
                </div>
                <Link className="mb-4 inline-block text-sm text-primary underline" href={`/dashboard/finance?${new URLSearchParams({...(activeCentreId !== 'all' ? {centre:activeCentreId} : {})})}`}>Back to daily tasks</Link>
                {cycleFetchError ? <p role="alert" className="text-sm text-destructive">Couldn’t load billing schedules. Refresh to try again.</p> : <BillingCyclesTab
                    cycles={searchParams.family ? serializedBillingCycles.filter(cycle => cycle.config.parentId === searchParams.family) : serializedBillingCycles}
                    centreId={activeCentreId}
                />}
            </div>}
        </div>
    );
}
