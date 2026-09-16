/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import FilterableInvoiceHistorySection from '@/features/finance/components/FilterableInvoiceHistorySection';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default async function InvoicesListPage() {
    const session = await requireTenantSession();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    
    // Check role access - ORG_OWNER or MANAGER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard');
    }

    let whereCondition = eq(invoices.organisationId, session.user.organisationId);
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentres = await getUserAccessibleCentres(session.user.id);
        const accessibleCentreIds = accessibleCentres.map(c => c.id);
        whereCondition = and(
            eq(invoices.organisationId, session.user.organisationId),
            accessibleCentreIds.length > 0
                ? inArray(invoices.centreId, accessibleCentreIds)
                : eq(invoices.centreId, 'unauthorized_centre_id')
        )!;
    }

    // Fetch invoices for the organization
    const allInvoices = await db.query.invoices.findMany({
        where: whereCondition,
        orderBy: [desc(invoices.createdAt)],
        with: {
            centre: true,
            child: true,
            parent: true
        }
    });

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

            <FilterableInvoiceHistorySection
                initialInvoices={allInvoices}
                isOwner={userRole === 'ORG_OWNER'}
            />
        </div>
    );
}
