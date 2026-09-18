'use server';
/**
 * Billing queries — pure read-only DB access.
 * NOT a  file — safe to call directly from server components.
 */

import { db } from '@/db';
import { billingConfigs, billingConfigChildren, billingRuns, billingCycleSkips, invoices, parents, children, centres } from '@/db/schema';
import { eq, and, desc, ne, inArray, lt, gte, isNull, sql, type Column } from 'drizzle-orm';
import { computeNextBillingPeriod, penceToPounds } from '@/lib/billing';
import { computeBillingSchedule, LeadTimeUnit } from '@/lib/billing/date-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoveredChild {
    childId:   string;
    childName: string;
}

export interface BillingCycleRow {
    config: {
        id:                 string;
        parentId:           string;
        centreId:           string;
        agreedMonthlyPence: number;
        billingAnchorDate:  string;  // 'YYYY-MM-DD'
        invoiceLeadDays:    number;
        paymentDayOfMonth?: number | null;
        leadTimeUnit?:      LeadTimeUnit | null;
        leadTimeValue?:     number | null;
        status:             'active' | 'paused' | 'cancelled';
        notes:              string | null;
    };
    familyName:     string;
    parentEmail:    string;
    centreName:     string;
    coveredChildren: CoveredChild[];
    amountDisplay:  string;
    periodLabel:    string;
    nextInvoiceDateStr: string | null;  // ISO string
    dueDateStr:         string | null;
    lastRunAt:          string | null;
    lastRunPeriodStart: string | null;
    cycleStatus:    'ready' | 'needs_setup' | 'invoice_sent' | 'paused' | 'skipped';
    currentPeriodStart?: string | null;
}

// ─── Fetch all billing cycles for the finance dashboard ───────────────────────

