'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
    FileText, 
    CheckCircle2, 
    AlertTriangle, 
    CalendarClock,
    Clock, 
    Ban,
    ChevronRight, 
    Plus, 
    CreditCard,
    TrendingUp,
    ShieldAlert,
} from 'lucide-react';
import { formatInvoiceDate, formatInvoicePeriod, formatPaidDate, invoiceBalanceLabel } from '../domain/invoice-display';
import {
    COLLECTION_STAGE_STYLES,
    evaluateInvoiceCollectionState,
    toLondonBusinessDate,
    type InvoiceCollectionStage,
} from '../domain/invoice-collection-state';
import { useToast } from '@/components/ui/ToastProvider';
import { recordPayment } from '@/features/finance/actions';
import { parseStoredDecimalToPence, formatPenceToDecimal } from '../domain/payment-eligibility';
import CreateInvoiceModal from './CreateInvoiceModal';

export interface InvoicePayment {
    id: string;
    amount: string | number;
    method?: string | null;
    status?: string | null;
    reversedAt?: string | Date | null;
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
    needsBillingReview?: boolean;
    invoiceDate: string | Date;
    dueDate: string | Date;
    billingPeriodStart?: string | Date | null;
    billingPeriodEnd?: string | Date | null;
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
    todayIso?: string;
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Issued' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'in_period', label: 'In period' },
    { value: 'partially_paid', label: 'Part-paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'paid', label: 'Paid' },
];

function renderStageIcon(stage: InvoiceCollectionStage) {
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

export default function FinanceDataGridClient({ invoices = [], totalCount = 0, page = 1, pageSize = 50, statusFilter = 'all', centres = [], todayIso }: FinanceDataGridClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast: addToast } = useToast();
    const [, startTransition] = useTransition();

    const todayLondonIso = todayIso ?? toLondonBusinessDate();

    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBulkPayModalOpen, setIsBulkPayModalOpen] = useState(false);
    const [bulkPaymentMethod, setBulkPaymentMethod] = useState<'bank_transfer' | 'cash' | 'card' | 'tax_free_childcare'>('bank_transfer');
    const [isSubmittingBulkPay, setIsSubmittingBulkPay] = useState(false);

