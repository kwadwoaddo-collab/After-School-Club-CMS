'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, MoreHorizontal, CheckCircle2, AlertCircle, Clock, X, ChevronRight, Plus, Download, RefreshCw, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/ToastProvider';
import { recordPayment } from '@/features/finance/actions';

// We define a simple slide-out Drawer component inline
function Sheet({ open, onClose, children, title }: { open: boolean, onClose: () => void, children: React.ReactNode, title: string }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-all duration-500">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative w-full max-w-md h-full bg-card border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary/80 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function FinanceDataGridClient({ invoices, totalCount, page, pageSize, statusFilter }: any) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addToast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [viewInvoice, setViewInvoice] = useState<any | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');

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
            setSelectedInvoices(new Set(invoices.map((i: any) => i.id)));
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

    const handleRecordPayment = async (invoiceId: string) => {
        if (!paymentAmount) return addToast('Please enter an amount', 'error');
        try {
            await recordPayment({
                invoiceId,
                amount: paymentAmount,
                method: 'bank_transfer',
                recordedAt: new Date()
            });
            addToast('Payment recorded successfully', 'success');
            setViewInvoice(null);
            setPaymentAmount('');
            router.refresh();
        } catch (error: any) {
            addToast(error.message || 'Failed to record payment', 'error');
        }
    };

    const handleBulkPayment = async () => {
        try {
            const selected = invoices.filter((i: any) => selectedInvoices.has(i.id));
            for (const invoice of selected) {
                const payments = invoice.payments || [];
                const outstanding = Number(invoice.amount) - payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
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
        } catch (error: any) {
            addToast(error.message || 'Failed to record bulk payment', 'error');
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-card p-4 rounded-2xl border shadow-sm gap-4">
                <div className="flex bg-secondary/50 rounded-xl p-1 w-full sm:w-auto">
                    {['all', 'overdue', 'paid'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold capitalize rounded-lg transition-all ${
                                statusFilter === s
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                
                {selectedInvoices.size > 0 && (
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">{selectedInvoices.size} selected</span>
                        <button 
                            onClick={handleBulkPayment}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                            <CreditCard className="w-4 h-4" />
                            Record Lump Sum Payment
                        </button>
                    </div>
                )}
            </div>

            {/* Data Grid */}
            <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b bg-secondary/20 text-muted-foreground text-xs uppercase tracking-wider">
                                <th className="p-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-border accent-primary w-4 h-4"
                                        checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th className="p-4 font-bold">Invoice #</th>
                                <th className="p-4 font-bold">Client / Student</th>
                                <th className="p-4 font-bold">Date / Due</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold text-right">Amount</th>
                                <th className="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        No invoices found for this criteria.
                                    </td>
                                </tr>
                            ) : invoices.map((invoice: any) => {
                                const isOverdue = invoice.status !== 'paid' && invoice.status !== 'void' && new Date(invoice.dueDate) < new Date();
                                const payments = invoice.payments || [];
                                const outstanding = Number(invoice.amount) - payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

                                return (
                                    <tr 
                                        key={invoice.id} 
                                        className={`hover:bg-secondary/10 transition-colors cursor-pointer ${selectedInvoices.has(invoice.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleSelection(invoice.id)}
                                    >
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-border accent-primary w-4 h-4"
                                                checked={selectedInvoices.has(invoice.id)}
                                                onChange={() => toggleSelection(invoice.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-medium text-primary">
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); setViewInvoice(invoice); setPaymentAmount(outstanding.toString()); }}
                                                className="hover:underline"
                                            >
                                                {invoice.invoiceNumber}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold">{invoice.parent?.firstName} {invoice.parent?.lastName}</div>
                                            {invoice.child && <div className="text-xs text-muted-foreground">{invoice.child.firstName} {invoice.child.lastName}</div>}
                                        </td>
                                        <td className="p-4">
                                            <div>{format(new Date(invoice.invoiceDate), 'MMM d, yyyy')}</div>
                                            <div className={`text-xs ${isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                Due: {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {invoice.status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-bold">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                                                </span>
                                            ) : isOverdue ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
                                                    <AlertCircle className="w-3.5 h-3.5" /> Overdue
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                                    <Clock className="w-3.5 h-3.5" /> {invoice.status.replace('_', ' ')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold tabular-nums">£{Number(invoice.amount).toFixed(2)}</div>
                                            {invoice.status !== 'paid' && outstanding < Number(invoice.amount) && (
                                                <div className="text-xs text-muted-foreground tabular-nums">Bal: £{outstanding.toFixed(2)}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                onClick={() => {
                                                    setViewInvoice(invoice);
                                                    setPaymentAmount(outstanding.toString());
                                                }}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80 transition-colors"
                                            >
                                                Details
                                                <ChevronRight className="w-4 h-4" />
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
                    <div className="border-t p-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}</span>
                        <div className="flex gap-2">
                            <button 
                                disabled={page === 1}
                                onClick={() => goToPage(page - 1)}
                                className="px-3 py-1.5 rounded-lg border hover:bg-secondary/50 disabled:opacity-50 transition-colors font-medium"
                            >
                                Previous
                            </button>
                            <button 
                                disabled={page === totalPages}
                                onClick={() => goToPage(page + 1)}
                                className="px-3 py-1.5 rounded-lg border hover:bg-secondary/50 disabled:opacity-50 transition-colors font-medium"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Slide-out Drawer for Invoice Details & Payment */}
            <Sheet 
                open={!!viewInvoice} 
                onClose={() => { setViewInvoice(null); setPaymentAmount(''); }}
                title={`Invoice ${viewInvoice?.invoiceNumber}`}
            >
                {viewInvoice && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Billed To</h3>
                            <div className="text-lg font-bold">{viewInvoice.parent?.firstName} {viewInvoice.parent?.lastName}</div>
                            <div className="text-muted-foreground">{viewInvoice.parent?.email}</div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Line Items</h3>
                            <div className="space-y-3 bg-secondary/20 p-4 rounded-xl border">
                                {viewInvoice.lineItems?.length > 0 ? (
                                    viewInvoice.lineItems.map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center text-sm">
                                            <span>{item.quantity}x {item.description}</span>
                                            <span className="font-bold tabular-nums">£{Number(item.lineTotal).toFixed(2)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground">Standard Billing</div>
                                )}
                                <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                                    <span>Total</span>
                                    <span>£{Number(viewInvoice.amount).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {viewInvoice.status !== 'paid' && viewInvoice.status !== 'void' && (
                            <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl">
                                <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    Record Payment
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground mb-1 block">Amount (£)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            className="w-full px-4 py-2 rounded-xl border bg-background text-sm font-bold tabular-nums focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleRecordPayment(viewInvoice.id)}
                                        className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-all"
                                    >
                                        Confirm Payment
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {viewInvoice.payments?.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Payment History</h3>
                                <div className="space-y-2">
                                    {viewInvoice.payments.map((p: any) => (
                                        <div key={p.id} className="flex justify-between items-center p-3 bg-card border rounded-xl text-sm">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-success" />
                                                <span className="text-muted-foreground">{format(new Date(p.recordedAt), 'MMM d, yyyy')}</span>
                                            </div>
                                            <span className="font-bold tabular-nums text-success">£{Number(p.amount).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Sheet>
        </div>
    );
}
