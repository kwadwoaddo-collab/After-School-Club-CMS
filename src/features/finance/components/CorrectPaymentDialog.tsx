'use client';
import { useEffect, useRef, useState } from 'react';
import { correctPaymentDetails } from '../correct-payment';
export function CorrectPaymentDialog({ payment, onClose, onSaved }: {
    payment: {
        id: string;
        amount: string | number;
        recordedAt: Date | string;
        transactionReference: string | null;
    };
    onClose: () => void;
    onSaved: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(payment.recordedAt)));
    const [reference, setReference] = useState(payment.transactionReference ?? '');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [requestId] = useState(() => crypto.randomUUID());
    useEffect(() => { const previous = document.activeElement; dialog.current?.showModal(); return () => { if (previous instanceof HTMLElement)
        previous.focus(); }; }, []);
    return <dialog ref={dialog} aria-labelledby="correct-payment-title" onCancel={e => { if (busy)
        e.preventDefault();
    else
        onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/50">
 <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (busy)
        return; setBusy(true); setError(''); try {
        const result = await correctPaymentDetails({ paymentId: payment.id, correctionId: requestId, paymentDate: date, reference: reference.trim() || null, reason, expectedRecordedAt: new Date(payment.recordedAt).toISOString(), expectedReference: payment.transactionReference });
        if (!result.success) { setError(result.error); return; }
        onSaved();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Correction was not confirmed. Reload the invoice before retrying.');
    }
    finally {
        setBusy(false);
    } }}>
 <h2 id="correct-payment-title" className="text-xl font-semibold">Correct payment details</h2><p className="text-sm text-muted-foreground">This keeps the £{Number(payment.amount).toFixed(2)} payment and paid balance unchanged. The correction is audited. No email is sent automatically.</p>
 <p className="text-sm">Current payment date: {new Date(payment.recordedAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}</p>
 <label className="block text-sm font-medium">Payment date<input autoFocus required type="date" disabled={busy} value={date} onChange={e => setDate(e.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background p-3"/></label>
 <label className="block text-sm font-medium">Payment reference<input maxLength={255} disabled={busy} value={reference} onChange={e => setReference(e.target.value)} className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background p-3"/></label>
 <label className="block text-sm font-medium">Reason for correction<textarea required minLength={3} maxLength={500} rows={3} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 block w-full rounded-lg border border-border bg-background p-3"/></label>
 {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
 <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={busy || reason.trim().length < 3} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Saving correction…' : 'Save correction'}</button></div>
 </form></dialog>;
}
