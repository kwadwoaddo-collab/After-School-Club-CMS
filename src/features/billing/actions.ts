'use server';

/**
 * Billing server actions — family agreed-fee model.
 * All mutations go through these functions (create, update, pause, etc.)
 */

import { requireTenantSession, TypedSession } from '@/lib/session';
import { db } from '@/db';
import { billingConfigs, billingConfigChildren, billingRuns, billingCycleSkips, invoices, children, auditEvents, payments } from '@/db/schema';
import { eq, and, sql, ne, inArray, isNull, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { computeNextBillingPeriod, penceToPounds } from '@/lib/billing';
import { computeExpectedPaymentDate, LeadTimeUnit } from '@/lib/billing/date-engine';
import { nanoid } from 'nanoid';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

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

    if (data.childIds.length > 0) {
        const validChildren = await db.select({ id: children.id })
            .from(children)
            .where(
                and(
                    inArray(children.id, data.childIds),
                    eq(children.organisationId, orgId),
                    eq(children.parentId, data.parentId),
                    eq(children.centreId, data.centreId),
                    isNull(children.deletedAt)
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

        return newConfig;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    return { success: true, configId: config.id };
}

/**
 * Update an existing billing config's fee, dates, and scheduler settings.
 */
export async function updateBillingConfig(
    configId: string,
    data: Partial<Omit<BillingConfigData, 'parentId' | 'centreId' | 'childIds'>>,
) {
    const { orgId, session } = await getOrgIdAndSession();

    const existingConfig = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!existingConfig) throw new Error('Billing config not found');
    await assertCentreAccess(session, existingConfig.centreId);

    await db.update(billingConfigs)
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

    await db.insert(auditEvents).values({
        organisationId: orgId,
        userId: session.user.id,
        eventType: 'billing_config_updated',
        eventData: JSON.stringify({
            configId,
            changedFields: Object.keys(data),
        }),
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
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
                isNull(children.deletedAt)
            )
        );

    if (validChildren.length !== 1) {
        throw new Error('Child is invalid or does not belong to this family/centre');
    }

    await db.insert(billingConfigChildren).values({ configId, childId }).onConflictDoNothing();

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    return { success: true };
}

/**
 * Remove a child from a billing config.
 */
export async function removeChildFromConfig(configId: string, childId: string) {
    const { orgId, session } = await getOrgIdAndSession();

    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);

    await db.delete(billingConfigChildren).where(
        and(
            eq(billingConfigChildren.configId, configId),
            eq(billingConfigChildren.childId, childId),
        )
    );

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    return { success: true };
}

// ─── Status management ────────────────────────────────────────────────────────

async function requireOwnedConfig(configId: string, orgId: string, session: TypedSession) {
    const config = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        columns: { centreId: true },
    });
    if (!config) throw new Error('Billing config not found');
    await assertCentreAccess(session, config.centreId);
}

export async function pauseBillingConfig(configId: string) {
    const { orgId, session } = await getOrgIdAndSession();
    await requireOwnedConfig(configId, orgId, session);
    await db.update(billingConfigs)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
    revalidatePath('/dashboard/finance');
    return { success: true };
}

export async function resumeBillingConfig(configId: string) {
    const { orgId, session } = await getOrgIdAndSession();
    await requireOwnedConfig(configId, orgId, session);
    await db.update(billingConfigs)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
    revalidatePath('/dashboard/finance');
    return { success: true };
}

export async function cancelBillingConfig(configId: string) {
    const { orgId, session } = await getOrgIdAndSession();
    await requireOwnedConfig(configId, orgId, session);
    await db.update(billingConfigs)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)));
    revalidatePath('/dashboard/finance');
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
    return { success: true };
}

// ─── Invoice generation ───────────────────────────────────────────────────────

export interface GenerateInvoiceInput {
    configId:        string;
    periodStartStr:  string;  // 'YYYY-MM-DD'
    periodEndStr:    string;
    amountPence?:    number;
    notes?:          string;
}

/**
 * Generate a family invoice draft for a billing period.
 * Idempotent — will not generate duplicate invoices for the same period.
 * Respects billing cycle skips (§26) and copy-forward rules (§16, §17).
 */
export async function generateInvoiceFromConfig(input: GenerateInvoiceInput) {
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
    if (config.status !== 'active') throw new Error('Billing config is not active');

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
            eq(invoices.billingConfigId,    config.id),
            eq(invoices.billingPeriodStart, periodStartDate),
            ne(invoices.status,             'void'),
        ),
    });
    if (existingInvoice) {
        return { success: true, invoiceId: existingInvoice.id, alreadyGenerated: true };
    }

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
        const lockKey = `billing_config:${input.configId}:${input.periodStartStr}`;
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

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
                eq(invoices.billingConfigId,    config.id),
                eq(invoices.billingPeriodStart, periodStartDate),
                ne(invoices.status,             'void'),
            ),
        });
        if (inTxInvoice) {
            return { id: inTxInvoice.id, alreadyGenerated: true };
        }

        const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

        // Create invoice draft
        const [invoice] = await tx.insert(invoices).values({
            organisationId:      orgId,
            centreId:            config.centreId,
            parentId:            config.parentId,
            invoiceNumber:       invoiceNumber,
            amount:              finalAmountStr,
            status:              'draft',
            invoiceDate:         new Date(),
            dueDate:             dueDate,
            billingPeriodStart:  periodStartDate,
            billingPeriodEnd:    new Date(input.periodEndStr),
            notes:               finalNotes,
            billingConfigId:     config.id,
            billingPeriodLabel:  `${input.periodStartStr} to ${input.periodEndStr}`,
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
                runAt: new Date(),
            },
        });

        return { id: invoice.id, alreadyGenerated: false };
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    return { success: true, invoiceId: result.id, alreadyGenerated: result.alreadyGenerated };
}
