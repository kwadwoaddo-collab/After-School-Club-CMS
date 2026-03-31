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
            <div className="flex items-center p-1 rounded-xl bg-[#2a2a2a] border border-[#424754]/30">
                <button
                    suppressHydrationWarning
                    onClick={() => handleViewChange('weekly')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        currentView === 'weekly'
                            ? 'bg-[#1a1d23] text-[#e5e2e1] shadow-sm border border-[#424754]/50'
                            : 'text-[#8c909f] hover:text-[#e5e2e1]'
                    }`}
                >
                    Weekly
                </button>
                <button
                    suppressHydrationWarning
                    onClick={() => handleViewChange('monthly')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        currentView === 'monthly'
                            ? 'bg-[#1a1d23] text-[#e5e2e1] shadow-sm border border-[#424754]/50'
                            : 'text-[#8c909f] hover:text-[#e5e2e1]'
                    }`}
                >
                    Monthly
                </button>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
                <div className="flex items-center p-1 rounded-xl bg-[#2a2a2a] border border-[#424754]/30">
                    <button
                        suppressHydrationWarning
                        onClick={() => handleNavigate('prev')}
                        className="p-1.5 text-[#8c909f] hover:text-[#e5e2e1] hover:bg-[#353535] rounded-lg transition-colors"
                        title="Previous"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 px-3">
                        <Calendar className="w-3.5 h-3.5 text-[#adc6ff]" />
                        <span className="text-sm font-bold text-[#e5e2e1] min-w-[120px] text-center">
                            {dateLabel}
                        </span>
                    </div>
                    <button
                        suppressHydrationWarning
                        onClick={() => handleNavigate('next')}
                        className="p-1.5 text-[#8c909f] hover:text-[#e5e2e1] hover:bg-[#353535] rounded-lg transition-colors"
                        title="Next"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                
                <button 
                    suppressHydrationWarning
                    onClick={goToToday}
                    className="text-xs font-bold text-[#8c909f] hover:text-[#e5e2e1] underline-offset-4 hover:underline transition-colors"
                >
                    Today
                </button>
            </div>
        </div>
    );
}
