'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
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
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isPending, startTransition] = useTransition();

    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
        { value: 'signed_up', label: 'Signed Up' },
        { value: 'not_interested', label: 'Not Interested' },
    ];

    // Computed from local state, not URL — avoids desync during debounce window
    const hasActiveFilters = !!(
        search ||
        (status && status !== 'all') ||
        selectedCentreId !== 'all'
    );

    const buildUrl = useCallback(
        (overrides?: { newSearch?: string; newStatus?: string; newCentre?: string }) => {
            const params = new URLSearchParams();

            const s = overrides?.newSearch !== undefined ? overrides.newSearch : search;
            if (s) params.set('search', s);

            const st = overrides?.newStatus !== undefined ? overrides.newStatus : status;
            if (st !== 'all') params.set('status', st);

            const c = overrides?.newCentre !== undefined ? overrides.newCentre : selectedCentreId;
            if (c !== 'all') params.set('centre', c);

            const qs = params.toString();
            return `/dashboard/registrations${qs ? `?${qs}` : ''}`;
        },
        [search, status, selectedCentreId],
    );

    const handleClearFilters = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSearch('');
        setStatus('all');
        setSelectedCentreId('all');
        router.push('/dashboard/registrations');
    };

    // Debounced search — applies 400ms after the user stops typing
    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            startTransition(() => {
                router.push(buildUrl({ newSearch: val }));
            });
        }, 400);
    };

    // Status filter — immediate (consistent with centre filter)
    const handleStatusChange = (val: string) => {
        setStatus(val);
        router.push(buildUrl({ newStatus: val }));
    };

    // Centre filter — already immediate via context; also apply to URL
    const handleCentreChange = (val: string) => {
        setSelectedCentreId(val);
        router.push(buildUrl({ newCentre: val }));
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    return (
        <div className="space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 flex-wrap">
                {/* Search — debounced 400ms */}
                <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search registrations…"
                        aria-label="Search registrations"
                        className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/30 transition-all outline-none border bg-secondary/50 border-border"
                    />
                </div>

                {/* Centre Filter — only visible when there are multiple centres */}
                {centres.length > 1 && (
                    <div className="relative min-w-[160px]">
                        <select
                            value={selectedCentreId}
                            onChange={(e) => handleCentreChange(e.target.value)}
                            aria-label="Filter by centre"
                            className="w-full pl-4 pr-8 py-2 rounded-xl text-sm font-medium text-foreground focus:ring-1 focus:ring-primary/40 transition-all outline-none appearance-none cursor-pointer text-left border bg-secondary/50 border-border"
                        >
                            <option value="all">All Centres</option>
                            {centres.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                    </div>
                )}

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-1.5 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-medium text-foreground transition-all cursor-pointer border border-border active:scale-95 duration-100"
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear
                    </button>
                )}
            </div>

            {/* Active Filters Display — reads from local state to avoid desync during debounce */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                        Active Filters:
                    </span>
                    {search && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/15">
                            Search: &ldquo;{search}&rdquo; ({resultsCount} results)
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
