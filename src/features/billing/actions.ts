'use server';

/**
 * Billing server actions — family agreed-fee model.
 * All mutations go through these functions (create, update, pause, etc.)
 */

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { billingConfigs, billingConfigChildren, billingRuns, invoices, children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { computeNextBillingPeriod, penceToPounds } from '@/lib/billing';
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
async function assertCentreAccess(session: NonNullable<Awaited<ReturnType<typeof auth>>>, centreId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session.user.role isn't in the base NextAuth type; same cast pattern used throughout src/features/finance/actions.ts
    const userRole = (session.user as any).role;
    if (userRole === 'ORG_OWNER') return;
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (!accessibleCentreIds.includes(centreId)) {
        throw new Error('Unauthorized: No access to this centre');
    }
}

async function getOrgIdAndSession(): Promise<{ orgId: string; session: NonNullable<Awaited<ReturnType<typeof auth>>> }> {
    const session = await auth();
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
            agreedMonthlyPence: data.agreedMonthlyPence,
            billingAnchorDate:  data.billingAnchorDate,
            invoiceLeadDays:    data.invoiceLeadDays ?? 7,
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

        return newConfig;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/students');
    return { success: true, configId: config.id };
}

/**
 * Update an existing billing config's fee and dates.
 */
export async function updateBillingConfig(
    configId: string,
    data: Partial<Omit<BillingConfigData, 'parentId' | 'centreId' | 'childIds'>>,
) {
    const { orgId, session } = await getOrgIdAndSession();

    const existingConfig = await db.query.billingConfigs.findFirst({
        where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
        columns: { centreId: true },
    });
    if (!existingConfig) throw new Error('Billing config not found');
    await assertCentreAccess(session, existingConfig.centreId);

    await db.update(billingConfigs)
        .set({
            ...(data.agreedMonthlyPence !== undefined && { agreedMonthlyPence: data.agreedMonthlyPence }),
            ...(data.billingAnchorDate  !== undefined && { billingAnchorDate:  data.billingAnchorDate }),
            ...(data.invoiceLeadDays    !== undefined && { invoiceLeadDays:    data.invoiceLeadDays }),
            ...(data.notes              !== undefined && { notes:              data.notes }),
            updatedAt: new Date(),
        })
        .where(and(
            eq(billingConfigs.id,             configId),
            eq(billingConfigs.organisationId, orgId),
        ));

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

async function requireOwnedConfig(configId: string, orgId: string, session: NonNullable<Awaited<ReturnType<typeof auth>>>) {
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

// ─── Invoice generation ───────────────────────────────────────────────────────

export interface GenerateInvoiceInput {
    configId:        string;
    periodStartStr:  string;  // 'YYYY-MM-DD'
    periodEndStr:    string;
    amountPence:     number;
    notes?:          string;
}

/**
 * Generate a family invoice for a billing period.
 * Idempotent — will not generate duplicate invoices for the same period.
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

    // Check for duplicate
    const existingRun = await db.query.billingRuns.findFirst({
        where: and(
            eq(billingRuns.billingConfigId, input.configId),
            eq(billingRuns.periodStart,     input.periodStartStr),
        ),
    });
    if (existingRun?.success) {
        throw new Error(`Invoice already generated for period ${input.periodStartStr}`);
    }

    // Build children snapshot
    const coveredChildren = (config.children ?? []).map(cc => ({
        id:   cc.child.id,
        name: `${cc.child.firstName} ${cc.child.lastName}`,
    }));

    const result = await db.transaction(async (tx) => {
        const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

        // Create invoice
        const [invoice] = await tx.insert(invoices).values({
            organisationId:      orgId,
            centreId:            config.centreId,
            parentId:            config.parentId,
            invoiceNumber:       invoiceNumber,
            amount:              String(input.amountPence / 100),
            status:              'draft',
            invoiceDate:         new Date(),
            dueDate:             new Date(input.periodStartStr),
            billingPeriodStart:  new Date(input.periodStartStr),
            billingPeriodEnd:    new Date(input.periodEndStr),
            notes:               input.notes ?? null,
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
            amountPence:     input.amountPence,
            runBy:           session?.user?.id ?? null,
            success:         true,
        });

        return invoice;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    return { success: true, invoiceId: result.id };
}
