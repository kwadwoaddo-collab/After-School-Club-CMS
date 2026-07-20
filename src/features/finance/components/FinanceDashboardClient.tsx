'use client';

import { useState, useTransition } from 'react';
import { Plus, Search, FileText, Trash2, Ban, Loader2, ChevronDown } from 'lucide-react';
import CreateInvoiceModal from './CreateInvoiceModal';
import ConfirmActionModal from './ConfirmActionModal';
import { useRouter } from 'next/navigation';
import { deleteInvoice, voidInvoice } from '../actions';

interface FinanceDashboardClientProps {
    students: any[];
    recentInvoices: any[];
    centres: any[];
    isOwner?: boolean;
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'partially_paid';

export default function FinanceDashboardClient({ students, recentInvoices = [], centres, isOwner }: FinanceDashboardClientProps) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const router = useRouter();

    return (
        <div className="flex flex-col gap-8">
            {/* Header Actions */}
            <div className="flex items-center gap-3 self-end flex-wrap">
                {/* Create invoice */}
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 h-[44px] bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 active:scale-95 duration-100"
                >
                    <Plus className="w-4 h-4" /> Create Invoice
                </button>
            </div>

            {isCreateModalOpen && (
                <CreateInvoiceModal 
                    centres={centres}
                    onClose={() => setIsCreateModalOpen(false)}
                />
            )}
        </div>
    );
}

