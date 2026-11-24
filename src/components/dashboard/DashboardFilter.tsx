'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import {
  addWeeks, subWeeks, addMonths, subMonths,
  parseISO, isValid,
} from 'date-fns';

interface DashboardFilterProps {
  currentView: 'weekly' | 'monthly';
  currentDateIso: string;
  dateLabel: string;
}

type QuickFilter = 'this-week' | 'last-week' | 'this-month' | 'last-month';

export function DashboardFilter({ currentView, currentDateIso, dateLabel }: DashboardFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticView, setOptimisticView] = useState<'weekly' | 'monthly'>(currentView);

  useEffect(() => {
    setOptimisticView(currentView);
  }, [currentView]);

  const handleViewChange = (view: 'weekly' | 'monthly') => {
    setOptimisticView(view);
    const params = new URLSearchParams(searchParams);
    params.set('view', view);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    const dateObj = parseISO(currentDateIso);
    if (!isValid(dateObj)) return;

    let newDate: Date;
    if (optimisticView === 'weekly') {
      newDate = direction === 'prev' ? subWeeks(dateObj, 1) : addWeeks(dateObj, 1);
    } else {
      newDate = direction === 'prev' ? subMonths(dateObj, 1) : addMonths(dateObj, 1);
    }

    const params = new URLSearchParams(searchParams);
    params.set('date', newDate.toISOString());
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const goToToday = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('date');
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    const now = new Date();
    const params = new URLSearchParams(searchParams);

    switch (filter) {
      case 'this-week':
        setOptimisticView('weekly');
        params.set('view', 'weekly');
        params.delete('date');
        break;
      case 'last-week':
        setOptimisticView('weekly');
        params.set('view', 'weekly');
        params.set('date', subWeeks(now, 1).toISOString());
        break;
      case 'this-month':
        setOptimisticView('monthly');
        params.set('view', 'monthly');
        params.delete('date');
        break;
      case 'last-month':
        setOptimisticView('monthly');
        params.set('view', 'monthly');
        params.set('date', subMonths(now, 1).toISOString());
        break;
    }

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: 'this-week', label: 'This Week' },
    { id: 'last-week', label: 'Last Week' },
    { id: 'this-month', label: 'This Month' },
    { id: 'last-month', label: 'Last Month' },
  ];

  return (
    <div className={`flex flex-col items-end gap-2 max-w-full transition-opacity ${isPending ? 'opacity-70' : ''}`}>
      {isPending && (
        <div
          className="fixed top-0 left-0 right-0 z-[250] h-0.5 bg-accent animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
      {/* View toggle + date nav — wraps cleanly at 360px */}
      <div className="flex flex-wrap items-center justify-end gap-2 max-w-full">
        {/* View Toggle — flat segmented control */}
        <div className="flex items-center rounded-md border border-border bg-page p-0.5">
          <button
            suppressHydrationWarning
            onClick={() => handleViewChange('weekly')}
            className={`px-3 h-7 text-xs font-medium rounded-sm transition-colors ${
              optimisticView === 'weekly'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            Weekly
          </button>
          <button
            suppressHydrationWarning
            onClick={() => handleViewChange('monthly')}
            className={`px-3 h-7 text-xs font-medium rounded-sm transition-colors ${
              optimisticView === 'monthly'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center rounded-md border border-border bg-page">
          <button
            suppressHydrationWarning
            onClick={() => handleNavigate('prev')}
            className="flex items-center justify-center size-7 text-text-secondary hover:text-text hover:bg-surface rounded-sm transition-colors"
            title="Previous"
            aria-label="Previous period"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            <Calendar className="size-3.5 text-text-muted" aria-hidden="true" />
            <span className="text-xs font-medium text-text min-w-[100px] text-center">
              {dateLabel}
            </span>
          </div>
          <button
            suppressHydrationWarning
            onClick={() => handleNavigate('next')}
            className="flex items-center justify-center size-7 text-text-secondary hover:text-text hover:bg-surface rounded-sm transition-colors"
            title="Next"
            aria-label="Next period"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <button
          suppressHydrationWarning
          onClick={goToToday}
          className="h-7 px-2 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
        >
          Today
        </button>
      </div>

      {/* Quick filter pills */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-full">
        {quickFilters.map(qf => (
          <button
            key={qf.id}
            suppressHydrationWarning
            onClick={() => handleQuickFilter(qf.id)}
            className="px-2.5 h-6 text-xs font-medium rounded-sm border border-border text-text-secondary hover:text-accent hover:border-accent/40 hover:bg-accent-soft transition-colors"
          >
            {qf.label}
          </button>
        ))}
      </div>
    </div>
  );
}
