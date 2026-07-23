'use client';

import { useState } from 'react';
import { Search, ChevronDown, FileText } from 'lucide-react';
import { InvoiceTable } from './FinanceDashboardClient';
import Link from 'next/link';

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue';

interface Props {
    initialInvoices: unknown[];
    isOwner: boolean;
}

export default function FilterableInvoiceSection({ initialInvoices, isOwner }: Props) {
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
            {/* Section header */}
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Recent Invoices
                </h3>
                <Link href="/dashboard/finance/invoices" className="text-sm font-bold text-primary hover:underline">
                    View All
                </Link>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-5 px-2 flex-wrap">
                <div className="relative flex-1 min-w-[160px] max-w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search invoices…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-8 pr-3 w-full bg-secondary/40 border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all"
                    />
                </div>
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="h-9 pl-3 pr-7 bg-secondary/40 border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer hover:bg-secondary/80 transition-all"
                    >
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            <InvoiceTable invoices={filtered} isOwner={isOwner} />
        </div>
    );
}
