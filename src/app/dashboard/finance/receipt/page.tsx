/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/db';
import { eq, and, inArray } from 'drizzle-orm';
import { centres, children } from '@/db/schema';
import { getUserAccessibleCentres, getVisibleChildIds } from '@/lib/permissions';
import ReceiptGeneratorClient from '@/features/finance/components/ReceiptGeneratorClient';

export default async function ReceiptPage() {
    const session = await requireTenantSession();

    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

    // Check role access - ORG_OWNER or MANAGER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard');
    }

    // Fetch accessible centres
    const orgCentres = await getUserAccessibleCentres(session.user.id);

    // Fetch children with parent records for the selection dropdown (scoped to accessible centres)
    const visibleChildIds = await getVisibleChildIds(session.user.id, orgId);
    const childrenWhere = visibleChildIds === null
        ? eq(children.organisationId, orgId)
        : and(
            eq(children.organisationId, orgId),
            visibleChildIds.length > 0
                ? inArray(children.id, visibleChildIds)
                : eq(children.id, 'unauthorized_child_id')
        );

    const allChildren = await db.query.children.findMany({
        where: childrenWhere,
        with: {
            parent: true,
        },
        orderBy: (children, { asc }) => [asc(children.firstName)],
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-center gap-4 no-print">
                <Link
                    href="/dashboard/finance"
                    className="p-2 hover:bg-secondary rounded-2xl transition-all text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        Cash Receipt Generator
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Create, print, and download quick cash receipts for parents
                    </p>
                </div>
            </div>

            {/* Main Interactive Work Area */}
            <div className="bg-secondary border border-border/40 rounded-[32px] p-6 sm:p-8 shadow-2xl relative">
                <ReceiptGeneratorClient 
                    organisation={{
                        id: orgId,
                        name: session.user.name || 'AfterSchool Club',
                        slug: '',
                    }}
                    centres={orgCentres}
                    // eslint-disable-next-line react/no-children-prop
                    children={allChildren}
                />
            </div>
        </div>
    );
}
