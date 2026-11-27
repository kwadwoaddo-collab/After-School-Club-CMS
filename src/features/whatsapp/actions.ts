'use server';
import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditEvents, centres, invoices, parents, whatsappCentreConfigs, whatsappConsents, whatsappMessages } from '@/db/schema';
import { requireTenantSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { normaliseWhatsAppPhone } from '@/lib/whatsapp';
import { isWhatsAppApiEnabled } from './config';
import { getLatestConsent, getLatestConsentRecord } from './consent';
import { sendInvoiceTemplate, type SendOutcome } from './service';

const STAFF_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'];
const ADMIN_ROLES = ['ORG_OWNER', 'MANAGER'];
const CONSENT_SOURCES = ['verbal', 'written_form', 'registration_form', 'parent_request', 'staff_note'] as const;

type Authed = { orgId: string; userId: string; role: string };

async function authorise(roles: string[]): Promise<Authed | { error: string }> {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) return { error: 'Unauthorized' };
    const role = (session.user as { role?: string }).role;
    if (!role || !roles.includes(role)) return { error: 'Forbidden' };
    return { orgId: session.user.organisationId, userId: session.user.id, role };
}

async function hasCentreAccess(a: Authed, centreId: string): Promise<boolean> {
    if (a.role === 'ORG_OWNER') return true;
    return (await getUserAccessibleCentreIds(a.userId)).includes(centreId);
}

/** Staff-triggered API send of an approved utility template for an invoice. Never auto-sent. */
export async function sendInvoiceWhatsAppTemplate(input: { invoiceId: string; kind: 'invoice_issued' | 'payment_reminder' | 'payment_receipt' }): Promise<SendOutcome> {
    const parsed = z.object({ invoiceId: z.string().uuid(), kind: z.enum(['invoice_issued', 'payment_reminder', 'payment_receipt']) }).safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid request' };
    const a = await authorise(STAFF_ROLES);
    if ('error' in a) return { success: false, error: a.error };

    const [inv] = await db.select({ centreId: invoices.centreId }).from(invoices)
        .where(and(eq(invoices.id, parsed.data.invoiceId), eq(invoices.organisationId, a.orgId)));
    if (!inv) return { success: false, error: 'Invoice not found' };
    if (!(await hasCentreAccess(a, inv.centreId))) return { success: false, error: 'Unauthorized: No access to this centre' };

    const res = await sendInvoiceTemplate({ orgId: a.orgId, userId: a.userId, invoiceId: parsed.data.invoiceId, kind: parsed.data.kind });
    revalidatePath(`/dashboard/finance/invoices/${parsed.data.invoiceId}`);
    return res;
}

/**
 * Records a parent's WhatsApp opt-in or opt-out (append-only history). Owner/Manager only.
 * Consent is org-wide (parents have no centre). Overriding a parent's own STOP reply is recorded with a distinct source.
 */
export async function recordWhatsAppConsent(input: { parentId: string; status: 'opted_in' | 'opted_out'; source: (typeof CONSENT_SOURCES)[number] }) {
    const parsed = z.object({ parentId: z.string().uuid(), status: z.enum(['opted_in', 'opted_out']), source: z.enum(CONSENT_SOURCES) }).safeParse(input);
    if (!parsed.success) return { success: false as const, error: 'Invalid request' };
    const a = await authorise(ADMIN_ROLES);
    if ('error' in a) return { success: false as const, error: a.error };

    const [parent] = await db.select({ id: parents.id, phone: parents.phone }).from(parents)
        .where(and(eq(parents.id, parsed.data.parentId), eq(parents.organisationId, a.orgId), isNull(parents.deletedAt)));
    if (!parent) return { success: false as const, error: 'Parent not found' };
    if (parsed.data.status === 'opted_in' && !normaliseWhatsAppPhone(parent.phone)) return { success: false as const, error: 'Parent has no valid WhatsApp number' };

    const latest = await getLatestConsentRecord(a.orgId, parent.id);
    const overridesStop = parsed.data.status === 'opted_in' && latest?.status === 'opted_out' && latest.source === 'whatsapp_stop_reply';
    const source = overridesStop ? 'staff_override_of_stop' : parsed.data.source;
    await db.insert(whatsappConsents).values({ organisationId: a.orgId, parentId: parent.id, status: parsed.data.status, source, recordedBy: a.userId });
    await db.insert(auditEvents).values({ organisationId: a.orgId, userId: a.userId, eventType: `whatsapp_${parsed.data.status}`, eventData: JSON.stringify({ parentId: parent.id, source, overridesStop }) });
    return { success: true as const };
}

