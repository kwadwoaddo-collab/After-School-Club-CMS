'use server';
/**
 * Billing queries — pure read-only DB access.
 * NOT a  file — safe to call directly from server components.
 */

import { db } from '@/db';
import { billingConfigs, billingConfigChildren, billingRuns, billingCycleSkips, invoices, parents, children, centres } from '@/db/schema';
import { eq, and, desc, ne, inArray, lt, gte } from 'drizzle-orm';
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

    if (configs.length === 0) return [];

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

    return enriched;
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

/**
 * Fetch all unissued draft invoices awaiting Manager review (B10).
 */
export async function fetchDraftsToReview(orgId: string, centreId: string = 'all') {
    const whereConditions = [
        eq(invoices.organisationId, orgId),
        eq(invoices.status, 'draft'),
    ];

    if (centreId !== 'all') {
        whereConditions.push(eq(invoices.centreId, centreId));
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
 * Fetch all active billing configs that require fee setup or anchor definition (B11).
 */
export async function fetchBillingSetupRequired(orgId: string, centreId: string = 'all') {
    const whereConditions = [
        eq(billingConfigs.organisationId, orgId),
        eq(billingConfigs.status, 'active'),
        eq(billingConfigs.agreedMonthlyPence, 0),
    ];

    if (centreId !== 'all') {
        whereConditions.push(eq(billingConfigs.centreId, centreId));
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

    return configs.filter(c => !c.parent?.deletedAt);
}

/**
 * Fetch upcoming expected payments on issued invoices (B12).
 */
export async function fetchPaymentsExpected(orgId: string, centreId: string = 'all') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const whereConditions = [
        eq(invoices.organisationId, orgId),
        eq(invoices.status, 'sent'),
        gte(invoices.dueDate, today),
    ];

    if (centreId !== 'all') {
        whereConditions.push(eq(invoices.centreId, centreId));
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
export async function fetchOverdueInvoices(orgId: string, centreId: string = 'all') {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const whereConditions = [
        eq(invoices.organisationId, orgId),
        inArray(invoices.status, ['sent', 'partially_paid']),
        lt(invoices.dueDate, today),
    ];

    if (centreId !== 'all') {
        whereConditions.push(eq(invoices.centreId, centreId));
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