export async function fetchBillingCycles(
    orgId: string,
    centreId: string,
): Promise<BillingCycleRow[]> {
    const whereClause = centreId !== 'all'
        ? and(
            eq(billingConfigs.organisationId, orgId),
            eq(billingConfigs.centreId,        centreId),
            eq(billingConfigs.status,          'active'),
        )
        : and(
            eq(billingConfigs.organisationId, orgId),
            eq(billingConfigs.status,         'active'),
        );

    const rawConfigs = await db.query.billingConfigs.findMany({
        where: whereClause,
        with: {
            children: {
                with: {
                    child: { columns: { id: true, firstName: true, lastName: true } },
                },
            },
            runs: {
                orderBy: [desc(billingRuns.runAt)],
                limit: 1,
            },
            skips: {
                orderBy: [desc(billingCycleSkips.skippedAt)],
                limit: 1,
            },
            parent: { columns: { firstName: true, lastName: true, email: true, deletedAt: true } },
            centre: { columns: { name: true } },
        },
    });

    // Filter out configs linked to soft-deleted parents
    const configs = rawConfigs.filter(c => !c.parent?.deletedAt);

    const enriched = await Promise.all(configs.map(async (config) => {
        const parent = config.parent;
        const centre = config.centre;

        // Compute next period (all dates as strings for serialisability)
        let periodLabel        = '';
        let nextInvoiceDateStr = null as string | null;
        let dueDateStr         = null as string | null;
        let currentPeriodStr   = '';

        try {
            const anchorDate = new Date((config.billingAnchorDate as unknown as string) + 'T00:00:00Z');
            const schedule = computeBillingSchedule({
                id: config.id,
                billingAnchorDate: anchorDate,
                invoiceLeadDays: config.invoiceLeadDays ?? 7,
                paymentDayOfMonth: config.paymentDayOfMonth,
                leadTimeUnit: config.leadTimeUnit,
                leadTimeValue: config.leadTimeValue,
            });
            periodLabel        = schedule.periodLabel;
            nextInvoiceDateStr = schedule.draftCreationDate.toISOString();
            dueDateStr         = schedule.dueDate.toISOString();
            currentPeriodStr   = schedule.periodStart.toISOString().split('T')[0];
        } catch { /* malformed config */ }

        const lastRun = config.runs?.[0] ?? null;
        const lastSkip = config.skips?.[0] ?? null;
        const coveredChildren: CoveredChild[] = (config.children ?? []).map(cc => ({
            childId:   cc.child.id,
            childName: `${cc.child.firstName} ${cc.child.lastName}`,
        }));

        // Determine status (§26, B7)
        let cycleStatus: BillingCycleRow['cycleStatus'] = 'needs_setup';
        if (config.status === 'paused') {
            cycleStatus = 'paused';
        } else if (lastSkip && lastSkip.periodStart === currentPeriodStr) {
            cycleStatus = 'skipped';
        } else if (!config.agreedMonthlyPence || config.agreedMonthlyPence <= 0) {
            cycleStatus = 'needs_setup';
        } else if (lastRun?.success && lastRun?.periodStart === currentPeriodStr) {
            cycleStatus = 'invoice_sent';
        } else {
            cycleStatus = 'ready';
        }

        return {
            config: {
                id:                 config.id,
                parentId:           config.parentId,
                centreId:           config.centreId,
                agreedMonthlyPence: config.agreedMonthlyPence,
                billingAnchorDate:  config.billingAnchorDate,
                invoiceLeadDays:    config.invoiceLeadDays,
                paymentDayOfMonth:  config.paymentDayOfMonth ?? null,
                leadTimeUnit:       config.leadTimeUnit ?? null,
                leadTimeValue:      config.leadTimeValue ?? null,
                status:             config.status,
                notes:              config.notes ?? null,
            },
            familyName:      parent ? `${parent.firstName} ${parent.lastName}` : '',
            parentEmail:     parent?.email ?? '',
            centreName:      centre?.name ?? '',
            coveredChildren,
            amountDisplay:   penceToPounds(config.agreedMonthlyPence),
            periodLabel,
            nextInvoiceDateStr,
            dueDateStr,
            lastRunAt:          lastRun ? (lastRun.runAt instanceof Date ? lastRun.runAt.toISOString() : String(lastRun.runAt)) : null,
            lastRunPeriodStart: lastRun?.periodStart ?? null,
            cycleStatus,
            currentPeriodStart: currentPeriodStr || null,
        } satisfies BillingCycleRow;
    }));

    // Append unconfigured registered families (Issue D)
    const registeredKids = await db.query.children.findMany({
        where: and(
            eq(children.organisationId, orgId),
            eq(children.isRegistered, true),
            isNull(children.deletedAt),
            centreId !== 'all' ? eq(children.centreId, centreId) : undefined,
        ),
        with: {
            parent: { columns: { firstName: true, lastName: true, email: true, deletedAt: true } },
            centre: { columns: { name: true } },
        },
    });

    const configKeySet = new Set(configs.map(c => `${c.parentId}:${c.centreId}`));

    const unconfiguredMap = new Map<string, {
        parentId: string;
        centreId: string;
        parent: { firstName: string; lastName: string; email: string | null; deletedAt: Date | null } | null;
        centre: { name: string } | null;
        kids: { id: string; firstName: string; lastName: string }[];
    }>();

    for (const kid of registeredKids) {
        if (!kid.parentId || !kid.centreId || !kid.parent || kid.parent.deletedAt) continue;
        const key = `${kid.parentId}:${kid.centreId}`;
        if (configKeySet.has(key)) continue;

        if (!unconfiguredMap.has(key)) {
            unconfiguredMap.set(key, {
                parentId: kid.parentId,
                centreId: kid.centreId,
                parent: kid.parent,
                centre: kid.centre,
                kids: [],
            });
        }
        unconfiguredMap.get(key)!.kids.push({
            id: kid.id,
            firstName: kid.firstName,
            lastName: kid.lastName,
        });
    }

    const unconfiguredRows: BillingCycleRow[] = Array.from(unconfiguredMap.values()).map(item => ({
        config: {
            id:                 `unconfigured-${item.parentId}-${item.centreId}`,
            parentId:           item.parentId,
            centreId:           item.centreId,
            agreedMonthlyPence: 0,
            billingAnchorDate:  new Date().toISOString().split('T')[0],
            invoiceLeadDays:    7,
            paymentDayOfMonth:  null,
            leadTimeUnit:       null,
            leadTimeValue:      null,
            status:             'active',
            notes:              null,
        },
        familyName:      item.parent ? `${item.parent.firstName} ${item.parent.lastName}` : '',
        parentEmail:     item.parent?.email ?? '',
        centreName:      item.centre?.name ?? '',
        coveredChildren: item.kids.map(k => ({
            childId:   k.id,
            childName: `${k.firstName} ${k.lastName}`,
        })),
        amountDisplay:   '£0.00',
        periodLabel:     'Schedule Setup Required',
        nextInvoiceDateStr: null,
        dueDateStr:         null,
        lastRunAt:          null,
        lastRunPeriodStart: null,
        cycleStatus:        'needs_setup',
        currentPeriodStart: null,
    }));

    return [...enriched, ...unconfiguredRows];
}

