/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';
import FilterableInvoiceHistorySection from '@/features/finance/components/FilterableInvoiceHistorySection';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';

export default async function InvoicesListPage() {
    const session = await requireTenantSession();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    // Check role access - ORG_OWNER or MANAGER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard');
    }

    let hasZeroAccessibleCentres = false;
    let allInvoices: any[] = [];

    if (userRole !== 'ORG_OWNER') {
        const accessibleCentres = await getUserAccessibleCentres(session.user.id);
        const accessibleCentreIds = accessibleCentres.map(c => c.id).filter(isValidUuid);

        if (accessibleCentreIds.length === 0) {
            hasZeroAccessibleCentres = true;
        } else {
            allInvoices = await db.query.invoices.findMany({
                where: and(
                    eq(invoices.organisationId, session.user.organisationId),
                    inArray(invoices.centreId, accessibleCentreIds)
                ),
                orderBy: [desc(invoices.createdAt)],
                with: {
                    centre: true,
                    child: true,
                    parent: true,
                },
            });
        }
    } else {
        allInvoices = await db.query.invoices.findMany({
            where: eq(invoices.organisationId, session.user.organisationId),
            orderBy: [desc(invoices.createdAt)],
            with: {
                centre: true,
                child: true,
                parent: true,
            },
        });
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Link
                        href="/dashboard/finance"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-bold group mb-2"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Ledger
                    </Link>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Full Invoice History</h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        A complete record of all billing transactions
                    </p>
                </div>
            </div>

            {hasZeroAccessibleCentres ? (
                <EmptyState
                    icon={<Building2 className="w-8 h-8" />}
                    title="No centres assigned"
                    description="You are not currently assigned to any centres. Ask an organisation owner to grant centre access to view invoice history."
                />
            ) : (
                <FilterableInvoiceHistorySection
                    initialInvoices={allInvoices}
                    isOwner={userRole === 'ORG_OWNER'}
                />
            )}
        </div>
    );
}
