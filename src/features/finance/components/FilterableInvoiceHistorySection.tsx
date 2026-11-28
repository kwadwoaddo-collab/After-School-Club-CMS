'use client';

import { useState } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { InvoiceTable } from './FinanceDashboardClient';
import Link from 'next/link';
import type { InvoiceWithRelations } from '@/features/finance/types';
import { evaluateInvoiceCollectionState, toLondonBusinessDate } from '../domain/invoice-collection-state';

type StatusFilter =
    | 'all'
    | 'draft'
    | 'sent'
    | 'upcoming'
    | 'in_period'
    | 'partially_paid'
    | 'overdue'
    | 'paid';

interface Props {
    initialInvoices: InvoiceWithRelations[];
    isOwner: boolean;
    activeCentreId?: string;
}

export default function FilterableInvoiceHistorySection({ initialInvoices, isOwner, activeCentreId }: Props) {
    const createInvoiceHref = activeCentreId && activeCentreId !== 'all'
        ? `/dashboard/finance?${new URLSearchParams({ centre: activeCentreId, create: '1' })}`
        : '/dashboard/finance?create=1';
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const todayIso = toLondonBusinessDate();

    const filtered = initialInvoices.filter(invoice => {
        const q = searchQuery.toLowerCase();
        const coveredMatches = Array.isArray(invoice.coveredChildrenJson)
            ? invoice.coveredChildrenJson.some((c: { name?: string; firstName?: string; lastName?: string }) =>
                  (c.name || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase().includes(q)
              )
            : false;
        const matchesSearch =
            invoice.invoiceNumber?.toLowerCase().includes(q) ||
            `${invoice.parent?.firstName} ${invoice.parent?.lastName}`.toLowerCase().includes(q) ||
            `${invoice.child?.firstName} ${invoice.child?.lastName}`.toLowerCase().includes(q) ||
            invoice.centre?.name?.toLowerCase().includes(q) ||
            coveredMatches;

        const stage = evaluateInvoiceCollectionState(invoice, todayIso, { strictPayments: false }).stage;
        const isOpenIssued = (invoice.status === 'sent' || invoice.status === 'partially_paid');

        const matchesStatus =
            statusFilter === 'all' ? true :
            statusFilter === 'upcoming' ? isOpenIssued && stage === 'upcoming' :
            statusFilter === 'in_period' ? isOpenIssued && stage === 'in_period' :
            statusFilter === 'overdue' ? isOpenIssued && stage === 'overdue' :
            statusFilter === 'paid' ? stage === 'paid' || invoice.status === 'paid' :
            invoice.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="bg-card border border-border shadow-sm rounded-xl p-6">
            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <input
                        type="search"
                        aria-label="Search invoices"
                        placeholder="Search by invoice #, parent, child, or centre…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="min-h-11 sm:min-h-10 pl-9 pr-4 w-full bg-secondary/40 border border-border rounded-md text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-transparent transition-all"
                    />
                </div>
                <div className="relative">
                    <select
                        aria-label="Filter invoices by collection status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="min-h-11 sm:min-h-10 pl-4 pr-8 bg-secondary/40 border border-border rounded-md text-sm font-bold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 appearance-none cursor-pointer hover:bg-secondary/80 transition-all"
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="in_period">In Period — Due</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="overdue">Overdue</option>
                        <option value="paid">Paid</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
                </div>
                <span className="text-xs font-bold text-muted-foreground ml-auto tabular-nums">
                    {filtered.length} of {initialInvoices.length} record{initialInvoices.length !== 1 ? 's' : ''}
                </span>
                {isOwner && (
                    <Link
                        href={createInvoiceHref}
                        className="flex items-center gap-2 px-4 py-2.5 min-h-11 sm:min-h-10 bg-accent rounded-md text-sm font-bold text-accent-foreground hover:bg-accent-hover transition-all shadow-xs"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Create Invoice
                    </Link>
                )}
            </div>

            <InvoiceTable invoices={filtered} isOwner={isOwner} />
        </div>
    );
}
