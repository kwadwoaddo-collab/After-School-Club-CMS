import { contractTemplateHash, CONTRACT_TEMPLATE_VERSION, formatContractDate, type ContractProvider, type ContractValues } from './template';

export interface PrefillInput {
    config: { serviceType?: string | null; status: string; agreedMonthlyPence: number; billingAnchorDate: string | Date };
    parent: { firstName: string; lastName: string; email: string | null };
    childNames: string[];
    childIds?: string[];
    /** Centre signature image as a data URL (already fetched and validated), if any */
    signatureImage?: string | null;
    provider: ContractProvider | null;
    missingCentreDetails: string[];
    now?: Date;
}

export type PrefillResult = { ok: true; values: ContractValues; templateVersion: string; templateHash: string } | { ok: false; error: string };

/**
 * Builds the values a parent signs. Start date = the family's billing anchor
 * date. Childcare families only, with a real amount, children and email.
 */
export function buildContractPrefill(input: PrefillInput): PrefillResult {
    const { config, parent, childNames, provider } = input;
    if (config.serviceType === 'tuition') return { ok: false, error: 'Contracts are for childcare families only. This family is set to Tuition.' };
    if (config.status === 'cancelled') return { ok: false, error: 'This family’s billing is cancelled, so a contract cannot be sent.' };
    if (!(config.agreedMonthlyPence > 0)) return { ok: false, error: 'Set the family’s agreed monthly amount before sending a contract.' };
    if (childNames.length === 0) return { ok: false, error: 'Add at least one covered child to the billing plan before sending a contract.' };
    if (!parent.email?.trim()) return { ok: false, error: 'This parent has no email address to send the contract to.' };
    if (!provider) return { ok: false, error: `Add the centre’s contract details before sending: ${input.missingCentreDetails.join(', ')}.` };
    const anchor = config.billingAnchorDate instanceof Date ? config.billingAnchorDate.toISOString().slice(0, 10) : config.billingAnchorDate;
    return {
        ok: true,
        templateVersion: CONTRACT_TEMPLATE_VERSION,
        templateHash: contractTemplateHash(),
        values: {
            provider,
            parentName: `${parent.firstName} ${parent.lastName}`.trim(),
            childNames,
            startDate: formatContractDate(anchor),
            amountPence: config.agreedMonthlyPence,
            providerSignedDate: formatContractDate(input.now ?? new Date()),
            signatureImage: input.signatureImage ?? null,
            childIds: [...(input.childIds ?? [])].sort(),
        },
    };
}
