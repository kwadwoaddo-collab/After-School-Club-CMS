/**
 * Billing queries — pure read-only DB access.
 * NOT a 'use server' file — safe to call directly from server components.
 */

import { db } from '@/db';
import { billingConfigs, billingRuns, nonUcRateTable, children, parents } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
    computeNonUcRate,
    computeNextNonUcBillingDates,
    computeUcPeriodDates,
    DEFAULT_NON_UC_RATES,
    penceToPounds,
    type RateRow,
} from '@/lib/billing';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getRateTable(orgId: string): Promise<RateRow[]> {
    const rows = await db.query.nonUcRateTable.findMany({
        where: eq(nonUcRateTable.organisationId, orgId),
        orderBy: [desc(nonUcRateTable.effectiveFrom)],
    });

    if (rows.length === 0) return DEFAULT_NON_UC_RATES;

    const seen = new Set<number>();
    const result: RateRow[] = [];
    for (const row of rows) {
        if (!seen.has(row.sessionsPerWeek)) {
            seen.add(row.sessionsPerWeek);
            result.push({
                sessionsPerWeek: row.sessionsPerWeek,
                monthlyRatePence: row.monthlyRatePence,
                extraSessionRatePence: row.extraSessionRatePence ?? null,
            });
        }
    }
    return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillingCycleRow {
    config: {
        id: string;
        billingType: 'non_uc' | 'uc';
        sessionsPerWeek: number | null;
        status: 'active' | 'paused' | 'cancelled';
        childId: string | null;
    };
    childName: string;
    parentName: string;
    parentEmail: string;
    amountPence: number;
    amountDisplay: string;
    periodLabel: string;
    nextInvoiceDateStr: string | null;  // ISO string — safe to pass to client components
    dueDateStr: string | null;           // ISO string
    rateSource: string;
    lastRunAt: string | null;            // ISO string
    lastRunPeriodStart: string | null;
    cycleStatus: 'ready' | 'needs_setup' | 'invoice_sent' | 'paused';
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function fetchBillingCycles(
    orgId: string,
    centreId: string,
): Promise<BillingCycleRow[]> {
    const whereClause = centreId !== 'all'
        ? and(
            eq(billingConfigs.organisationId, orgId),
            eq(billingConfigs.centreId, centreId),
            eq(billingConfigs.status, 'active'),
        )
        : and(
            eq(billingConfigs.organisationId, orgId),
            eq(billingConfigs.status, 'active'),
        );

    const configs = await db.query.billingConfigs.findMany({
        where: whereClause,
        with: {
            runs: {
                orderBy: [desc(billingRuns.runAt)],
                limit: 1,
            },
        },
    });

    if (configs.length === 0) return [];

    const rateTable = await getRateTable(orgId);

    const enriched = await Promise.all(configs.map(async (config) => {
        let amountPence = 0;
        let periodLabel = '';
        let nextInvoiceDateStr: string | null = null;
        let dueDateStr: string | null = null;
        let rateSource = '';

        try {
            if (config.billingType === 'non_uc' && config.sessionsPerWeek) {
                const { ratePence, source } = computeNonUcRate(
                    config.sessionsPerWeek,
                    config.agreedRatePence ?? null,
                    rateTable,
                );
                const dates = computeNextNonUcBillingDates({
                    billingAnchorDate: new Date(config.billingAnchorDate),
                    invoiceLeadDays: config.invoiceLeadDays,
                    sessionsPerWeek: config.sessionsPerWeek,
                    agreedRatePence: config.agreedRatePence ?? null,
                });
                amountPence = ratePence;
                periodLabel = dates.periodLabel;
                nextInvoiceDateStr = dates.invoiceDate.toISOString();
                dueDateStr = dates.dueDate.toISOString();
                rateSource = source;
            } else if (config.billingType === 'uc' && config.ucPeriodStartDay && config.ucAgreedAmountPence) {
                const dates = computeUcPeriodDates({
                    ucPeriodStartDay: config.ucPeriodStartDay,
                    invoiceLeadDays: config.invoiceLeadDays,
                    ucAgreedAmountPence: config.ucAgreedAmountPence,
                });
                amountPence = config.ucAgreedAmountPence;
                periodLabel = dates.periodLabel;
                nextInvoiceDateStr = dates.invoiceDate.toISOString();
                dueDateStr = dates.dueDate.toISOString();
                rateSource = 'uc_agreed';
            }
        } catch {
            // Malformed config — show as needs_setup
        }

        // Fetch child name
        let childName = '';
        if (config.childId) {
            const child = await db.query.children.findFirst({
                where: eq(children.id, config.childId),
                columns: { firstName: true, lastName: true },
            });
            childName = child ? `${child.firstName} ${child.lastName}` : '';
        }

        // Fetch parent name + email
        const parent = await db.query.parents.findFirst({
            where: eq(parents.id, config.parentId),
            columns: { firstName: true, lastName: true, email: true },
        });

        const lastRun = config.runs?.[0] ?? null;

        // Determine display status
        let cycleStatus: BillingCycleRow['cycleStatus'] = 'needs_setup';
        if (config.status === 'paused') {
            cycleStatus = 'paused';
        } else if (!amountPence || !periodLabel) {
            cycleStatus = 'needs_setup';
        } else if (lastRun?.success) {
            cycleStatus = 'invoice_sent';
        } else {
            cycleStatus = 'ready';
        }

        return {
            config: {
                id: config.id,
                billingType: config.billingType,
                sessionsPerWeek: config.sessionsPerWeek,
                status: config.status,
                childId: config.childId,
            },
            childName,
            parentName: parent ? `${parent.firstName} ${parent.lastName}` : '',
            parentEmail: parent?.email ?? '',
            amountPence,
            amountDisplay: penceToPounds(amountPence),
            periodLabel,
            nextInvoiceDateStr,
            dueDateStr,
            rateSource,
            lastRunAt:          lastRun ? (lastRun.runAt instanceof Date ? lastRun.runAt.toISOString() : String(lastRun.runAt)) : null,
            lastRunPeriodStart: lastRun?.periodStart ?? null,
            cycleStatus,
        } satisfies BillingCycleRow;
    }));

    return enriched;
}

// ─── Fetch active billing config for a specific student ───────────────────────

export async function fetchStudentBillingConfig(childId: string, orgId: string) {
    return db.query.billingConfigs.findFirst({
        where: and(
            eq(billingConfigs.childId, childId),
            eq(billingConfigs.organisationId, orgId),
            eq(billingConfigs.status, 'active'),
        ),
    });
}
