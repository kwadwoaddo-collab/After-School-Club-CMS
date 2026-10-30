/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/db';
import { eq, and, inArray } from 'drizzle-orm';
import { children, organisations, payments } from '@/db/schema';
import { getUserAccessibleCentres, getVisibleChildIds } from '@/lib/permissions';
import ReceiptGeneratorClient from '@/features/finance/components/ReceiptGeneratorClient';
import { stableReceiptNumber } from '@/lib/finance/receipt-number';

export default async function ReceiptPage(props: { searchParams: Promise<{ paymentId?: string }> }) {
    const searchParams = await props.searchParams;
    const session = await requireTenantSession();

    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

    // Check role access - ORG_OWNER or MANAGER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard');
    }

    // Fetch real organisation record so receipt headers never fall back to the logged-in user's personal name
    const orgRecord = await db.query.organisations.findFirst({
        where: eq(organisations.id, orgId),
        columns: { id: true, name: true, slug: true },
    });

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

    let initialPayment: {
        id: string;
        amount: string;
        method: string;
        recordedAt: string;
        receiptNo: string;
        parentId?: string | null;
        parentName?: string | null;
        childId?: string | null;
        studentName?: string | null;
        centreId?: string | null;
        centreName?: string | null;
        invoiceNumber?: string | null;
        description?: string | null;
    } | null = null;

    if (searchParams.paymentId) {
        const paymentRecord = await db.query.payments.findFirst({
            where: eq(payments.id, searchParams.paymentId),
            with: {
                invoice: {
                    with: {
                        parent: true,
                        child: true,
                        centre: true,
                    },
                },
            },
        });

        if (paymentRecord?.invoice && paymentRecord.invoice.organisationId === orgId) {
            const inv = paymentRecord.invoice;
            const recordedDateStr = paymentRecord.recordedAt
                ? new Date(paymentRecord.recordedAt).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
            initialPayment = {
                id: paymentRecord.id,
                amount: Number(paymentRecord.amount || 0).toFixed(2),
                method: paymentRecord.method,
                recordedAt: recordedDateStr,
                receiptNo: stableReceiptNumber(paymentRecord.id),
                parentId: inv.parentId,
                parentName: inv.parent ? `${inv.parent.firstName} ${inv.parent.lastName}`.trim() : null,
                childId: inv.childId,
                studentName: inv.child ? `${inv.child.firstName} ${inv.child.lastName}`.trim() : null,
                centreId: inv.centreId,
                centreName: inv.centre?.name || null,
                invoiceNumber: inv.invoiceNumber,
                description: `Payment for Invoice ${inv.invoiceNumber}`,
            };
        }
    }

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
                        name: orgRecord?.name || 'After-School Club',
                        slug: orgRecord?.slug || '',
                    }}
                    centres={orgCentres}
                    // eslint-disable-next-line react/no-children-prop
                    children={allChildren}
                    paymentId={searchParams.paymentId}
                    stableReceiptNo={searchParams.paymentId ? stableReceiptNumber(searchParams.paymentId) : undefined}
                    initialPayment={initialPayment}
                />
            </div>
        </div>
    );
}
