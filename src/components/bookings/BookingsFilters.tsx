'use client';

import { useState } from 'react';
import { Search, Filter, Calendar, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface BookingsFiltersProps {
    centres: { id: string; name: string }[];
}

export default function BookingsFilters({ centres }: BookingsFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const [centreId, setCentreId] = useState(searchParams.get('centre') || 'all');

    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
    ];

    const hasActiveFilters = search || status !== 'all' || centreId !== 'all';

    const handleClearFilters = () => {
        setSearch('');
        setStatus('all');
        setCentreId('all');
        router.push('/dashboard/bookings');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    const applyFilters = (overrides?: { newSearch?: string; newStatus?: string; newCentre?: string }) => {
        const params = new URLSearchParams();
        
        const currentSearch = overrides?.newSearch !== undefined ? overrides.newSearch : search;
        if (currentSearch) params.set('search', currentSearch);
        
        const currentStatus = overrides?.newStatus !== undefined ? overrides.newStatus : status;
        if (currentStatus !== 'all') params.set('status', currentStatus);
        
        const currentCentre = overrides?.newCentre !== undefined ? overrides.newCentre : centreId;
        if (currentCentre !== 'all') params.set('centre', currentCentre);

        const queryString = params.toString();
        router.push(`/dashboard/bookings${queryString ? `?${queryString}` : ''}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex-1 min-w-[280px]">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search students, bookings..."
                            className="w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                        />
                    </div>
                </form>

                {/* Status Filter */}
                <div className="relative min-w-[160px]">
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            applyFilters({ newStatus: val });
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    >
                        {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Centre Filter */}
                <div className="relative min-w-[180px]">
                    <select
                        value={centreId}
                        onChange={(e) => {
                            const val = e.target.value;
                            setCentreId(val);
                            applyFilters({ newCentre: val });
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none appearance-none cursor-pointer"
                        style={{ backgroundColor: '#14161b', color: '#ffffff', borderColor: '#2a2a2a' }}
                    >
                        <option value="all">All Centres</option>
                        {centres.map(centre => (
                            <option key={centre.id} value={centre.id}>
                                {centre.name}
                            </option>
                        ))}
                    </select>
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2d35] hover:bg-[#343843] rounded-2xl text-sm font-semibold text-[#FFFFFF] transition-all"
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
                    {search && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                            Search: "{search}"
                        </span>
                    )}
                    {status !== 'all' && (
                        <span className="px-3 py-1 bg-accent-violet/10 text-accent-violet text-xs font-semibold rounded-full">
                            Status: {statusOptions.find(s => s.value === status)?.label}
                        </span>
                    )}
                    {centreId !== 'all' && (
                        <span className="px-3 py-1 bg-accent-cyan/10 text-accent-cyan text-xs font-semibold rounded-full">
                            Centre: {centres.find(c => c.id === centreId)?.name}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
