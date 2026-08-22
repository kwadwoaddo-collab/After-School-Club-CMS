'use client';

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

/**
 * Milestone 2 Correction Pass: previously a tall, three-row stack of
 * `rounded-full`/`shadow-inner` pills on legacy shadcn tokens (bg-secondary,
 * text-muted-foreground, text-primary/80) — a heavy "feature card" treatment
 * InvoiceFlow would never use for a date filter. Rebuilt as a single compact
 * application toolbar: flat segmented control + icon-button date nav, using
 * the CMS's actual design tokens and InvoiceFlow's control geometry
 * (rounded-md, h-8/h-9 controls, accent-only interactive colour — no
 * standalone rounded container, no blue/teal mix). All filter functionality
 * (view toggle, prev/next navigation, quick filters, today) is unchanged.
 */
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
    <div className="flex flex-col items-end gap-2">
      {/* View toggle + date nav */}
      <div className="flex items-center gap-2">
        {/* View Toggle — flat segmented control */}
        <div className="flex items-center rounded-md border border-border bg-page p-0.5">
          <button
            suppressHydrationWarning
            onClick={() => handleViewChange('weekly')}
            className={`px-3 h-7 text-xs font-medium rounded-sm transition-colors ${
              currentView === 'weekly'
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
              currentView === 'monthly'
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
      <div className="flex flex-wrap items-center gap-1.5">
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
