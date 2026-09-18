import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import {
    billingConfigs, billingConfigChildren, billingRuns, billingCycleSkips, invoices,
    children, parents, centres, organisations,
} from '@/db/schema';
import { eq, and, isNull, or, ne, sql, desc, inArray } from 'drizzle-orm';
import { computeBillingSchedule } from '@/lib/billing/date-engine';
import { nanoid } from 'nanoid';

/**
 * POST /api/cron/billing
 *
 * Automated monthly invoice generation for all active billing configs.
 * Runs daily and generates draft invoices for configs whose draft creation date is today or overdue.
 *
 * Secured by CRON_SECRET header.
 * Idempotent — won't double-generate for the same billing period.
 *
 * Schedule (vercel.json): "0 6 * * *" — 6am UTC daily
 */
export async function POST(request: NextRequest) {
    // ── Auth: CRON_SECRET check (timing-safe) ─────────────────────────────────
    const authCheck = verifyCronAuthorization(request);
    if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status ?? 401 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const results = {
        processed: 0,
        generated: 0,
        skipped_already_exists: 0,
        skipped_not_due: 0,
        skipped_no_amount: 0,
        skipped_by_manager: 0,
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
                // Parse anchor date
                const anchorDate = new Date((config.billingAnchorDate as unknown as string) + 'T00:00:00Z');

                // Compute billing schedule using Category B Date Engine (§20–§23)
                const schedule = computeBillingSchedule(
                    {
                        id: config.id,
                        billingAnchorDate: anchorDate,
                        invoiceLeadDays: config.invoiceLeadDays ?? 7,
                        paymentDayOfMonth: config.paymentDayOfMonth,
                        leadTimeUnit: config.leadTimeUnit,
                        leadTimeValue: config.leadTimeValue,
                    },
                    today
                );

                const draftDate = new Date(schedule.draftCreationDate);
                draftDate.setUTCHours(0, 0, 0, 0);

                // ── 2. Check if draft creation date is today or already overdue ────────
                if (draftDate > today) {
                    results.skipped_not_due++;
                    continue;
                }

                const periodStartStr = schedule.periodStart.toISOString().split('T')[0];
                const periodEndStr = schedule.periodEnd.toISOString().split('T')[0];

                // ── 3. Skip Cycle Check (§26, B6) ────────────────────────────────
                const skip = await db.query.billingCycleSkips.findFirst({
                    where: and(
                        eq(billingCycleSkips.billingConfigId, config.id),
                        eq(billingCycleSkips.periodStart, periodStartStr),
                    ),
                });
                if (skip) {
                    results.skipped_by_manager++;
                    continue;
                }

                // ── 4. Amount Resolution & Copy-Forward (§16, §17, Issue E & 8) ───────────────
                // Precedence: most recent issued invoice (sent/partially_paid/paid) > agreedMonthlyPence > 0.00 draft
                let amountPence = 0;
                let amountStr = '0.00';
                let notes: string | null = `Monthly tuition — ${schedule.periodLabel}`;

                // Look for most recent ISSUED invoice for this family & centre context (excluding draft and void)
                const prevIssuedInvoice = await db.query.invoices.findFirst({
                    where: and(
                        eq(invoices.organisationId, config.organisationId),
                        eq(invoices.centreId,       config.centreId),
                        eq(invoices.parentId,       config.parentId),
                        inArray(invoices.status,    ['sent', 'partially_paid', 'paid']),
                    ),
                    orderBy: [desc(invoices.billingPeriodStart), desc(invoices.createdAt)],
                });

                if (prevIssuedInvoice && Number(prevIssuedInvoice.amount) > 0) {
                    amountStr = prevIssuedInvoice.amount;
                    amountPence = Math.round(Number(prevIssuedInvoice.amount) * 100);
                    if (prevIssuedInvoice.notes) {
                        notes = prevIssuedInvoice.notes;
                    }
                } else if (config.agreedMonthlyPence && config.agreedMonthlyPence > 0) {
                    amountPence = config.agreedMonthlyPence;
                    amountStr = String(config.agreedMonthlyPence / 100);
                } else {
                    // Issue 8: First cycle with no prior issued invoice and zero agreed fee: draft saved with 0.00
                    amountPence = 0;
                    amountStr = '0.00';
                }

                // ── 5. Idempotency & Manual Conflict Check (Issue 9) ──────────────────────────
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

                // Check for existing active invoice for this config and period (covers both manual and scheduler invoices linked to this config)
                const existingInvoice = await db.query.invoices.findFirst({
                    where: and(
                        eq(invoices.organisationId,     config.organisationId),
                        eq(invoices.centreId,           config.centreId),
                        eq(invoices.billingConfigId,    config.id),
                        eq(invoices.billingPeriodStart, schedule.periodStart),
                        ne(invoices.status,             'void'),
                    ),
                });

                if (existingInvoice) {
                    try {
                        await db.insert(billingRuns).values({
                            billingConfigId: config.id,
                            periodStart: periodStartStr,
                            periodEnd: periodEndStr,
                            invoiceId: existingInvoice.id,
                            amountPence: amountPence,
                            runBy: null,
                            success: true,
                        }).onConflictDoNothing();
                    } catch {
                        // Ignore if run already recorded
                    }
                    results.skipped_already_exists++;
                    continue;
                }

                // ── 6. Generate draft invoice in a transaction with advisory locking ──
                const coveredChildren = (config.children ?? []).map(cc => ({
                    id: cc.child.id,
                    name: `${cc.child.firstName} ${cc.child.lastName}`,
                }));

                const generatedResult = await db.transaction(async (tx) => {
                    // Advisory lock on config and period to serialize overlapping cron runs
                    const lockKey = `billing_config:${config.id}:${periodStartStr}`;
                    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

                    // Re-check skip cycle inside locked transaction
                    const inTxSkip = await tx.query.billingCycleSkips.findFirst({
                        where: and(
                            eq(billingCycleSkips.billingConfigId, config.id),
                            eq(billingCycleSkips.periodStart, periodStartStr),
                        ),
                    });
                    if (inTxSkip) {
                        return { skipped: true, byManager: true };
                    }

                    // Re-check billingRuns inside locked transaction
                    const inTxRun = await tx.query.billingRuns.findFirst({
                        where: and(
                            eq(billingRuns.billingConfigId, config.id),
                            eq(billingRuns.periodStart, periodStartStr)
                        ),
                    });
                    if (inTxRun?.success) {
                        return { skipped: true, byManager: false };
                    }

                    // Re-check invoices inside locked transaction (covers both manual and scheduler invoices)
                    const inTxInvoice = await tx.query.invoices.findFirst({
                        where: and(
                            eq(invoices.organisationId,     config.organisationId),
                            eq(invoices.centreId,           config.centreId),
                            eq(invoices.parentId,           config.parentId),
                            eq(invoices.billingPeriodStart, schedule.periodStart),
                            ne(invoices.status,             'void'),
                        ),
                    });
                    if (inTxInvoice) {
                        return { skipped: true, byManager: false };
                    }

                    const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

                    const [invoice] = await tx.insert(invoices).values({
                        organisationId: config.organisationId,
                        centreId: config.centreId,
                        parentId: config.parentId,
                        invoiceNumber,
                        amount: amountStr,
                        status: 'draft',
                        invoiceDate: new Date(),
                        dueDate: schedule.dueDate,
                        billingPeriodStart: schedule.periodStart,
                        billingPeriodEnd: schedule.periodEnd,
                        notes: notes,
                        billingConfigId: config.id,
                        billingPeriodLabel: schedule.periodLabel,
                        coveredChildrenJson: coveredChildren,
                    }).returning();

                    await tx.insert(billingRuns).values({
                        billingConfigId: config.id,
                        periodStart: periodStartStr,
                        periodEnd: periodEndStr,
                        invoiceId: invoice.id,
                        amountPence: amountPence,
                        runBy: null, // automated
                        success: true,
                    }).onConflictDoUpdate({
                        target: [billingRuns.billingConfigId, billingRuns.periodStart],
                        set: {
                            invoiceId: invoice.id,
                            amountPence: amountPence,
                            runBy: null,
                            success: true,
                            runAt: new Date(),
                        },
                    });

                    return { skipped: false, invoiceId: invoice.id };
                });

                if (generatedResult.skipped) {
                    if (generatedResult.byManager) {
                        results.skipped_by_manager++;
                    } else {
                        results.skipped_already_exists++;
                    }
                } else {
                    results.generated++;
                }
            } catch (err) {
                results.errors++;
                const msg = err instanceof Error ? err.message : String(err);
                results.errorDetails.push(`config ${config.id}: ${msg}`);
                logger.error(`[cron/billing] Error for config ${config.id}:`, err);
            }
        }

        logger.info('[cron/billing] Run complete:', results);

        return NextResponse.json({
            ok: true,
            runAt: new Date().toISOString(),
            ...results,
        });

    } catch (err) {
        logger.error('[cron/billing] Fatal error:', err);
        return NextResponse.json(
            { error: 'Cron failed', details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/cron/billing
 * Vercel Cron invokes scheduled routes via GET. Delegates to POST handler.
 */
export async function GET(request: NextRequest) {
    return POST(request);
}
