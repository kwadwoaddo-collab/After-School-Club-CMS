import crypto from 'crypto';

/** Bump when any clause below changes; stored on every contract with the hash. */
export const CONTRACT_TEMPLATE_VERSION = '2026-11-v1';

export interface ContractProvider {
    providerName: string;
    address: string;
    phone: string;
    website: string | null;
    ofstedRegNo: string;
    /** Authorised signatory who signs for the provider (pre-applied on every contract) */
    signatoryName: string;
    signatoryRole: string | null;
}

export interface ContractValues {
    provider: ContractProvider;
    parentName: string;
    childNames: string[];
    /** dd/mm/yyyy, from the family's billing anchor date */
    startDate: string;
    amountPence: number;
    /** dd/mm/yyyy, the day the contract was sent (provider signature date) */
    providerSignedDate: string;
    /** PNG/JPEG data URL of the centre's signature image, frozen at send time; null falls back to the typed signatory name */
    signatureImage?: string | null;
    /** Children covered when sent; used only to flag later changes, never shown */
    childIds?: string[];
}

export interface ContractSection {
    heading: string;
    intro?: string;
    items: string[];
    note?: string;
}

/** Clause text shared by every centre. Only the provider details and prefilled fields differ. */
export function contractSections(providerName: string): ContractSection[] {
    return [
        {
            heading: 'Services Provided',
            intro: `${providerName} provides:`,
            items: [
                'School pick-up and drop-off (where applicable)',
                'Board and computer games',
                'Story-time and reading challenges',
                'Movie days and themed activities',
                'Other stimulating extracurricular activities',
                'Supplementary online learning sessions and virtual activities (where appropriate), provided as an extension of the childcare service and not as a replacement for in-person attendance',
            ],
            note: 'Days & Times: Monday to Sunday, 9:00 am – 8:30 pm',
        },
        {
            heading: 'Fees & Payment',
            items: [
                'Fees are payable in advance by bank transfer, card, or cash.',
                'Late payment charge: £5 per day after the due date.',
                'A two-week deposit is payable on enrolment.',
                'Full fees remain payable for booked sessions.',
            ],
        },
        {
            heading: 'Holidays, Absences & Closures',
            items: [
                'Parents must notify the Club if their child will not attend.',
                'Full fees apply for absences.',
                'The Club will notify parents in advance of closures.',
            ],
        },
        {
            heading: 'Illness, First Aid & Emergencies',
            items: [
                'Children with contagious illness may not attend.',
                'In an emergency, staff will contact the Parent/Guardian immediately.',
                'Parents authorise medical assistance if required.',
            ],
        },
        {
            heading: 'Behaviour & Safeguarding',
            items: [
                'The Club follows Ofsted safeguarding standards.',
                'Parents will be informed of concerns.',
                'Persistent unsafe behaviour may lead to termination.',
            ],
        },
        {
            heading: 'Parental Obligations',
            items: ['Abide by policies.', 'Ensure prompt payment.', 'Provide accurate information.', 'Notify changes.'],
        },
        { heading: 'Data Protection', items: ['Complies with UK GDPR.', 'Data kept confidential.'] },
        {
            heading: 'Termination of Agreement',
            items: ['4 weeks’ notice required.', 'Immediate termination for serious breaches.'],
        },
        {
            heading: 'Tax Credits & Funding',
            items: ['Parents must notify authorities if childcare stops.'],
        },
    ];
}

export const CONTRACT_TITLE = 'Childcare Service Agreement';
export const CONTRACT_AGREE_LABEL = 'I have read and agree to this Childcare Service Agreement.';

/** Hash of the clause text with a neutral provider name, so it identifies the wording only. */
export function contractTemplateHash(): string {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify({ v: CONTRACT_TEMPLATE_VERSION, title: CONTRACT_TITLE, sections: contractSections('{{provider}}') }))
        .digest('hex');
}

export function formatPounds(pence: number): string {
    return `£${(pence / 100).toFixed(2)}`;
}

export function formatContractDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d;
    return date.toLocaleDateString('en-GB', { timeZone: typeof d === 'string' ? 'UTC' : 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function joinChildNames(names: string[]): string {
    return names.join(', ');
}
