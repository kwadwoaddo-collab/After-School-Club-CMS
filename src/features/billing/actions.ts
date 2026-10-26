'use server';

/**
 * Billing server actions — family agreed-fee model.
 * All mutations go through these functions (create, update, pause, etc.)
 */

import { requireTenantSession, TypedSession } from '@/lib/session';
import { db } from '@/db';
import { billingConfigs, billingConfigChildren, billingRuns, billingCycleSkips, invoices, children, auditEvents, payments } from '@/db/schema';
import { eq, and, sql, ne, inArray, isNull, desc, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { computeNextBillingPeriod, penceToPounds } from '@/lib/billing';
import {
    computeExpectedPaymentDate,
    computeAutomatedBillingScheduleForIndex,
    getBillingPeriodForDate,
    isEligibleAutomatedBillingSchedule,
    isHistoricalBillingPeriod,
    validateBillingPeriodSelection,
    LeadTimeUnit,
} from '@/lib/billing/date-engine';
import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { captureBillingResult } from './billing-problem';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { financeEligibleChildSql, getFinanceEligibleChildIds, assertEligibleBillingCoverage, lockEnrolmentForBilling, confirmedEnrolmentChildSql, lifecycleEligibleChildSql, lockBillingConfiguration } from '@/lib/enrolment/finance-eligibility';
import { assertNotQuarantined } from '@/lib/data-quality/quarantine';
import { recurringInvoiceOverlapSql } from '@/lib/billing/invoice-overlap';

// ─── Auth helper ──────────────────────────────────────────────────────────────

/**
 * Milestone 3G, L2: every mutation below previously checked organisation
 * membership only (via a bare session/organisationId check), with no role or
 * centre check at all.
 * BillingSettingsCard — this module's own UI — is rendered unconditionally
 * inside the frozen Students module's StudentProfile.tsx, which is viewable
 * by ORG_OWNER, MANAGER, and FRONT_DESK. That meant MANAGER/FRONT_DESK staff
 * could create, edit, pause, resume, or cancel ANY family's recurring
 * billing config org-wide, including families at centres they have no
 * assignment to — live-reachable through the real UI, not just a crafted
 * direct call. See project-notes/milestone-3g-finance-audit.md, L2.
 *
 * This helper applies the same evidenced policy already used by every
 * non-owner-aware mutation in src/features/finance/actions.ts (recordPayment,
 * updateInvoiceDate, updateInvoiceNotes, verifyPayment, failPayment):
 * ORG_OWNER bypasses the check; everyone else must have the target centre in
 * their accessible-centres list.
 */
async function assertCentreAccess(session: TypedSession, centreId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session.user.role isn't in the base NextAuth type; same cast pattern used throughout src/features/finance/actions.ts
    const userRole = (session.user as any).role;
    if (userRole === 'ORG_OWNER') return;
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (!accessibleCentreIds.includes(centreId)) {
        throw new Error('Unauthorized: No access to this centre');
    }
}

async function getOrgIdAndSession(): Promise<{ orgId: string; session: TypedSession }> {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    return { orgId: session.user.organisationId, session };
}

/** Called only in the transaction that saves an explicitly reviewed fee/start
 * and exact family coverage. Activating a student alone never clears this hold. */
async function confirmRestartFeeReview(
    tx: Pick<typeof db, 'execute' | 'insert'>,
    orgId: string,
    actorId: string,
    configId: string,
    childIds: string[],
    amountPence: number,
    startDate: string,
) {
    if (childIds.length === 0) return;
    await tx.execute(sql`UPDATE student_enrolment_events reviewed
        SET fee_review_confirmed = true, billing_reviewed_from = ${startDate}::date
        WHERE reviewed.organisation_id = ${orgId}
          AND reviewed.child_id IN (${sql.join(childIds.map(id => sql`${id}::uuid`), sql`, `)})
          AND reviewed.status = 'active' AND reviewed.fee_review_confirmed = false
          AND reviewed.id = (SELECT latest.id FROM student_enrolment_events latest
              WHERE latest.child_id = reviewed.child_id AND latest.organisation_id = reviewed.organisation_id
                AND latest.effective_date <= ${startDate}::date
              ORDER BY latest.effective_date DESC, latest.created_at DESC, latest.id DESC LIMIT 1)`);
    await tx.insert(auditEvents).values({
        organisationId: orgId,
        userId: actorId,
        eventType: 'student_restart_billing_reviewed',
        eventData: JSON.stringify({ configId, childIds, agreedMonthlyPence: amountPence, billingStartDate: startDate }),
    });
}

// ─── Create / Update config ───────────────────────────────────────────────────

export interface BillingConfigData {
    parentId:           string;
    centreId:           string;
    agreedMonthlyPence: number;
    billingAnchorDate:  string;   // ISO date string 'YYYY-MM-DD'
    invoiceLeadDays?:   number;
    paymentDayOfMonth?: number | null;
    leadTimeUnit?:      LeadTimeUnit | null;
    leadTimeValue?:     number | null;
    notes?:             string;
    childIds:           string[]; // which children to cover
}

/**
 * Create a new family billing config.
 * Also links all childIds provided to this config.
 */
export async function createBillingConfig(data: BillingConfigData) {
    const { orgId, session } = await getOrgIdAndSession();
    await assertCentreAccess(session, data.centreId);
    assertNotQuarantined(data.parentId, 'Billing configuration');

    if (!['ORG_OWNER', 'MANAGER'].includes(session.user.role)) throw new Error('Only an Owner or Manager can review family billing');
    if (!Number.isInteger(data.agreedMonthlyPence) || data.agreedMonthlyPence <= 0) throw new Error('Enter the agreed family fee before billing review');

    if (data.childIds.length === 0) throw new Error('Select at least one confirmed signed-up student for billing');
    if (data.childIds.length > 0) {
        const validChildren = await db.select({ id: children.id })
            .from(children)
            .where(
                and(
                    inArray(children.id, data.childIds),
                    eq(children.organisationId, orgId),
                    eq(children.parentId, data.parentId),
                    eq(children.centreId, data.centreId),
                    isNull(children.deletedAt),
                    confirmedEnrolmentChildSql(),
                    lifecycleEligibleChildSql(data.billingAnchorDate, data.billingAnchorDate, false)
                )
            );

        if (validChildren.length !== data.childIds.length) {
            throw new Error('One or more children are invalid or do not belong to this family/centre');
        }
    }

    // Check for existing config for this parent+centre
    const existing = await db.query.billingConfigs.findFirst({
        where: and(
            eq(billingConfigs.parentId,       data.parentId),
            eq(billingConfigs.centreId,        data.centreId),
            eq(billingConfigs.organisationId,  orgId),
        ),
    });
    if (existing) {
        throw new Error('A billing config already exists for this family at this centre. Use update instead.');
    }

    const config = await db.transaction(async (tx) => {
        await lockEnrolmentForBilling(tx, data.childIds);
        const reviewedChildren = await tx.select({ id: children.id }).from(children).where(and(
            inArray(children.id, data.childIds), eq(children.organisationId, orgId),
            eq(children.parentId, data.parentId), eq(children.centreId, data.centreId),
            isNull(children.deletedAt), confirmedEnrolmentChildSql(),
            lifecycleEligibleChildSql(data.billingAnchorDate, data.billingAnchorDate, false),
        ));
        assertEligibleBillingCoverage(data.childIds, new Set(reviewedChildren.map(child => child.id)));
        const [newConfig] = await tx.insert(billingConfigs).values({
            organisationId:     orgId,
            centreId:           data.centreId,
            parentId:           data.parentId,
            agreedMonthlyPence: data.agreedMonthlyPence ?? 0,
            billingAnchorDate:  data.billingAnchorDate,
            invoiceLeadDays:    data.invoiceLeadDays ?? 7,
            paymentDayOfMonth:  data.paymentDayOfMonth ?? null,
            leadTimeUnit:       data.leadTimeUnit ?? null,
            leadTimeValue:      data.leadTimeValue ?? null,
            notes:              data.notes ?? null,
            status:             'active',
        }).returning();

        // Link all specified children
        if (data.childIds.length > 0) {
            await tx.insert(billingConfigChildren).values(
                data.childIds.map(childId => ({
                    configId: newConfig.id,
                    childId,
                }))
            ).onConflictDoNothing();
        }

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'billing_config_created',
            eventData: JSON.stringify({
                configId: newConfig.id,
                parentId: data.parentId,
                centreId: data.centreId,
                agreedMonthlyPence: data.agreedMonthlyPence ?? 0,
            }),
        });

        await confirmRestartFeeReview(tx, orgId, session.user.id, newConfig.id, data.childIds,
            data.agreedMonthlyPence, data.billingAnchorDate);
        return newConfig;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/centres/${data.centreId}/billing`);
    if (data.parentId) {
        revalidatePath(`/dashboard/parents/${data.parentId}`);
    }
    if (data.childIds) {
        for (const childId of data.childIds) {
            revalidatePath(`/dashboard/students/${childId}`);
        }
    }
    return { success: true, configId: config.id };
}

/**
 * Update an existing billing config's fee, dates, and scheduler settings.
 */
export async function updateBillingConfig(
    configId: string,
    data: Partial<Omit<BillingConfigData, 'parentId' | 'centreId' | 'childIds'>> & { childIds?: string[] },
) {
    const { orgId, session } = await getOrgIdAndSession();

    const existingConfig = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        with: {
            children: true,
        },
    });
    if (!existingConfig) throw new Error('Billing config not found');
    await assertCentreAccess(session, existingConfig.centreId);
    assertNotQuarantined(existingConfig.parentId, 'Billing configuration update');

    const childIds = data.childIds ?? (existingConfig.children ?? []).map(link => link.childId);
    const isFeeReview = data.agreedMonthlyPence !== undefined && data.billingAnchorDate !== undefined;
    if ((data.agreedMonthlyPence !== undefined || data.billingAnchorDate !== undefined || data.childIds !== undefined) && !['ORG_OWNER', 'MANAGER'].includes(session.user.role)) throw new Error('Only an Owner or Manager can review family billing and coverage');
    if (data.childIds !== undefined && !isFeeReview) throw new Error('Review billing settings with the family fee and start date when changing covered students');
    if (isFeeReview && (!Number.isInteger(data.agreedMonthlyPence) || data.agreedMonthlyPence! <= 0)) throw new Error('Enter the agreed family fee before billing review');
    if (data.childIds !== undefined && childIds.length === 0) throw new Error('Select at least one confirmed active student');

    await db.transaction(async tx => {
        await lockBillingConfiguration(tx, configId);
        await lockEnrolmentForBilling(tx, [...childIds, ...(existingConfig.children ?? []).map(link => link.childId)]);
        if (isFeeReview || data.childIds !== undefined) {
            const startDate = data.billingAnchorDate ?? existingConfig.billingAnchorDate;
            const valid = await tx.select({ id: children.id }).from(children).where(and(
                inArray(children.id, childIds), eq(children.organisationId, orgId),
                eq(children.parentId, existingConfig.parentId), eq(children.centreId, existingConfig.centreId),
                isNull(children.deletedAt), confirmedEnrolmentChildSql(),
                lifecycleEligibleChildSql(startDate, startDate, false),
            ));
            assertEligibleBillingCoverage(childIds, new Set(valid.map(child => child.id)));
        }
        await tx.update(billingConfigs)
        .set({
            ...(data.agreedMonthlyPence !== undefined && { agreedMonthlyPence: data.agreedMonthlyPence }),
            ...(data.billingAnchorDate  !== undefined && { billingAnchorDate:  data.billingAnchorDate }),
            ...(data.invoiceLeadDays    !== undefined && { invoiceLeadDays:    data.invoiceLeadDays }),
            ...(data.paymentDayOfMonth  !== undefined && { paymentDayOfMonth:  data.paymentDayOfMonth }),
            ...(data.leadTimeUnit       !== undefined && { leadTimeUnit:       data.leadTimeUnit }),
            ...(data.leadTimeValue      !== undefined && { leadTimeValue:      data.leadTimeValue }),
            ...(data.notes              !== undefined && { notes:              data.notes }),
            updatedAt: new Date(),
        })
        .where(and(
            eq(billingConfigs.id,             configId),
            eq(billingConfigs.organisationId, orgId),
        ));

        if (data.childIds !== undefined) {
            await tx.delete(billingConfigChildren).where(eq(billingConfigChildren.configId, configId));
            await tx.insert(billingConfigChildren).values(childIds.map(childId => ({ configId, childId }))).onConflictDoNothing();
        }

        await tx.insert(auditEvents).values({
        organisationId: orgId,
        userId: session.user.id,
        eventType: 'billing_config_updated',
        eventData: JSON.stringify({
            configId,
            changedFields: Object.keys(data),
        }),
        });
        if (isFeeReview) await confirmRestartFeeReview(tx, orgId, session.user.id, configId, childIds,
            data.agreedMonthlyPence!, data.billingAnchorDate!);
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/centres/${existingConfig.centreId}/billing`);
    if (existingConfig.parentId) {
        revalidatePath(`/dashboard/parents/${existingConfig.parentId}`);
    }
    if (existingConfig.children) {
        for (const c of existingConfig.children) {
            revalidatePath(`/dashboard/students/${c.childId}`);
        }
    }
    return { success: true };
}

