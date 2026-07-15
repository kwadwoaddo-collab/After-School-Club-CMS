'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { billingConfigs, billingRuns, nonUcRateTable, invoices, centres, children, parents } from '@/db/schema';
import { eq, and, desc, isNull, lte, gte, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
    computeNonUcRate,
    computeNextNonUcBillingDates,
    computeUcPeriodDates,
    DEFAULT_NON_UC_RATES,
    type RateRow,
    penceToPounds,
} from '@/lib/billing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillingConfigFormData {
    childId?: string | null;
    parentId: string;
    centreId: string;
    billingType: 'non_uc' | 'uc';
    sessionsPerWeek?: number | null;
    agreedRatePence?: number | null;
    ucPeriodStartDay?: number | null;
    ucAgreedAmountPence?: number | null;
    billingAnchorDate: string; // ISO date string YYYY-MM-DD
    billingEndDate?: string | null;
    invoiceLeadDays?: number;
    notes?: string | null;
}

export interface GenerateInvoiceOverrides {
    amountPence?: number;
    invoiceDate?: string;   // ISO date
    dueDate?: string;       // ISO date
    notes?: string;
    sendEmail?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    return session.user.organisationId;
}

async function getRateTable(orgId: string): Promise<RateRow[]> {
    const rows = await db.query.nonUcRateTable.findMany({
        where: eq(nonUcRateTable.organisationId, orgId),
        orderBy: [desc(nonUcRateTable.effectiveFrom)],
    });

    if (rows.length === 0) return DEFAULT_NON_UC_RATES;

    // Return most recent effective row per sessionsPerWeek
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

function nextInvoiceNumber(existing: string[]): string {
    const year = new Date().getFullYear();
    const nums = existing
        .map(n => parseInt(n.split('-').pop() ?? '0', 10))
        .filter(n => !isNaN(n));
    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `INV-${year}-${String(next).padStart(4, '0')}`;
}

// ─── Seed default rate table ──────────────────────────────────────────────────

export async function seedDefaultRateTable(orgId?: string): Promise<void> {
    const resolvedOrgId = orgId ?? (await getOrgId());
    const existing = await db.query.nonUcRateTable.findMany({
        where: eq(nonUcRateTable.organisationId, resolvedOrgId),
    });

    if (existing.length > 0) return; // already seeded

    const today = new Date().toISOString().split('T')[0];
    await db.insert(nonUcRateTable).values(
        DEFAULT_NON_UC_RATES.map(r => ({
            organisationId:         resolvedOrgId,
            sessionsPerWeek:        r.sessionsPerWeek,
            monthlyRatePence:       r.monthlyRatePence,
            extraSessionRatePence:  r.extraSessionRatePence ?? null,
            effectiveFrom:          today,
        }))
    );
}

// ─── Create / Update billing config ──────────────────────────────────────────

export async function createBillingConfig(data: BillingConfigFormData) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    // Validate: only one active config per child
    if (data.childId) {
        const existing = await db.query.billingConfigs.findFirst({
            where: and(
                eq(billingConfigs.childId, data.childId),
                eq(billingConfigs.status, 'active'),
            ),
        });
        if (existing) {
            throw new Error('This student already has an active billing configuration. Pause or cancel it first.');
        }
    }

    const [config] = await db.insert(billingConfigs).values({
        organisationId:      orgId,
        centreId:            data.centreId,
        parentId:            data.parentId,
        childId:             data.childId ?? null,
        billingType:         data.billingType,
        sessionsPerWeek:     data.sessionsPerWeek ?? null,
        agreedRatePence:     data.agreedRatePence ?? null,
        ucPeriodStartDay:    data.ucPeriodStartDay ?? null,
        ucAgreedAmountPence: data.ucAgreedAmountPence ?? null,
        billingAnchorDate:   data.billingAnchorDate,
        billingEndDate:      data.billingEndDate ?? null,
        invoiceLeadDays:     data.invoiceLeadDays ?? 7,
        status:              'active',
        notes:               data.notes ?? null,
    }).returning();

    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/finance');
    return config;
}

export async function updateBillingConfig(
    configId: string,
    data: Partial<BillingConfigFormData>
) {
    const orgId = await getOrgId();

    const existing = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!existing) throw new Error('Billing config not found');

    const [updated] = await db.update(billingConfigs).set({
        sessionsPerWeek:     data.sessionsPerWeek ?? existing.sessionsPerWeek,
        agreedRatePence:     data.agreedRatePence ?? existing.agreedRatePence,
        ucPeriodStartDay:    data.ucPeriodStartDay ?? existing.ucPeriodStartDay,
        ucAgreedAmountPence: data.ucAgreedAmountPence ?? existing.ucAgreedAmountPence,
        billingAnchorDate:   data.billingAnchorDate ?? existing.billingAnchorDate,
        billingEndDate:      data.billingEndDate ?? existing.billingEndDate,
        invoiceLeadDays:     data.invoiceLeadDays ?? existing.invoiceLeadDays,
        billingType:         data.billingType ?? existing.billingType,
        notes:               data.notes ?? existing.notes,
        updatedAt:           new Date(),
    }).where(eq(billingConfigs.id, configId)).returning();

    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/finance');
    return updated;
}

