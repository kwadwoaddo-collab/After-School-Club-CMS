'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Calendar, X, Menu, SlidersHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import Link from 'next/link';

interface BookingsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
    statusCounts?: Record<string, number>;
    totalAggCount?: number;
}

export default function BookingsFilters({ centres, resultsCount = 0, statusCounts, totalAggCount = 0 }: BookingsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
    const [toDate, setToDate] = useState(searchParams.get('to') || '');
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

    const isToday = searchParams.get('today') === 'true';

    const statusOptionsWithCounts = [
        { value: 'all', label: 'All', count: totalAggCount, color: '' },
        { value: 'confirmed', label: 'Confirmed', count: statusCounts?.confirmed || 0, color: 'text-blue-400 bg-blue-500/10' },
        { value: 'pending', label: 'Pending', count: statusCounts?.pending || 0, color: 'text-amber-400 bg-amber-500/10' },
        { value: 'completed', label: 'Attended', count: statusCounts?.completed || 0, color: 'text-violet-400 bg-violet-500/10' },
        { value: 'cancelled', label: 'Cancelled', count: statusCounts?.cancelled || 0, color: 'text-slate-400 bg-slate-500/10' },
        { value: 'rescheduled', label: 'Rescheduled', count: statusCounts?.rescheduled || 0, color: 'text-indigo-400 bg-indigo-500/10' },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        status !== 'all' ||
        fromDate ||
        toDate ||
        searchParams.get('today') ||
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

    const applyFilters = (overrides?: { newSearch?: string; newStatus?: string; newFrom?: string; newTo?: string; newToday?: string }) => {
        const params = new URLSearchParams();
        
        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);
        
        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);

        const currentFrom = overrides?.newFrom !== undefined ? overrides.newFrom : fromDate;
        if (currentFrom) params.set('from', currentFrom);

        const currentTo = overrides?.newTo !== undefined ? overrides.newTo : toDate;
        if (currentTo) params.set('to', currentTo);

        const currentToday = overrides?.newToday !== undefined ? overrides.newToday : searchParams.get('today');
        if (currentToday) params.set('today', currentToday);

        const queryString = params.toString();
        router.push(`/dashboard/bookings${queryString ? `?${queryString}` : ''}`);
    };

    return (
        <div className="space-y-4">
            {/* Unified Filter Bar (Desktop) */}
            <div className="hidden lg:flex items-center justify-between gap-4">
                <div className="flex bg-secondary/60 p-1 rounded-2xl border border-border self-start overflow-x-auto max-w-full scrollbar-none gap-1">
                    {statusOptionsWithCounts.map((tab) => {
                        const isActive = status === tab.value;
                        return (
                            <button
                                key={tab.value}
                                onClick={() => {
                                    setStatus(tab.value);
                                    applyFilters({ newStatus: tab.value });
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 duration-150 ${
                                    isActive
                                        ? 'bg-card text-foreground shadow-sm border border-border'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : `${tab.color || 'bg-secondary text-muted-foreground'}`
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => applyFilters({ newToday: isToday ? '' : 'true' })}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all active:scale-95 duration-100 ${
                            isToday
                                ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_12px_rgba(142,171,255,0.15)]'
                                : 'bg-card hover:bg-secondary border-border text-foreground'
                        }`}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Today</span>
                    </button>
                    
                    <form onSubmit={handleSearch} className="min-w-[240px]">
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
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
                                placeholder="Search bookings..."
                                className="w-full pl-9 pr-4 py-2 bg-secondary/50 backdrop-blur-md border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            />
                        </div>
                    </form>
                    
                    {centres.length > 1 && (
                        <div className="relative min-w-[150px]">
                            <select
                                value={selectedCentreId}
                                onChange={(e) => {
                                    setSelectedCentreId(e.target.value);
                                }}
                                className="w-full pl-3 pr-8 py-2 bg-secondary/50 border border-border rounded-xl text-xs text-foreground font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer"
                            >
                                <option value="all">All Centres</option>
                                {centres.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-2 py-0.5 flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFromDate(val);
                                applyFilters({ newFrom: val });
                            }}
                            className="bg-transparent border-none text-[10px] text-foreground outline-none cursor-pointer w-24 py-1.5"
                        />
                        <span className="text-slate-600 text-[10px] font-bold px-1">➔</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => {
                                const val = e.target.value;
                                setToDate(val);
                                applyFilters({ newTo: val });
                            }}
                            className="bg-transparent border-none text-[10px] text-foreground outline-none cursor-pointer w-24 py-1.5"
                        />
                    </div>
                    
                    {hasActiveFilters && (
                        <button
                            onClick={handleClearFilters}
                            className="flex items-center justify-center p-2 bg-secondary hover:bg-secondary/80 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border flex-shrink-0 active:scale-95 duration-100"
                            title="Clear Filters"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Filter Toggle & Search */}
            <div className="lg:hidden flex items-center gap-3">
                <form onSubmit={handleSearch} className="flex-1">
                    <div className="relative flex items-center">
                        <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
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
                            placeholder="Search..."
                            className="w-full pl-9 pr-4 py-2.5 bg-secondary/50 backdrop-blur-md border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                    </div>
                </form>
                <button
                    onClick={() => setIsMobileSheetOpen(true)}
                    className="flex items-center justify-center p-2.5 bg-secondary hover:bg-secondary/80 rounded-xl text-foreground transition-all cursor-pointer border border-border flex-shrink-0 active:scale-95 relative"
                >
                    <SlidersHorizontal className="w-5 h-5" />
                    {hasActiveFilters && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                </button>
            </div>

            {/* Mobile Filter Bottom Sheet */}
            {isMobileSheetOpen && (
                <div className="fixed inset-0 z-[200] flex justify-end flex-col lg:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileSheetOpen(false)} />
                    <div className="bg-background border-t border-border shadow-2xl rounded-t-3xl p-6 flex flex-col relative animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground">Filters</h2>
                            {hasActiveFilters && (
                                <button onClick={handleClearFilters} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="space-y-6">
                            {/* Today Toggle */}
                            <button
                                onClick={() => {
                                    applyFilters({ newToday: isToday ? '' : 'true' });
                                    setIsMobileSheetOpen(false);
                                }}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-sm font-bold transition-all active:scale-95 duration-100 ${
                                    isToday
                                        ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_12px_rgba(142,171,255,0.15)]'
                                        : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
                                }`}
                            >
                                <Calendar className="w-4 h-4" />
                                <span>Show Today Only</span>
                            </button>

                            {/* Status */}
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Status</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {statusOptionsWithCounts.map((tab) => (
                                        <button
                                            key={tab.value}
                                            onClick={() => {
                                                setStatus(tab.value);
                                                applyFilters({ newStatus: tab.value });
                                                setIsMobileSheetOpen(false);
                                            }}
                                            className={`flex flex-col items-start p-3 rounded-xl border transition-all ${
                                                status === tab.value
                                                    ? 'bg-card border-primary text-foreground ring-1 ring-primary/30'
                                                    : 'bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                                            }`}
                                        >
                                            <span className="text-sm font-bold">{tab.label}</span>
                                            <span className="text-xs mt-1">{tab.count} bookings</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Centre Filter */}
                            {centres.length > 1 && (
                                <div>
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Centre</h3>
                                    <select
                                        value={selectedCentreId}
                                        onChange={(e) => {
                                            setSelectedCentreId(e.target.value);
                                            setIsMobileSheetOpen(false);
                                        }}
                                        className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-sm text-foreground font-medium outline-none"
                                    >
                                        <option value="all">All Centres</option>
                                        {centres.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Date Range */}
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Date Range</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-slate-500">From</label>
                                        <input
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFromDate(val);
                                                applyFilters({ newFrom: val });
                                            }}
                                            className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-slate-500">To</label>
                                        <input
                                            type="date"
                                            value={toDate}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setToDate(val);
                                                applyFilters({ newTo: val });
                                            }}
                                            className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <button
                            onClick={() => setIsMobileSheetOpen(false)}
                            className="w-full mt-6 px-4 py-3 bg-primary hover:bg-primary/90 rounded-xl text-sm font-bold text-primary-foreground transition-all active:scale-95"
                        >
                            View {resultsCount} Results
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