// ─── Child management ─────────────────────────────────────────────────────────

/**
 * Add a child to an existing family billing config.
 */
export async function addChildToConfig(configId: string, childId: string) {
    const { orgId, session } = await getOrgIdAndSession();

    // Verify the config belongs to this org
    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        with: { children: true },
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    const validChildren = await db.select({ id: children.id })
        .from(children)
        .where(
            and(
                eq(children.id, childId),
                eq(children.organisationId, orgId),
                eq(children.parentId, config.parentId),
                eq(children.centreId, config.centreId),
                isNull(children.deletedAt),
                financeEligibleChildSql()
            )
        );

    if (validChildren.length !== 1) {
        throw new Error('Child is invalid or does not belong to this family/centre');
    }

    return updateBillingConfig(configId, { childIds: [...new Set([...(config.children ?? []).map(link => link.childId), childId])] });
}

/**
 * Remove a child from a billing config.
 */
export async function removeChildFromConfig(configId: string, childId: string) {
    const { orgId, session } = await getOrgIdAndSession();

    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        with: { children: true },
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    return updateBillingConfig(configId, { childIds: (config.children ?? []).map(link => link.childId).filter(id => id !== childId) });
}

// ─── Status management ────────────────────────────────────────────────────────

async function requireOwnedConfig(configId: string, orgId: string, session: TypedSession) {
    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        columns: { centreId: true, parentId: true },
        with: { children: true },
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);
    if (!['ORG_OWNER', 'MANAGER'].includes(session.user.role)) throw new Error('Only an Owner or Manager can change billing status');
    return config;
}

