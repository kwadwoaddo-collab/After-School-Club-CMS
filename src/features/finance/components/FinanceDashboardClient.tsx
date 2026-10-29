'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, FileText, Trash2, Ban, Loader2 } from 'lucide-react';
import ConfirmActionModal from './ConfirmActionModal';
import { useRouter } from 'next/navigation';
import { deleteInvoice, voidInvoice } from '../actions';

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
    
    if (!invoices || invoices.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-secondary/40 rounded-full flex items-center justify-center mb-4 border border-border">
                    <FileText className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h4 className="text-lg font-bold text-foreground">No invoices yet</h4>
                <p className="text-sm text-muted-foreground max-w-xs mt-1 mb-4">
                    Create your first invoice to get started.
                </p>
                {isOwner && onCreateInvoice && (
                    <button
                        onClick={onCreateInvoice}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-95 duration-100"
                    >
                        <Plus className="w-4 h-4" />
                        Create Invoice
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="relative overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative scrollbar-thin">
                {isPending && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                        <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl text-sm font-bold text-foreground shadow-xl animate-in zoom-in-95 duration-150">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
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
                            const todayMidnight = new Date();
                            todayMidnight.setUTCHours(0, 0, 0, 0);
                            const isOverdue = Boolean(
                                dueDate &&
                                dueDate < todayMidnight &&
                                (invoice.status === 'sent' || invoice.status === 'partially_paid')
                            );

                            return (
                                <tr 
                                    key={invoice.id} 
                                    onClick={() => { if (isPending) return; router.push(`/dashboard/finance/invoices/${invoice.id}`); }}
                                    className={`group transition-all duration-100 border-l-2 active:scale-[0.99] ${
                                        isOverdue
                                            ? 'bg-destructive/5 border-l-destructive hover:bg-destructive/10'
                                            : 'border-l-transparent hover:bg-secondary/60'
                                    } ${isPending ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                                >
                                    <td className="py-4 px-4">
                                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{invoice.invoiceNumber}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col">
                                            {invoice.child ? (
                                                <Link
                                                    href={`/dashboard/students/${invoice.child.id || invoice.childId}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors w-fit"
                                                >
                                                    {invoice.child.firstName} {invoice.child.lastName}
                                                </Link>
                                            ) : invoice.parent ? (
                                                <Link
                                                    href={`/dashboard/parents/${invoice.parent.id || invoice.parentId}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors w-fit"
                                                >
                                                    {`${invoice.parent.firstName} ${invoice.parent.lastName} Family`}
                                                </Link>
                                            ) : null}
                                            <span className="text-xs text-muted-foreground">{invoice.centre?.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        {dueDate ? (
                                            <span className={`text-sm font-medium ${isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                {dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                            invoice.status === 'draft'          ? 'bg-warning/15 text-amber-700 dark:text-amber-400 border border-warning/30' :
                                            invoice.status === 'paid'           ? 'bg-success/10 text-emerald-700 dark:text-emerald-400' : 
                                            invoice.status === 'partially_paid' ? 'bg-warning/10 text-amber-700 dark:text-amber-400' :
                                            invoice.status === 'sent'           ? 'bg-info/10 text-info' :
                                            invoice.status === 'void'           ? 'bg-secondary/60 text-muted-foreground' : 
                                            isOverdue                           ? 'bg-destructive/10 text-destructive' :
                                                                                  'bg-secondary/60 text-muted-foreground'
                                        }`}>
                                            {invoice.status === 'draft' ? 'DRAFT' : invoice.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right px-4">
                                        <span className="text-sm font-black text-foreground">£{Number(invoice.amount).toFixed(2)}</span>
                                    </td>
                                    {isOwner && (
                                        <td className="py-4 text-right px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                {invoice.status !== 'void' && invoice.status !== 'draft' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, action: 'void' })}
                                                        className="p-2 bg-warning/10 text-amber-700 dark:text-amber-400 hover:bg-warning/20 rounded-lg transition-all border border-warning/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 duration-100"
                                                        title="Void Invoice"
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {invoice.status === 'draft' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, action: 'delete' })}
                                                        className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-all border border-destructive/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 duration-100"
                                                        title="Delete Draft"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
                    if (!confirmTarget) return;
                    startTransition(async () => {
                        if (confirmTarget.action === 'delete') {
                            await deleteInvoice(confirmTarget.id);
                        } else {
                            await voidInvoice(confirmTarget.id);
                        }
                        router.refresh();
                    });
                }}
            />
        </>
    );
}
