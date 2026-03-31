'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { addWeeks, subWeeks, addMonths, subMonths, format, parseISO, isValid } from 'date-fns';

interface DashboardFilterProps {
    currentView: 'weekly' | 'monthly';
    currentDateIso: string;
    dateLabel: string;
}

export function DashboardFilter({ currentView, currentDateIso, dateLabel }: DashboardFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleViewChange = (view: 'weekly' | 'monthly') => {
        const params = new URLSearchParams(searchParams);
        params.set('view', view);
        // We keep the same date, so switching views stays around the same time
        router.push(`?${params.toString()}`);
    };

    const handleNavigate = (direction: 'prev' | 'next') => {
        const dateObj = parseISO(currentDateIso);
        if (!isValid(dateObj)) return;

        let newDate: Date;
        if (currentView === 'weekly') {
            newDate = direction === 'prev' ? subWeeks(dateObj, 1) : addWeeks(dateObj, 1);
        } else {
            newDate = direction === 'prev' ? subMonths(dateObj, 1) : addMonths(dateObj, 1);
        }

        const params = new URLSearchParams(searchParams);
        params.set('date', newDate.toISOString());
        router.push(`?${params.toString()}`);
    };

    const goToToday = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('date');
        router.push(`?${params.toString()}`);
    }

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-surface-container-low border border-outline-variant/10">
                <button
                    suppressHydrationWarning
                    onClick={() => handleViewChange('weekly')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        currentView === 'weekly'
                            ? 'bg-surface-container-high text-white shadow-sm border border-outline-variant/50'
                            : 'text-on-surface-variant hover:text-white'
                    }`}
                >
                    Weekly
                </button>
                <button
                    suppressHydrationWarning
                    onClick={() => handleViewChange('monthly')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        currentView === 'monthly'
                            ? 'bg-surface-container-high text-white shadow-sm border border-outline-variant/50'
                            : 'text-on-surface-variant hover:text-white'
                    }`}
                >
                    Monthly
                </button>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <button
                        suppressHydrationWarning
                        onClick={() => handleNavigate('prev')}
                        className="p-1.5 text-on-surface-variant hover:text-white hover:bg-surface-bright rounded-lg transition-colors"
                        title="Previous"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 px-3">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-bold text-white min-w-[120px] text-center">
                            {dateLabel}
                        </span>
                    </div>
                    <button
                        suppressHydrationWarning
                        onClick={() => handleNavigate('next')}
                        className="p-1.5 text-on-surface-variant hover:text-white hover:bg-surface-bright rounded-lg transition-colors"
                        title="Next"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                
                <button 
                    suppressHydrationWarning
                    onClick={goToToday}
                    className="text-xs font-bold text-on-surface-variant hover:text-white underline-offset-4 hover:underline transition-colors"
                >
                    Today
                </button>
            </div>
        </div>
    );
}