export function InvoiceTable({ 
    invoices = [], 
    isOwner = false,
    onCreateInvoice,
}: { 
    invoices?: any[];
    isOwner?: boolean;
    onCreateInvoice?: () => void;
}) {
    const router = useRouter();
    const [confirmTarget, setConfirmTarget] = useState<{ id: string; invoiceNumber: string; hasPayments: boolean; action: 'delete' | 'void' } | null>(null);
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
                            const hasPayments = (invoice.payments?.length ?? 0) > 0;
                            const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
                            const todayMidnight = new Date();
                            todayMidnight.setHours(0, 0, 0, 0);
                            const isOverdue = dueDate && dueDate < todayMidnight && invoice.status !== 'paid' && invoice.status !== 'void';

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
                                            <span className="text-sm font-bold text-foreground">
                                                {invoice.child?.firstName} {invoice.child?.lastName}
                                                {!invoice.child && invoice.parent && `${invoice.parent.firstName} ${invoice.parent.lastName} Family`}
                                            </span>
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
                                            invoice.status === 'paid'           ? 'bg-success/10 text-success' : 
                                            invoice.status === 'partially_paid' ? 'bg-warning/10 text-warning' :
                                            invoice.status === 'sent'           ? 'bg-info/10 text-info' :
                                            invoice.status === 'void'           ? 'bg-secondary/60 text-muted-foreground' : 
                                            isOverdue                           ? 'bg-destructive/10 text-destructive' :
                                                                                  'bg-secondary/60 text-muted-foreground'
                                        }`}>
                                            {invoice.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right px-4">
                                        <span className="text-sm font-black text-foreground">£{Number(invoice.amount).toFixed(2)}</span>
                                    </td>
                                    {isOwner && (
                                        <td className="py-4 text-right px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                {invoice.status !== 'void' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, hasPayments, action: 'void' })}
                                                        className="p-2 bg-warning/10 text-warning hover:bg-warning/20 rounded-lg transition-all border border-warning/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 duration-100"
                                                        title="Void Invoice"
                                                    >
                                                        <Ban className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {invoice.status !== 'paid' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, hasPayments, action: 'delete' })}
                                                        className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-all border border-destructive/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 duration-100"
                                                        title="Delete Invoice"
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
                hasPayments={confirmTarget?.hasPayments ?? false}
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

export function OverdueInvoiceTable({ invoices = [] }: { invoices?: any[] }) {
    const router = useRouter();
    
    if (!invoices || invoices.length === 0) {
        return null;
    }

    return (
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative scrollbar-thin">
            <table className="w-full">
                <thead>
                    <tr className="text-left border-b border-border">
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Invoice #</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Parent</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Child</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Amount</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Paid</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Balance</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Due Date</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {invoices.map((invoice: any) => {
                        const paid = invoice.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                        const balance = Number(invoice.amount) - paid;
                        
                        return (
                            <tr 
                                key={invoice.id} 
                                onClick={() => router.push(`/dashboard/finance/invoices/${invoice.id}`)}
                                className="group hover:bg-secondary/60 transition-all duration-100 cursor-pointer active:scale-[0.99]"
                            >
                                <td className="py-4 px-4">
                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{invoice.invoiceNumber}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-sm font-bold text-foreground">
                                        {invoice.parent?.firstName} {invoice.parent?.lastName}
                                    </span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {invoice.child ? `${invoice.child.firstName} ${invoice.child.lastName}` : '—'}
                                    </span>
                                </td>
                                <td className="py-4 text-right px-4">
                                    <span className="text-sm font-medium text-foreground">£{Number(invoice.amount).toFixed(2)}</span>
                                </td>
                                <td className="py-4 text-right px-4">
                                    <span className="text-sm font-medium text-success">£{paid.toFixed(2)}</span>
                                </td>
                                <td className="py-4 text-right px-4">
                                    <span className="text-sm font-black text-destructive">£{balance.toFixed(2)}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-sm text-destructive font-bold">
                                        {new Date(invoice.dueDate).toLocaleDateString('en-GB')}
                                    </span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                        invoice.status === 'partially_paid' ? 'bg-warning/10 text-warning' :
                                        invoice.status === 'sent'           ? 'bg-info/10 text-info' :
                                                                              'bg-secondary/60 text-muted-foreground'
                                    }`}>
                                        {invoice.status.replace(/_/g, ' ')}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function InvoiceAgingSummary({ buckets }: { buckets: any }) {
    if (!buckets) return null;
    
    const items = [
        { label: 'Current',    data: buckets.current,      color: 'bg-success/10 text-success border-success/20' },
        { label: '1–7 Days',   data: buckets.days_1_7,     color: 'bg-warning/10 text-warning border-warning/20' },
        { label: '8–30 Days',  data: buckets.days_8_30,    color: 'bg-warning/20 text-warning border-warning/30' },
        { label: '31–60 Days', data: buckets.days_31_60,   color: 'bg-destructive/10 text-destructive border-destructive/20' },
        { label: '60+ Days',   data: buckets.days_60_plus, color: 'bg-destructive/15 text-destructive border-destructive/30' },
    ];

    const totalOverdueAmount = items.slice(1).reduce((acc, curr) => acc + curr.data.amount, 0);

    return (
        <div className="bg-card border border-border rounded-[32px] p-6">
            <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Accounts Receivable Aging
                </h3>
                {totalOverdueAmount > 0 && (
                    <span className="text-sm font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-lg border border-destructive/20">
                        £{totalOverdueAmount.toFixed(2)} Overdue
                    </span>
                )}
            </div>
            
            <div className="flex flex-row gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {items.map((item, index) => (
                    <div key={index} className={`border rounded-2xl p-4 flex flex-col flex-shrink-0 min-w-[140px] ${item.color}`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70">{item.label}</span>
                        <span className="text-xl font-black mb-1">£{item.data.amount.toFixed(2)}</span>
                        <span className="text-xs font-medium opacity-70">{item.data.count} invoice{item.data.count !== 1 ? 's' : ''}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ParentBalanceTable({ balances = [] }: { balances?: any[] }) {
    if (!balances || balances.length === 0) return null;

    return (
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative scrollbar-thin">
            <table className="w-full">
                <thead>
                    <tr className="text-left border-b border-border">
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider px-4 select-none">Parent</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-center px-4 select-none">Unpaid Invoices</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Total Invoiced</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Total Paid</th>
                        <th className="sticky top-0 z-10 bg-card border-b border-border pb-4 pt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right px-4 select-none">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {balances.map((row: any) => (
                        <tr key={row.parent_id} className="group hover:bg-secondary/60 transition-colors">
                            <td className="py-4 px-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground">
                                        {row.first_name} {row.last_name}
                                    </span>
                                    {row.email ? <span className="text-xs text-muted-foreground">{row.email}</span> : null}
                                </div>
                            </td>
                            <td className="py-4 text-center px-4">
                                <span className="text-sm font-bold text-foreground">{row.unpaid_invoice_count}</span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-medium text-foreground">£{Number(row.total_invoiced).toFixed(2)}</span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-medium text-success">£{Number(row.total_paid).toFixed(2)}</span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-black text-destructive">£{Number(row.balance).toFixed(2)}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
