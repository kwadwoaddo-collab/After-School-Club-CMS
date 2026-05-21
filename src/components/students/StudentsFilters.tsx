'use client';

import { useState } from 'react';
import { Search, Filter, GraduationCap, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface StudentsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
}

export default function StudentsFilters({ centres, resultsCount = 0 }: StudentsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [year, setYear] = useState(searchParams.get('year') || 'all');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');

    const yearOptions = [
        { value: 'all', label: 'All Years' },
        ...Array.from({ length: 13 }, (_, i) => ({
            value: String(i + 1),
            label: `Year ${i + 1}`,
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    const applyFilters = (overrides?: { newSearch?: string; newYear?: string; newStatus?: string }) => {
        const params = new URLSearchParams();

        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);

        const currentYear = overrides?.newYear !== undefined ? overrides.newYear : year;
        if (currentYear !== 'all') params.set('year', currentYear);

        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        // Retain the centre filter from url if selectedCentreId is defined
        if (selectedCentreId !== 'all') {
            params.set('centre', selectedCentreId);
        }

        const queryString = params.toString();
        router.push(`/dashboard/students${queryString ? `?${queryString}` : ''}`);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                            placeholder="Search student or parent name, contact..."
                            className="w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                        />
                    </div>
                </form>

                {/* School Year Filter */}
                <div className="relative min-w-[150px]">
                    <select
                        value={year}
                        onChange={(e) => {
                            const val = e.target.value;
                            setYear(val);
                            applyFilters({ newYear: val });
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    >
                        {yearOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <GraduationCap className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Status Filter */}
                <div className="relative min-w-[180px]">
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            applyFilters({ newStatus: val });
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#2a2d35] hover:bg-[#343843] rounded-2xl text-sm font-bold text-[#FFFFFF] transition-all cursor-pointer border border-[#424754]/10"
                    >
                        <X className="w-4 h-4" />
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
                    {year !== 'all' && (
                        <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full border border-secondary/15">
                            Year: {yearOptions.find((o) => o.value === year)?.label}
                        </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-tertiary-container/10 text-tertiary text-xs font-bold rounded-full border border-tertiary/15">
                            Status: {statusOptions.find((o) => o.value === status)?.label}
                        </span>
                    )}
                    {selectedCentreId !== 'all' && (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/15 animate-pulse">
                            Centre: {centres.find((c) => c.id === selectedCentreId)?.name || 'Selected'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
