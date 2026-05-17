'use client';

import { useState } from 'react';
import { Plus, Filter, FileText, Trash2 } from 'lucide-react';
import CreateInvoiceModal from './CreateInvoiceModal';
import { useRouter } from 'next/navigation';
import { deleteInvoice } from '../actions';

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
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="text-left border-b border-outline-variant/10">
                        <th className="pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Invoice #</th>
                        <th className="pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Student</th>
                        <th className="pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Status</th>
                        <th className="pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4">Amount</th>
                        {isOwner && <th className="pb-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                    {invoices.map((invoice: any) => (
                        <tr 
                            key={invoice.id} 
                            onClick={() => router.push(`/dashboard/finance/invoices/${invoice.id}`)}
                            className="group hover:bg-white/5 transition-colors cursor-pointer"
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
                                    invoice.status === 'sent' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
                                }`}>
                                    {invoice.status.replace('_', ' ')}
                                </span>
                            </td>
                            <td className="py-4 text-right px-4">
                                <span className="text-sm font-black text-white">£{Number(invoice.amount).toFixed(2)}</span>
                            </td>
                            {isOwner && (
                                <td className="py-4 text-right px-4" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        type="button"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log("Delete button clicked for invoice:", invoice.id);
                                            if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
                                                try {
                                                    await deleteInvoice(invoice.id);
                                                    alert('Invoice deleted successfully.');
                                                } catch (error: any) {
                                                    console.error(error);
                                                    alert(error.message || 'Error deleting invoice');
                                                }
                                            }
                                        }}
                                        className="p-2 bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors border border-error/20 z-50 relative cursor-pointer"
                                        title="Delete Invoice"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function OverdueInvoiceTable({ invoices = [] }: { invoices?: any[] }) {
    const router = useRouter();
    
    if (!invoices || invoices.length === 0) {
        return null;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="text-left border-b border-outline-variant/10">
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Invoice #</th>
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Parent</th>
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4">Amount</th>
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4">Paid</th>
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right px-4">Balance</th>
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Due Date</th>
                        <th className="pb-4 pt-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider px-4">Status</th>
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