export async function pauseBillingConfig(configId: string) {
    const orgId = await getOrgId();
    await db.update(billingConfigs)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
}

export async function resumeBillingConfig(configId: string) {
    const orgId = await getOrgId();
    await db.update(billingConfigs)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
}

export async function cancelBillingConfig(configId: string, endDate?: string) {
    const orgId = await getOrgId();
    await db.update(billingConfigs).set({
        status: 'cancelled',
        billingEndDate: endDate ?? new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
    }).where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
}

// ─── Get billing config for a student ────────────────────────────────────────

export async function getBillingConfigForStudent(childId: string) {
    const orgId = await getOrgId();

    const config = await db.query.billingConfigs.findFirst({
        where: and(
            eq(billingConfigs.childId, childId),
            eq(billingConfigs.organisationId, orgId),
            eq(billingConfigs.status, 'active'),
        ),
        with: { runs: { orderBy: [desc(billingRuns.runAt)], limit: 1 } },
    });

    return config ?? null;
}

// ─── Preview next invoice (no DB write) ──────────────────────────────────────

export async function previewNextInvoice(configId: string) {
    const orgId = await getOrgId();

    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!config) throw new Error('Billing config not found');

    const rateTable = await getRateTable(orgId);

    if (config.billingType === 'non_uc') {
        if (!config.sessionsPerWeek) throw new Error('sessions_per_week is required for Non-UC billing');

        const { ratePence, source } = computeNonUcRate(
            config.sessionsPerWeek,
            config.agreedRatePence ?? null,
            rateTable,
        );
        const dates = computeNextNonUcBillingDates({
            billingAnchorDate: new Date(config.billingAnchorDate),
            invoiceLeadDays:   config.invoiceLeadDays,
            sessionsPerWeek:   config.sessionsPerWeek,
            agreedRatePence:   config.agreedRatePence ?? null,
        });

        return { ...dates, ratePence, rateSource: source, amountDisplay: penceToPounds(ratePence) };
    } else {
        // UC
        if (!config.ucPeriodStartDay || !config.ucAgreedAmountPence) {
            throw new Error('ucPeriodStartDay and ucAgreedAmountPence are required for UC billing');
        }
        const dates = computeUcPeriodDates({
            ucPeriodStartDay:    config.ucPeriodStartDay,
            invoiceLeadDays:     config.invoiceLeadDays,
            ucAgreedAmountPence: config.ucAgreedAmountPence,
        });
        return {
            ...dates,
            ratePence: config.ucAgreedAmountPence,
            rateSource: 'uc_agreed' as const,
            amountDisplay: penceToPounds(config.ucAgreedAmountPence),
        };
    }
}

// ─── Generate invoice from billing config ────────────────────────────────────

export async function generateInvoiceFromConfig(
    configId: string,
    overrides: GenerateInvoiceOverrides = {},
) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    return await db.transaction(async (tx) => {
        const config = await tx.query.billingConfigs.findFirst({
            where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        });
        if (!config) throw new Error('Billing config not found');
        if (config.status !== 'active') throw new Error('Billing config is not active');

        const rateTable = await getRateTable(orgId);

        // Compute period + rate
        let ratePence: number;
        let rateSource: string;
        let period: Awaited<ReturnType<typeof computeNextNonUcBillingDates>>;

        if (config.billingType === 'non_uc') {
            if (!config.sessionsPerWeek) throw new Error('sessionsPerWeek required');
            const r = computeNonUcRate(config.sessionsPerWeek, config.agreedRatePence ?? null, rateTable);
            ratePence  = r.ratePence;
            rateSource = r.source;
            period     = computeNextNonUcBillingDates({
                billingAnchorDate: new Date(config.billingAnchorDate),
                invoiceLeadDays:   config.invoiceLeadDays,
                sessionsPerWeek:   config.sessionsPerWeek,
                agreedRatePence:   config.agreedRatePence ?? null,
            });
        } else {
            if (!config.ucPeriodStartDay || !config.ucAgreedAmountPence) throw new Error('UC config incomplete');
            ratePence  = config.ucAgreedAmountPence;
            rateSource = 'uc_agreed';
            period     = computeUcPeriodDates({
                ucPeriodStartDay:    config.ucPeriodStartDay,
                invoiceLeadDays:     config.invoiceLeadDays,
                ucAgreedAmountPence: config.ucAgreedAmountPence,
            });
        }

        // Idempotency check — has this period already been billed?
        const periodStartStr = period.periodStart.toISOString().split('T')[0];
        const existingRun = await tx.query.billingRuns.findFirst({
            where: and(
                eq(billingRuns.billingConfigId, configId),
                eq(billingRuns.periodStart, periodStartStr),
                eq(billingRuns.success, true),
            ),
        });
        if (existingRun) {
            throw new Error(`An invoice was already generated for this period (${period.periodLabel}). Check the Invoices tab.`);
        }

        const finalAmountPence = overrides.amountPence ?? ratePence;
        const finalAmountStr   = (finalAmountPence / 100).toFixed(2);

        const invoiceDateStr = overrides.invoiceDate ?? period.invoiceDate.toISOString().split('T')[0];
        const dueDateStr     = overrides.dueDate     ?? period.dueDate.toISOString().split('T')[0];

        // Fetch existing invoice numbers for this org to compute next number
        const existingNums = await tx.query.invoices.findMany({
            where: eq(invoices.organisationId, orgId),
            columns: { invoiceNumber: true },
        });
        const invoiceNumber = nextInvoiceNumber(existingNums.map(i => i.invoiceNumber));

        // Create the invoice
        const [newInvoice] = await tx.insert(invoices).values({
            organisationId:      orgId,
            centreId:            config.centreId,
            parentId:            config.parentId,
            childId:             config.childId ?? null,
            invoiceNumber,
            amount:              finalAmountStr,
            status:              'draft',
            invoiceDate:         new Date(invoiceDateStr),
            dueDate:             new Date(dueDateStr),
            billingPeriodStart:  period.periodStart,
            billingPeriodEnd:    period.periodEnd,
            notes:               overrides.notes ?? config.notes ?? null,
        } as any).returning();

        // Record the billing run
        await tx.insert(billingRuns).values({
            billingConfigId:  configId,
            periodStart:      periodStartStr,
            periodEnd:        period.periodEnd.toISOString().split('T')[0],
            invoiceId:        newInvoice.id,
            rateAppliedPence: finalAmountPence,
            rateSource:       rateSource,
            runBy:            session.user.id ?? null,
            success:          true,
        });

        revalidatePath('/dashboard/finance');
        revalidatePath(`/dashboard/students/${config.childId}`);
        return newInvoice;
    });
}

