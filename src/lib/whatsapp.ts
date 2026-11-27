/**
 * Shared £0-Forever WhatsApp Click-to-Chat (`wa.me`) utilities.
 *
 * Security & UK GDPR invariants:
 * - Normalises UK (`07…`, `+44…`, `+44 (0)7…`, `0044…`, 10-digit Excel-stripped `7…`,
 *   and UK `01`/`02`/`03` numbers) as well as international `+` / `00` E.164 numbers.
 * - Never embeds sensitive child medical, allergy, or safeguarding notes in URLs.
 */

export const WHATSAPP_PORTAL_BILLING_URL = 'https://app.sprintscaleit.co.uk/portal/billing';

/**
 * Normalises a raw phone string into digits-only E.164 format (without `+`) suitable for `https://wa.me/<digits>`.
 * Returns `null` when the input cannot be safely normalised to an 8–15 digit international number.
 */
export function normaliseWhatsAppPhone(raw: string | null | undefined): string | null {
    if (!raw || typeof raw !== 'string') return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Reject strings containing letters (e.g. email addresses or "N/A")
    if (/[a-zA-Z@]/.test(trimmed)) return null;

    // Strip UK trunk `(0)` when preceded by +44 or 0044 (e.g. "+44 (0) 7700 900123")
    const cleanedTrunk = trimmed.replace(/^(\+?44|0044)\s*\(0\)/, '$1');

    const hasExplicitPlus = cleanedTrunk.startsWith('+');
    const digitsOnly = cleanedTrunk.replace(/\D/g, '');

    if (!digitsOnly) return null;

    let e164Digits: string | null = null;

    if (hasExplicitPlus) {
        // Explicit international prefix: strip accidental trunk 0 after +44
        if (digitsOnly.startsWith('440') && digitsOnly.length === 13) {
            e164Digits = `44${digitsOnly.slice(3)}`;
        } else {
            e164Digits = digitsOnly;
        }
    } else if (digitsOnly.startsWith('00')) {
        // International 00 prefix (e.g. 00447700900123 or 00353871234567)
        const withoutIdd = digitsOnly.slice(2);
        if (withoutIdd.startsWith('440') && withoutIdd.length === 13) {
            e164Digits = `44${withoutIdd.slice(3)}`;
        } else {
            e164Digits = withoutIdd;
        }
    } else if (digitsOnly.startsWith('440') && digitsOnly.length === 13) {
        // 4407... -> 447...
        e164Digits = `44${digitsOnly.slice(3)}`;
    } else if (digitsOnly.startsWith('44') && (digitsOnly.length === 11 || digitsOnly.length === 12)) {
        // Already UK E.164 digits without + (e.g. 447700900123)
        e164Digits = digitsOnly;
    } else if (/^07\d{9}$/.test(digitsOnly)) {
        // Standard 11-digit UK domestic mobile (07xxxxxxxxx)
        e164Digits = `44${digitsOnly.slice(1)}`;
    } else if (/^0[123]\d{8,9}$/.test(digitsOnly)) {
        // Standard UK geographic/VoIP number (01..., 02..., 03...) of 10-11 digits
        e164Digits = `44${digitsOnly.slice(1)}`;
    } else if (/^7\d{9}$/.test(digitsOnly)) {
        // 10-digit UK mobile with leading zero stripped by CSV/spreadsheet import (e.g. 7578550316)
        e164Digits = `44${digitsOnly}`;
    } else {
        return null;
    }

    // Validate E.164 bounds: 8 to 15 digits, cannot start with 0
    if (!/^[1-9]\d{7,14}$/.test(e164Digits)) {
        return null;
    }

    // UK +44 numbers must be 11 or 12 digits total; UK +447 mobiles are strictly 12 digits
    if (e164Digits.startsWith('44') && e164Digits.length !== 11 && e164Digits.length !== 12) {
        return null;
    }
    if (e164Digits.startsWith('447') && e164Digits.length !== 12) {
        return null;
    }

    return e164Digits;
}

export function isWhatsAppCapablePhone(raw: string | null | undefined): boolean {
    return normaliseWhatsAppPhone(raw) !== null;
}

/**
 * Builds a `https://wa.me/<digits>` URL with an optional URL-encoded pre-filled text message.
 * Returns `null` if `rawPhone` is missing or invalid.
 */
export function buildWhatsAppUrl(rawPhone: string | null | undefined, message?: string | null): string | null {
    const digits = normaliseWhatsAppPhone(rawPhone);
    if (!digits) return null;

    const cleanMessage = message?.trim();
    if (!cleanMessage) {
        return `https://wa.me/${digits}`;
    }

    return `https://wa.me/${digits}?text=${encodeURIComponent(cleanMessage)}`;
}

/**
 * Formats stored broadcast recipient identifiers (`whatsapp:+447578550316`) for clean UI display.
 */
