'use server';
import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditEvents, billingConfigs, centres, children, contractCentreSettings, contracts, parents } from '@/db/schema';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { emailService } from '@/lib/services/email';
import { getBaseUrl } from '@/lib/base-url';
import { logger } from '@/lib/logger';
import { resolveCentreDetails } from './centre-details';
import { buildContractPrefill } from './prefill';
import { contractExpiry, generateContractToken, hashContractToken } from './tokens';
import { formatContractDate } from './template';

type Session = Awaited<ReturnType<typeof requireTenantSession>>;
type Result = { success: true; message?: string } | { success: false; error: string };

/** Owner/Manager only, with the same org + centre guard as the billing actions. */
async function requireContractManager(centreId: string): Promise<{ session: Session; orgId: string }> {
    const session = await requireTenantSession();
    const orgId = session.user.organisationId;
    if (!orgId) throw new Error('Unauthorized');
    if (!['ORG_OWNER', 'MANAGER'].includes(session.user.role)) throw new Error('Only an Owner or Manager can manage contracts.');
    if (session.user.role !== 'ORG_OWNER') {
        const accessible = await getUserAccessibleCentreIds(session.user.id);
        if (!accessible.includes(centreId)) throw new Error('Unauthorized: No access to this centre');
    }
    return { session, orgId };
}

function fail(error: unknown): Result {
    const message = error instanceof Error ? error.message : '';
    const known = /^(Only an Owner|Unauthorized|Contracts are|This family|Set the|Add |This parent|Billing|Contract|Check)/.test(message);
    if (!known) logger.error('[contracts] action failed', error);
    return { success: false, error: known ? message : 'Could not complete that. Please try again.' };
}

const sendSchema = z.object({ configId: z.string().uuid() });

export async function sendContract(raw: { configId: string }): Promise<Result> {
    try {
        const { configId } = sendSchema.parse(raw);
        const session = await requireTenantSession();
        const orgId = session.user.organisationId;
        if (!orgId) throw new Error('Unauthorized');
        const config = await db.query.billingConfigs.findFirst({
            where: and(eq(billingConfigs.id, configId), eq(billingConfigs.organisationId, orgId)),
            with: { children: true },
        });
        if (!config) throw new Error('Billing config not found');
        const { session: actor } = await requireContractManager(config.centreId);

        const [parent] = await db.select({ id: parents.id, firstName: parents.firstName, lastName: parents.lastName, email: parents.email })
            .from(parents).where(and(eq(parents.id, config.parentId), eq(parents.organisationId, orgId), isNull(parents.deletedAt)));
        if (!parent) throw new Error('Billing config not found');
        const childIds = config.children.map(c => c.childId);
        const childRows = childIds.length ? await db.select({ id: children.id, firstName: children.firstName, lastName: children.lastName })
            .from(children).where(and(inArray(children.id, childIds), eq(children.organisationId, orgId), eq(children.parentId, config.parentId), eq(children.centreId, config.centreId), isNull(children.deletedAt))) : [];
        const [centre] = await db.select({ name: centres.name, address: centres.address, billingPhone: centres.billingPhone, ofstedId: centres.ofstedId })
            .from(centres).where(and(eq(centres.id, config.centreId), eq(centres.organisationId, orgId)));
        if (!centre) throw new Error('Billing config not found');
        const [setting] = await db.select().from(contractCentreSettings).where(and(eq(contractCentreSettings.centreId, config.centreId), eq(contractCentreSettings.organisationId, orgId)));
        const details = resolveCentreDetails({ setting, centre });

        const prefill = buildContractPrefill({
            config, parent, provider: details.provider, missingCentreDetails: details.missing,
            childNames: childRows.map(c => `${c.firstName} ${c.lastName}`.trim()).sort(),
        });
        if (!prefill.ok) throw new Error(prefill.error);

        const token = generateContractToken();
        const now = new Date();
        const expiresAt = contractExpiry(now);
        const snapshot = JSON.stringify(prefill.values);

        // One open contract per family: re-sending rotates the token, which invalidates the previous link.
        const contractId = await db.transaction(async tx => {
            const [open] = await tx.select({ id: contracts.id }).from(contracts)
                .where(and(eq(contracts.billingConfigId, config.id), eq(contracts.organisationId, orgId), inArray(contracts.status, ['draft', 'sent'])))
                .orderBy(desc(contracts.createdAt)).for('update');
            const fields = {
                status: 'draft' as const, tokenHash: hashContractToken(token), expiresAt, sentAt: null, sentToEmail: null,
                templateVersion: prefill.templateVersion, templateHash: prefill.templateHash,
                amountPence: prefill.values.amountPence, snapshot, updatedAt: now,
            };
            if (open) {
                await tx.update(contracts).set(fields).where(eq(contracts.id, open.id));
                return open.id;
            }
            const [row] = await tx.insert(contracts).values({
                ...fields, organisationId: orgId, centreId: config.centreId, parentId: config.parentId, billingConfigId: config.id, createdBy: actor.user.id,
            }).returning({ id: contracts.id });
            return row.id;
        });

        const result = await emailService.sendContractLink({
            parentEmail: parent.email!, parentName: parent.firstName, providerName: prefill.values.provider.providerName,
            signUrl: `${getBaseUrl()}/sign/${token}`, expiresOn: formatContractDate(expiresAt),
        });
        if (!result.success) {
            await db.insert(auditEvents).values({ organisationId: orgId, userId: actor.user.id, eventType: 'contract_send_failed', eventData: JSON.stringify({ contractId, configId: config.id }) });
            throw new Error('Check the email setup: the contract email could not be sent, so nothing was sent to the parent.');
        }
        await db.transaction(async tx => {
            await tx.update(contracts).set({ status: 'sent', sentAt: new Date(), sentToEmail: parent.email, updatedAt: new Date() })
                .where(and(eq(contracts.id, contractId), eq(contracts.organisationId, orgId), eq(contracts.status, 'draft')));
            await tx.insert(auditEvents).values({ organisationId: orgId, userId: actor.user.id, eventType: 'contract_sent', eventData: JSON.stringify({ contractId, configId: config.id, centreId: config.centreId, amountPence: prefill.values.amountPence, templateVersion: prefill.templateVersion }) });
        });
        revalidatePath(`/dashboard/parents/${config.parentId}`);
        return { success: true, message: 'Contract sent to the parent.' };
    } catch (error) {
        return fail(error);
    }
}

