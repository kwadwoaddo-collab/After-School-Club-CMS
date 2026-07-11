'use client';

import { useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface RegistrationsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
}

export default function RegistrationsFilters({ centres, resultsCount = 0 }: RegistrationsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');

    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
        { value: 'signed_up', label: 'Signed Up' },
        { value: 'not_interested', label: 'Not Interested' },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        (searchParams.get('status') && searchParams.get('status') !== 'all') ||
        selectedCentreId !== 'all'
    );

    const handleClearFilters = () => {
        setSearch('');
        setStatus('all');
        setSelectedCentreId('all');
        router.push('/dashboard/registrations');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    const applyFilters = (overrides?: { newSearch?: string; newStatus?: string }) => {
        const params = new URLSearchParams();

        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);

        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        if (selectedCentreId !== 'all') {
            params.set('centre', selectedCentreId);
        }

        const queryString = params.toString();
        router.push(`/dashboard/registrations${queryString ? `?${queryString}` : ''}`);
    };

    return (
        <div className="space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <form onSubmit={handleSearch} className="min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearch(val);
                                if (val === '') {
                                    applyFilters({ newSearch: '' });
                                }
                            }}
                            placeholder="Search…"
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm placeholder:text-slate-600 focus:ring-1 focus:ring-primary/30 transition-all outline-none border bg-[#19191b]/60 border-outline-variant/20 text-white"
                        />
                    </div>
                </form>

                {/* Centre Filter — only visible when there are multiple centres */}
                {centres.length > 1 && (
                    <div className="relative min-w-[160px]">
                        <select
                            value={selectedCentreId}
                            onChange={(e) => {
                                setSelectedCentreId(e.target.value);
                            }}
                            className="w-full pl-4 pr-8 py-2 rounded-xl text-sm font-medium focus:ring-1 focus:ring-primary/40 transition-all outline-none appearance-none cursor-pointer text-left border bg-[#19191b]/40 border-outline-variant/20 text-white"
                        >
                            <option value="all" className="bg-[#1a1d23] text-white">All Centres</option>
                            {centres.map((c) => (
                                <option key={c.id} value={c.id} className="bg-[#1a1d23] text-white">{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                    </div>
                )}

                {/* Status Filter */}
                <div className="relative min-w-[160px]">
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            applyFilters({ newStatus: val });
                        }}
                        className="w-full pl-4 pr-8 py-2 rounded-xl text-sm font-medium focus:ring-1 focus:ring-primary/40 transition-all outline-none appearance-none cursor-pointer text-left border bg-[#19191b]/40 border-outline-variant/20 text-white"
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-[#1a1d23] text-white">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-all cursor-pointer border border-outline-variant/10"
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Active Filters:
                      </span>
                    {searchParams.get('search') && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/15">
                            Search: "{searchParams.get('search')}" ({resultsCount} results)
                          </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-tertiary-container/10 text-tertiary text-xs font-bold rounded-full border border-tertiary/15">
                            Status: {statusOptions.find((o) => o.value === status)?.label}
                          </span>
                    )}
                    {selectedCentreId !== 'all' && (
                        <span className="px-3 py-1 bg-accent-cyan/10 text-accent-cyan text-xs font-bold rounded-full border border-accent-cyan/15">
                            Centre: {centres.find(c => c.id === selectedCentreId)?.name || 'Selected'}
                          </span>
                    )}
                </div>
            )}
        </div>
    );
}
