import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { centres, contractCentreSettings, contracts } from '@/db/schema';
import { resolveCentreDetails } from './centre-details';
import { deriveContractStatus, type ContractStatusView } from './status';

export interface CentreContractDetails {
    centreId: string;
    values: { providerName: string; address: string; phone: string; website: string; ofstedRegNo: string };
    missing: string[];
}

/** Contract status per billing config. Selects no signature data, snapshot or PDF bytes. */
export async function fetchContractStatuses(organisationId: string, configs: { id: string; agreedMonthlyPence: number }[]): Promise<Record<string, ContractStatusView>> {
    if (configs.length === 0) return {};
    const rows = await db.select({
        id: contracts.id, billingConfigId: contracts.billingConfigId, status: contracts.status, expiresAt: contracts.expiresAt,
        createdAt: contracts.createdAt, amountPence: contracts.amountPence, signedAt: contracts.signedAt, sentAt: contracts.sentAt, signerName: contracts.signerName,
    }).from(contracts).where(and(eq(contracts.organisationId, organisationId), inArray(contracts.billingConfigId, configs.map(c => c.id))));
    const out: Record<string, ContractStatusView> = {};
    for (const config of configs) {
        out[config.id] = deriveContractStatus(rows.filter(r => r.billingConfigId === config.id), config.agreedMonthlyPence);
    }
    return out;
}

export async function fetchCentreContractDetails(organisationId: string, centreIds: string[]): Promise<Record<string, CentreContractDetails>> {
    if (centreIds.length === 0) return {};
    const [centreRows, settingRows] = await Promise.all([
        db.select({ id: centres.id, name: centres.name, address: centres.address, billingPhone: centres.billingPhone, ofstedId: centres.ofstedId })
            .from(centres).where(and(eq(centres.organisationId, organisationId), inArray(centres.id, centreIds))),
        db.select().from(contractCentreSettings).where(and(eq(contractCentreSettings.organisationId, organisationId), inArray(contractCentreSettings.centreId, centreIds))),
    ]);
    const out: Record<string, CentreContractDetails> = {};
    for (const centre of centreRows) {
        const { draft, missing } = resolveCentreDetails({ setting: settingRows.find(s => s.centreId === centre.id), centre });
        out[centre.id] = { centreId: centre.id, values: { providerName: draft.providerName, address: draft.address, phone: draft.phone, website: draft.website, ofstedRegNo: draft.ofstedRegNo }, missing };
    }
    return out;
}
