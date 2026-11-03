'use client';

import { useEffect, useState, useTransition } from 'react';
import { Search, Filter, Calendar, X, SlidersHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import { Button } from '@/components/ui/Button';

export interface BookingOutcomeCounts {
    all: number;
    needsAttendance: number;
    didNotAttendFollowUp: number;
    awaitingOutcome: number;
    signedUp: number;
    didNotSignUp: number;
}

interface BookingsFiltersProps {
    centres: { id: string; name: string }[];
    resultsCount?: number;
    statusCounts?: Record<string, number>;
    totalAggCount?: number;
    outcomeCounts?: BookingOutcomeCounts;
}

export default function BookingsFilters({ centres, resultsCount = 0, statusCounts, totalAggCount = 0, outcomeCounts }: BookingsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedCentreId, setSelectedCentreId } = useCentreFilter();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
    const [toDate, setToDate] = useState(searchParams.get('to') || '');
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const urlStatus = searchParams.get('status') || 'all';
    useEffect(() => { setStatus(urlStatus); }, [urlStatus]);

    const isToday = searchParams.get('today') === 'true';
    const activeOutcome = searchParams.get('outcome') || 'all';

    const outcomeFilterPills = [
        { value: 'all', label: 'All', count: outcomeCounts?.all ?? totalAggCount },
        { value: 'needs_attendance', label: 'Needs Attendance', count: outcomeCounts?.needsAttendance ?? 0 },
        { value: 'did_not_attend', label: 'Did Not Attend · Follow Up', count: outcomeCounts?.didNotAttendFollowUp ?? 0 },
        { value: 'awaiting_outcome', label: 'Awaiting Sign-Up', count: outcomeCounts?.awaitingOutcome ?? 0 },
        { value: 'signed_up', label: 'Signed Up', count: outcomeCounts?.signedUp ?? 0 },
        { value: 'did_not_sign_up', label: 'Not Interested', count: outcomeCounts?.didNotSignUp ?? 0 },
    ];

    const statusOptionsWithCounts = [
        { value: 'all', label: 'All Statuses', count: totalAggCount },
        { value: 'confirmed', label: 'Booked', count: statusCounts?.confirmed || 0 },
        { value: 'completed', label: 'Attended', count: statusCounts?.completed || 0 },
        { value: 'did_not_attend', label: 'Did Not Attend', count: statusCounts?.did_not_attend || 0 },
        { value: 'signed_up', label: 'Signed Up', count: statusCounts?.signed_up || 0 },
        { value: 'pending', label: 'Pending', count: statusCounts?.pending || 0 },
        { value: 'rescheduled', label: 'Rescheduled', count: statusCounts?.rescheduled || 0 },
        { value: 'cancelled', label: 'Cancelled', count: statusCounts?.cancelled || 0 },
    ];

    const hasActiveFilters = !!(
        searchParams.get('search') ||
        status !== 'all' ||
        fromDate ||
        toDate ||
        searchParams.get('today') ||
        (searchParams.get('outcome') && searchParams.get('outcome') !== 'all') ||
        selectedCentreId !== 'all'
    );

    const handleClearFilters = () => {
        setSearch('');
        setStatus('all');
        setFromDate('');
        setToDate('');
        setSelectedCentreId('all');
        startTransition(() => {
            router.push('/dashboard/bookings');
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    const applyFilters = (overrides?: { newSearch?: string; newStatus?: string; newFrom?: string; newTo?: string; newToday?: string; newOutcome?: string }) => {
        const params = new URLSearchParams();
        for (const key of ['summaryFrom', 'summaryTo']) {
            const value = searchParams.get(key);
            if (value) params.set(key, value);
        }
        if (selectedCentreId !== 'all') params.set('centre', selectedCentreId);
        const outcome = overrides?.newOutcome !== undefined ? overrides.newOutcome : searchParams.get('outcome');
        if (outcome && outcome !== 'all') params.set('outcome', outcome);

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
        startTransition(() => {
            router.push(`/dashboard/bookings${queryString ? `?${queryString}` : ''}`);
        });
    };

    return (
        <div className={`space-y-2.5 transition-opacity ${isPending ? 'opacity-75' : ''}`}>
            {isPending && (
                <div
                    className="fixed top-0 left-0 right-0 z-[250] h-0.5 bg-accent animate-pulse pointer-events-none"
                    aria-hidden="true"
                />
            )}
            {/* Row 1: Pipeline Stage Queue Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none py-0.5" role="group" aria-label="Filter by enrolment outcome">
                {outcomeFilterPills.map((pill) => {
                    const isActive =
                        activeOutcome === pill.value ||
                        (pill.value === 'needs_attendance' && activeOutcome === 'required') ||
                        (pill.value === 'all' && !searchParams.get('outcome'));
                    return (
                        <button
                            key={pill.value}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => {
                                setStatus('all');
                                setFromDate('');
                                setToDate('');
                                applyFilters({
                                    newOutcome: pill.value === 'all' ? '' : pill.value,
                                    newStatus: 'all',
                                    newToday: '',
                                    newFrom: '',
                                    newTo: '',
                                });
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border ${
                                isActive
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-surface text-text-secondary border-border hover:text-text hover:bg-page'
                            }`}
                        >
                            <span>{pill.label}</span>
                            <span
                                className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                                    isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-page text-text-muted'
                                }`}
                            >
                                {pill.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Row 2: Single-Line Filter & Search Bar (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 flex-wrap">
                <Button
                    type="button"
                    variant={isToday ? 'default' : 'outline'}
                    size="sm"
                    className="h-9"
                    onClick={() => applyFilters({ newToday: isToday ? '' : 'true' })}
                >
                    <Calendar className="w-3.5 h-3.5" />
                    Today
                </Button>

                <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-xs relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSearch(val);
                            if (val === '') applyFilters({ newSearch: '' });
                        }}
                        placeholder="Search bookings…"
                        aria-label="Search bookings"
                        className="w-full h-9 pl-9 pr-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                    />
                </form>

                <div className="relative">
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            applyFilters({ newStatus: val });
                        }}
                        aria-label="Filter by status"
                        className="h-9 pl-3 pr-8 rounded-sm text-sm text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors appearance-none cursor-pointer border border-border bg-surface min-w-[165px]"
                    >
                        {statusOptionsWithCounts.map((tab) => (
                            <option key={tab.value} value={tab.value}>
                                {tab.label} ({tab.count})
                            </option>
                        ))}
                    </select>
                    <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                </div>

                {centres.length > 1 && (
                    <div className="relative">
                        <select
                            value={selectedCentreId}
                            onChange={(e) => setSelectedCentreId(e.target.value)}
                            aria-label="Filter by centre"
                            className="h-9 pl-3 pr-8 rounded-sm text-sm text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors appearance-none cursor-pointer border border-border bg-surface min-w-[140px]"
                        >
                            <option value="all">All Centres</option>
                            {centres.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                    </div>
                )}

                <div className="flex items-center gap-1.5 border border-border bg-surface rounded-sm px-2 h-9">
                    <Calendar className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <input
                        type="date"
                        value={fromDate}
                        aria-label="From date"
                        onChange={(e) => {
                            const val = e.target.value;
                            setFromDate(val);
                            applyFilters({ newFrom: val });
                        }}
                        className="bg-transparent border-none text-xs text-text outline-none cursor-pointer w-[104px]"
                    />
                    <span className="text-text-muted text-xs">–</span>
                    <input
                        type="date"
                        value={toDate}
                        aria-label="To date"
                        onChange={(e) => {
                            const val = e.target.value;
                            setToDate(val);
                            applyFilters({ newTo: val });
                        }}
                        className="bg-transparent border-none text-xs text-text outline-none cursor-pointer w-[104px]"
                    />
                </div>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-9" onClick={handleClearFilters} title="Clear filters">
                        <X className="w-3.5 h-3.5" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Mobile toolbar */}
            <div className="lg:hidden flex items-center gap-2">
                <form onSubmit={handleSearch} className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSearch(val);
                            if (val === '') applyFilters({ newSearch: '' });
                        }}
                        placeholder="Search…"
                        aria-label="Search bookings"
                        className="w-full h-10 pl-9 pr-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                    />
                </form>
                <button
                    onClick={() => setIsMobileSheetOpen(true)}
                    className="relative flex items-center justify-center h-10 w-10 rounded-sm border border-border bg-surface text-text hover:bg-page transition-colors flex-shrink-0"
                    aria-label="Open filters"
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    {hasActiveFilters && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
                    )}
                </button>
            </div>

            {/* Mobile filter sheet */}
            {isMobileSheetOpen && (
                <div className="fixed inset-0 z-[200] flex justify-end flex-col lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileSheetOpen(false)} />
                    <div className="relative bg-surface border-t border-border shadow-[var(--shadow-popover)] rounded-t-lg p-5 flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-section-title text-text">Filters</h2>
                            {hasActiveFilters && (
                                <button onClick={handleClearFilters} className="text-sm font-medium text-text-secondary hover:text-text">
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="space-y-5">
                            <Button
                                type="button"
                                variant={isToday ? 'default' : 'outline'}
                                className="w-full"
                                onClick={() => {
                                    applyFilters({ newToday: isToday ? '' : 'true' });
                                    setIsMobileSheetOpen(false);
                                }}
                            >
                                <Calendar className="w-4 h-4" />
                                Show Today Only
                            </Button>

                            <div>
                                <h3 className="text-label text-text-muted mb-2">Status</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {statusOptionsWithCounts.map((tab) => (
                                        <button
                                            key={tab.value}
                                            onClick={() => {
                                                setStatus(tab.value);
                                                applyFilters({ newStatus: tab.value });
                                                setIsMobileSheetOpen(false);
                                            }}
                                            className={`flex flex-col items-start p-3 rounded-sm border text-left transition-colors ${
                                                status === tab.value
                                                    ? 'bg-page border-accent text-text'
                                                    : 'bg-surface border-border text-text-secondary hover:text-text'
                                            }`}
                                        >
                                            <span className="text-sm font-medium">{tab.label}</span>
                                            <span className="text-metadata mt-0.5">{tab.count} bookings</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {centres.length > 1 && (
                                <div>
                                    <h3 className="text-label text-text-muted mb-2">Centre</h3>
                                    <select
                                        value={selectedCentreId}
                                        onChange={(e) => {
                                            setSelectedCentreId(e.target.value);
                                            setIsMobileSheetOpen(false);
                                        }}
                                        className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-sm text-text outline-none"
                                    >
                                        <option value="all">All Centres</option>
                                        {centres.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <h3 className="text-label text-text-muted mb-2">Date Range</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-metadata text-text-secondary">From</label>
                                        <input
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFromDate(val);
                                                applyFilters({ newFrom: val });
                                            }}
                                            className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-sm text-text outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-metadata text-text-secondary">To</label>
                                        <input
                                            type="date"
                                            value={toDate}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setToDate(val);
                                                applyFilters({ newTo: val });
                                            }}
                                            className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-sm text-text outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button className="w-full mt-6" onClick={() => setIsMobileSheetOpen(false)}>
                            View {resultsCount} Results
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
