'use client';
import { useState, useTransition } from 'react';
import { recordWhatsAppConsent, saveWhatsAppCentreConfig, sendInvoiceWhatsAppTemplate } from './actions';

type Kind = 'invoice_issued' | 'payment_reminder' | 'payment_receipt';
const KIND_LABEL: Record<Kind, string> = { invoice_issued: 'Send invoice', payment_reminder: 'Send payment reminder', payment_receipt: 'Send receipt' };
const KINDS_BY_STATUS: Record<string, Kind[]> = { sent: ['invoice_issued', 'payment_reminder'], partially_paid: ['invoice_issued'], paid: ['payment_receipt'] };

export interface WhatsAppPanelProps {
    invoiceId: string;
    parentId: string;
    invoiceStatus: string;
    apiAvailable: boolean;
    consent: 'opted_in' | 'opted_out' | null;
    messages: { id: string; templateName: string; status: string; dryRun: boolean; errorMessage: string | null; createdAt: Date | string }[];
}

/** Additive WhatsApp Business API panel. The Phase 1 wa.me buttons remain the fallback and are untouched. */
export function WhatsAppApiPanel({ invoiceId, parentId, invoiceStatus, apiAvailable, consent, messages }: WhatsAppPanelProps) {
    const [pending, start] = useTransition();
    const [note, setNote] = useState<string | null>(null);
    const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
        start(async () => { const r = await fn(); setNote(r.success ? ok : r.error ?? 'Failed'); });

    return (
        <section aria-labelledby="wa-api-h" className="rounded-2xl border bg-card p-4 space-y-3">
            <h2 id="wa-api-h" className="text-sm font-bold">WhatsApp Business messages</h2>
            <p className="text-xs text-muted-foreground">
                Consent: {consent === 'opted_in' ? 'Opted in' : consent === 'opted_out' ? 'Opted out' : 'Not recorded'}.
                {' '}Messages only send to parents who have opted in.
            </p>
            <div className="flex flex-wrap gap-2">
                {consent !== 'opted_in' && (
                    <button type="button" disabled={pending} className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        onClick={() => run(() => recordWhatsAppConsent({ parentId, status: 'opted_in', source: 'verbal' }), 'Opt-in recorded — refresh to update')}>
                        Record parent opt-in
                    </button>
                )}
                {consent === 'opted_in' && (
                    <button type="button" disabled={pending} className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        onClick={() => run(() => recordWhatsAppConsent({ parentId, status: 'opted_out', source: 'parent_request' }), 'Opt-out recorded — refresh to update')}>
                        Record opt-out
                    </button>
                )}
                {apiAvailable && consent === 'opted_in' && (KINDS_BY_STATUS[invoiceStatus] ?? []).map(kind => (
                    <button key={kind} type="button" disabled={pending} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
                        onClick={() => run(() => sendInvoiceWhatsAppTemplate({ invoiceId, kind }), 'Message queued — refresh to see status')}>
                        {KIND_LABEL[kind]}
                    </button>
                ))}
            </div>
            <p role="status" aria-live="polite" className="text-xs">{note}</p>
            {messages.length > 0 && (
                <ul className="text-xs divide-y">
                    {messages.map(m => (
                        <li key={m.id} className="py-1.5 flex justify-between gap-2">
                            <span>{m.templateName}{m.dryRun ? ' (test)' : ''}</span>
                            <span className="font-semibold">{m.status}{m.errorMessage ? ` — ${m.errorMessage}` : ''}</span>
                            <time dateTime={new Date(m.createdAt).toISOString()}>{new Date(m.createdAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</time>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export function WhatsAppCentreConfigCard({ centreId, initial }: { centreId: string; initial: { phoneNumberId: string; wabaId: string; displayPhone: string; enabled: boolean } }) {
    const [v, setV] = useState(initial);
    const [pending, start] = useTransition();
    const [note, setNote] = useState<string | null>(null);
    return (
        <section aria-labelledby="wa-cfg-h" className="rounded-2xl border bg-card p-4 space-y-3">
            <h2 id="wa-cfg-h" className="text-sm font-bold">WhatsApp Business number (this centre)</h2>
            <p className="text-xs text-muted-foreground">Each centre has its own number. The access token is set on the server, never here. Until enabled, staff use the WhatsApp link as before.</p>
            {(['phoneNumberId', 'wabaId', 'displayPhone'] as const).map(k => (
                <label key={k} className="block text-xs font-semibold">
                    {k === 'phoneNumberId' ? 'Meta phone number ID' : k === 'wabaId' ? 'WhatsApp Business Account ID' : 'Display number'}
                    <input className="mt-1 block w-full rounded-lg border px-2 py-1.5 text-sm font-normal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />
                </label>
            ))}
            <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={v.enabled} onChange={e => setV({ ...v, enabled: e.target.checked })} /> Enabled for this centre
            </label>
            <button type="button" disabled={pending} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold"
                onClick={() => start(async () => { const r = await saveWhatsAppCentreConfig({ centreId, ...v }); setNote(r.success ? 'Saved' : r.error ?? 'Failed'); })}>
                Save
            </button>
            <p role="status" aria-live="polite" className="text-xs">{note}</p>
        </section>
    );
}
