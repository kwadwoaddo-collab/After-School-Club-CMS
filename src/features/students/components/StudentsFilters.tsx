'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, X, ChevronDown, Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface StudentsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
}

export default function StudentsFilters({ centres, resultsCount = 0 }: StudentsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');

    const initialYearParam = searchParams.get('year') || 'all';
    const initialYears = initialYearParam === 'all' ? [] : initialYearParam.split(',');
    const [selectedYears, setSelectedYears] = useState<string[]>(initialYears);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const yearOptions = [
        { value: 'Reception', label: 'Reception' },
        ...Array.from({ length: 13 }, (_, i) => ({
            value: `Y${i + 1}`,
            label: `Year ${i + 1}`,
        })),
    ];

    const statusOptions = [
        { value: 'all', label: 'All statuses' },
        { value: 'registered', label: 'Registered' },
        { value: 'unregistered', label: 'Leads / unregistered' },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        (searchParams.get('year') && searchParams.get('year') !== 'all') ||
        (searchParams.get('status') && searchParams.get('status') !== 'all') ||
        selectedCentreId !== 'all'
    );

    const handleClearFilters = () => {
        setSearch('');
        setSelectedYears([]);
        setStatus('all');
        setSelectedCentreId('all');
        router.push('/dashboard/students');
    };

    const applyFilters = useCallback((overrides?: { newSearch?: string; newYears?: string[]; newStatus?: string }) => {
        const params = new URLSearchParams();

        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);

        const currentYears = overrides?.newYears !== undefined ? overrides.newYears : selectedYears;
        if (currentYears.length > 0) {
            params.set('year', currentYears.join(','));
        }

        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        if (selectedCentreId !== 'all') params.set('centre', selectedCentreId);

        const queryString = params.toString();
        router.push(`/dashboard/students${queryString ? `?${queryString}` : ''}`);
    }, [search, selectedYears, status, selectedCentreId, router]);

    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            applyFilters({ newSearch: value });
        }, 350);
    }, [applyFilters]);

    const toggleYear = (val: string) => {
        const newYears = selectedYears.includes(val)
            ? selectedYears.filter(y => y !== val)
            : [...selectedYears, val];
        setSelectedYears(newYears);
        applyFilters({ newYears });
    };

    const toggleAllYears = () => {
        if (selectedYears.length === yearOptions.length) {
            setSelectedYears([]);
            applyFilters({ newYears: [] });
        } else {
            const all = yearOptions.map(o => o.value);
            setSelectedYears(all);
            applyFilters({ newYears: all });
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, []);

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
                        placeholder="Search by student, parent, email…"
                        aria-label="Search students"
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

                {/* Multi-select year dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        className="h-9 flex items-center justify-between gap-2 px-3 rounded-sm text-sm text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface min-w-[170px]"
                        aria-haspopup="listbox"
                        aria-expanded={isYearDropdownOpen}
                    >
                        <span>
                            {selectedYears.length === 0 ? 'Year groups (all)' : `Year groups (${selectedYears.length})`}
                        </span>
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                    </button>

                    {isYearDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1.5 w-56 bg-surface-elevated border border-border rounded-md shadow-[var(--shadow-popover)] z-50 max-h-64 overflow-y-auto p-1">
                            <button
                                onClick={toggleAllYears}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-page rounded-sm text-left text-text"
                            >
                                <span className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${selectedYears.length === yearOptions.length ? 'bg-accent border-accent text-white' : 'border-border'}`}>
                                    {selectedYears.length === yearOptions.length && <Check className="w-3 h-3" />}
                                </span>
                                Select all
                            </button>
                            <div className="h-px bg-border-subtle my-1 mx-2" />
                            {yearOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleYear(opt.value)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-page rounded-sm text-left text-text"
                                >
                                    <span className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${selectedYears.includes(opt.value) ? 'bg-accent border-accent text-white' : 'border-border'}`}>
                                        {selectedYears.includes(opt.value) && <Check className="w-3 h-3" />}
                                    </span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
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
                    {selectedYears.length > 0 && (
                        <Badge>{selectedYears.map(y => yearOptions.find(o => o.value === y)?.label || y).join(', ')}</Badge>
                    )}
                    {status !== 'all' && (
                        <Badge>{statusOptions.find((o) => o.value === status)?.label || status}</Badge>
                    )}
                    {selectedCentreId !== 'all' && (
                        <Badge variant="success">Centre: {centres.find((c) => c.id === selectedCentreId)?.name || 'Selected'}</Badge>
                    )}
                </div>
            )}
        </div>
    );
}