async function setBillingConfigStatus(configId: string, orgId: string, session: TypedSession,
    config: Awaited<ReturnType<typeof requireOwnedConfig>>, status: 'active' | 'paused' | 'cancelled') {
    await db.transaction(async tx => {
        await lockBillingConfiguration(tx, configId);
        await lockEnrolmentForBilling(tx, (config.children ?? []).map(link => link.childId));
        await tx.update(billingConfigs).set({ status, updatedAt: new Date() })
            .where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
        await tx.insert(auditEvents).values({ organisationId: orgId, userId: session.user.id,
            eventType: 'billing_status_changed', eventData: JSON.stringify({ configId, status }),
        });
    });
}

export async function pauseBillingConfig(configId: string) {
    const { orgId, session } = await getOrgIdAndSession();
    const config = await requireOwnedConfig(configId, orgId, session);
    await setBillingConfigStatus(configId, orgId, session, config, 'paused');
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    for (const c of config.children ?? []) {
        revalidatePath(`/dashboard/students/${c.childId}`);
    }
    return { success: true };
}

export async function resumeBillingConfig(configId: string) {
    const { orgId, session } = await getOrgIdAndSession();
    const config = await requireOwnedConfig(configId, orgId, session);
    await setBillingConfigStatus(configId, orgId, session, config, 'active');
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    for (const c of config.children ?? []) {
        revalidatePath(`/dashboard/students/${c.childId}`);
    }
    return { success: true };
}

