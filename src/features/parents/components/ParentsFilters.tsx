'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
        { value: 'all', label: 'All parents' },
        { value: 'active', label: 'Active (has children)' },
        { value: 'inactive', label: 'Inactive (no children)' },
        { value: 'arrears', label: 'In arrears' },
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
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="flex-1 min-w-[220px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by name, child name, email, or phone…"
                        aria-label="Search parents"
                        className="w-full h-9 pl-9 pr-9 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                    />
                    {search && (
                        <button
                            onClick={() => handleSearchChange('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Status filter */}
                <div className="relative">
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            applyFilters({ newStatus: val });
                        }}
                        aria-label="Filter by status"
                        className="h-9 pl-3 pr-8 rounded-sm text-sm text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors appearance-none cursor-pointer border border-border bg-surface"
                    >
                        {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                        <X className="w-3.5 h-3.5" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Active filter summary */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-label text-text-muted">Active:</span>
                    {searchParams.get('search') && (
                        <Badge variant="info">&quot;{searchParams.get('search')}&quot; ({resultsCount} results)</Badge>
                    )}
                    {status !== 'all' && (
                        <Badge>{statusOptions.find((o) => o.value === status)?.label || status}</Badge>
                    )}
                </div>
            )}
        </div>
    );
}
