import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
    billingConfigs, billingConfigChildren, billingRuns, invoices,
    children, parents, centres, organisations,
} from '@/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { computeNextBillingPeriod } from '@/lib/billing';
import { nanoid } from 'nanoid';

/**
 * POST /api/cron/billing
 *
 * Automated monthly invoice generation for all active billing configs.
 * Runs daily and generates invoices for configs whose invoice date is today or overdue.
 *
 * Secured by CRON_SECRET header.
 * Idempotent — won't double-generate for the same billing period.
 *
 * Schedule (vercel.json): "0 6 * * *" — 6am UTC daily
 */
export async function POST(request: NextRequest) {
    // ── Auth: CRON_SECRET check ────────────────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const results = {
        processed: 0,
        generated: 0,
        skipped_already_exists: 0,
        skipped_not_due: 0,
        skipped_no_amount: 0,
        errors: 0,
        errorDetails: [] as string[],
    };

    try {
        // ── 1. Fetch all active billing configs across all orgs ────────────────
        const configs = await db.query.billingConfigs.findMany({
            where: eq(billingConfigs.status, 'active'),
            with: {
                children: {
                    with: {
                        child: { columns: { id: true, firstName: true, lastName: true } },
                    },
                },
            },
        });

        results.processed = configs.length;

        for (const config of configs) {
            try {
                // Guard: need a non-zero agreed amount
                if (!config.agreedMonthlyPence || config.agreedMonthlyPence <= 0) {
                    results.skipped_no_amount++;
                    continue;
                }

                // Parse the anchor date (Drizzle returns date as string 'YYYY-MM-DD')
                const anchorDate = new Date((config.billingAnchorDate as unknown as string) + 'T00:00:00Z');
                const leadDays = config.invoiceLeadDays ?? 7;

                const period = computeNextBillingPeriod(
                    { billingAnchorDate: anchorDate, invoiceLeadDays: leadDays },
                    today
                );

                const invoiceDate = period.invoiceDate;
                invoiceDate.setUTCHours(0, 0, 0, 0);

                // ── 2. Check if invoice date is today or already overdue ────────
                if (invoiceDate > today) {
                    results.skipped_not_due++;
                    continue;
                }

                const periodStartStr = period.periodStart.toISOString().split('T')[0];
                const periodEndStr = period.periodEnd.toISOString().split('T')[0];

                // ── 3. Idempotency — check for existing run for this period ─────
                const existingRun = await db.query.billingRuns.findFirst({
                    where: and(
                        eq(billingRuns.billingConfigId, config.id),
                        eq(billingRuns.periodStart, periodStartStr)
                    ),
                });

                if (existingRun?.success) {
                    results.skipped_already_exists++;
                    continue;
                }

                // ── 4. Generate invoice in a transaction ───────────────────────
                const coveredChildren = (config.children ?? []).map(cc => ({
                    id: cc.child.id,
                    name: `${cc.child.firstName} ${cc.child.lastName}`,
                }));

                await db.transaction(async (tx) => {
                    const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

                    const [invoice] = await tx.insert(invoices).values({
                        organisationId: config.organisationId,
                        centreId: config.centreId,
                        parentId: config.parentId,
                        invoiceNumber,
                        amount: String(config.agreedMonthlyPence / 100),
                        status: 'draft',
                        invoiceDate: new Date(),
                        dueDate: period.dueDate,
                        billingPeriodStart: period.periodStart,
                        billingPeriodEnd: period.periodEnd,
                        notes: `Monthly tuition — ${period.periodLabel}`,
                        billingConfigId: config.id,
                        billingPeriodLabel: `${periodStartStr} to ${periodEndStr}`,
                        coveredChildrenJson: coveredChildren,
                    }).returning();

                    await tx.insert(billingRuns).values({
                        billingConfigId: config.id,
                        periodStart: periodStartStr,
                        periodEnd: periodEndStr,
                        invoiceId: invoice.id,
                        amountPence: config.agreedMonthlyPence,
                        runBy: null, // automated
                        success: true,
                    });
                });

                results.generated++;
            } catch (err) {
                results.errors++;
                const msg = err instanceof Error ? err.message : String(err);
                results.errorDetails.push(`config ${config.id}: ${msg}`);
                console.error(`[cron/billing] Error for config ${config.id}:`, err);
            }
        }

        console.log('[cron/billing] Run complete:', results);

        return NextResponse.json({
            ok: true,
            runAt: new Date().toISOString(),
            ...results,
        });

    } catch (err) {
        console.error('[cron/billing] Fatal error:', err);
        return NextResponse.json(
            { error: 'Cron failed', details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