// ─── Fetch billing config for a specific student (via parent+centre) ──────────

export interface StudentBillingConfig {
    id:                 string;
    parentId:           string;
    centreId:           string;
    agreedMonthlyPence: number;
    billingAnchorDate:  string;
    billingEndDate:     string | null;
    invoiceLeadDays:    number;
    paymentDayOfMonth?: number | null;
    leadTimeUnit?:      LeadTimeUnit | null;
    leadTimeValue?:     number | null;
    status:             'active' | 'paused' | 'cancelled';
    notes:              string | null;
    coveredChildren:    CoveredChild[];
}

export async function fetchStudentBillingConfig(
    childId:  string,
    parentId: string,
    orgId:    string,
): Promise<StudentBillingConfig | null> {
    // Find the child to get their centreId
    const child = await db.query.children.findFirst({
        where: eq(children.id, childId),
        columns: { centreId: true },
    });
    if (!child?.centreId) return null;

    // Find the family's billing config for this centre
    const config = await db.query.billingConfigs.findFirst({
        where: and(
            eq(billingConfigs.parentId,       parentId),
            eq(billingConfigs.centreId,        child.centreId),
            eq(billingConfigs.organisationId,  orgId),
        ),
        with: {
            children: {
                with: {
                    child: { columns: { id: true, firstName: true, lastName: true } },
                },
            },
        },
    });

    if (!config) return null;

    return {
        id:                 config.id,
        parentId:           config.parentId,
        centreId:           config.centreId,
        agreedMonthlyPence: config.agreedMonthlyPence,
        billingAnchorDate:  config.billingAnchorDate,
        billingEndDate:     config.billingEndDate ?? null,
        invoiceLeadDays:    config.invoiceLeadDays,
        paymentDayOfMonth:  config.paymentDayOfMonth ?? null,
        leadTimeUnit:       config.leadTimeUnit ?? null,
        leadTimeValue:      config.leadTimeValue ?? null,
        status:             config.status,
        notes:              config.notes ?? null,
        coveredChildren:    (config.children ?? []).map(cc => ({
            childId:   cc.child.id,
            childName: `${cc.child.firstName} ${cc.child.lastName}`,
        })),
    };
}

// ─── Operational Dashboard Queries (§41–§48, B10–B13) ─────────────────────────

function buildCentreFilter(column: Column, centreId: string | string[]) {
    if (centreId === 'all') return undefined;
    if (Array.isArray(centreId)) {
        if (centreId.length === 0) return sql`false`;
        return inArray(column, centreId);
    }
    return eq(column, centreId);
}

/**
 * Fetch all unissued draft invoices awaiting Manager review (B10).
 */
export async function fetchDraftsToReview(orgId: string, centreId: string | string[] = 'all') {
    const centreCond = buildCentreFilter(invoices.centreId, centreId);
    const whereConditions = [
        eq(invoices.organisationId, orgId),
        eq(invoices.status, 'draft'),
    ];

    if (centreCond) {
        whereConditions.push(centreCond);
    }

    return await db.query.invoices.findMany({
        where: and(...whereConditions),
        with: {
            parent: { columns: { firstName: true, lastName: true, email: true } },
            centre: { columns: { name: true } },
        },
        orderBy: [desc(invoices.createdAt)],
    });
}

/**
 * Fetch all active billing configs that require fee setup or anchor definition (B11, Issue D).
 * Includes both 0-fee active configs and registered families with active children having no config yet.
 */