export function formatWhatsAppRecipientDisplay(recipientValue: string | null | undefined): string {
    if (!recipientValue) return '';
    if (!recipientValue.startsWith('whatsapp:')) return recipientValue;

    const raw = recipientValue.slice('whatsapp:'.length).trim();
    const digits = raw.replace(/^\+/, '');
    if (/^447\d{9}$/.test(digits)) {
        return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    return raw.startsWith('+') ? raw : `+${digits}`;
}

/**
 * Builds a polite, GDPR-safe 1-click greeting link for parent/student/booking contact rows.
 */
export function buildParentGreetingMessage(params: {
    parentFirstName?: string | null;
    centreName?: string | null;
}): string | undefined {
    const firstName = params.parentFirstName?.trim();
    const centre = params.centreName?.trim();
    return firstName
        ? centre
            ? `Hi ${firstName}, this is ${centre}. `
            : `Hi ${firstName}, `
        : undefined;
}

export function buildParentGreetingWhatsAppUrl(params: {
    phone?: string | null;
    parentFirstName?: string | null;
    centreName?: string | null;
}): string | null {
    return buildWhatsAppUrl(params.phone, buildParentGreetingMessage(params));
}

/**
 * Formats a stored phone number for copy/paste into WhatsApp search or the phone contacts:
 * UK mobiles as `+44 7xxx xxxxxx`, anything else as `+<digits>`. Returns `null` when the number is not valid.
 */
export function formatPhoneForCopy(raw: string | null | undefined): string | null {
    const digits = normaliseWhatsAppPhone(raw);
    if (!digits) return null;
    if (/^447\d{9}$/.test(digits)) {
        return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    }
    return `+${digits}`;
}

/**
 * Builds a service-type-aware (`Tuition` vs `Childcare`) pre-filled WhatsApp message for an invoice or receipt.
 * Never embeds child medical/safeguarding notes.
 */
export function buildInvoiceWhatsAppMessage(params: {
    parentFirstName?: string | null;
    invoiceNumber: string;
    amountFormatted: string;
    dueDateFormatted?: string | null;
    periodFormatted?: string | null;
    serviceType: 'childcare' | 'tuition';
    isPaid?: boolean;
    organisationName: string;
    portalBillingUrl?: string;
}): string {
    const greeting = params.parentFirstName?.trim() ? `Hi ${params.parentFirstName.trim()},` : 'Hello,';
    const serviceWord = params.serviceType === 'tuition' ? 'Tuition' : 'Childcare';
    const portalUrl = params.portalBillingUrl || WHATSAPP_PORTAL_BILLING_URL;
    const periodLine = params.periodFormatted && params.periodFormatted !== '-' ? `\n• Period: ${params.periodFormatted}` : '';

    if (params.isPaid) {
        return (
            `${greeting} thank you for your payment! Your ${serviceWord} invoice ${params.invoiceNumber} ` +
            `(£${params.amountFormatted}) with ${params.organisationName} is marked as paid.` +
            `${periodLine}\n\nYou can view and download your receipt anytime in the Parent Portal:\n${portalUrl}`
        );
    }

    const dueLine = params.dueDateFormatted && params.dueDateFormatted !== '-' ? `\n• Due date: ${params.dueDateFormatted}` : '';
    return (
        `${greeting} here are the details for your ${serviceWord} invoice ${params.invoiceNumber} from ${params.organisationName}:` +
        `\n• Amount due: £${params.amountFormatted}` +
        `${periodLine}` +
        `${dueLine}` +
        `\n\nYou can view and pay your invoice in the Parent Portal:\n${portalUrl}`
    );
}

/**
 * Builds a personalised 1-to-1 WhatsApp message for the Communications Launch Queue.
 */
export function buildBroadcastWhatsAppMessage(params: {
    firstName?: string | null;
    subject: string;
    message: string;
    centreName?: string | null;
}): string {
    const greeting = params.firstName?.trim() ? `Hi ${params.firstName.trim()},` : 'Hello,';
    const cleanSubject = params.subject.trim();
    const cleanBody = params.message.trim();
    const signOff = params.centreName?.trim() ? `\n\n— ${params.centreName.trim()}` : '';

    return `${greeting}\n\n*${cleanSubject}*\n\n${cleanBody}${signOff}`;
}

/**
 * Builds a ready-to-paste announcement for a WhatsApp Community Announcement group.
 */
export function buildCommunityWhatsAppCopy(params: {
    subject: string;
    message: string;
    centreName?: string | null;
}): string {
    const cleanSubject = params.subject.trim();
    const cleanBody = params.message.trim();
    const signOff = params.centreName?.trim() ? `\n\n— ${params.centreName.trim()}` : '';

    return `*${cleanSubject}*\n\n${cleanBody}${signOff}`;
}
