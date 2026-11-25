import { logger } from '@/lib/logger';
import { normaliseServiceType } from '@/features/finance/service-type';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import {
    billingConfigs, billingRuns, billingCycleSkips, invoices, organisations,
} from '@/db/schema';
import { eq, and, or, ne, sql, desc, inArray } from 'drizzle-orm';
import {
    getBillingPeriodForDate,
    computeAutomatedBillingScheduleForIndex,
    isHistoricalBillingPeriod,
    isEligibleAutomatedBillingSchedule,
    toUtcDate,
} from '@/lib/billing/date-engine';
import { nanoid } from 'nanoid';
import { getFinanceEligibleChildIds, assertEligibleBillingCoverage, lockEnrolmentForBilling, lockBillingConfiguration } from '@/lib/enrolment/finance-eligibility';
import { isQuarantinedParentId } from '@/lib/data-quality/quarantine';
import { recurringInvoiceOverlapSql } from '@/lib/billing/invoice-overlap';

export const maxDuration = 60;

const CRON_BUDGET_MS = 50_000;

/**
 * POST /api/cron/billing
 *
 * Automated monthly invoice generation for all active billing configs in ACTIVE organisations.
 * Authoritative rule (CMS-FINANCE-INCIDENT-1):
 * - Automation may create DRAFTS for current and eligible upcoming periods only.
 * - Automation must NEVER create completed historical periods (inclusive UTC date-only semantics:
 *   a period ending today at 00:00:00.000Z is current, not historical).
 * - Selects the current anchored period and eligible upcoming periods directly without walking
 *   historical backlog or fabricating run/skip history.
 * - Discarded drafts (recorded in billing_runs with success=false, invoiceId=null) are not
 *   regenerated automatically unless explicitly reopened by a Manager/Owner.
 *
 * Secured by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
    // ── Auth: CRON_SECRET check (timing-safe) ─────────────────────────────────
    const authCheck = verifyCronAuthorization(request);
    if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status ?? 401 });
    }

    const startedAt = Date.now();
    const today = toUtcDate(new Date());
    let partial = false;

    const results = {
        processed: 0,
        generated: 0,
        skipped_unconfirmed: 0,
        skipped_already_exists: 0,
        skipped_not_due: 0,
        skipped_no_amount: 0,
        skipped_by_manager: 0,
        skipped_quarantined: 0,
        errors: 0,
        errorDetails: [] as Array<{ configId: string; errorCode: string }>,
    };

    try {
        // ── 1. Fetch all active billing configs in ACTIVE organisations ────────
        const fetchedConfigs = await db.query.billingConfigs.findMany({
            where: and(
                eq(billingConfigs.status, 'active'),
                sql`EXISTS (
                    SELECT 1 FROM ${organisations}
                    WHERE ${organisations.id} = ${billingConfigs.organisationId}
                      AND ${organisations.approvalStatus} = 'ACTIVE'
                )`,
            ),
            with: {
                centre: {
                    columns: { id: true },
                    with: {
                        organisation: { columns: { id: true, approvalStatus: true } },
                    },
                },
                children: {
                    with: {
                        child: { columns: { id: true, firstName: true, lastName: true } },
                    },
                },
                runs: {
                    where: eq(billingRuns.success, true),
                    orderBy: [desc(billingRuns.periodStart)],
                    limit: 1,
                },
                skips: {
                    orderBy: [desc(billingCycleSkips.periodStart)],
                    limit: 1,
                },
            },
        });

        // Defensive in-memory guard for mocked/non-SQL test fixtures carrying explicit non-ACTIVE org state
        const configs = fetchedConfigs.filter((config) => {
            const orgStatus =
                config.centre?.organisation?.approvalStatus ??
                (config as { organisation?: { approvalStatus?: string } }).organisation?.approvalStatus;
            return !orgStatus || orgStatus === 'ACTIVE';
        });

        for (const config of configs) {
            if (Date.now() - startedAt >= CRON_BUDGET_MS) {
                partial = true;
                break;
            }
            results.processed++;

            try {
                // DATA-REMEDIATION-1A: Quarantine safety guard
                if (config.parentId && isQuarantinedParentId(config.parentId)) {
                    results.skipped_quarantined++;
                    continue;
                }

                const coveredIds = (config.children ?? []).map(cc => cc.child.id);
                if (coveredIds.length === 0) {
                    results.skipped_unconfirmed++;
                    continue;
                }

                // Directly resolve the current anchored period as of today (never walk historical backlog)
                const currentAnchoredPeriod = getBillingPeriodForDate(config.billingAnchorDate, today);
                let periodIndex = currentAnchoredPeriod.periodIndex;

                // Evaluate only current and eligible upcoming anchored periods.
                // Defer getFinanceEligibleChildIds until at least one cycle is actually due (draftDate <= today)
                // so future-only configs do not trigger redundant N+1 DB queries.
                const MAX_CYCLES_PER_CONFIG = 12;
                let cyclesProcessed = 0;
                let eligibilityChecked = false;
                let configUnconfirmed = false;

                while (cyclesProcessed < MAX_CYCLES_PER_CONFIG) {
                    if (cyclesProcessed > 0 && Date.now() - startedAt >= CRON_BUDGET_MS) {
                        partial = true;
                        break;
                    }

                    const targetIndex = periodIndex;
                    periodIndex++;
                    cyclesProcessed++;

                    const schedule = computeAutomatedBillingScheduleForIndex(
                        {
                            id: config.id,
                            billingAnchorDate: config.billingAnchorDate,
                            invoiceLeadDays: config.invoiceLeadDays ?? 7,
                            paymentDayOfMonth: config.paymentDayOfMonth,
                            leadTimeUnit: config.leadTimeUnit,
                            leadTimeValue: config.leadTimeValue,
                        },
                        targetIndex,
                    );

                    // Authoritative guard: never create completed historical periods, and never fabricate run/skip records
                    if (isHistoricalBillingPeriod(schedule.periodEnd, today)) {
                        continue;
                    }

                    const draftDate = toUtcDate(schedule.draftCreationDate);

                    // ── 2. Check if draft creation date is today or already due ────────
                    if (draftDate > today) {
                        if (cyclesProcessed === 1) {
                            results.skipped_not_due++;
                        }
                        break;
                    }

                    if (!eligibilityChecked) {
                        eligibilityChecked = true;
                        const eligibleIds = await getFinanceEligibleChildIds(
                            config.organisationId,
                            coveredIds,
                            db,
                            { parentId: config.parentId, centreId: config.centreId },
                        );
                        if (coveredIds.some(id => !eligibleIds.has(id))) {
                            configUnconfirmed = true;
                            break;
                        }
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

                    // ── 5. Idempotency, Discarded-Draft & Manual Conflict Check ──────────────────────────
                    const existingRun = await db.query.billingRuns.findFirst({
                        where: and(
                            eq(billingRuns.billingConfigId, config.id),
                            eq(billingRuns.periodStart, periodStartStr)
                        ),
                    });

                    // Respect both completed runs (success=true) and discarded drafts (success=false)
                    // until explicitly reopened via reopenBillingCycle.
                    if (existingRun) {
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
                        await lockBillingConfiguration(tx, config.id);
                        const lockKey = `billing_config:${config.id}:${periodStartStr}`;
                        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
                        await lockEnrolmentForBilling(tx, coveredIds);

                        // Recheck period eligibility inside the creation transaction (inclusive UTC date-only semantics)
                        const txToday = toUtcDate(new Date());
                        if (!isEligibleAutomatedBillingSchedule(schedule, txToday)) {
                            return { skipped: true, byManager: false, notEligible: true };
                        }

                        // Re-check skip cycle inside locked transaction
                        const inTxSkip = await tx.query.billingCycleSkips.findFirst({
                            where: and(
                                eq(billingCycleSkips.billingConfigId, config.id),
                                eq(billingCycleSkips.periodStart, periodStartStr),
                            ),
                        });
                        if (inTxSkip) {
                            return { skipped: true, byManager: true, notEligible: false };
                        }

                        // Re-check billingRuns inside locked transaction (including discarded drafts with success=false)
                        const inTxRun = await tx.query.billingRuns.findFirst({
                            where: and(
                                eq(billingRuns.billingConfigId, config.id),
                                eq(billingRuns.periodStart, periodStartStr)
                            ),
                        });
                        if (inTxRun) {
                            return { skipped: true, byManager: false, notEligible: false };
                        }

                        // Re-check invoices inside locked transaction (covers both manual and scheduler invoices)
                        const inTxInvoice = await tx.query.invoices.findFirst({
                            where: and(
                                eq(invoices.organisationId,     config.organisationId),
                                eq(invoices.centreId,           config.centreId),
                                eq(invoices.parentId,           config.parentId),
                                or(eq(invoices.billingPeriodStart, schedule.periodStart),
                                    recurringInvoiceOverlapSql(coveredIds, schedule.periodStart, schedule.periodEnd)),
                                ne(invoices.status,             'void'),
                            ),
                        });
                        if (inTxInvoice) {
                            return { skipped: true, byManager: false, notEligible: false };
                        }

                        assertEligibleBillingCoverage(coveredIds, await getFinanceEligibleChildIds(config.organisationId, coveredIds, tx, { parentId: config.parentId, centreId: config.centreId, billingConfig: config }, {
                            startDate: periodStartStr, endDate: periodEndStr,
                        }));

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
                            serviceType: normaliseServiceType(config.serviceType),
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

                        return { skipped: false, invoiceId: invoice.id, notEligible: false };
                    });

                    if (generatedResult.skipped) {
                        if (generatedResult.notEligible) {
                            results.skipped_not_due++;
                        } else if (generatedResult.byManager) {
                            results.skipped_by_manager++;
                        } else {
                            results.skipped_already_exists++;
                        }
                    } else {
                        results.generated++;
                    }
                } // end while (current & upcoming eligible cycles)

                if (configUnconfirmed) {
                    results.skipped_unconfirmed++;
                    continue;
                }

                if (partial) {
                    break;
                }
            } catch (err) {
                results.errors++;
                results.errorDetails.push({
                    configId: config.id,
                    errorCode: 'billing_generation_failed',
                });
                logger.error(`[cron/billing] Error for config ${config.id}:`, err);
            }
        }

        if (partial) {
            logger.warn('[cron/billing] Cooperative time budget reached; exiting cleanly with partial progress', {
                processed: results.processed,
                totalConfigs: configs.length,
            });
        } else {
            logger.info('[cron/billing] Run complete:', results);
        }

        return NextResponse.json({
            ok: true,
            partial,
            runAt: new Date().toISOString(),
            ...results,
        });

    } catch (err) {
        logger.error('[cron/billing] Fatal error:', err);
        return NextResponse.json(
            { error: 'Cron failed' },
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
