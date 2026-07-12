'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar, Zap } from 'lucide-react';
import {
  addWeeks, subWeeks, addMonths, subMonths,
  format, parseISO, isValid,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subDays,
} from 'date-fns';
import { cn } from '@/components/ui/utils';

interface DashboardFilterProps {
  currentView: 'weekly' | 'monthly';
  currentDateIso: string;
  dateLabel: string;
}

type QuickFilter = 'this-week' | 'last-week' | 'this-month' | 'last-month';

export function DashboardFilter({ currentView, currentDateIso, dateLabel }: DashboardFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewChange = (view: 'weekly' | 'monthly') => {
    const params = new URLSearchParams(searchParams);
    params.set('view', view);
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
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    const now = new Date();
    const params = new URLSearchParams(searchParams);

    switch (filter) {
      case 'this-week':
        params.set('view', 'weekly');
        params.delete('date');
        break;
      case 'last-week':
        params.set('view', 'weekly');
        params.set('date', subWeeks(now, 1).toISOString());
        break;
      case 'this-month':
        params.set('view', 'monthly');
        params.delete('date');
        break;
      case 'last-month':
        params.set('view', 'monthly');
        params.set('date', subMonths(now, 1).toISOString());
        break;
    }

    router.push(`?${params.toString()}`);
  };

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: 'this-week', label: 'This Week' },
    { id: 'last-week', label: 'Last Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'last-month', label: 'Last Month' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Quick filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
        {quickFilters.map(qf => (
          <button
            key={qf.id}
            suppressHydrationWarning
            onClick={() => handleQuickFilter(qf.id)}
            className="px-3 py-1 text-[10px] font-bold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/30 transition-all"
          >
            {qf.label}
          </button>
        ))}
      </div>

      {/* View toggle + date nav */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-secondary border border-border">
          <button
            suppressHydrationWarning
            onClick={() => handleViewChange('weekly')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              currentView === 'weekly'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Weekly
          </button>
          <button
            suppressHydrationWarning
            onClick={() => handleViewChange('monthly')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              currentView === 'monthly'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-secondary border border-border">
            <button
              suppressHydrationWarning
              onClick={() => handleNavigate('prev')}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-bold text-foreground min-w-[120px] text-center">
                {dateLabel}
              </span>
            </div>
            <button
              suppressHydrationWarning
              onClick={() => handleNavigate('next')}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            suppressHydrationWarning
            onClick={goToToday}
            className="text-xs font-bold text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
}
