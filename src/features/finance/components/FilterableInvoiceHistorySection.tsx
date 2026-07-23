'use client';

import { useState } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { InvoiceTable } from './FinanceDashboardClient';
import Link from 'next/link';

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue';

interface Props {
    initialInvoices: unknown[];
    isOwner: boolean;
}

export default function FilterableInvoiceHistorySection({ initialInvoices, isOwner }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = initialInvoices.filter(invoice => {
        const matchesSearch =
            invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${invoice.parent?.firstName} ${invoice.parent?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${invoice.child?.firstName} ${invoice.child?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());

        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
        const isOverdue = dueDate && dueDate < today && invoice.status !== 'paid' && invoice.status !== 'void';

        const matchesStatus =
            statusFilter === 'all'      ? true :
            statusFilter === 'overdue'  ? !!isOverdue :
            invoice.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="bg-card border border-border shadow-sm rounded-[32px] p-6">
            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search by invoice #, parent, or child…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 pl-9 pr-4 w-full bg-secondary/40 border border-border rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all"
                    />
                </div>
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="h-10 pl-4 pr-8 bg-secondary/40 border border-border rounded-2xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer hover:bg-secondary/80 transition-all"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                <span className="text-xs font-bold text-muted-foreground ml-auto">
                    {filtered.length} of {initialInvoices.length} record{initialInvoices.length !== 1 ? 's' : ''}
                </span>
                {isOwner && (
                    <Link
                        href="/dashboard/finance"
                        className="flex items-center gap-2 px-4 py-2.5 h-10 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Create Invoice
                    </Link>
                )}
            </div>

            <InvoiceTable invoices={filtered} isOwner={isOwner} />
        </div>
    );
}
