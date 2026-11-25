import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    billingConfigChildren,
    billingConfigs,
    invoices,
} from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

export async function applyStoppedBillingSideEffects(
    tx: any,
    params: {
        childId: string;
        parentId: string;
        organisationId: string;
        effectiveDate: string;
        today: string;
    },
) {
    if (typeof tx.update !== 'function' || typeof tx.select !== 'function') return;

    const linkedConfigs = await tx
        .select({ configId: billingConfigs.id })
        .from(billingConfigChildren)
        .innerJoin(billingConfigs, eq(billingConfigChildren.configId, billingConfigs.id))
        .where(and(
            eq(billingConfigChildren.childId, params.childId),
            eq(billingConfigs.organisationId, params.organisationId),
        ));

    const singleChildConfigIds = new Set<string>();

    for (const { configId } of linkedConfigs) {
        const coveredRows = await tx
            .select({ childId: billingConfigChildren.childId })
            .from(billingConfigChildren)
            .where(eq(billingConfigChildren.configId, configId));

        if (coveredRows.length <= 1) {
            singleChildConfigIds.add(configId);
            if (params.effectiveDate <= params.today) {
                await tx
                    .update(billingConfigs)
                    .set({ status: 'paused', updatedAt: new Date() })
                    .where(and(
                        eq(billingConfigs.id, configId),
                        eq(billingConfigs.organisationId, params.organisationId),
                    ));
            }
        } else if (params.effectiveDate <= params.today && typeof tx.delete === 'function') {
            await tx
                .delete(billingConfigChildren)
                .where(and(
                    eq(billingConfigChildren.configId, configId),
                    eq(billingConfigChildren.childId, params.childId),
                ));
        }
    }

    const candidateDrafts = await tx
        .select({
            id: invoices.id,
            childId: invoices.childId,
            billingConfigId: invoices.billingConfigId,
            coveredChildrenJson: invoices.coveredChildrenJson,
        })
        .from(invoices)
        .where(and(
            eq(invoices.organisationId, params.organisationId),
            eq(invoices.parentId, params.parentId),
            eq(invoices.status, 'draft'),
            sql`${invoices.billingPeriodStart}::date >= ${params.effectiveDate}::date`,
        ));

    const draftIdsToCancel = candidateDrafts
        .filter((inv: any) => {
            if (inv.childId === params.childId) return true;
            if (Array.isArray(inv.coveredChildrenJson)) {
                return inv.coveredChildrenJson.length === 1 && (
                    inv.coveredChildrenJson[0]?.childId === params.childId ||
                    inv.coveredChildrenJson[0]?.id === params.childId
                );
            }
            if (inv.billingConfigId && singleChildConfigIds.has(inv.billingConfigId)) return true;
            return false;
        })
        .map((inv: any) => inv.id);

    if (draftIdsToCancel.length > 0) {
        await tx
            .update(invoices)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(and(
                eq(invoices.organisationId, params.organisationId),
                eq(invoices.status, 'draft'),
                inArray(invoices.id, draftIdsToCancel),
            ));
    }
}

export async function applyReactivatedBillingSideEffects(
    tx: any,
    params: {
        childId: string;
        organisationId: string;
    },
) {
    if (typeof tx.update !== 'function' || typeof tx.select !== 'function') return;

    const linkedConfigs = await tx
        .select({ configId: billingConfigs.id, status: billingConfigs.status })
        .from(billingConfigChildren)
        .innerJoin(billingConfigs, eq(billingConfigChildren.configId, billingConfigs.id))
        .where(and(
            eq(billingConfigChildren.childId, params.childId),
            eq(billingConfigs.organisationId, params.organisationId),
        ));

    for (const cfg of linkedConfigs) {
        if (cfg.status !== 'paused') continue;
        const coveredRows = await tx
            .select({ childId: billingConfigChildren.childId })
            .from(billingConfigChildren)
            .where(eq(billingConfigChildren.configId, cfg.configId));
        if (coveredRows.length <= 1) {
            await tx
                .update(billingConfigs)
                .set({ status: 'active', updatedAt: new Date() })
                .where(and(
                    eq(billingConfigs.id, cfg.configId),
                    eq(billingConfigs.organisationId, params.organisationId),
                ));
        }
    }
}