export async function cancelBillingConfig(configId: string) {
    const { orgId, session } = await getOrgIdAndSession();
    const config = await requireOwnedConfig(configId, orgId, session);
    await setBillingConfigStatus(configId, orgId, session, config, 'cancelled');
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    for (const c of config.children ?? []) {
        revalidatePath(`/dashboard/students/${c.childId}`);
    }
    return { success: true };
}

// ─── Skip Cycle & Reopen Actions (§26, §27, B4, B7) ──────────────────────────

/**
 * Intentionally skip a billing cycle for a family billing configuration (§26, B4).
 * If an unissued draft invoice already exists for this cycle, it is discarded (voided).
 * Rejects if an issued invoice already exists.
 */
export async function skipBillingCycle(
    configId: string,
    periodStartStr: string,
    reason: string,
) {
    const { orgId, session } = await getOrgIdAndSession();
    if (!reason || !reason.trim()) {
        throw new Error('Skip reason is required');
    }

    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    const periodStartDate = new Date(periodStartStr);

    const result = await db.transaction(async (tx) => {
        const lockKey = `billing_config:${configId}:${periodStartStr}`;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

        // Check for existing invoice for this period
        const existingInvoice = await tx.query.invoices.findFirst({
            where: and(
                eq(invoices.billingConfigId, configId),
                eq(invoices.billingPeriodStart, periodStartDate),
                ne(invoices.status, 'void'),
            ),
        });

        if (existingInvoice) {
            if (existingInvoice.status !== 'draft') {
                throw new Error(`Cannot skip cycle: an issued invoice (${existingInvoice.invoiceNumber}) already exists for this period`);
            }

            // Check if draft has any payments
            const paymentCount = await tx.select({ count: sql<number>`count(*)` })
                .from(payments)
                .where(eq(payments.invoiceId, existingInvoice.id));
            if (Number(paymentCount[0]?.count ?? 0) > 0) {
                throw new Error('Cannot skip cycle: draft invoice has associated payments');
            }

            // Discard unissued draft invoice (Issue A)
            await tx.update(billingRuns)
                .set({ success: false, errorLog: `Draft discarded due to cycle skip by ${session.user.id}`, invoiceId: null })
                .where(eq(billingRuns.invoiceId, existingInvoice.id));

            await tx.delete(invoices)
                .where(eq(invoices.id, existingInvoice.id));

            await tx.insert(auditEvents).values({
                organisationId: orgId,
                userId: session.user.id,
                eventType: 'invoice_draft_discarded',
                eventData: JSON.stringify({
                    invoiceId: existingInvoice.id,
                    invoiceNumber: existingInvoice.invoiceNumber,
                    reason: 'Discarded during skip cycle',
                }),
            });
        }

        const [skip] = await tx.insert(billingCycleSkips).values({
            billingConfigId: configId,
            periodStart: periodStartStr,
            skippedBy: session.user.id,
            skipReason: reason.trim(),
        }).onConflictDoUpdate({
            target: [billingCycleSkips.billingConfigId, billingCycleSkips.periodStart],
            set: {
                skippedBy: session.user.id,
                skipReason: reason.trim(),
                skippedAt: new Date(),
            },
        }).returning();

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'billing_cycle_skipped',
            eventData: JSON.stringify({
                configId,
                periodStart: periodStartStr,
                reason: reason.trim(),
            }),
        });

        return skip;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    return { success: true, skipId: result.id };
}