// ─── List all billing cycles for the finance dashboard ───────────────────────

export async function listBillingCycles(centreId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const centreFilter = centreId !== 'all'
        ? and(eq(billingConfigs.organisationId, orgId), eq(billingConfigs.centreId, centreId), eq(billingConfigs.status, 'active'))
        : and(eq(billingConfigs.organisationId, orgId), eq(billingConfigs.status, 'active'));

    const configs = await db.query.billingConfigs.findMany({
        where: centreFilter,
        with: { runs: { orderBy: [desc(billingRuns.runAt)], limit: 1 } },
    });

    const rateTable = await getRateTable(orgId);

    // Enrich with computed next period + child/parent names
    const enriched = await Promise.all(configs.map(async (config) => {
        let amountPence = 0;
        let periodLabel = '';
        let nextPeriodStart: Date | null = null;
        let rateSource = '';

        try {
            if (config.billingType === 'non_uc' && config.sessionsPerWeek) {
                const { ratePence, source } = computeNonUcRate(config.sessionsPerWeek, config.agreedRatePence ?? null, rateTable);
                const dates = computeNextNonUcBillingDates({
                    billingAnchorDate: new Date(config.billingAnchorDate),
                    invoiceLeadDays: config.invoiceLeadDays,
                    sessionsPerWeek: config.sessionsPerWeek,
                    agreedRatePence: config.agreedRatePence ?? null,
                });
                amountPence = ratePence;
                periodLabel = dates.periodLabel;
                nextPeriodStart = dates.periodStart;
                rateSource = source;
            } else if (config.billingType === 'uc' && config.ucPeriodStartDay && config.ucAgreedAmountPence) {
                const dates = computeUcPeriodDates({
                    ucPeriodStartDay: config.ucPeriodStartDay,
                    invoiceLeadDays: config.invoiceLeadDays,
                    ucAgreedAmountPence: config.ucAgreedAmountPence,
                });
                amountPence = config.ucAgreedAmountPence;
                periodLabel = dates.periodLabel;
                nextPeriodStart = dates.periodStart;
                rateSource = 'uc_agreed';
            }
        } catch {}

        // Fetch child name if applicable
        let childName = '';
        if (config.childId) {
            const child = await db.query.children.findFirst({
                where: eq(children.id, config.childId),
                columns: { firstName: true, lastName: true },
            });
            childName = child ? `${child.firstName} ${child.lastName}` : '';
        }

        // Fetch parent name
        const parent = await db.query.parents.findFirst({
            where: eq(parents.id, config.parentId),
            columns: { firstName: true, lastName: true, email: true },
        });

        const lastRun = config.runs?.[0] ?? null;

        // Determine status
        let cycleStatus: 'ready' | 'needs_setup' | 'invoice_sent' | 'paused' = 'needs_setup';
        if (config.status === 'paused') {
            cycleStatus = 'paused';
        } else if (!amountPence || !periodLabel) {
            cycleStatus = 'needs_setup';
        } else if (lastRun?.success) {
            // Check if last run was for the current period
            cycleStatus = 'invoice_sent';
        } else {
            cycleStatus = 'ready';
        }

        return {
            config,
            childName,
            parentName: parent ? `${parent.firstName} ${parent.lastName}` : '',
            parentEmail: parent?.email ?? '',
            amountPence,
            amountDisplay: penceToPounds(amountPence),
            periodLabel,
            nextPeriodStart,
            rateSource,
            lastRun,
            cycleStatus,
        };
    }));

    return enriched;
}
