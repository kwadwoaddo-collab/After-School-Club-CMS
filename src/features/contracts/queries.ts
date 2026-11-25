import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { centres, contractCentreSettings, contracts } from '@/db/schema';
import { resolveCentreDetails } from './centre-details';
import { deriveContractStatus, type ContractStatusView } from './status';

export interface CentreContractDetails {
    centreId: string;
    values: { providerName: string; address: string; phone: string; website: string; ofstedRegNo: string; signatoryName: string; signatoryRole: string };
    missing: string[];
}

/**
 * Contract status per centre for one family. Rows are matched by parent + centre (not billing config) so contracts
 * stay listed if the billing config is ever removed. Selects no signature data, snapshot or PDF bytes.
 * Returns null for a centre with neither a billing config nor any contract.
 */
export async function fetchContractStatuses(
    organisationId: string,
    parentId: string,
    centresInput: { centreId: string; config: { agreedMonthlyPence: number; childIds: string[] } | null }[],
): Promise<Record<string, ContractStatusView | null>> {
    if (centresInput.length === 0) return {};
    const rows = await db.select({
        id: contracts.id, centreId: contracts.centreId, status: contracts.status, expiresAt: contracts.expiresAt,
        createdAt: contracts.createdAt, amountPence: contracts.amountPence, childIds: contracts.childIds, signedAt: contracts.signedAt,
        sentAt: contracts.sentAt, signerName: contracts.signerName, archivedAt: contracts.archivedAt,
    }).from(contracts).where(and(eq(contracts.organisationId, organisationId), eq(contracts.parentId, parentId), inArray(contracts.centreId, centresInput.map(c => c.centreId))));
    const out: Record<string, ContractStatusView | null> = {};
    for (const { centreId, config } of centresInput) {
        const own = rows.filter(r => r.centreId === centreId);
        out[centreId] = config || own.length > 0
            ? deriveContractStatus(own, config ? { amountPence: config.agreedMonthlyPence, childIds: config.childIds } : null)
            : null;
    }
    return out;
}

export async function fetchCentreContractDetails(organisationId: string, centreIds: string[]): Promise<Record<string, CentreContractDetails>> {
    if (centreIds.length === 0) return {};
    const [centreRows, settingRows] = await Promise.all([
        db.select({ id: centres.id, name: centres.name, address: centres.address, billingPhone: centres.billingPhone, ofstedId: centres.ofstedId, managerName: centres.managerName })
            .from(centres).where(and(eq(centres.organisationId, organisationId), inArray(centres.id, centreIds))),
        db.select().from(contractCentreSettings).where(and(eq(contractCentreSettings.organisationId, organisationId), inArray(contractCentreSettings.centreId, centreIds))),
    ]);
    const out: Record<string, CentreContractDetails> = {};
    for (const centre of centreRows) {
        const { draft, missing } = resolveCentreDetails({ setting: settingRows.find(s => s.centreId === centre.id), centre });
        out[centre.id] = { centreId: centre.id, values: { providerName: draft.providerName, address: draft.address, phone: draft.phone, website: draft.website, ofstedRegNo: draft.ofstedRegNo, signatoryName: draft.signatoryName, signatoryRole: draft.signatoryRole }, missing };
    }
    return out;
}
