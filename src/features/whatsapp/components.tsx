'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordWhatsAppConsent, saveWhatsAppCentreConfig, sendInvoiceWhatsAppTemplate } from './actions';

type Kind = 'invoice_issued' | 'payment_reminder' | 'payment_receipt';
const KIND_LABEL: Record<Kind, string> = { invoice_issued: 'Send invoice', payment_reminder: 'Send payment reminder', payment_receipt: 'Send receipt' };
const KINDS_BY_STATUS: Record<string, Kind[]> = { sent: ['invoice_issued', 'payment_reminder'], partially_paid: ['invoice_issued'], paid: ['payment_receipt'] };

const TEMPLATE_LABEL: Record<string, string> = {
    invoice_issued: 'Invoice issued',
    payment_reminder: 'Payment reminder',
    payment_receipt: 'Payment receipt',
};

const STATUS_LABEL: Record<string, string> = {
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    failed: 'Failed',
    queued: 'Queued',
    draft: 'Draft',
};

function humanizeTemplate(name: string): string {
    return TEMPLATE_LABEL[name] || name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function humanizeStatus(status: string): string {
    return STATUS_LABEL[status] || status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

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
    const router = useRouter();
    const [pending, start] = useTransition();
    const [note, setNote] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
        start(async () => {
            const r = await fn();
            if (r.success) {
                setNote(ok);
                setIsError(false);
                router.refresh();
            } else {
                setNote(r.error ?? 'Failed');
                setIsError(true);
            }
        });

    return (
        <section aria-labelledby="wa-api-h" className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 id="wa-api-h" className="text-sm font-bold text-foreground">WhatsApp Business messages</h2>
            <p className="text-xs text-muted-foreground">
                Consent: {consent === 'opted_in' ? 'Opted in' : consent === 'opted_out' ? 'Opted out' : 'Not recorded'}.
                {' '}Messages only send to parents who have opted in.
            </p>
            <div className="flex flex-wrap gap-2">
                {consent !== 'opted_in' && (
                    <button type="button" disabled={pending} className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60 transition-colors ${FOCUS_RING}`}
                        onClick={() => run(() => recordWhatsAppConsent({ parentId, status: 'opted_in', source: 'verbal' }), 'Opt-in recorded')}>
                        Record parent opt-in
                    </button>
                )}
                {consent === 'opted_in' && (
                    <button type="button" disabled={pending} className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/60 transition-colors ${FOCUS_RING}`}
                        onClick={() => run(() => recordWhatsAppConsent({ parentId, status: 'opted_out', source: 'parent_request' }), 'Opt-out recorded')}>
                        Record opt-out
                    </button>
                )}
                {apiAvailable && consent === 'opted_in' && (KINDS_BY_STATUS[invoiceStatus] ?? []).map(kind => (
                    <button key={kind} type="button" disabled={pending} className={`rounded-lg bg-accent text-on-accent px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity ${FOCUS_RING}`}
                        onClick={() => run(() => sendInvoiceWhatsAppTemplate({ invoiceId, kind }), 'Message queued')}>
                        {KIND_LABEL[kind]}
                    </button>
                ))}
            </div>
            {note && (
                <p role={isError ? "alert" : "status"} aria-live="polite" className={isError ? "text-xs text-destructive font-medium" : "text-xs text-muted-foreground"}>
                    {note}
                </p>
            )}
            {messages.length > 0 && (
                <ul className="text-xs divide-y divide-border">
                    {messages.map(m => (
                        <li key={m.id} className="py-1.5 flex justify-between gap-2">
                            <span className="text-foreground">{humanizeTemplate(m.templateName)}{m.dryRun ? ' (test)' : ''}</span>
                            <span className="font-semibold text-foreground">
                                {humanizeStatus(m.status)}
                                {m.errorMessage ? <span role="alert" className="text-destructive font-normal"> — {m.errorMessage}</span> : null}
                            </span>
                            <time dateTime={new Date(m.createdAt).toISOString()} className="text-muted-foreground tabular-nums">
                                {new Date(m.createdAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                            </time>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export function WhatsAppCentreConfigCard({ centreId, initial }: { centreId: string; initial: { phoneNumberId: string; wabaId: string; displayPhone: string; enabled: boolean } }) {
    const router = useRouter();
    const [v, setV] = useState(initial);
    const [pending, start] = useTransition();
    const [note, setNote] = useState<string | null>(null);
    const [isError, setIsError] = useState(false);
    return (
        <section aria-labelledby="wa-cfg-h" className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 id="wa-cfg-h" className="text-sm font-bold text-foreground">WhatsApp Business number (this centre)</h2>
            <p className="text-xs text-muted-foreground">Each centre has its own number. The access token is set on the server, never here. Until enabled, staff use the WhatsApp link as before.</p>
            {(['phoneNumberId', 'wabaId', 'displayPhone'] as const).map(k => (
                <label key={k} className="block text-xs font-semibold text-foreground">
                    {k === 'phoneNumberId' ? 'Meta phone number ID' : k === 'wabaId' ? 'WhatsApp Business Account ID' : 'Display number'}
                    <input className={`mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-normal text-foreground ${FOCUS_RING}`} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} />
                </label>
            ))}
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <input type="checkbox" checked={v.enabled} onChange={e => setV({ ...v, enabled: e.target.checked })} className="rounded border-border" /> Enabled for this centre
            </label>
            <button type="button" disabled={pending} className={`rounded-lg bg-accent text-on-accent px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity ${FOCUS_RING}`}
                onClick={() => start(async () => {
                    const r = await saveWhatsAppCentreConfig({ centreId, ...v });
                    if (r.success) {
                        setNote('Saved');
                        setIsError(false);
                        router.refresh();
                    } else {
                        setNote(r.error ?? 'Failed');
                        setIsError(true);
                    }
                })}>
                Save
            </button>
            {note && (
                <p role={isError ? "alert" : "status"} aria-live="polite" className={isError ? "text-xs text-destructive font-medium" : "text-xs text-muted-foreground"}>
                    {note}
                </p>
            )}
        </section>
    );
}
