'use client';

import { useState, useTransition } from 'react';
import { Plus, Filter, FileText, Trash2, Ban, Loader2 } from 'lucide-react';
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

export default function FinanceDashboardClient({ students, recentInvoices = [], centres, isOwner }: FinanceDashboardClientProps) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    const filteredInvoices = (recentInvoices || []).filter(invoice => 
        invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${invoice.parent?.firstName} ${invoice.parent?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-8">
            {/* Header Actions */}
            <div className="flex items-center gap-3 self-end">
                <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-high border border-outline-variant/10 rounded-xl text-sm font-bold text-white hover:bg-surface-container-highest transition-all">
                    <Filter className="w-4 h-4" /> Filter
                </button>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary rounded-xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                >
                    <Plus className="w-4 h-4" /> Create Invoice
                </button>
            </div>

            {/* Modal */}
            {isCreateModalOpen && (
                <CreateInvoiceModal 
                    centres={centres}
                    onClose={() => setIsCreateModalOpen(false)}
                />
            )}
        </div>
    );
}

export function InvoiceTable({ invoices = [], isOwner = false }: { invoices?: any[], isOwner?: boolean }) {
    const router = useRouter();
    const [confirmTarget, setConfirmTarget] = useState<{ id: string; invoiceNumber: string; hasPayments: boolean; action: 'delete' | 'void' } | null>(null);
    const [isPending, startTransition] = useTransition();
    
    if (!invoices || invoices.length === 0) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-500/5 rounded-full flex items-center justify-center mb-4 border border-slate-500/10">
                    <FileText className="w-8 h-8 text-slate-500/40" />
                </div>
                <h4 className="text-lg font-bold text-white">No invoices yet</h4>
                <p className="text-sm text-on-surface-variant max-w-xs mt-1">
                    Start by creating an invoice for a student.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="relative overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative scrollbar-thin">
                {isPending && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                        <div className="flex items-center gap-2 bg-surface-container-high border border-outline-variant/10 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-xl animate-in zoom-in-95 duration-150">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            Updating Ledger...
                        </div>
                    </div>
                )}
                <table className="w-full">
                    <thead>
                        <tr className="text-left border-b border-outline-variant/10">
                            <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Invoice #</th>
                            <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Student</th>
                            <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Status</th>
                            <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Amount</th>
                            {isOwner && <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                        {invoices.map((invoice: any) => {
                            const hasPayments = (invoice.payments?.length ?? 0) > 0;
                            return (
                                <tr 
                                    key={invoice.id} 
                                    onClick={() => {
                                        if (isPending) return;
                                        router.push(`/dashboard/finance/invoices/${invoice.id}`);
                                    }}
                                    className={`group hover:bg-white/5 transition-colors ${isPending ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                                >
                                    <td className="py-4 px-4">
                                        <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{invoice.invoiceNumber}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">
                                                {invoice.child?.firstName} {invoice.child?.lastName}
                                                {!invoice.child && invoice.parent && `${invoice.parent.firstName} ${invoice.parent.lastName} Family`}
                                            </span>
                                            <span className="text-xs text-on-surface-variant">{invoice.centre?.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                            invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 
                                            invoice.status === 'partially_paid' ? 'bg-amber-500/10 text-amber-400' :
                                            invoice.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                                            invoice.status === 'void' ? 'bg-neutral-500/10 text-neutral-400 line-through' : 'bg-slate-500/10 text-slate-400'
                                        }`}>
                                            {invoice.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right px-4">
                                        <span className="text-sm font-black text-white">£{Number(invoice.amount).toFixed(2)}</span>
                                    </td>
                                    {isOwner && (
                                        <td className="py-4 text-right px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                {invoice.status !== 'void' && (
                                                    <button 
                                                        type="button"
                                                        disabled={isPending}
                                                        onClick={() => setConfirmTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, hasPayments, action: 'void' })}
                                                        className="p-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                        className="p-2 bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors border border-error/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <tr className="text-left border-b border-outline-variant/10">
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Invoice #</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Parent</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Amount</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Paid</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Balance</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Due Date</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                    {invoices.map((invoice: any) => {
                        const paid = invoice.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
                        const balance = Number(invoice.amount) - paid;
                        
                        return (
                            <tr 
                                key={invoice.id} 
                                onClick={() => router.push(`/dashboard/finance/invoices/${invoice.id}`)}
                                className="group hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <td className="py-4 px-4">
                                    <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{invoice.invoiceNumber}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-sm font-bold text-white">
                                        {invoice.parent?.firstName} {invoice.parent?.lastName}
                                    </span>
                                </td>
                                <td className="py-4 text-right px-4">
                                    <span className="text-sm font-medium text-white">£{Number(invoice.amount).toFixed(2)}</span>
                                </td>
                                <td className="py-4 text-right px-4">
                                    <span className="text-sm font-medium text-emerald-400">£{paid.toFixed(2)}</span>
                                </td>
                                <td className="py-4 text-right px-4">
                                    <span className="text-sm font-black text-error">£{balance.toFixed(2)}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-sm text-error font-medium">{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                        invoice.status === 'partially_paid' ? 'bg-amber-500/10 text-amber-400' :
                                        invoice.status === 'sent' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
                                    }`}>
                                        {invoice.status.replace('_', ' ')}
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
        { label: 'Current', data: buckets.current, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        { label: '1-7 Days', data: buckets.days_1_7, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
        { label: '8-30 Days', data: buckets.days_8_30, color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
        { label: '31-60 Days', data: buckets.days_31_60, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
        { label: '60+ Days', data: buckets.days_60_plus, color: 'bg-rose-600/10 text-rose-500 border-rose-600/20' },
    ];

    const totalOverdueAmount = items.slice(1).reduce((acc, curr) => acc + curr.data.amount, 0);

    return (
        <div className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-6">
            <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Accounts Receivable Aging
                </h3>
                {totalOverdueAmount > 0 && (
                    <span className="text-sm font-bold text-error bg-error/10 px-3 py-1 rounded-lg">
                        £{totalOverdueAmount.toFixed(2)} Overdue
                    </span>
                )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {items.map((item, index) => (
                    <div key={index} className={`border rounded-2xl p-4 flex flex-col items-center justify-center text-center ${item.color}`}>
                        <span className="text-xs font-bold uppercase tracking-wider mb-2">{item.label}</span>
                        <span className="text-xl font-black mb-1">£{item.data.amount.toFixed(2)}</span>
                        <span className="text-xs font-medium opacity-80">{item.data.count} invoice{item.data.count !== 1 ? 's' : ''}</span>
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
                    <tr className="text-left border-b border-outline-variant/10">
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4 select-none">Parent</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center px-4 select-none">Unpaid Invoices</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Total Invoiced</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Total Paid</th>
                        <th className="sticky top-0 z-10 bg-surface-container border-b border-outline-variant/10 pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4 select-none">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                    {balances.map((row: any) => (
                        <tr key={row.parent_id} className="group hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">
                                        {row.first_name} {row.last_name}
                                    </span>
                                    {row.email ? <span className="text-xs text-on-surface-variant">{row.email}</span> : null}
                                </div>
                            </td>
                            <td className="py-4 text-center px-4">
                                <span className="text-sm font-bold text-white">{row.unpaid_invoice_count}</span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-medium text-white">£{Number(row.total_invoiced).toFixed(2)}</span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-medium text-emerald-400">£{Number(row.total_paid).toFixed(2)}</span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-black text-error">£{Number(row.balance).toFixed(2)}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
