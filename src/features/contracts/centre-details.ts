import type { ContractProvider } from './template';

export interface CentreDetailsInput {
    setting?: { providerName?: string | null; address?: string | null; phone?: string | null; website?: string | null; ofstedRegNo?: string | null; signatoryName?: string | null; signatoryRole?: string | null } | null;
    centre: { name: string; address?: string | null; billingPhone?: string | null; ofstedId?: string | null; managerName?: string | null };
}

export const REQUIRED_CENTRE_FIELDS = [
    ['providerName', 'provider name'],
    ['address', 'address'],
    ['phone', 'phone number'],
    ['ofstedRegNo', 'Ofsted registration number'],
    ['signatoryName', 'authorised signatory name'],
] as const;

const clean = (v?: string | null) => (v ?? '').trim();

/**
 * Per-centre contract details: the editable contract setting wins, then the
 * centre record. Website is optional. Never invents or prints blanks.
 */
export function resolveCentreDetails({ setting, centre }: CentreDetailsInput): { provider: ContractProvider | null; missing: string[]; draft: Record<string, string> } {
    const draft = {
        providerName: clean(setting?.providerName) || clean(centre.name),
        address: clean(setting?.address) || clean(centre.address),
        phone: clean(setting?.phone) || clean(centre.billingPhone),
        website: clean(setting?.website),
        ofstedRegNo: clean(setting?.ofstedRegNo) || clean(centre.ofstedId),
        signatoryName: clean(setting?.signatoryName) || clean(centre.managerName),
        signatoryRole: clean(setting?.signatoryRole) || (clean(setting?.signatoryName) || !clean(centre.managerName) ? '' : 'Manager'),
    };
    const missing = REQUIRED_CENTRE_FIELDS.filter(([key]) => !draft[key]).map(([, label]) => label);
    if (missing.length) return { provider: null, missing, draft };
    return {
        provider: { providerName: draft.providerName, address: draft.address, phone: draft.phone, website: draft.website || null, ofstedRegNo: draft.ofstedRegNo, signatoryName: draft.signatoryName, signatoryRole: draft.signatoryRole || null },
        missing: [],
        draft,
    };
}