/**
 * Remove a cycle skip record, allowing the cycle to be billed on the next run (§26).
 */
export async function unskipBillingCycle(configId: string, periodStartStr: string) {
    const { orgId, session } = await getOrgIdAndSession();

    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    await db.transaction(async (tx) => {
        await tx.delete(billingCycleSkips).where(
            and(
                eq(billingCycleSkips.billingConfigId, configId),
                eq(billingCycleSkips.periodStart, periodStartStr),
            )
        );

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'billing_cycle_unskipped',
            eventData: JSON.stringify({
                configId,
                periodStart: periodStartStr,
            }),
        });
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    return { success: true };
}

/**
 * Manager/Owner explicit regeneration of a voided/skipped billing cycle (§27, Issue B).
 * Removes the historical billingRun entry, allowing draft generation to re-occur.
 */
export async function reopenBillingCycle(configId: string, periodStartStr: string) {
    const { orgId, session } = await getOrgIdAndSession();
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Unauthorized: Only Org Owner and Centre Managers can reopen a billing cycle');
    }

    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    const periodStartDate = new Date(periodStartStr);

    await db.transaction(async (tx) => {
        const activeInvoice = await tx.query.invoices.findFirst({
            where: and(
                eq(invoices.billingConfigId, configId),
                eq(invoices.billingPeriodStart, periodStartDate),
                ne(invoices.status, 'void'),
            ),
        });
        if (activeInvoice) {
            throw new Error(`Cannot reopen cycle: an active invoice (${activeInvoice.invoiceNumber}) exists for this period`);
        }

        await tx.delete(billingRuns).where(
            and(
                eq(billingRuns.billingConfigId, configId),
                eq(billingRuns.periodStart, periodStartStr),
            )
        );

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'billing_cycle_reopened',
            eventData: JSON.stringify({
                configId,
                periodStart: periodStartStr,
            }),
        });
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    return { success: true };
}

// ─── Invoice generation ───────────────────────────────────────────────────────

export interface GenerateInvoiceInput {
    configId:          string;
    periodStartStr:    string;  // 'YYYY-MM-DD'
    periodEndStr:      string;
    amountPence?:      number;
    notes?:            string;
    confirmHistorical?: boolean;
    historicalReason?:  string;
}

/**
 * Generate a family invoice draft for a single explicitly selected billing period.
 * Authoritative rules (CMS-FINANCE-INCIDENT-1):
 * - Restricted to ORG_OWNER and centre-authorized MANAGER.
 * - Validates periodStartStr / periodEndStr against the configuration's anchor.
 * - When the selected period is historical (periodEnd < today UTC), requires explicit
 *   confirmation and a non-empty reason, and records an actor/reason audit event.
 * - Creates a DRAFT only (status: 'draft') with actual creation timestamp (new Date()).
 * - Never triggers automatic catch-up across other periods and never sends parent email.
 */
export async function generateInvoiceFromConfig(input: GenerateInvoiceInput) {
    return generateInvoiceFromConfigInternal(input, false);
}

