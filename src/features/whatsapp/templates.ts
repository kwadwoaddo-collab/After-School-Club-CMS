/**
 * Approved UTILITY templates only. Template names/language/params are fixed in code: there is no free-text send.
 * Wording must stay in sync with docs/whatsapp-business-platform.md (the text submitted to Meta).
 * Safeguarding: parameters are limited to parent first name, service word, invoice number, org name, amount and date.
 * Never add child names, medical, allergy or safeguarding details.
 */
export type WhatsAppTemplateKind = 'invoice_issued' | 'payment_reminder' | 'payment_receipt';

export interface WhatsAppTemplateDef {
    name: string;
    language: string;
    paramCount: number;
}

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKind, WhatsAppTemplateDef> = {
    invoice_issued: { name: 'invoice_issued_v1', language: 'en_GB', paramCount: 6 },
    payment_reminder: { name: 'payment_reminder_v1', language: 'en_GB', paramCount: 6 },
    payment_receipt: { name: 'payment_receipt_v1', language: 'en_GB', paramCount: 4 },
};

export interface TemplateInput {
    parentFirstName?: string | null;
    serviceType: 'childcare' | 'tuition';
    invoiceNumber: string;
    organisationName: string;
    amountFormatted: string;
    dueDateFormatted?: string | null;
}

/** Meta rejects newlines, tabs and 4+ consecutive spaces in parameters. */
export function sanitiseParam(value: string | null | undefined, fallback = '-'): string {
    const cleaned = (value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 60);
    return cleaned || fallback;
}

export function buildTemplateParams(kind: WhatsAppTemplateKind, i: TemplateInput): string[] {
    const first = sanitiseParam(i.parentFirstName, 'there');
    const service = i.serviceType === 'tuition' ? 'Tuition' : 'Childcare';
    const org = sanitiseParam(i.organisationName);
    const inv = sanitiseParam(i.invoiceNumber);
    const amount = sanitiseParam(i.amountFormatted);
    const due = sanitiseParam(i.dueDateFormatted);
    switch (kind) {
        case 'invoice_issued': return [first, service, inv, org, amount, due];
        case 'payment_reminder': return [first, service, inv, amount, org, due];
        case 'payment_receipt': return [first, amount, inv, org];
    }
}

/** Graph API `messages` payload for a template send. `to` is digits-only E.164. */
export function buildTemplatePayload(to: string, kind: WhatsAppTemplateKind, params: string[]) {
    const def = WHATSAPP_TEMPLATES[kind];
    if (params.length !== def.paramCount) throw new Error(`Template ${def.name} expects ${def.paramCount} params`);
    return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
            name: def.name,
            language: { code: def.language },
            components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
        },
    };
}

/** Which invoice statuses each template may be sent for. Reminder is limited to wholly unpaid ('sent') invoices so the amount is exact. */
export const TEMPLATE_ELIGIBLE_STATUSES: Record<WhatsAppTemplateKind, string[]> = {
    invoice_issued: ['sent', 'partially_paid'],
    payment_reminder: ['sent'],
    payment_receipt: ['paid'],
};

/** One send per invoice per kind; reminders are allowed once per UTC day. */
export function buildIdempotencyKey(kind: WhatsAppTemplateKind, invoiceId: string, now: Date = new Date()): string {
    const base = `inv:${invoiceId}:${kind}`;
    return kind === 'payment_reminder' ? `${base}:${now.toISOString().slice(0, 10)}` : base;
}

/** Keywords honoured as an opt-out when a parent replies. Exact-match after trimming/punctuation removal. */
const OPT_OUT_KEYWORDS = new Set(['STOP', 'STOP ALL', 'STOPALL', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL', 'END', 'QUIT']);
export function isOptOutText(text: string | null | undefined): boolean {
    if (!text) return false;
    return OPT_OUT_KEYWORDS.has(text.trim().toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim());
}
