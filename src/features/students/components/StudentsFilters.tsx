'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, X, ChevronDown, Check } from 'lucide-react';
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
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Unified Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search by student, parent, email..."
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

                {/* Multi-Select Year Dropdown */}
                <div className="relative min-w-[180px]" ref={dropdownRef}>
                    <button
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none border bg-secondary/50 border-border"
                    >
                        <span>
                            {selectedYears.length === 0 ? 'Year Groups (All)' : `Year Groups (${selectedYears.length} Selected)`}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    
                    {isYearDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto p-2">
                            <button
                                onClick={toggleAllYears}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-secondary/50 rounded-lg text-left"
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedYears.length === yearOptions.length ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                                    {selectedYears.length === yearOptions.length && <Check className="w-3 h-3" />}
                                </div>
                                Select All
                            </button>
                            <div className="h-px bg-border my-1 mx-2"></div>
                            {yearOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleYear(opt.value)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-secondary/50 rounded-lg text-left"
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedYears.includes(opt.value) ? 'bg-primary border-primary text-white' : 'border-border'}`}>
                                        {selectedYears.includes(opt.value) && <Check className="w-3 h-3" />}
                                    </div>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
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
                    {selectedYears.length > 0 && (
                        <span className="px-3 py-1 bg-secondary text-foreground text-xs font-bold rounded-full border border-border flex flex-wrap gap-1">
                            {selectedYears.map(y => yearOptions.find(o => o.value === y)?.label || y).join(', ')}
                        </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-xs font-bold rounded-full border border-tertiary/20">
                            {statusOptions.find((o) => o.value === status)?.label || status}
                        </span>
                    )}
                    {selectedCentreId !== 'all' && (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-bold rounded-full border border-emerald-500/20">
                            Centre: {centres.find((c) => c.id === selectedCentreId)?.name || 'Selected'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
