'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendContract, revokeContract, saveContractCentreDetails } from './actions';
import type { ContractStatusView } from './status';
import type { CentreContractDetails } from './queries';

export interface ContractPanelData {
    status: ContractStatusView;
    details: CentreContractDetails | null;
}

const BTN = 'inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60';
const FIELD = 'mt-1 block min-h-11 w-full rounded-lg border border-border bg-card p-3 text-sm';

export function ContractPanel({ configId, centreId, serviceType, data }: { configId: string; centreId: string; serviceType?: string; data: ContractPanelData }) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const { status, details } = data;
    const missing = details?.missing ?? [];
    const run = (fn: () => Promise<{ success: boolean; error?: string; message?: string }>) => start(async () => {
        const r = await fn();
        setMessage({ ok: r.success, text: (r.success ? r.message : r.error) ?? '' });
        if (r.success) { setEditing(false); router.refresh(); }
    });

    if (serviceType === 'tuition') {
        return <section aria-labelledby="contract-heading" className="rounded-lg border border-border p-4"><h3 id="contract-heading" className="text-sm font-semibold">Contract</h3><p className="mt-1 text-sm text-muted-foreground">Contracts are for childcare families only. This family is set to Tuition.</p></section>;
    }
    return (
        <section aria-labelledby="contract-heading" className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="contract-heading" className="text-sm font-semibold">Contract</h3>
                <span className="rounded-full border border-border px-3 py-1 text-sm font-medium" data-testid="contract-status">{status.label}</span>
            </div>
            {status.signed && (
                <p className="text-sm">Signed contract: {new Date(status.signed.signedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })} · £{(status.signed.amountPence / 100).toFixed(2)} a month{' '}
                    <a className="font-semibold text-primary underline" href={`/api/contracts/${status.signed.id}/pdf`}>Download signed contract</a></p>
            )}
            {status.amountChanged && <p role="alert" className="text-sm font-medium text-danger">The agreed amount has changed since this contract was signed. Send a new contract; nothing is sent automatically.</p>}
            {status.pending && <p className="text-sm text-muted-foreground">Link expires {new Date(status.pending.expiresAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}. Sending again replaces the earlier link.</p>}
            {missing.length > 0 && <p role="alert" className="text-sm font-medium text-danger">Add this centre’s contract details before sending: {missing.join(', ')}.</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={BTN} disabled={pending || missing.length > 0} onClick={() => run(() => sendContract({ configId }))}>
                    {status.pending ? 'Resend contract' : status.signed && !status.amountChanged ? 'Send a new contract' : 'Send contract'}
                </button>
                {status.pending && <button type="button" className={BTN} disabled={pending} onClick={() => run(() => revokeContract({ contractId: status.pending!.id }))}>Revoke link</button>}
                {details && <button type="button" className={BTN} onClick={() => setEditing(e => !e)} aria-expanded={editing}>{editing ? 'Close centre details' : 'Centre contract details'}</button>}
            </div>
            {editing && details && (
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const get = (k: string) => String(f.get(k) ?? '');
                    run(() => saveContractCentreDetails({ centreId, providerName: get('providerName'), address: get('address'), phone: get('phone'), website: get('website'), ofstedRegNo: get('ofstedRegNo') }));
                }}>
                    <label className="text-sm font-medium">Provider name<input name="providerName" defaultValue={details.values.providerName} required className={FIELD} /></label>
                    <label className="text-sm font-medium">Ofsted registration no.<input name="ofstedRegNo" defaultValue={details.values.ofstedRegNo} required className={FIELD} /></label>
                    <label className="text-sm font-medium sm:col-span-2">Address<input name="address" defaultValue={details.values.address} required className={FIELD} /></label>
                    <label className="text-sm font-medium">Phone<input name="phone" defaultValue={details.values.phone} required className={FIELD} /></label>
                    <label className="text-sm font-medium">Website (optional)<input name="website" defaultValue={details.values.website} className={FIELD} /></label>
                    <div><button type="submit" className={BTN} disabled={pending}>Save contract details</button></div>
                </form>
            )}
            <p aria-live="polite" className={message?.ok ? 'text-sm text-green-700' : 'text-sm text-danger'}>{message?.text}</p>
        </section>
    );
}
