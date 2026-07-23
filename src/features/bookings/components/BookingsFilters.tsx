'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Calendar, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface BookingsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
}

export default function BookingsFilters({ centres, resultsCount = 0 }: BookingsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
    const [toDate, setToDate] = useState(searchParams.get('to') || '');

    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        status !== 'all' ||
        fromDate ||
        toDate ||
        selectedCentreId !== 'all'
    );

    const handleClearFilters = () => {
        setSearch('');
        setStatus('all');
        setFromDate('');
        setToDate('');
        setSelectedCentreId('all');
        router.push('/dashboard/bookings');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    const applyFilters = (overrides?: { newSearch?: string; newStatus?: string; newFrom?: string; newTo?: string }) => {
        const params = new URLSearchParams();
        
        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);
        
        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        const currentFrom = overrides?.newFrom !== undefined ? overrides.newFrom : fromDate;
        if (currentFrom) params.set('from', currentFrom);

        const currentTo = overrides?.newTo !== undefined ? overrides.newTo : toDate;
        if (currentTo) params.set('to', currentTo);

        const queryString = params.toString();
        router.push(`/dashboard/bookings${queryString ? `?${queryString}` : ''}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
                    <div className="relative flex items-center">
                        <Search className="absolute left-4 w-4 h-4 text-muted-foreground" />
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
                            placeholder="Search parent name, child name..."
                            className="w-full pl-11 pr-24 py-2.5 bg-secondary/50 backdrop-blur-md border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                        <button 
                            type="submit"
                            className="absolute right-1.5 px-3 py-1.5 bg-background hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground transition-all shadow-sm active:scale-95"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* Centre Filter — only visible when there are multiple centres */}
                {centres.length > 1 && (
                    <div className="relative min-w-[180px]">
                        <select
                            value={selectedCentreId}
                            onChange={(e) => {
                                setSelectedCentreId(e.target.value);
                            }}
                            className="w-full pl-4 pr-10 py-2.5 bg-secondary/50 border border-border rounded-2xl text-sm text-foreground font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer text-left"
                        >
                            <option value="all">All Centres</option>
                            {centres.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                )}

                {/* Unified Date Range Group */}
                <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-2xl px-3 py-1 flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase mr-2 pointer-events-none">From</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFromDate(val);
                                applyFilters({ newFrom: val });
                            }}
                            className="bg-transparent border-none text-xs text-foreground outline-none cursor-pointer w-28 py-1.5"
                        />
                    </div>
                    <span className="text-slate-600 text-xs font-bold px-1">➔</span>
                    <div className="flex items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase mr-2 pointer-events-none">To</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setToDate(val);
                                applyFilters({ newTo: val });
                            }}
                            className="bg-transparent border-none text-xs text-foreground outline-none cursor-pointer w-28 py-1.5"
                        />
                    </div>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold text-foreground transition-all cursor-pointer border border-border flex-shrink-0 active:scale-95 duration-100"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Active Filters:
                    </span>
                    {searchParams.get('search') && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/15">
                            Search: "{searchParams.get('search')}" ({resultsCount} results)
                        </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-accent-violet/10 text-accent-violet text-xs font-semibold rounded-full border border-accent-violet/15">
                            Status: {statusOptions.find(s => s.value === status)?.label}
                        </span>
                    )}
                    {fromDate && (
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-full border border-amber-500/15 flex items-center gap-1.5">
                            From: {fromDate}
                            <button 
                                onClick={() => { setFromDate(''); applyFilters({ newFrom: '' }); }} 
                                className="hover:text-white ml-0.5 text-slate-400 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {toDate && (
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-full border border-amber-500/15 flex items-center gap-1.5">
                            To: {toDate}
                            <button 
                                onClick={() => { setToDate(''); applyFilters({ newTo: '' }); }} 
                                className="hover:text-white ml-0.5 text-slate-400 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )}
                    {selectedCentreId !== 'all' && (
                        <span className="px-3 py-1 bg-accent-cyan/10 text-accent-cyan text-xs font-semibold rounded-full border border-accent-cyan/15">
                            Centre: {centres.find(c => c.id === selectedCentreId)?.name || 'Selected'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