export async function fetchBillingSetupRequired(orgId: string, centreId: string | string[] = 'all') {
    const centreCond = buildCentreFilter(billingConfigs.centreId, centreId);
    const whereConditions = [
        eq(billingConfigs.organisationId, orgId),
        eq(billingConfigs.status, 'active'),
        eq(billingConfigs.agreedMonthlyPence, 0),
    ];

    if (centreCond) {
        whereConditions.push(centreCond);
    }

    const configs = await db.query.billingConfigs.findMany({
        where: and(...whereConditions),
        with: {
            parent: { columns: { firstName: true, lastName: true, email: true, deletedAt: true } },
            centre: { columns: { name: true } },
            children: {
                with: { child: { columns: { id: true, firstName: true, lastName: true } } },
            },
        },
    });

    const activeConfigs = configs.filter(c => !c.parent?.deletedAt);

    // Also include active registered children with no billing config (Issue D)
    const childCentreCond = buildCentreFilter(children.centreId, centreId);
    const registeredKids = await db.query.children.findMany({
        where: and(
            eq(children.organisationId, orgId),
            eq(children.isRegistered, true),
            isNull(children.deletedAt),
            childCentreCond,
        ),
        with: {
            parent: { columns: { firstName: true, lastName: true, email: true, deletedAt: true } },
            centre: { columns: { name: true } },
        },
    });

    const allOrgConfigs = await db.query.billingConfigs.findMany({
        where: eq(billingConfigs.organisationId, orgId),
        columns: { parentId: true, centreId: true },
    });
    const configKeySet = new Set(allOrgConfigs.map(c => `${c.parentId}:${c.centreId}`));

    const unconfiguredMap = new Map<string, {
        parentId: string;
        centreId: string;
        parent: { firstName: string; lastName: string; email: string | null; deletedAt: Date | null } | null;
        centre: { name: string } | null;
        kids: { id: string; firstName: string; lastName: string }[];
    }>();

    for (const kid of registeredKids) {
        if (!kid.parentId || !kid.centreId || !kid.parent || kid.parent.deletedAt) continue;
        const key = `${kid.parentId}:${kid.centreId}`;
        if (configKeySet.has(key)) continue;

        if (!unconfiguredMap.has(key)) {
            unconfiguredMap.set(key, {
                parentId: kid.parentId,
                centreId: kid.centreId,
                parent: kid.parent,
                centre: kid.centre,
                kids: [],
            });
        }
        unconfiguredMap.get(key)!.kids.push({
            id: kid.id,
            firstName: kid.firstName,
            lastName: kid.lastName,
        });
    }

    const unconfiguredItems = Array.from(unconfiguredMap.values()).map(item => ({
        id: `unconfigured-${item.parentId}-${item.centreId}`,
        organisationId: orgId,
        centreId: item.centreId,
        parentId: item.parentId,
        agreedMonthlyPence: 0,
        billingAnchorDate: null as unknown as string,
        status: 'active' as const,
        parent: item.parent,
        centre: item.centre,
        children: item.kids.map(k => ({ child: k })),
    }));

    return [...activeConfigs, ...unconfiguredItems];
}

/**
 * Fetch upcoming expected payments on issued invoices (B12).
 */
export async function fetchPaymentsExpected(orgId: string, centreId: string | string[] = 'all') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const centreCond = buildCentreFilter(invoices.centreId, centreId);
    const whereConditions = [
        eq(invoices.organisationId, orgId),
        eq(invoices.status, 'sent'),
        gte(invoices.dueDate, today),
    ];

    if (centreCond) {
        whereConditions.push(centreCond);
    }

    return await db.query.invoices.findMany({
        where: and(...whereConditions),
        with: {
            parent: { columns: { firstName: true, lastName: true, email: true } },
            centre: { columns: { name: true } },
        },
        orderBy: [desc(invoices.dueDate)],
    });
}

/**
 * Fetch overdue issued invoices that require staff attention (B13).
 */
export async function fetchOverdueInvoices(orgId: string, centreId: string | string[] = 'all') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const centreCond = buildCentreFilter(invoices.centreId, centreId);
    const whereConditions = [
        eq(invoices.organisationId, orgId),
        inArray(invoices.status, ['sent', 'partially_paid']),
        lt(invoices.dueDate, today),
    ];

    if (centreCond) {
        whereConditions.push(centreCond);
    }

    return await db.query.invoices.findMany({
        where: and(...whereConditions),
        with: {
            parent: { columns: { firstName: true, lastName: true, email: true } },
            centre: { columns: { name: true } },
            payments: true,
        },
        orderBy: [desc(invoices.dueDate)],
    });
}
