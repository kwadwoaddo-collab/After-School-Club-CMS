import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditEvents, parents, whatsappCentreConfigs, whatsappConsents, whatsappMessages } from '@/db/schema';
import { normaliseWhatsAppPhone } from '@/lib/whatsapp';
import { isOptOutText } from './templates';

interface MetaStatus { id?: string; status?: string; timestamp?: string; errors?: { code?: number; title?: string }[] }
interface MetaInbound { from?: string; type?: string; text?: { body?: string } }
interface MetaPayload { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; statuses?: MetaStatus[]; messages?: MetaInbound[] } }[] }[] }

const RANK: Record<string, number> = { queued: 0, dry_run: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/** Applies delivery receipts and STOP replies. Idempotent: replays never move a status backwards. */
export async function processWhatsAppWebhook(payload: MetaPayload): Promise<{ statusUpdates: number; optOuts: number }> {
    let statusUpdates = 0;
    let optOuts = 0;
    for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
            const value = change.value;
            const phoneNumberId = value?.metadata?.phone_number_id;
            if (!value || !phoneNumberId) continue;
            const [config] = await db.select({ centreId: whatsappCentreConfigs.centreId, organisationId: whatsappCentreConfigs.organisationId })
                .from(whatsappCentreConfigs).where(eq(whatsappCentreConfigs.phoneNumberId, phoneNumberId));
            if (!config) continue; // unknown number: ignore

            for (const s of value.statuses ?? []) {
                if (!s.id || !s.status || !(s.status in RANK) || s.status === 'queued') continue;
                const [msg] = await db.select({ id: whatsappMessages.id, status: whatsappMessages.status })
                    .from(whatsappMessages)
                    .where(and(eq(whatsappMessages.wamid, s.id), eq(whatsappMessages.centreId, config.centreId), eq(whatsappMessages.organisationId, config.organisationId)));
                if (!msg || RANK[s.status] <= RANK[msg.status]) continue;
                const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
                const set: Record<string, unknown> = { status: s.status };
                if (s.status === 'delivered') set.deliveredAt = at;
                if (s.status === 'read') set.readAt = at;
                if (s.status === 'failed') {
                    set.failedAt = at;
                    set.errorCode = String(s.errors?.[0]?.code ?? 'unknown').slice(0, 20);
                    set.errorMessage = String(s.errors?.[0]?.title ?? 'Delivery failed').slice(0, 300);
                }
                await db.update(whatsappMessages).set(set).where(eq(whatsappMessages.id, msg.id));
                statusUpdates++;
            }

            for (const m of value.messages ?? []) {
                if (m.type !== 'text' || !isOptOutText(m.text?.body)) continue;
                const from = normaliseWhatsAppPhone(m.from ? `+${m.from}` : null);
                if (!from) continue;
                // Narrow in SQL by trailing digits, then confirm the exact normalised match in code.
                const candidates = await db.select({ id: parents.id, phone: parents.phone }).from(parents)
                    .where(and(eq(parents.organisationId, config.organisationId),
                        sql`regexp_replace(${parents.phone}, '[^0-9]', '', 'g') LIKE ${'%' + from.slice(-9)}`));
                for (const p of candidates) {
                    if (normaliseWhatsAppPhone(p.phone) !== from) continue;
                    const [latest] = await db.select({ status: whatsappConsents.status }).from(whatsappConsents)
                        .where(and(eq(whatsappConsents.parentId, p.id), eq(whatsappConsents.organisationId, config.organisationId)))
                        .orderBy(desc(whatsappConsents.recordedAt)).limit(1);
                    if (latest?.status === 'opted_out') continue;
                    await db.insert(whatsappConsents).values({ organisationId: config.organisationId, parentId: p.id, status: 'opted_out', source: 'whatsapp_stop_reply', recordedBy: null });
                    await db.insert(auditEvents).values({ organisationId: config.organisationId, userId: null, eventType: 'whatsapp_opt_out_reply', eventData: JSON.stringify({ parentId: p.id, centreId: config.centreId }) });
                    optOuts++;
                }
            }
        }
    }
    return { statusUpdates, optOuts };
}
