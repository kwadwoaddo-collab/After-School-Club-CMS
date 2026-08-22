'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
    FileText, 
    MoreHorizontal, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    X, 
    ChevronRight, 
    Plus, 
    Download, 
    RefreshCw, 
    CreditCard,
    TrendingUp,
    ShieldAlert,
    Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/ToastProvider';
import { recordPayment } from '@/features/finance/actions';
import CreateInvoiceModal from './CreateInvoiceModal';

export interface InvoicePayment {
    id: string;
    amount: string | number;
    method?: string | null;
    recordedAt: string | Date;
}

export interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice?: string | number;
    lineTotal: string | number;
}

export interface FinanceInvoice {
    id: string;
    invoiceNumber: string;
    organisationId: string;
    centreId?: string | null;
    parentId: string;
    childId?: string | null;
    amount: string | number;
    status: string;
    invoiceDate: string | Date;
    dueDate: string | Date;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    centre?: { id: string; name: string } | null;
    child?: { id: string; firstName: string; lastName: string } | null;
    parent?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
    payments?: InvoicePayment[];
    lineItems?: InvoiceLineItem[];
}

export interface FinanceDataGridClientProps {
    invoices?: FinanceInvoice[];
    totalCount?: number;
    page?: number;
    pageSize?: number;
    statusFilter?: string;
    centres?: { id: string; name: string }[];
}

const formatDateSafe = (dateVal: string | Date | null | undefined, formatStr = 'MMM d, yyyy'): string => {
    if (!dateVal) return '-';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '-';
        return format(d, formatStr);
    } catch {
        return '-';
    }
};

