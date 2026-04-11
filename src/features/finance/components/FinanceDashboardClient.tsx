'use client';

import { useState } from 'react';
import { Plus, Filter, FileText } from 'lucide-react';
import CreateInvoiceModal from './CreateInvoiceModal';
import { useRouter } from 'next/navigation';

interface FinanceDashboardClientProps {
    students: any[];
    recentInvoices: any[];
    centres: any[];
}

export default function FinanceDashboardClient({ students, recentInvoices = [], centres }: FinanceDashboardClientProps) {
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

export function InvoiceTable({ invoices = [] }: { invoices?: any[] }) {
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
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
