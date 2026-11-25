/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { parents, children, invoices, billingConfigs } from '@/db/schema';
import { eq, desc, and, inArray, isNull, sql } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { isValidUuid } from '@/lib/uuid';
import { confirmedEnrolmentChildSql, currentLifecycleStatusChildSql } from '@/lib/enrolment/finance-eligibility';
import type { ParentBillingGroup } from '@/features/billing/components/ParentBillingSection';
import ParentProfileClient from './ParentProfileClient';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import DeleteParentButton from '@/features/parents/components/DeleteParentButton';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buildFamilyActivity } from '@/features/parents/domain/family-activity';
import { getFamilyActivityRecords } from '@/features/parents/family-activity-query';
import { FamilyActivityHistory } from '@/features/parents/components/FamilyActivityHistory';
import { logger } from '@/lib/logger';

interface ParentPageProps {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{billing?: string}>;
}

export default async function ParentProfilePage({ params, searchParams }: ParentPageProps) {
    const { id } = await params;
    const openBilling = (await searchParams)?.billing === 'setup';
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    const organisationId = (session.user as any).organisationId;
    const userRole = (session.user as any).role as string | undefined;

    if (!isValidUuid(id)) return notFound();

    const fetchParent = () =>
        db.query.parents.findFirst({
            where: and(
                eq(parents.id, id),
                eq(parents.organisationId, organisationId),
                isNull(parents.deletedAt)
            ),
            with: {
                children: {
                    where: (c, { isNull: isN }) => isN(c.deletedAt),
                    with: {
                        centre: true,
                    },
                },
            },
        });

    // Stage 1: Resolve accessible centres & primary parent record (preserving zero-centre short-circuit for non-owners)
    let rawAccessibleCentres: Awaited<ReturnType<typeof getUserAccessibleCentres>>;
    let parent: Awaited<ReturnType<typeof fetchParent>>;

    if (userRole === 'ORG_OWNER') {
        [rawAccessibleCentres, parent] = await Promise.all([
            getUserAccessibleCentres(session.user.id),
            fetchParent(),
        ]);
    } else {
        rawAccessibleCentres = await getUserAccessibleCentres(session.user.id);
        const nonOwnerCentres = (rawAccessibleCentres ?? []).filter((c: { id: string }) => isValidUuid(c?.id));
        if (nonOwnerCentres.length === 0) {
            return notFound();
        }
        parent = await fetchParent();
    }

    const accessibleCentres = (rawAccessibleCentres ?? []).filter((c: { id: string }) => isValidUuid(c?.id));
    const accessibleCentreIds = accessibleCentres.map(c => c.id);

    if (!parent || (parent as any).deletedAt) return notFound();

    const activeChildren = (parent.children ?? []).filter(c => !c.deletedAt && c.organisationId === organisationId);

    if (
        userRole !== 'ORG_OWNER' &&
        activeChildren.length > 0 &&
        !activeChildren.some(c => !c.centreId || accessibleCentreIds.includes(c.centreId))
    ) {
        return notFound();
    }

    const visibleChildren = userRole === 'ORG_OWNER'
        ? activeChildren
        : activeChildren.filter(c => !c.centreId || accessibleCentreIds.includes(c.centreId));

    const canManageBilling = ['ORG_OWNER', 'MANAGER'].includes(userRole ?? '');
    const activeFamilyChildIds = visibleChildren.map(c => c.id).filter(isValidUuid);

    const fetchChildStatusMap = async (): Promise<Map<string, { confirmedEnrolment: boolean; lifecycleStatus: string }> | null> => {
        if (!canManageBilling || activeFamilyChildIds.length === 0) return null;
        try {
            const statusRows = await db.select({
                id: children.id,
                confirmedEnrolment: sql<boolean>`CASE WHEN ${confirmedEnrolmentChildSql()} THEN true ELSE false END`,
                lifecycleStatus: currentLifecycleStatusChildSql(),
            })
                .from(children)
                .where(and(
                    inArray(children.id, activeFamilyChildIds),
                    eq(children.organisationId, organisationId),
                    isNull(children.deletedAt),
                ));
            return new Map(statusRows.map(r => [r.id, { confirmedEnrolment: Boolean(r.confirmedEnrolment), lifecycleStatus: r.lifecycleStatus || 'active' }]));
        } catch {
            try {
                const fallbackRows = await db.select({
                    id: children.id,
                    confirmedEnrolment: sql<boolean>`CASE WHEN ${confirmedEnrolmentChildSql()} THEN true ELSE false END`,
                })
                    .from(children)
                    .where(and(
                        inArray(children.id, activeFamilyChildIds),
                        eq(children.organisationId, organisationId),
                        isNull(children.deletedAt),
                    ));
                return new Map(fallbackRows.map(r => [r.id, { confirmedEnrolment: Boolean(r.confirmedEnrolment), lifecycleStatus: 'active' }]));
            } catch (err) {
                logger.error('[parent] Confirmed enrolment lookup failed:', err);
                return null;
            }
        }
    };

    // Stage 2: Fetch child enrolment status, billing plans, and family invoices concurrently
    const [childStatusMap, plans, familyInvoices] = await Promise.all([
        fetchChildStatusMap(),
        canManageBilling && accessibleCentreIds.length > 0
            ? db.query.billingConfigs.findMany({
                  where: and(
                      eq(billingConfigs.parentId, id),
                      eq(billingConfigs.organisationId, organisationId),
                      inArray(billingConfigs.centreId, accessibleCentreIds)
                  ),
                  with: { children: { with: { child: true } } },
              })
            : Promise.resolve([]),
        db.query.invoices.findMany({
            where: and(
                eq(invoices.parentId, id),
                eq(invoices.organisationId, organisationId)
            ),
            orderBy: [desc(invoices.createdAt)],
            with: {
                payments: true,
                centre: true,
                child: true,
            },
        }),
    ]);

    const billingGroups: ParentBillingGroup[] = canManageBilling ? accessibleCentres.map(centre => {
        const siblings = visibleChildren
            .filter(c => c.centreId === centre.id)
            .map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, ...(childStatusMap?.has(c.id) ? childStatusMap.get(c.id) : {}) }));
        const config = plans.find(p => p.centreId === centre.id);
        return {
            centreId: centre.id,
            centreName: centre.name,
            siblings,
            config: config ? {
                id: config.id,
                parentId: config.parentId,
                centreId: config.centreId,
                agreedMonthlyPence: config.agreedMonthlyPence,
                billingAnchorDate: config.billingAnchorDate,
                billingEndDate: config.billingEndDate ?? null,
                invoiceLeadDays: config.invoiceLeadDays,
                paymentDayOfMonth: config.paymentDayOfMonth,
                leadTimeUnit: config.leadTimeUnit,
                leadTimeValue: config.leadTimeValue,
                status: config.status,
                notes: config.notes,
                serviceType: config.serviceType === 'tuition' ? 'tuition' as const : 'childcare' as const,
                coveredChildren: config.children
                    .filter(c => c.child && !c.child.deletedAt && c.child.organisationId === organisationId && c.child.parentId === id && c.child.centreId === centre.id)
                    .map(c => ({ childId: c.child.id, childName: c.child.firstName + ' ' + c.child.lastName })),
            } : null,
        };
    }).filter(g => g.siblings.length || g.config) : [];

    // Supplemental read-only history must not hide the existing ledger on failure.
    let activityRecords: Awaited<ReturnType<typeof getFamilyActivityRecords>> = { bookings: [], registrations: [], lifecycle: [], contacts: [], audit: [] };
    let activityUnavailable = false;
    try {
        activityRecords = await getFamilyActivityRecords(organisationId, id, activeFamilyChildIds, familyInvoices.map(invoice => invoice.id).filter(isValidUuid));
    } catch (error) {
        activityUnavailable = true;
        logger.error('[parent] Supplemental family activity unavailable', error);
    }
    const activity = buildFamilyActivity({ children: visibleChildren, invoices: familyInvoices, ...activityRecords });

    // Calculate Ledger Stats
    const billableInvoices = familyInvoices.filter(inv => inv.status !== 'void' && inv.status !== 'draft');
    const totalOwed = billableInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalPaid = billableInvoices.reduce((sum, inv) => {
        const paid = inv.payments
            ?.filter(p => p.status === 'verified')
            ?.reduce((s, p) => s + Number(p.amount), 0) || 0;
        return sum + paid;
    }, 0);
    const outstanding = Math.max(0, totalOwed - totalPaid);

    const fullName = `${parent.firstName} ${parent.lastName}`;
    const initials = `${(parent.firstName || '')[0] ?? ''}${(parent.lastName || '')[0] ?? ''}`.toUpperCase();
    const childCount = visibleChildren.length;

    return (
        <div className="max-w-4xl mx-auto space-y-5">

            {/* ── Navigation bar ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/parents"
                    className="group inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to parents
                </Link>
                <DeleteParentButton
                    parentId={parent.id}
                    parentName={fullName}
                    childCount={childCount}
                    variant="button"
                />
            </div>

            {/* ── Header card ─────────────────────────────────────────────── */}
            <Card>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                        <span className="text-page-title select-none">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-page-title text-text truncate">{fullName}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge>
                                {childCount} {childCount === 1 ? 'child' : 'children'}
                            </Badge>
                            <span className="text-metadata">Family account &amp; ledger</span>
                        </div>
                    </div>

                    {/* Key metrics */}
                    <div className="flex sm:flex-col gap-2 sm:min-w-[150px]">
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata">Balance</span>
                            <span className={outstanding > 0 ? 'text-small-body font-semibold text-danger' : 'text-small-body font-semibold text-text'}>
                                £{outstanding.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata">Total invoiced</span>
                            <span className="text-small-body font-semibold text-text">£{totalOwed.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </Card>

            <FamilyActivityHistory events={activity} unavailable={activityUnavailable} />

            {/* ── Tabs & tab content ──────────────────────────────────────── */}
            <ParentProfileClient
                parent={{ ...parent, children: visibleChildren }}
                billingGroups={billingGroups}
                canManageBilling={canManageBilling}
                orgId={organisationId}
                openBilling={openBilling}
                invoices={familyInvoices}
                stats={{
                    totalOwed,
                    totalPaid,
                    outstanding
                }}
                isOwner={userRole === 'ORG_OWNER'}
                userRole={userRole}
            />
        </div>
    );
}
