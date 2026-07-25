'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface ParentsFiltersProps {
    resultsCount?: number;
}

export default function ParentsFilters({ resultsCount = 0 }: ParentsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const statusOptions = [
        { value: 'all', label: 'All Parents' },
        { value: 'active', label: 'Active (Has Children)' },
        { value: 'inactive', label: 'Inactive (No Children)' },
        { value: 'arrears', label: 'In Arrears' },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        (searchParams.get('status') && searchParams.get('status') !== 'all')
    );

    const applyFilters = useCallback((overrides?: { newSearch?: string; newStatus?: string }) => {
        const params = new URLSearchParams();

        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);

        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        if (selectedCentreId !== 'all') params.set('centre', selectedCentreId);

        const queryString = params.toString();
        router.push(`/dashboard/parents${queryString ? `?${queryString}` : ''}`);
    }, [search, status, selectedCentreId, router]);

    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            applyFilters({ newSearch: value });
        }, 350);
    }, [applyFilters]);

    const handleClearFilters = () => {
        setSearch('');
        setStatus('all');
        const params = new URLSearchParams();
        if (selectedCentreId !== 'all') params.set('centre', selectedCentreId);
        const queryString = params.toString();
        router.push(`/dashboard/parents${queryString ? `?${queryString}` : ''}`);
    };

    useEffect(() => {
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, []);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by name, child name, email, or phone..."
                        className="w-full pl-11 pr-10 py-2.5 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border bg-secondary/50 border-border"
                    />
                    {search && (
                        <button
                            onClick={() => handleSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
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
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer border pr-8 bg-secondary/50 border-border"
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-bold text-foreground transition-all cursor-pointer border border-border"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Active:</span>
                    {searchParams.get('search') && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                            &quot;{searchParams.get('search')}&quot; ({resultsCount} results)
                        </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-bold rounded-full border border-tertiary/20">
                            {statusOptions.find((o) => o.value === status)?.label || status}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
