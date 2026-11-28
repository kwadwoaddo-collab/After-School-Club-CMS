/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { db } from '@/db';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { billingConfigs, children, organisations, payments } from '@/db/schema';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentres, getVisibleChildIds } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';
import ReceiptGeneratorClient from '@/features/finance/components/ReceiptGeneratorClient';
import { EmptyState } from '@/components/ui/EmptyState';
import { stableReceiptNumber } from '@/lib/finance/receipt-number';
import { normaliseServiceType, type ServiceType } from '@/features/finance/service-type';

export default async function ReceiptPage(props: { searchParams?: Promise<{ paymentId?: string; centre?: string; childId?: string }> } = {}) {
    const searchParams = (await props.searchParams) ?? {};
    const session = await requireTenantSession();

    if (!session?.user) return redirect('/login');
    const orgId = (session.user as any).organisationId;
    if (!orgId) return redirect('/onboarding');

    // Check role access - ORG_OWNER or MANAGER
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return redirect('/dashboard');
    }

    // Fetch accessible centres first so non-owner staff with 0 centres short-circuit cleanly
    const orgCentres = (await getUserAccessibleCentres(session.user.id)) ?? [];
    const accessibleCentreIds = orgCentres
        .map((c: { id: string }) => c.id)
        .filter(isValidUuid);
    const activeCentreId = accessibleCentreIds.length > 0
        ? await resolveActiveCentreId(searchParams.centre, accessibleCentreIds)
        : 'all';
    const backHref = isValidUuid(activeCentreId)
        ? `/dashboard/finance?${new URLSearchParams({ centre: activeCentreId })}`
        : '/dashboard/finance';

    if (userRole !== 'ORG_OWNER' && accessibleCentreIds.length === 0) {
        return (
            <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex items-center gap-4 no-print">
                    <Link
                        href="/dashboard/finance"
                        aria-label="Back to finance"
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 hover:bg-secondary rounded-2xl transition-all text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">
                            Parent Payment Receipt
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Create, print, and download quick cash receipts for parents
                        </p>
                    </div>
                </div>
                <EmptyState
                    icon={<Building2 className="w-8 h-8" />}
                    title="No centres assigned"
                    description="You are not currently assigned to any centres. Ask an organisation owner to grant centre access before generating cash receipts."
                />
            </div>
        );
    }

    const validPaymentId = isValidUuid(searchParams.paymentId)
        ? searchParams.paymentId
        : undefined;
    const preselectedChildId = isValidUuid(searchParams.childId)
        ? searchParams.childId
        : undefined;

    const [orgRecord, allChildren, paymentRecord] = await Promise.all([
        db.query.organisations.findFirst({
            where: eq(organisations.id, orgId),
            columns: { id: true, name: true, slug: true },
        }),
        (async () => {
            const visibleChildIds = await getVisibleChildIds(session.user.id, orgId);
            const validVisibleChildIds = visibleChildIds === null
                ? null
                : visibleChildIds.filter(isValidUuid);

            if (validVisibleChildIds !== null && validVisibleChildIds.length === 0) {
                return [];
            }

            const rawChildren = await db.query.children.findMany({
                where: validVisibleChildIds === null
                    ? and(eq(children.organisationId, orgId), isNull(children.deletedAt))
                    : and(
                        eq(children.organisationId, orgId),
                        isNull(children.deletedAt),
                        inArray(children.id, validVisibleChildIds)
                    ),
                with: {
                    parent: true,
                },
                orderBy: (children, { asc }) => [asc(children.firstName)],
            });

            if (!rawChildren || rawChildren.length === 0) {
                return [];
            }

            const familyConfigs = (await db.query.billingConfigs?.findMany?.({
                where: eq(billingConfigs.organisationId, orgId),
                columns: { parentId: true, centreId: true, serviceType: true },
            })) ?? [];

            const configServiceMap = new Map<string, ServiceType>();
            for (const cfg of familyConfigs) {
                const resolved = normaliseServiceType(cfg.serviceType);
                configServiceMap.set(`${cfg.parentId}:${cfg.centreId}`, resolved);
                if (!configServiceMap.has(`${cfg.parentId}:*`)) {
                    configServiceMap.set(`${cfg.parentId}:*`, resolved);
                }
            }

            return rawChildren.map((child) => ({
                ...child,
                serviceType:
                    configServiceMap.get(`${child.parentId}:${child.centreId}`) ??
                    configServiceMap.get(`${child.parentId}:*`) ??
                    'childcare',
            }));
        })(),
        validPaymentId
            ? db.query.payments.findFirst({
                where: eq(payments.id, validPaymentId),
                with: {
                    invoice: {
                        with: {
                            parent: true,
                            child: true,
                            centre: true,
                        },
                    },
                },
            })
            : Promise.resolve(null),
    ]);

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
        serviceType?: ServiceType;
    } | null = null;

    if (validPaymentId) {

        const inv = paymentRecord?.invoice;
        const canAccessPaymentInvoice = Boolean(
            inv &&
            inv.organisationId === orgId &&
            (userRole === 'ORG_OWNER' || (inv.centreId !== null && accessibleCentreIds.includes(inv.centreId)))
        );

        if (paymentRecord && inv && canAccessPaymentInvoice) {
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
                serviceType: normaliseServiceType(inv.serviceType),
            };
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-center gap-4 no-print">
                <Link
                    href={backHref}
                    aria-label="Back to finance"
                    className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 hover:bg-secondary rounded-2xl transition-all text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        Parent Payment Receipt
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">
                        Create, print, and download quick cash receipts for parents
                    </p>
                </div>
            </div>

            {/* Main Interactive Work Area */}
            <div className="bg-secondary/40 border border-border rounded-2xl p-6 sm:p-8 shadow-sm relative">
                <ReceiptGeneratorClient
                    organisation={{
                        id: orgId,
                        name: orgRecord?.name || 'After-School Club',
                        slug: orgRecord?.slug || '',
                    }}
                    centres={orgCentres}
                    // eslint-disable-next-line react/no-children-prop
                    children={allChildren}
                    paymentId={validPaymentId}
                    stableReceiptNo={validPaymentId ? stableReceiptNumber(validPaymentId) : undefined}
                    initialPayment={initialPayment}
                    initialCentreId={isValidUuid(activeCentreId) ? activeCentreId : undefined}
                    initialChildId={preselectedChildId}
                />
            </div>
        </div>
    );
}
