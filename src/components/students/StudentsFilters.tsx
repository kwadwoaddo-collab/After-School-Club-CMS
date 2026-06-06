'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, X, LayoutGrid, Table2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface StudentsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
    currentView?: 'table' | 'grid';
}

export default function StudentsFilters({ centres, resultsCount = 0, currentView = 'table' }: StudentsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [year, setYear] = useState(searchParams.get('year') || 'all');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const yearPills = [
        { value: 'all', label: 'All' },
        { value: '0', label: 'Rec' },
        ...Array.from({ length: 13 }, (_, i) => ({
            value: String(i + 1),
            label: `Y${i + 1}`,
        })),
    ];

    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'registered', label: 'Registered' },
        { value: 'unregistered', label: 'Leads / Unregistered' },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        (searchParams.get('year') && searchParams.get('year') !== 'all') ||
        (searchParams.get('status') && searchParams.get('status') !== 'all') ||
        selectedCentreId !== 'all'
    );

    const handleClearFilters = () => {
        setSearch('');
        setYear('all');
        setStatus('all');
        setSelectedCentreId('all');
        router.push('/dashboard/students');
    };

    const applyFilters = useCallback((overrides?: { newSearch?: string; newYear?: string; newStatus?: string; newView?: string }) => {
        const params = new URLSearchParams();

        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);

        const currentYear = overrides?.newYear !== undefined ? overrides.newYear : year;
        if (currentYear !== 'all') params.set('year', currentYear);

        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        if (selectedCentreId !== 'all') params.set('centre', selectedCentreId);

        const newView = overrides?.newView !== undefined ? overrides.newView : currentView;
        if (newView === 'grid') params.set('view', 'grid');

        const queryString = params.toString();
        router.push(`/dashboard/students${queryString ? `?${queryString}` : ''}`);
    }, [search, year, status, selectedCentreId, currentView, router]);

    // Debounced instant search — fires 350ms after user stops typing
    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            applyFilters({ newSearch: value });
        }, 350);
    }, [applyFilters]);

    useEffect(() => {
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, []);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Row 1: Search + Status + View Toggle */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Instant Search — no submit button needed */}
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search student or parent name, contact..."
                        className="w-full pl-11 pr-10 py-2.5 rounded-2xl text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 transition-all outline-none border"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    />
                    {search && (
                        <button
                            onClick={() => handleSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Status Filter */}
                <div className="relative min-w-[160px]">
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            applyFilters({ newStatus: val });
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer border pr-8"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* View Toggle: Table / Grid */}
                <div className="flex items-center bg-[#14161b] border border-[#2a2a2a] rounded-2xl p-1 gap-1">
                    <button
                        onClick={() => applyFilters({ newView: 'table' })}
                        className={`p-2 rounded-xl transition-all ${currentView === 'table' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                        title="Table view"
                    >
                        <Table2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => applyFilters({ newView: 'grid' })}
                        className={`p-2 rounded-xl transition-all ${currentView === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                        title="Card grid view"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2d35] hover:bg-[#343843] rounded-2xl text-sm font-bold text-white transition-all cursor-pointer border border-[#424754]/10"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {/* Row 2: Year Group Pills */}
            <div className="flex items-center gap-2 flex-wrap">
                {yearPills.map((pill) => (
                    <button
                        key={pill.value}
                        onClick={() => {
                            setYear(pill.value);
                            applyFilters({ newYear: pill.value });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            year === pill.value
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                : 'bg-[#14161b] border-[#2a2a2a] text-slate-400 hover:border-primary/30 hover:text-white'
                        }`}
                    >
                        {pill.label}
                    </button>
                ))}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active:</span>
                    {searchParams.get('search') && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/15">
                            &quot;{searchParams.get('search')}&quot; ({resultsCount} results)
                        </span>
                    )}
                    {year !== 'all' && (
                        <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full border border-secondary/15">
                            {yearPills.find((o) => o.value === year)?.label || `Year ${year}`}
                        </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-tertiary-container/10 text-tertiary text-xs font-bold rounded-full border border-tertiary/15">
                            {statusOptions.find((o) => o.value === status)?.label || status}
                        </span>
                    )}
                    {selectedCentreId !== 'all' && (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/15">
                            Centre: {centres.find((c) => c.id === selectedCentreId)?.name || 'Selected'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