/** Owner/Manager: set a centre's own WhatsApp number. Enabling needs a phone_number_id. The token is env-only, never here. */
export async function saveWhatsAppCentreConfig(input: { centreId: string; phoneNumberId: string; wabaId?: string; displayPhone?: string; enabled: boolean }) {
    const parsed = z.object({
        centreId: z.string().uuid(), phoneNumberId: z.string().trim().regex(/^\d{5,32}$/, 'Phone number ID must be digits').or(z.literal('')),
        wabaId: z.string().trim().regex(/^\d{5,32}$/).or(z.literal('')).optional(), displayPhone: z.string().trim().max(30).optional(), enabled: z.boolean(),
    }).safeParse(input);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid request' };
    const a = await authorise(ADMIN_ROLES);
    if ('error' in a) return { success: false as const, error: a.error };
    const d = parsed.data;

    const [centre] = await db.select({ id: centres.id }).from(centres).where(and(eq(centres.id, d.centreId), eq(centres.organisationId, a.orgId)));
    if (!centre) return { success: false as const, error: 'Centre not found' };
    if (!(await hasCentreAccess(a, d.centreId))) return { success: false as const, error: 'Unauthorized: No access to this centre' };
    if (d.enabled && !d.phoneNumberId) return { success: false as const, error: 'Enter the Meta phone number ID before enabling' };

    const values = {
        phoneNumberId: d.phoneNumberId || null, wabaId: d.wabaId || null, displayPhone: d.displayPhone || null,
        enabled: d.enabled, status: (d.enabled ? 'active' : d.phoneNumberId ? 'disabled' : 'pending') as 'active' | 'disabled' | 'pending',
        updatedBy: a.userId, updatedAt: new Date(),
    };
    try {
        await db.insert(whatsappCentreConfigs).values({ organisationId: a.orgId, centreId: d.centreId, ...values })
            .onConflictDoUpdate({ target: whatsappCentreConfigs.centreId, set: values });
    } catch {
        return { success: false as const, error: 'That phone number ID is already used by another centre' };
    }
    await db.insert(auditEvents).values({ organisationId: a.orgId, userId: a.userId, eventType: 'whatsapp_centre_config_saved', eventData: JSON.stringify({ centreId: d.centreId, enabled: d.enabled }) });
    revalidatePath('/dashboard/communications');
    return { success: true as const };
}

/** Message log + availability for the invoice detail page. Org- and centre-scoped. */
export async function getInvoiceWhatsAppInfo(invoiceId: string) {
    if (!z.string().uuid().safeParse(invoiceId).success) return { success: false as const, error: 'Invalid request' };
    const a = await authorise(STAFF_ROLES);
    if ('error' in a) return { success: false as const, error: a.error };
    const [inv] = await db.select({ centreId: invoices.centreId, parentId: invoices.parentId }).from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, a.orgId)));
    if (!inv) return { success: false as const, error: 'Invoice not found' };
    if (!(await hasCentreAccess(a, inv.centreId))) return { success: false as const, error: 'Unauthorized: No access to this centre' };

    const messages = await db.select({
        id: whatsappMessages.id, templateName: whatsappMessages.templateName, status: whatsappMessages.status, dryRun: whatsappMessages.dryRun,
        errorMessage: whatsappMessages.errorMessage, createdAt: whatsappMessages.createdAt, deliveredAt: whatsappMessages.deliveredAt, readAt: whatsappMessages.readAt,
    }).from(whatsappMessages)
        .where(and(eq(whatsappMessages.invoiceId, invoiceId), eq(whatsappMessages.organisationId, a.orgId)))
        .orderBy(desc(whatsappMessages.createdAt)).limit(20);
    const [config] = await db.select({ enabled: whatsappCentreConfigs.enabled, status: whatsappCentreConfigs.status })
        .from(whatsappCentreConfigs).where(and(eq(whatsappCentreConfigs.centreId, inv.centreId), eq(whatsappCentreConfigs.organisationId, a.orgId)));
    const consent = await getLatestConsent(a.orgId, inv.parentId);
    return {
        success: true as const, messages, consent,
        apiAvailable: isWhatsAppApiEnabled() && !!config?.enabled && config.status === 'active',
    };
}
