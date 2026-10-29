'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatInvoiceDate, formatInvoicePeriod } from '../domain/invoice-display';
import { toEuropeLondonBusinessDate } from '../domain/payment-eligibility';

type Props = {
    invoice: { invoiceNumber: string; amount: string | number; dueDate?: Date | string | null;
        billingPeriodStart?: Date | string | null; billingPeriodEnd?: Date | string | null;
        parent?: { id?: string; firstName: string; lastName: string; email?: string | null } | null;
        childDisplayName?: string | null; child?: { id: string; firstName: string; lastName: string } | null;
        coveredChildrenJson?: { id?: string; name?: string; childName?: string }[] | null };
    pending: boolean; onClose: () => void; onConfirm: () => Promise<void>;
};

export default function IssueInvoiceConfirmation({ invoice, pending, onClose, onConfirm }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const inFlight = useRef(false);
    const cancelButton = useRef<HTMLButtonElement>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const today = toEuropeLondonBusinessDate(new Date());
    const endDate = invoice.billingPeriodEnd ? new Date(invoice.billingPeriodEnd) : null;
    const periodEnd = endDate && Number.isFinite(endDate.getTime()) ? endDate.toISOString().slice(0, 10) : null;
    const historical = !!periodEnd && periodEnd < today;
    const children = invoice.coveredChildrenJson?.length ? invoice.coveredChildrenJson : invoice.child ? [{ id: invoice.child.id, name: `${invoice.child.firstName} ${invoice.child.lastName}` }] : [];
    useEffect(() => {
        const node = dialog.current;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        node?.showModal();
        cancelButton.current?.focus();
        return () => { node?.close(); opener?.focus(); };
    }, []);
    return <dialog ref={dialog} aria-labelledby="issue-confirm-title" aria-describedby="issue-confirm-effect" onCancel={event => { event.preventDefault(); if (!pending && !inFlight.current) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground backdrop:bg-black/60 sm:p-6">
        <h2 id="issue-confirm-title" className="text-xl font-semibold">Issue {invoice.invoiceNumber}?</h2>
        <dl className="my-5 space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Family</dt><dd className="font-medium">{invoice.parent?.id ? <Link className="text-primary underline" href={`/dashboard/parents/${invoice.parent.id}`}>{invoice.parent.firstName} {invoice.parent.lastName}</Link> : 'Check family on invoice'}</dd></div>
            <div><dt className="text-muted-foreground">Covered children</dt><dd>{children.length ? children.map((child, i) => <span key={child.id || i}>{i > 0 && ', '}{child.id ? <Link className="text-primary underline" href={`/dashboard/students/${child.id}`}>{child.name || child.childName || 'View student'}</Link> : child.name || child.childName || 'Check student'}</span>) : invoice.childDisplayName || 'Check covered children on invoice'}</dd></div>
            <div><dt className="text-muted-foreground">Billing period</dt><dd className="font-medium">{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)}</dd></div>
            <div><dt className="text-muted-foreground">Invoice total</dt><dd className="font-semibold">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(invoice.amount))}</dd></div>
            <div><dt className="text-muted-foreground">Due date</dt><dd>{formatInvoiceDate(invoice.dueDate)}</dd></div>
        </dl>
        <p id="issue-confirm-effect" className="text-sm text-muted-foreground">This changes the draft into an issued invoice. No email or parent notification is sent. Use Send invoice by email separately when you are ready. No payment is recorded.</p>
        {historical && <label className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/40 p-3 text-sm"><input className="mt-1" type="checkbox" checked={acknowledged} disabled={pending} onChange={event => setAcknowledged(event.target.checked)}/><span><strong>Historical billing period.</strong> I have checked existing invoices and payments and confirm this invoice is required for the selected historical period.</span></label>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button ref={cancelButton} type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Cancel</button>
            <button type="button" disabled={pending || (historical && !acknowledged)} onClick={async () => { if (inFlight.current) return; inFlight.current = true; try { await onConfirm(); } finally { inFlight.current = false; } }} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">{pending ? 'Issuing…' : 'Confirm and issue invoice'}</button>
        </div>
    </dialog>;
}