/** Prepare only a period whose canonical preparation window has opened.
 * Deliberately separate from explicit manual historical/future generation. */
export async function generateEligibleDraftFromConfig(input: GenerateInvoiceInput) {
    return generateInvoiceFromConfigInternal(input, true);
}

function assertEligibleDraftWindow(config: typeof billingConfigs.$inferSelect, input: GenerateInvoiceInput) {
    const selection = validateBillingPeriodSelection(input.periodStartStr, input.periodEndStr, config.billingAnchorDate);
    if (!selection.valid) throw new Error(selection.error || 'Invalid billing period selection');
    const { periodIndex } = getBillingPeriodForDate(config.billingAnchorDate, input.periodStartStr);
    const schedule = computeAutomatedBillingScheduleForIndex(config, periodIndex);
    if (schedule.periodStart.toISOString().slice(0, 10) !== input.periodStartStr ||
        schedule.periodEnd.toISOString().slice(0, 10) !== input.periodEndStr ||
        !isEligibleAutomatedBillingSchedule(schedule, new Date())) {
        throw new Error('This billing period is not eligible for draft preparation today. Review the preparation date; use explicit manual generation for a deliberately selected period.');
    }
}

async function generateInvoiceFromConfigInternal(input: GenerateInvoiceInput, eligibleOnly: boolean) {
    const { orgId, session } = await getOrgIdAndSession();

    const config = await db.query.billingConfigs.findFirst({
        where: and(
            eq(billingConfigs.id,             input.configId),
            eq(billingConfigs.organisationId, orgId),
        ),
        with: {
            children: {
                with: { child: { columns: { id: true, firstName: true, lastName: true } } },
            },
        },
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Unauthorized: Only Org Owner and Centre Managers can generate invoices');
    }

    if (config.status !== 'active') throw new Error('Billing config is not active');
    assertNotQuarantined(config.parentId, 'Invoice generation');

    // Validate period selection
    const periodValidation = validateBillingPeriodSelection(
        input.periodStartStr,
        input.periodEndStr,
        config.billingAnchorDate,
    );
    if (!periodValidation.valid) {
        throw new Error(periodValidation.error || 'Invalid billing period selection');
    }

    if (eligibleOnly) assertEligibleDraftWindow(config, input);

    // Pre-check: Skip cycle check
    const existingSkip = await db.query.billingCycleSkips.findFirst({
        where: and(
            eq(billingCycleSkips.billingConfigId, input.configId),
            eq(billingCycleSkips.periodStart,     input.periodStartStr),
        ),
    });
    if (existingSkip) {
        throw new Error(`Cannot generate invoice: billing cycle ${input.periodStartStr} is skipped (${existingSkip.skipReason})`);
    }

    // Historical period control: require explicit warning confirmation and audit reason
    const isHistorical = isHistoricalBillingPeriod(input.periodEndStr, new Date());
    const trimmedHistoricalReason = input.historicalReason?.trim() ?? '';
    if (isHistorical) {
        if (!input.confirmHistorical || trimmedHistoricalReason.length < 3) {
            throw new Error(
                'Historical billing period warning: generating a draft for a completed historical period requires explicit confirmation and a reason for audit.'
            );
        }
    }

    // Pre-transaction check 1: Billing run check
    const existingRun = await db.query.billingRuns.findFirst({
        where: and(
            eq(billingRuns.billingConfigId, input.configId),
            eq(billingRuns.periodStart,     input.periodStartStr),
        ),
    });
    if (existingRun?.success) {
        if (existingRun.invoiceId) {
            return { success: true, invoiceId: existingRun.invoiceId, alreadyGenerated: true };
        }
        throw new Error(`Invoice already generated for period ${input.periodStartStr}`);
    }

    // Pre-transaction check 2: Existing active invoice check (covers both scheduler & manual invoices for this config and period)
    const periodStartDate = new Date(input.periodStartStr);
    const existingInvoice = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.organisationId,     orgId),
            eq(invoices.centreId,           config.centreId),
            eq(invoices.parentId, config.parentId),
            or(and(eq(invoices.billingConfigId, config.id), eq(invoices.billingPeriodStart, periodStartDate)),
                recurringInvoiceOverlapSql((config.children ?? []).map(link => link.child.id), periodStartDate, new Date(input.periodEndStr))),
            ne(invoices.status,             'void'),
        ),
    });
    if (existingInvoice) {
        if (existingInvoice.billingPeriodStart && new Date(existingInvoice.billingPeriodStart).getTime() !== periodStartDate.getTime()) {
            throw new Error('The selected billing period overlaps an existing family invoice. Review coverage before creating another draft; no automatic proration or credit has been applied.');
        }
        return { success: true, invoiceId: existingInvoice.id, alreadyGenerated: true };
    }

    const coveredIds = (config.children ?? []).map(cc => cc.child.id);
    const servicePeriod = { startDate: input.periodStartStr, endDate: input.periodEndStr };
    assertEligibleBillingCoverage(coveredIds, await getFinanceEligibleChildIds(orgId, coveredIds, db, { parentId: config.parentId, centreId: config.centreId }, servicePeriod));

    // Copy-forward resolution (§16, §17, Issue E & 8)
    // Precedence: explicit input > most recent issued invoice (sent/partially_paid/paid) > agreedMonthlyPence > 0.00 draft
    let finalAmountStr: string;
    let finalNotes: string | null = input.notes ?? null;
    let recordedAmountPence: number = 0;

    if (input.amountPence !== undefined && input.amountPence > 0) {
        recordedAmountPence = input.amountPence;
        finalAmountStr = String(input.amountPence / 100);
    } else {
        // Query most recent issued invoice (excluding draft and void)
        const prevIssuedInvoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.organisationId, orgId),
                eq(invoices.centreId,       config.centreId),
                eq(invoices.parentId,       config.parentId),
                inArray(invoices.status,    ['sent', 'partially_paid', 'paid']),
            ),
            orderBy: [desc(invoices.billingPeriodStart), desc(invoices.createdAt)],
        });

        if (prevIssuedInvoice && Number(prevIssuedInvoice.amount) > 0) {
            finalAmountStr = prevIssuedInvoice.amount;
            recordedAmountPence = Math.round(Number(prevIssuedInvoice.amount) * 100);
            if (!finalNotes && prevIssuedInvoice.notes) {
                finalNotes = prevIssuedInvoice.notes;
            }
        } else if (config.agreedMonthlyPence > 0) {
            recordedAmountPence = config.agreedMonthlyPence;
            finalAmountStr = String(config.agreedMonthlyPence / 100);
        } else {
            // First cycle with no prior issued invoice and zero agreed fee: draft saved with 0.00 (Issue 8)
            finalAmountStr = '0.00';
            recordedAmountPence = 0;
        }
    }

    // Build children snapshot
    const coveredChildren = (config.children ?? []).map(cc => ({
        id:   cc.child.id,
        name: `${cc.child.firstName} ${cc.child.lastName}`,
    }));

    // Calculate due date respecting paymentDayOfMonth
    const dueDate = computeExpectedPaymentDate(periodStartDate, config.paymentDayOfMonth);

    const result = await db.transaction(async (tx) => {
        // PM-2C: Transactional advisory lock to serialize concurrent generation for the same config & period
        await lockBillingConfiguration(tx, input.configId);
        const lockKey = `billing_config:${input.configId}:${input.periodStartStr}`;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
        await lockEnrolmentForBilling(tx, coveredIds);

        // A settings change while waiting for the lock must not admit an early draft.
        if (eligibleOnly) {
            const lockedConfig = await tx.query.billingConfigs.findFirst({
                where: and(eq(billingConfigs.id, input.configId), eq(billingConfigs.organisationId, orgId)),
            });
            if (!lockedConfig || lockedConfig.status !== 'active') throw new Error('Billing config is not active');
            assertEligibleDraftWindow(lockedConfig, input);
        }

        // Re-check inside locked transaction: skip cycle
        const inTxSkip = await tx.query.billingCycleSkips.findFirst({
            where: and(
                eq(billingCycleSkips.billingConfigId, input.configId),
                eq(billingCycleSkips.periodStart,     input.periodStartStr),
            ),
        });
        if (inTxSkip) {
            throw new Error(`Cannot generate invoice: billing cycle ${input.periodStartStr} is skipped (${inTxSkip.skipReason})`);
        }

        // Re-check inside locked transaction: billing_runs
        const inTxRun = await tx.query.billingRuns.findFirst({
            where: and(
                eq(billingRuns.billingConfigId, input.configId),
                eq(billingRuns.periodStart,     input.periodStartStr),
            ),
        });
        if (inTxRun?.success) {
            if (inTxRun.invoiceId) {
                return { id: inTxRun.invoiceId, alreadyGenerated: true };
            }
            throw new Error(`Invoice already generated for period ${input.periodStartStr}`);
        }

        // Re-check inside locked transaction: invoices (covers both scheduler & manual invoices linked to this config)
        const inTxInvoice = await tx.query.invoices.findFirst({
            where: and(
                eq(invoices.organisationId,     orgId),
                eq(invoices.centreId,           config.centreId),
                eq(invoices.parentId, config.parentId),
                or(and(eq(invoices.billingConfigId, config.id), eq(invoices.billingPeriodStart, periodStartDate)),
                    recurringInvoiceOverlapSql(coveredIds, periodStartDate, new Date(input.periodEndStr))),
                ne(invoices.status,             'void'),
            ),
        });
        if (inTxInvoice) {
            if (inTxInvoice.billingPeriodStart && new Date(inTxInvoice.billingPeriodStart).getTime() !== periodStartDate.getTime()) {
                throw new Error('The selected billing period overlaps an existing family invoice. Review coverage before creating another draft.');
            }
            return { id: inTxInvoice.id, alreadyGenerated: true };
        }

        assertEligibleBillingCoverage(coveredIds, await getFinanceEligibleChildIds(orgId, coveredIds, tx, { parentId: config.parentId, centreId: config.centreId, billingConfig: config }, servicePeriod));

        const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;
        const actualCreatedAt = new Date();
        const canonicalPeriodLabel = periodValidation.periodLabel || `${input.periodStartStr} to ${input.periodEndStr}`;

        // Create invoice draft with actual creation timestamp
        const [invoice] = await tx.insert(invoices).values({
            organisationId:      orgId,
            centreId:            config.centreId,
            parentId:            config.parentId,
            invoiceNumber:       invoiceNumber,
            amount:              finalAmountStr,
            status:              'draft',
            invoiceDate:         actualCreatedAt,
            dueDate:             dueDate,
            billingPeriodStart:  periodStartDate,
            billingPeriodEnd:    new Date(input.periodEndStr),
            notes:               finalNotes,
            billingConfigId:     config.id,
            billingPeriodLabel:  canonicalPeriodLabel,
            coveredChildrenJson: coveredChildren,
        }).returning();

        // Record the run
        await tx.insert(billingRuns).values({
            billingConfigId: config.id,
            periodStart:     input.periodStartStr,
            periodEnd:       input.periodEndStr,
            invoiceId:       invoice.id,
            amountPence:     recordedAmountPence,
            runBy:           session?.user?.id ?? null,
            success:         true,
        }).onConflictDoUpdate({
            target: [billingRuns.billingConfigId, billingRuns.periodStart],
            set: {
                invoiceId: invoice.id,
                amountPence: recordedAmountPence,
                runBy: session?.user?.id ?? null,
                success: true,
                runAt: actualCreatedAt,
            },
        });

        // Record explicit actor & reason audit trail
        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: isHistorical ? 'manual_historical_invoice_draft_created' : 'invoice_draft_created',
            eventData: JSON.stringify({
                configId: config.id,
                invoiceId: invoice.id,
                invoiceNumber,
                periodStart: input.periodStartStr,
                periodEnd: input.periodEndStr,
                amountPence: recordedAmountPence,
                status: 'draft',
                actorId: session.user.id,
                actorRole: userRole,
                isHistorical,
                historicalReason: isHistorical ? trimmedHistoricalReason : null,
                createdAt: actualCreatedAt.toISOString(),
            }),
        });

        return { id: invoice.id, alreadyGenerated: false };
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    revalidatePath(`/dashboard/centres/${config.centreId}/billing`);
    if (config.parentId) {
        revalidatePath(`/dashboard/parents/${config.parentId}`);
    }
    for (const cc of config.children ?? []) {
        revalidatePath(`/dashboard/students/${cc.child.id}`);
    }
    return { success: true, invoiceId: result.id, alreadyGenerated: result.alreadyGenerated };
}


// UI-facing wrappers return approved text rather than relying on production-redacted exceptions.
// The original actions retain all validation, tenant checks and transactional behavior.
export async function saveFamilyBillingSettings(input: { configId?: string; data: BillingConfigData }) {
    return captureBillingResult(async () => {
        if (input.configId) return updateBillingConfig(input.configId, input.data);
        return createBillingConfig(input.data);
    }, error => {
        const reference = `BILL-${nanoid(10)}`;
        logger.error(`[${reference}] Billing settings save not confirmed`, error);
        return reference;
    });
}

export async function changeFamilyBillingStatus(configId: string, action: 'pause' | 'resume' | 'cancel') {
    return captureBillingResult(async () => {
        if (action === 'pause') return pauseBillingConfig(configId);
        if (action === 'resume') return resumeBillingConfig(configId);
        if (action === 'cancel') return cancelBillingConfig(configId);
        throw new Error('Invalid billing status action');
    }, error => {
        const reference = `BILL-${nanoid(10)}`;
        logger.error(`[${reference}] Billing status change not confirmed`, error);
        return reference;
    });
}
