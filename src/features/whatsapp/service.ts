import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditEvents, centres, invoices, organisations, parents, whatsappCentreConfigs, whatsappMessages } from '@/db/schema';
import { logger } from '@/lib/logger';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { normaliseWhatsAppPhone } from '@/lib/whatsapp';
import { getWhatsAppAccessToken, isWhatsAppApiEnabled, isWhatsAppDryRun } from './config';
import { getLatestConsent } from './consent';
import { sendGraphMessage } from './client';
import { decideRoute } from './routing';
import {
    TEMPLATE_ELIGIBLE_STATUSES, WHATSAPP_TEMPLATES, buildIdempotencyKey, buildTemplateParams, buildTemplatePayload,
    type WhatsAppTemplateKind,
} from './templates';

export type SendOutcome =
    | { success: true; status: 'sent' | 'dry_run'; messageId: string }
    | { success: false; error: string; route?: 'wa_me' | 'blocked'; reason?: string };

const money = (v: string | number) => Number(v).toFixed(2);
const ukDate = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : null);
const maskPhone = (digits: string) => `***${digits.slice(-4)}`;

/**
 * Sends one approved utility template for an invoice. Caller must already have authorised the staff user
 * (role + centre guard); this function enforces org scoping, routing, consent, idempotency and rate limiting.
 */
export async function sendInvoiceTemplate(
    input: { orgId: string; userId: string; invoiceId: string; kind: WhatsAppTemplateKind },
    deps: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<SendOutcome> {
    const { orgId, userId, invoiceId, kind } = input;
    const now = deps.now ?? new Date();

    const [invoice] = await db.select({
        id: invoices.id, centreId: invoices.centreId, parentId: invoices.parentId, invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount, status: invoices.status, dueDate: invoices.dueDate, serviceType: invoices.serviceType,
    }).from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)));
    if (!invoice) return { success: false, error: 'Invoice not found' };
    if (!TEMPLATE_ELIGIBLE_STATUSES[kind].includes(invoice.status)) {
        return { success: false, error: 'This message cannot be sent for the invoice in its current state' };
    }

    const [parent] = await db.select({ id: parents.id, firstName: parents.firstName, phone: parents.phone })
        .from(parents).where(and(eq(parents.id, invoice.parentId), eq(parents.organisationId, orgId)));
    if (!parent) return { success: false, error: 'Parent not found' };

    const [config] = await db.select({
        phoneNumberId: whatsappCentreConfigs.phoneNumberId, status: whatsappCentreConfigs.status, enabled: whatsappCentreConfigs.enabled,
    }).from(whatsappCentreConfigs).where(and(eq(whatsappCentreConfigs.centreId, invoice.centreId), eq(whatsappCentreConfigs.organisationId, orgId)));

    const token = getWhatsAppAccessToken();
    const dryRun = isWhatsAppDryRun();
    const phone = normaliseWhatsAppPhone(parent.phone);
    const consent = await getLatestConsent(orgId, parent.id);
    const decision = decideRoute({ flagOn: isWhatsAppApiEnabled(), hasCredentials: !!token, dryRun, config, phoneDigits: phone, consent });

    if (decision.route !== 'api') {
        return { success: false, route: decision.route, reason: decision.reason, error: decision.route === 'wa_me'
            ? 'WhatsApp API is not active for this centre — use the WhatsApp link instead'
            : decision.reason === 'invalid_phone' ? 'Parent has no valid WhatsApp number'
            : 'Parent has not opted in to WhatsApp messages' };
    }

    const rl = await checkRateLimit(apiRateLimit, `wa-send:${orgId}`, { localLimit: 30 });
    if (!rl.success) return { success: false, error: 'Too many WhatsApp sends — try again shortly' };

    const [org] = await db.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, orgId));
    const [centre] = await db.select({ name: centres.name }).from(centres).where(eq(centres.id, invoice.centreId));
    const params = buildTemplateParams(kind, {
        parentFirstName: parent.firstName, serviceType: invoice.serviceType === 'tuition' ? 'tuition' : 'childcare',
        invoiceNumber: invoice.invoiceNumber, organisationName: centre?.name || org?.name || '',
        amountFormatted: money(invoice.amount), dueDateFormatted: ukDate(invoice.dueDate),
    });
    const payload = buildTemplatePayload(phone!, kind, params);
    const def = WHATSAPP_TEMPLATES[kind];
    const key = buildIdempotencyKey(kind, invoice.id, now);

    // Idempotency: first writer wins; a previously FAILED send may be retried, anything else is a duplicate.
    let [row] = await db.insert(whatsappMessages).values({
        organisationId: orgId, centreId: invoice.centreId, parentId: parent.id, invoiceId: invoice.id,
        templateName: def.name, templateLanguage: def.language, idempotencyKey: key, status: 'queued', dryRun, createdBy: userId,
    }).onConflictDoNothing().returning({ id: whatsappMessages.id });
    if (!row) {
        [row] = await db.update(whatsappMessages)
            .set({ status: 'queued', errorCode: null, errorMessage: null, failedAt: null, dryRun, createdBy: userId })
            .where(and(eq(whatsappMessages.idempotencyKey, key), eq(whatsappMessages.organisationId, orgId), eq(whatsappMessages.status, 'failed')))
            .returning({ id: whatsappMessages.id });
        if (!row) return { success: false, error: 'This message has already been sent' };
    }

    const audit = (status: string) => db.insert(auditEvents).values({
        organisationId: orgId, userId, eventType: 'invoice_whatsapp_api_send',
        eventData: JSON.stringify({ invoiceId: invoice.id, template: def.name, status, dryRun, messageId: row.id }),
    });

    if (dryRun) {
        logger.info(`[WhatsApp dry-run] ${def.name} to ${maskPhone(phone!)} via ${decision.phoneNumberId}: ${JSON.stringify(params)}`);
        await db.update(whatsappMessages).set({ status: 'dry_run' }).where(eq(whatsappMessages.id, row.id));
        await audit('dry_run');
        return { success: true, status: 'dry_run', messageId: row.id };
    }

    const result = await sendGraphMessage(decision.phoneNumberId, payload, token!, deps.fetchImpl);
    if (result.ok) {
        await db.update(whatsappMessages).set({ status: 'sent', wamid: result.wamid, sentAt: now }).where(eq(whatsappMessages.id, row.id));
        await audit('sent');
        return { success: true, status: 'sent', messageId: row.id };
    }
    await db.update(whatsappMessages).set({ status: 'failed', errorCode: result.code.slice(0, 20), errorMessage: result.message, failedAt: now }).where(eq(whatsappMessages.id, row.id));
    await audit('failed');
    logger.warn(`[WhatsApp] send failed template=${def.name} code=${result.code}`);
    return { success: false, error: 'WhatsApp could not deliver this message — use the WhatsApp link instead', reason: result.code };
}

