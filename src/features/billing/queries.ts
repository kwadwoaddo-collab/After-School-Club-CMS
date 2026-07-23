'use server';
/**
 * Billing queries — pure read-only DB access.
 * NOT a  file — safe to call directly from server components.
 */

import { db } from '@/db';
import { billingConfigs, billingConfigChildren, billingRuns, parents, children, centres } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { computeNextBillingPeriod, penceToPounds } from '@/lib/billing';

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
    cycleStatus:    'ready' | 'needs_setup' | 'invoice_sent' | 'paused';
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

        try {
            const period = computeNextBillingPeriod({
                billingAnchorDate: new Date(config.billingAnchorDate),
                invoiceLeadDays:   config.invoiceLeadDays,
            });
            periodLabel        = period.periodLabel;
            nextInvoiceDateStr = period.invoiceDate.toISOString();
            dueDateStr         = period.dueDate.toISOString();
        } catch { /* malformed config */ }

        const lastRun = config.runs?.[0] ?? null;
        const coveredChildren: CoveredChild[] = (config.children ?? []).map(cc => ({
            childId:   cc.child.id,
            childName: `${cc.child.firstName} ${cc.child.lastName}`,
        }));

        // Determine status
        let cycleStatus: BillingCycleRow['cycleStatus'] = 'needs_setup';
        if (config.status === 'paused') {
            cycleStatus = 'paused';
        } else if (!config.agreedMonthlyPence) {
            cycleStatus = 'needs_setup';
        } else if (lastRun?.success) {
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
        status:             config.status,
        notes:              config.notes ?? null,
        coveredChildren:    (config.children ?? []).map(cc => ({
            childId:   cc.child.id,
            childName: `${cc.child.firstName} ${cc.child.lastName}`,
        })),
    };
}