    useEffect(() => {
        if (searchParams.get('create') === '1' || searchParams.get('create') === 'true') {
            setIsCreateModalOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!isBulkPayModalOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmittingBulkPay) {
                setIsBulkPayModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isBulkPayModalOpen, isSubmittingBulkPay]);


    // KPI Metrics calculation for summary banner (CMS-FINANCE-INCIDENT-1: exclude DRAFT and VOID from issued receivable totals and overdue counts)
    const metrics = useMemo(() => {
        let totalInvoiced = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;
        let overdueCount = 0;
        let inPeriodCount = 0;
        let upcomingCount = 0;

        invoices.forEach((inv) => {
            if (inv.status === 'draft' || inv.status === 'void') {
                return;
            }

            const state = evaluateInvoiceCollectionState(inv, todayLondonIso, { strictPayments: false });
            const amt = Number(inv.amount) || 0;
            totalInvoiced += amt;

            const payments = inv.payments || [];
            const paid = payments
                .filter((p: InvoicePayment) => !p.reversedAt && (!p.status || p.status === 'verified'))
                .reduce((sum: number, p: InvoicePayment) => sum + (Number(p.amount) || 0), 0);

            if (inv.status === 'paid') {
                totalPaid += amt;
            } else {
                totalPaid += paid;
                const outstanding = amt - paid;
                if (outstanding > 0) {
                    totalOutstanding += outstanding;
                }
            }

            if (state.stage === 'overdue') {
                overdueCount++;
            } else if (state.stage === 'in_period') {
                inPeriodCount++;
            } else if (state.stage === 'upcoming') {
                upcomingCount++;
            }
        });

        return { totalInvoiced, totalPaid, totalOutstanding, overdueCount, inPeriodCount, upcomingCount };
    }, [invoices, todayLondonIso]);

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

    const eligibleBulkPayItems = useMemo(() => {
        return invoices
            .filter((inv) => selectedInvoices.has(inv.id) && ['sent', 'overdue', 'partially_paid'].includes(inv.status))
            .map((inv) => {
                const verifiedPayments = (inv.payments || []).filter(
                    (p: InvoicePayment) => !p.reversedAt && (!p.status || p.status === 'verified')
                );
                const totalPaidPence = verifiedPayments.reduce(
                    (sum: number, p: { amount: string | number }) => sum + parseStoredDecimalToPence(p.amount),
                    0
                );
                const invoiceAmountPence = parseStoredDecimalToPence(inv.amount);
                const outstandingPence = Math.max(0, invoiceAmountPence - totalPaidPence);
                return { invoice: inv, outstandingPence };
            })
            .filter((item) => item.outstandingPence > 0);
    }, [invoices, selectedInvoices]);

    const totalBulkPayPence = useMemo(
        () => eligibleBulkPayItems.reduce((sum, item) => sum + item.outstandingPence, 0),
        [eligibleBulkPayItems]
    );

    const handleOpenBulkPayModal = () => {
        if (eligibleBulkPayItems.length === 0) {
            addToast('None of the selected invoices are eligible for payment (draft, paid, and void invoices cannot be paid).', 'error');
            return;
        }
        setIsBulkPayModalOpen(true);
    };

    const handleBulkPay = async () => {
        if (eligibleBulkPayItems.length === 0) return;
        setIsSubmittingBulkPay(true);
        try {
            for (const { invoice, outstandingPence } of eligibleBulkPayItems) {
                const res = await recordPayment({
                    invoiceId: invoice.id,
                    amount: formatPenceToDecimal(outstandingPence),
                    method: bulkPaymentMethod,
                    recordedAt: new Date(),
                    operationMode: 'SETTLE_OUTSTANDING'
                });
                if (!res.success) {
                    throw new Error(res.error);
                }
            }
            addToast('Bulk payments recorded successfully', 'success');
            setIsBulkPayModalOpen(false);
            setSelectedInvoices(new Set());
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to record bulk payment', 'error');
        } finally {
            setIsSubmittingBulkPay(false);
        }
    };

    return (
        <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
                Totals cover invoices on this page within the current centre and status filters.
                Draft and void invoices are excluded from these totals.
            </p>
            {/* KPI Stat Cards Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat Card 1: Total Invoiced */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoiced (Page)</span>
                        <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-colors duration-200">
                            <TrendingUp className="w-4 h-4" aria-hidden="true" />
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
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collected (Page)</span>
                        <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-colors duration-200">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight tabular-nums">
                            £{metrics.totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 font-medium">Successfully processed</p>
                    </div>
                </div>

                {/* Stat Card 3: Outstanding */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Outstanding (Page)</span>
                        <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-800 dark:text-amber-200 flex items-center justify-center transition-colors duration-200">
                            <Clock className="w-4 h-4" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-200 tracking-tight tabular-nums">
                            £{metrics.totalOutstanding.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 font-medium">
                            {metrics.inPeriodCount} in assessment period · {metrics.upcomingCount} upcoming
                        </p>
                    </div>
                </div>

                {/* Stat Card 4: Overdue Count */}
                <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overdue (Page)</span>
                        <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center justify-center transition-colors duration-200">
                            <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 tracking-tight tabular-nums">
                            {metrics.overdueCount}
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 font-medium">Past assessment period</p>
                    </div>
                </div>
            </div>

            <h2 id="invoice-list" className="scroll-mt-24 text-xl font-bold text-foreground">Invoice list</h2>
            {/* Segmented Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-card/80 backdrop-blur-md p-3.5 rounded-3xl border border-border/60 shadow-sm gap-4">
                <div className="flex flex-wrap bg-secondary/50 p-1.5 rounded-2xl w-full sm:w-auto border border-border/40 gap-1">
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatusFilter(opt.value)}
                            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${
                                statusFilter === opt.value
                                    ? 'bg-background shadow-sm text-foreground border border-border/50'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                    {selectedInvoices.size > 0 && (
                        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-2xl animate-in fade-in duration-200">
                            <span className="text-xs font-bold text-primary">
                                {selectedInvoices.size} selected ({eligibleBulkPayItems.length} payable)
                            </span>
                            <button 
                                type="button"
                                onClick={handleOpenBulkPayModal}
                                disabled={eligibleBulkPayItems.length === 0}
                                className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                                Lump Sum Payment
                            </button>
                        </div>
                    )}

                    <Link
                        href="/dashboard/finance/reconciliation"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-secondary/80 text-foreground border border-border/60 text-xs font-bold hover:bg-secondary transition-all"
                    >
                        Reconcile TFC / Bank
                    </Link>

                    {centres.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            Create Invoice
                        </button>
                    )}
                </div>
            </div>

            {/* Data Grid Table */}
            <div className="bg-card/90 backdrop-blur-md border border-border/60 rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
                <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">Each row is one invoice. Billing period is the service covered; Created is when the record was made. Scroll for actions.</p>
                <div role="region" aria-label="Invoices table, scroll for more columns" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary">
                    <table className="w-full min-w-[760px] text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/60 bg-secondary/30 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                                <th className="p-4 w-12 text-center select-none">
                                    <input 
                                        type="checkbox" 
                                        aria-label="Select all invoices on this page"
                                        className="rounded border-border accent-primary w-4 h-4 cursor-pointer"
                                        checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th className="p-4 font-bold tracking-wider">Invoice #</th>
                                <th className="p-4 font-bold tracking-wider">Client / Student</th>
                                <th className="p-4 font-bold tracking-wider">Billing period / Due</th>
                                <th className="p-4 font-bold tracking-wider">Status</th>
                                <th className="p-4 font-bold tracking-wider text-right">Total / Remaining</th>
                                <th className="p-4 font-bold tracking-wider text-right sticky right-0 z-10 bg-card">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-sm">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                                            <FileText className="w-6 h-6" aria-hidden="true" />
                                        </div>
                                        <p className="text-base font-bold text-foreground">No invoices found</p>
                                        <p className="text-xs text-muted-foreground mt-1">There are no records matching your current filter criteria.</p>
                                    </td>
                                </tr>
                            ) : invoices.map((invoice) => {
                                const state = evaluateInvoiceCollectionState(invoice, todayLondonIso, { strictPayments: false });
                                const isOverdue = state.stage === 'overdue';
                                const isInPeriod = state.stage === 'in_period';
                                const paidDate = state.stage === 'paid' ? formatPaidDate(invoice.payments) : null;
                                const balanceLabel = invoiceBalanceLabel(invoice);

                                return (
                                    <tr 
                                        key={invoice.id} 
                                        className={`hover:bg-secondary/20 transition-all duration-150 cursor-pointer ${selectedInvoices.has(invoice.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleSelection(invoice.id)}
                                    >
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                aria-label={`Select invoice ${invoice.invoiceNumber}`}
                                                className="rounded border-border accent-primary w-4 h-4 cursor-pointer"
                                                checked={selectedInvoices.has(invoice.id)}
                                                onChange={() => toggleSelection(invoice.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-primary">
                                            <Link href={`/dashboard/finance/invoices/${invoice.id}`} onClick={event => event.stopPropagation()} className="hover:underline hover:text-primary/80 transition-colors whitespace-nowrap">{invoice.invoiceNumber}</Link>
                                            <p className="text-xs font-normal text-muted-foreground whitespace-nowrap">{invoice.createdAt ? 'Created' : 'Invoice date'} {formatInvoiceDate(invoice.createdAt || invoice.invoiceDate)}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-foreground whitespace-nowrap">
                                                {invoice.parent ? (
                                                    <Link href={`/dashboard/parents/${invoice.parent.id}`} className="hover:underline hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                                        {invoice.parent.firstName} {invoice.parent.lastName}
                                                    </Link>
                                                ) : null}
                                            </div>
                                            {invoice.child && (
                                                <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                                    <Link href={`/dashboard/students/${invoice.child.id}`} className="hover:underline hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                                        {invoice.child.firstName} {invoice.child.lastName}
                                                    </Link>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-foreground whitespace-nowrap">{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)}</div>
                                            <div className={`text-xs whitespace-nowrap ${isOverdue ? 'text-rose-700 dark:text-rose-300 font-bold' : isInPeriod ? 'text-amber-800 dark:text-amber-200 font-medium' : 'text-muted-foreground'}`}>
                                                Due {formatInvoiceDate(invoice.dueDate)}{paidDate ? ` · Paid ${paidDate}` : ''}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {invoice.needsBillingReview && <p className="mb-2 max-w-56 text-xs font-semibold text-amber-800 dark:text-amber-200">
                                                Billing review required: check pause/restart dates, family coverage and fee before issuance. This draft has been preserved.
                                            </p>}
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${COLLECTION_STAGE_STYLES[state.stage].badge}`}>
                                                {renderStageIcon(state.stage)}
                                                {state.staffBadgeLabel}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-bold text-foreground tabular-nums text-base leading-5">£{Number(invoice.amount).toFixed(2)}</div>
                                            <div className="text-xs text-muted-foreground tabular-nums font-semibold whitespace-nowrap">{balanceLabel}</div>
                                        </td>
                                        <td className="p-4 text-right sticky right-0 z-10 bg-card" onClick={(e) => e.stopPropagation()}>
                                            <Link
                                                href={`/dashboard/finance/invoices/${invoice.id}`}
                                                aria-label={`${invoice.status === 'draft' ? 'Review and issue' : 'View'} invoice ${invoice.invoiceNumber}`}
                                                onClick={event => event.stopPropagation()}
                                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-secondary/80 text-foreground text-xs font-bold hover:bg-secondary transition-all border border-border/50 shadow-sm whitespace-nowrap"
                                            >
                                                {invoice.status === 'draft' ? 'Review & issue' : 'View invoice'}
                                                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                            </Link>
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


            {isBulkPayModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bulk-pay-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => !isSubmittingBulkPay && setIsBulkPayModalOpen(false)}
                >
                    <div
                        className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden p-6 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div>
                            <h3 id="bulk-pay-modal-title" className="text-lg font-bold text-foreground">
                                Confirm Lump Sum Payment
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Review the selected payable invoices and choose the payment method before recording.
                            </p>
                        </div>

                        <div className="rounded-xl bg-secondary/40 border border-border p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Eligible payable invoices</span>
                                <span className="font-bold text-foreground">{eligibleBulkPayItems.length}</span>
                            </div>
                            {selectedInvoices.size > eligibleBulkPayItems.length && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    {selectedInvoices.size - eligibleBulkPayItems.length} non-payable invoice(s) (draft, paid, or void) were excluded.
                                </p>
                            )}
                            <div className="flex justify-between border-t border-border pt-2">
                                <span className="text-muted-foreground">Total remaining balance</span>
                                <span className="font-black text-foreground tabular-nums">
                                    £{formatPenceToDecimal(totalBulkPayPence)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="bulk-payment-method" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Payment Method
                            </label>
                            <select
                                id="bulk-payment-method"
                                value={bulkPaymentMethod}
                                onChange={(e) => setBulkPaymentMethod(e.target.value as 'bank_transfer' | 'cash' | 'card' | 'tax_free_childcare')}
                                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="bank_transfer">Bank Transfer (BACS)</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="tax_free_childcare">Tax-Free Childcare (TFC)</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isSubmittingBulkPay}
                                onClick={() => setIsBulkPayModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSubmittingBulkPay || eligibleBulkPayItems.length === 0}
                                onClick={handleBulkPay}
                                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                            >
                                {isSubmittingBulkPay ? 'Recording...' : `Confirm £${formatPenceToDecimal(totalBulkPayPence)} Payment`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <CreateInvoiceModal 
                    centres={centres}
                    onClose={() => setIsCreateModalOpen(false)}
                />
            )}
        </div>
    );
}
