'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
    Plus,
    FileText,
    Trash2,
    Ban,
    Loader2,
    CheckCircle2,
    CalendarClock,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import ConfirmActionModal from './ConfirmActionModal';
import { useRouter } from 'next/navigation';
import { deleteInvoice, voidInvoice } from '../actions';
import {
    COLLECTION_STAGE_STYLES,
    evaluateInvoiceCollectionState,
    toLondonBusinessDate,
    type InvoiceCollectionStage,
} from '../domain/invoice-collection-state';

function renderCollectionStageIcon(stage: InvoiceCollectionStage) {
    switch (stage) {
        case 'paid':
            return <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />;
        case 'upcoming':
            return <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />;
        case 'in_period':
            return <Clock className="w-3.5 h-3.5" aria-hidden="true" />;
        case 'overdue':
        case 'needs_checking':
            return <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />;
        case 'draft':
            return <FileText className="w-3.5 h-3.5" aria-hidden="true" />;
        case 'void':
            return <Ban className="w-3.5 h-3.5" aria-hidden="true" />;
    }
}

export function InvoiceTable({ 
    invoices = [], 
    isOwner = false,
    onCreateInvoice,
}: { 
    invoices?: unknown[];
    isOwner?: boolean;
    onCreateInvoice?: () => void;
}) {
    const router = useRouter();
    const [confirmTarget, setConfirmTarget] = useState<{ id: string; invoiceNumber: string; action: 'delete' | 'void' } | null>(null);
    const [isPending, startTransition] = useTransition();
    const confirmLockRef = useRef(false);
    const todayLondonIso = toLondonBusinessDate();
    
    if (!invoices || invoices.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-secondary/40 rounded-full flex items-center justify-center mb-4 border border-border">
                    <FileText className="w-8 h-8 text-muted-foreground/40" aria-hidden="true" />
                </div>
                <h4 className="text-lg font-bold text-foreground">No invoices yet</h4>
                <p className="text-sm text-muted-foreground max-w-xs mt-1 mb-4">
                    Create your first invoice to get started.
                </p>
                {isOwner && onCreateInvoice && (
                    <button
                        type="button"
                        onClick={onCreateInvoice}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-95 duration-100"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Create Invoice
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="relative overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
                {isPending && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                        <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl text-sm font-bold text-foreground shadow-xl animate-in zoom-in-95 duration-150">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
                            Updating Ledger...
                        </div>
                    </div>
                )}
                <table className="w-full">
                    <thead>
                        <tr className="text-left border-b border-border">
                            <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Invoice #</th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Student</th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Due Date</th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Status</th>
                            <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Amount</th>
                            {isOwner && <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {invoices.map((invoice: any) => {
                            const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
                            const collectionState = evaluateInvoiceCollectionState(invoice, todayLondonIso, { strictPayments: false });
                            const isOpenIssued = (invoice.status === 'sent' || invoice.status === 'partially_paid');
                            const isOverdue = isOpenIssued && collectionState.stage === 'overdue';
                            const isInPeriod = isOpenIssued && collectionState.stage === 'in_period';

                            return (
                                <tr 
                                    key={invoice.id} 
                                    onClick={() => { if (isPending) return; router.push(`/dashboard/finance/invoices/${invoice.id}`); }}
                                    className={`group transition-colors duration-100 ${
                                        isOverdue
                                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                                            : 'hover:bg-secondary/60'
                                    } ${isPending ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                                >
                                    <td className="py-4 px-4">
                                        <Link
                                            href={`/dashboard/finance/invoices/${invoice.id}`}
                                            onClick={(e) => {
                                                if (isPending) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                                e.stopPropagation();
                                            }}
                                            className="text-sm font-bold text-foreground group-hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-sm transition-colors"
                                        >
                                            {invoice.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col">
                                            {(() => {
                                                const covered = Array.isArray(invoice.coveredChildrenJson) && invoice.coveredChildrenJson.length > 0
                                                    ? invoice.coveredChildrenJson
                                                    : null;
                                                if (covered) {
                                                    return (
                                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                                            {covered.map((c: any, idx: number) => {
                                                                const childId = c.id || c.childId;
                                                                const childName = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
                                                                return (
                                                                    <span key={childId || idx} className="inline-flex items-center">
                                                                        {childId ? (
                                                                            <Link
                                                                                href={`/dashboard/students/${childId}`}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors w-fit"
                                                                            >
                                                                                {childName}
                                                                            </Link>
                                                                        ) : (
                                                                            <span className="text-sm font-bold text-foreground">{childName}</span>
                                                                        )}
                                                                        {idx < covered.length - 1 && <span className="text-muted-foreground mr-0.5">,</span>}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                }
                                                if (invoice.child) {
                                                    return (
                                                        <Link
                                                            href={`/dashboard/students/${invoice.child.id || invoice.childId}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors w-fit"
                                                        >
                                                            {invoice.child.firstName} {invoice.child.lastName}
                                                        </Link>
                                                    );
                                                }
                                                if (invoice.parent) {
                                                    return (
                                                        <Link
                                                            href={`/dashboard/parents/${invoice.parent.id || invoice.parentId}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors w-fit"
                                                        >
                                                            {`${invoice.parent.firstName} ${invoice.parent.lastName} Family`}
                                                        </Link>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <span className="text-xs text-muted-foreground">{invoice.centre?.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        {dueDate ? (
                                            <span className={`text-sm ${
                                                isOverdue
                                                    ? 'text-rose-700 dark:text-rose-300 font-bold'
                                                    : isInPeriod
                                                        ? 'text-amber-800 dark:text-amber-200 font-medium'
                                                        : 'text-muted-foreground font-medium'
                                            }`}>
                                                {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${COLLECTION_STAGE_STYLES[collectionState.stage].badge}`}>
                                            {renderCollectionStageIcon(collectionState.stage)}
                                            {collectionState.staffBadgeLabel}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right px-4">
                                        <span className="text-sm font-black text-foreground tabular-nums">£{Number(invoice.amount).toFixed(2)}</span>
                                    </td>
                                    {isOwner && (
                                        <td className="py-4 text-right px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                {invoice.status !== 'void' && invoice.status !== 'draft' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, action: 'void' })}
                                                        className="min-w-[44px] min-h-[44px] p-2 inline-flex items-center justify-center bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 rounded-lg transition-all border border-amber-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 duration-100"
                                                        title="Void Invoice"
                                                        aria-label="Void Invoice"
                                                    >
                                                        <Ban className="w-4 h-4" aria-hidden="true" />
                                                    </button>
                                                )}
                                                {invoice.status === 'draft' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, action: 'delete' })}
                                                        className="min-w-[44px] min-h-[44px] p-2 inline-flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-all border border-destructive/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 duration-100"
                                                        title="Delete Draft"
                                                        aria-label="Delete Draft"
                                                    >
                                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ConfirmActionModal
                isOpen={confirmTarget !== null}
                onClose={() => setConfirmTarget(null)}
                variant={confirmTarget?.action ?? 'delete'}
                invoiceNumber={confirmTarget?.invoiceNumber ?? ''}
                onConfirm={async () => {
                    if (!confirmTarget || confirmLockRef.current) return;
                    confirmLockRef.current = true;
                    try {
                        if (confirmTarget.action === 'delete') {
                            await deleteInvoice(confirmTarget.id);
                        } else {
                            await voidInvoice(confirmTarget.id);
                        }
                        startTransition(() => {
                            router.refresh();
                        });
                    } finally {
                        confirmLockRef.current = false;
                    }
                }}
            />
        </>
    );
}