export default function FinanceDataGridClient({ invoices = [], totalCount = 0, page = 1, pageSize = 50, statusFilter = 'all', centres = [] }: FinanceDataGridClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast: addToast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get('create') === '1' || searchParams.get('create') === 'true') {
            setIsCreateModalOpen(true);
        }
    }, [searchParams]);


    // KPI Metrics calculation for summary banner
    const metrics = useMemo(() => {
        let totalInvoiced = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;
        let overdueCount = 0;

        const now = new Date();

        invoices.forEach((inv) => {
            const amt = Number(inv.amount) || 0;
            totalInvoiced += amt;

            const payments = inv.payments || [];
            const paid = payments.reduce((sum: number, p) => sum + (Number(p.amount) || 0), 0);

            if (inv.status === 'paid') {
                totalPaid += amt;
            } else {
                totalPaid += paid;
                const outstanding = amt - paid;
                if (outstanding > 0) {
                    totalOutstanding += outstanding;
                }
                const dueDateObj = inv.dueDate ? new Date(inv.dueDate) : null;
                const isOverdue = dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj < now && inv.status !== 'void';
                if (isOverdue) {
                    overdueCount++;
                }
            }
        });

        return { totalInvoiced, totalPaid, totalOutstanding, overdueCount };
    }, [invoices]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedInvoices);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedInvoices(newSet);
    };

    const toggleAll = () => {
        if (selectedInvoices.size === invoices.length) {
            setSelectedInvoices(new Set());
        } else {
            setSelectedInvoices(new Set(invoices.map((i) => i.id)));
        }
    };

    const setStatusFilter = (status: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (status === 'all') params.delete('status');
        else params.set('status', status);
        params.set('page', '1');
        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    const goToPage = (p: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', p.toString());
        startTransition(() => {
            router.push(`?${params.toString()}`);
        });
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const handleBulkPayment = async () => {
        try {
            const selected = invoices.filter((i) => selectedInvoices.has(i.id));
            for (const invoice of selected) {
                const payments = invoice.payments || [];
                const outstanding = Number(invoice.amount) - payments.reduce((sum: number, p) => sum + Number(p.amount), 0);
                if (outstanding > 0) {
                    await recordPayment({
                        invoiceId: invoice.id,
                        amount: outstanding.toString(),
                        method: 'bank_transfer',
                        recordedAt: new Date()
                    });
                }
            }
            addToast('Bulk payments recorded successfully', 'success');
            setSelectedInvoices(new Set());
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to record bulk payment', 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Apple-grade KPI Stat Cards Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat Card 1: Total Invoiced */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoiced (Page)</span>
                        <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight tabular-nums">
                            £{metrics.totalInvoiced.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{invoices.length} Invoices on page</p>
                    </div>
                </div>

                {/* Stat Card 2: Total Collected */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collected</span>
                        <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                            £{metrics.totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">Successfully processed</p>
                    </div>
                </div>

                {/* Stat Card 3: Outstanding */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Outstanding</span>
                        <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight tabular-nums">
                            £{metrics.totalOutstanding.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1 font-medium">Awaiting payment</p>
                    </div>
                </div>

                {/* Stat Card 4: Overdue Count */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overdue</span>
                        <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
                            {metrics.overdueCount}
                        </div>
                        <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">Invoices past due date</p>
                    </div>
                </div>
            </div>

            {/* Segmented Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-card/80 backdrop-blur-md p-3.5 rounded-3xl border border-border/60 shadow-sm gap-4">
                <div className="flex bg-secondary/50 p-1.5 rounded-2xl w-full sm:w-auto border border-border/40 gap-1">
                    {['all', 'overdue', 'paid'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`flex-1 sm:flex-none px-5 py-2 text-xs font-bold capitalize rounded-xl transition-all duration-200 ${
                                statusFilter === s
                                    ? 'bg-background shadow-sm text-foreground border border-border/50 scale-[1.02]'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {selectedInvoices.size > 0 && (
                        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-2xl animate-in fade-in duration-200">
                            <span className="text-xs font-bold text-primary">{selectedInvoices.size} selected</span>
                            <button 
                                onClick={handleBulkPayment}
                                className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                Lump Sum Payment
                            </button>
                        </div>
                    )}

                    {centres.length > 0 && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Create Invoice
                        </button>
                    )}
                </div>
            </div>

            {/* Data Grid Table */}
            <div className="bg-card/90 backdrop-blur-md border border-border/60 rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/60 bg-secondary/30 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                                <th className="p-4 w-12 text-center select-none">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-border accent-primary w-4 h-4 cursor-pointer"
                                        checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th className="p-4 font-bold tracking-wider">Invoice #</th>
                                <th className="p-4 font-bold tracking-wider">Client / Student</th>
                                <th className="p-4 font-bold tracking-wider">Date / Due</th>
                                <th className="p-4 font-bold tracking-wider">Status</th>
                                <th className="p-4 font-bold tracking-wider text-right">Amount</th>
                                <th className="p-4 font-bold tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-sm">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <p className="text-base font-bold text-foreground">No invoices found</p>
                                        <p className="text-xs text-muted-foreground mt-1">There are no records matching your current filter criteria.</p>
                                    </td>
                                </tr>
                            ) : invoices.map((invoice) => {
                                const dueDateObj = invoice.dueDate ? new Date(invoice.dueDate) : null;
                                const isOverdue = invoice.status !== 'paid' && invoice.status !== 'void' && !!dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj < new Date();
                                const payments = invoice.payments || [];
                                const outstanding = Number(invoice.amount) - payments.reduce((sum: number, p) => sum + Number(p.amount), 0);

                                return (
                                    <tr 
                                        key={invoice.id} 
                                        className={`hover:bg-secondary/20 transition-all duration-150 cursor-pointer ${selectedInvoices.has(invoice.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleSelection(invoice.id)}
                                    >
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-border accent-primary w-4 h-4 cursor-pointer"
                                                checked={selectedInvoices.has(invoice.id)}
                                                onChange={() => toggleSelection(invoice.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-primary">
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); router.push('/dashboard/finance/invoices/' + invoice.id); }}
                                                className="hover:underline hover:text-primary/80 transition-colors cursor-pointer"
                                            >
                                                {invoice.invoiceNumber}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-foreground">
                                                {invoice.parent ? (
                                                    <Link href={`/dashboard/parents/${invoice.parent.id}`} className="hover:underline hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                                        {invoice.parent.firstName} {invoice.parent.lastName}
                                                    </Link>
                                                ) : null}
                                            </div>
                                            {invoice.child && (
                                                <div className="text-xs text-muted-foreground font-medium">
                                                    <Link href={`/dashboard/students/${invoice.child.id}`} className="hover:underline hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                                        {invoice.child.firstName} {invoice.child.lastName}
                                                    </Link>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-foreground">{formatDateSafe(invoice.invoiceDate)}</div>
                                            <div className={`text-xs ${isOverdue ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                                                Due: {formatDateSafe(invoice.dueDate)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {invoice.status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                                                </span>
                                            ) : isOverdue ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold">
                                                    <AlertCircle className="w-3.5 h-3.5" /> Overdue
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-bold">
                                                    <Clock className="w-3.5 h-3.5" /> {invoice.status?.replace('_', ' ')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-foreground tabular-nums text-base">£{Number(invoice.amount).toFixed(2)}</div>
                                            {invoice.status !== 'paid' && outstanding < Number(invoice.amount) && (
                                                <div className="text-xs text-muted-foreground tabular-nums font-semibold">Bal: £{outstanding.toFixed(2)}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push('/dashboard/finance/invoices/' + invoice.id);
                                                }}
                                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-secondary/80 text-foreground text-xs font-bold hover:bg-secondary hover:gap-2 transition-all border border-border/50 shadow-sm"
                                            >
                                                Details
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="border-t border-border/60 p-4 flex items-center justify-between text-xs font-semibold text-muted-foreground bg-secondary/10">
                        <span>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}</span>
                        <div className="flex gap-2">
                            <button 
                                disabled={page === 1}
                                onClick={() => goToPage(page - 1)}
                                className="px-3.5 py-1.5 rounded-xl border border-border/60 hover:bg-background disabled:opacity-40 transition-all font-bold text-foreground"
                            >
                                Previous
                            </button>
                            <button 
                                disabled={page === totalPages}
                                onClick={() => goToPage(page + 1)}
                                className="px-3.5 py-1.5 rounded-xl border border-border/60 hover:bg-background disabled:opacity-40 transition-all font-bold text-foreground"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
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