export async function revokeContract(raw: { contractId: string }): Promise<Result> {
    try {
        const { contractId } = z.object({ contractId: z.string().uuid() }).parse(raw);
        const session = await requireTenantSession();
        const orgId = session.user.organisationId;
        if (!orgId) throw new Error('Unauthorized');
        const [row] = await db.select({ id: contracts.id, centreId: contracts.centreId, parentId: contracts.parentId, status: contracts.status })
            .from(contracts).where(and(eq(contracts.id, contractId), eq(contracts.organisationId, orgId)));
        if (!row) throw new Error('Contract not found');
        const { session: actor } = await requireContractManager(row.centreId);
        if (!['draft', 'sent'].includes(row.status)) throw new Error('Contract can no longer be revoked.');
        await db.transaction(async tx => {
            const updated = await tx.update(contracts).set({ status: 'revoked', revokedAt: new Date(), updatedAt: new Date() })
                .where(and(eq(contracts.id, contractId), eq(contracts.organisationId, orgId), inArray(contracts.status, ['draft', 'sent']))).returning({ id: contracts.id });
            if (updated.length === 0) throw new Error('Contract can no longer be revoked.');
            await tx.insert(auditEvents).values({ organisationId: orgId, userId: actor.user.id, eventType: 'contract_revoked', eventData: JSON.stringify({ contractId }) });
        });
        revalidatePath(`/dashboard/parents/${row.parentId}`);
        return { success: true, message: 'Contract link revoked.' };
    } catch (error) {
        return fail(error);
    }
}

const detailsSchema = z.object({
    centreId: z.string().uuid(),
    providerName: z.string().trim().min(1, 'Check the provider name').max(255),
    address: z.string().trim().min(1, 'Check the address').max(500),
    phone: z.string().trim().min(1, 'Check the phone number').max(50),
    website: z.string().trim().max(255),
    ofstedRegNo: z.string().trim().min(1, 'Check the Ofsted registration number').max(50),
});

export async function saveContractCentreDetails(raw: z.input<typeof detailsSchema>): Promise<Result> {
    try {
        const parsed = detailsSchema.safeParse(raw);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the centre details');
        const data = parsed.data;
        const { session, orgId } = await requireContractManager(data.centreId);
        const [centre] = await db.select({ id: centres.id }).from(centres).where(and(eq(centres.id, data.centreId), eq(centres.organisationId, orgId)));
        if (!centre) throw new Error('Unauthorized: No access to this centre');
        const values = { providerName: data.providerName, address: data.address, phone: data.phone, website: data.website || null, ofstedRegNo: data.ofstedRegNo, updatedBy: session.user.id, updatedAt: new Date() };
        await db.transaction(async tx => {
            await tx.insert(contractCentreSettings).values({ organisationId: orgId, centreId: data.centreId, ...values })
                .onConflictDoUpdate({ target: contractCentreSettings.centreId, set: values, setWhere: eq(contractCentreSettings.organisationId, orgId) });
            await tx.insert(auditEvents).values({ organisationId: orgId, userId: session.user.id, eventType: 'contract_centre_details_updated', eventData: JSON.stringify({ centreId: data.centreId }) });
        });
        revalidatePath('/dashboard/parents');
        return { success: true, message: 'Contract details saved.' };
    } catch (error) {
        return fail(error);
    }
}
