'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonthsYm,
  formatMonthShortOnly,
  formatPenceToGBP,
  formatSignedPenceDelta,
  type CashReceiptsLedgerResult,
  type CashReceiptsWeekRow,
  type PeriodComparison,
} from '../domain/cash-receipts-ledger';
import { formatInvoiceDate } from '../domain/invoice-display';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function shortCentreName(fullName: string): string {
  const cleaned = fullName.replace(/\s+After\s+School\s+Club$/i, '').trim();
  return cleaned || fullName;
}

function formatPaymentMethod(method: string): string {
  switch (method) {
    case 'bank_transfer':
      return 'Bank transfer';
    case 'tax_free_childcare':
      return 'Tax-Free Childcare';
    case 'cash':
      return 'Cash';
    case 'voucher':
      return 'Childcare voucher';
    case 'stripe':
      return 'Card (Stripe)';
    case 'gocardless':
      return 'Direct Debit';
    default:
      return method.replace(/_/g, ' ');
  }
}

function DeltaBadge({ comparison }: { comparison: PeriodComparison }) {
  if (comparison.comparisonStatus === 'insufficient_history') {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
        Baseline building
      </span>
    );
  }

  if (comparison.comparisonStatus === 'zero_prior_base') {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground tabular-nums">
        £0 prior base
      </span>
    );
  }

  const pct = comparison.deltaPercent ?? 0;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const absPct = Math.abs(pct).toFixed(1);

  const toneClass =
    pct > 0
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : pct < 0
        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
        : 'bg-secondary text-muted-foreground';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${toneClass}`}
    >
      {sign}
      {absPct}%
    </span>
  );
}

export interface CashReceiptsOwnerViewProps {
  ledger: CashReceiptsLedgerResult;
}

export default function CashReceiptsOwnerView({ ledger }: CashReceiptsOwnerViewProps) {
  // Default-expand the current live week (or most recent week with payments)
  const defaultExpandedWeek =
    ledger.weeks.find((w) => w.state === 'current' && w.fullWeekCount > 0)?.weekNumber ??
    [...ledger.weeks].reverse().find((w) => w.fullWeekCount > 0)?.weekNumber ??
    null;

  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>(
    defaultExpandedWeek ? { [defaultExpandedWeek]: true } : {}
  );
  // Scope toggle for boundary weeks: 'in_month' vs 'full_week'
  const [boundaryScope, setBoundaryScope] = useState<Record<number, 'in_month' | 'full_week'>>({});

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks((prev) => ({ ...prev, [weekNumber]: !prev[weekNumber] }));
  };

  const getWeekScope = (week: CashReceiptsWeekRow): 'in_month' | 'full_week' => {
    if (!week.isBoundaryStart && !week.isBoundaryEnd) return 'in_month';
    return boundaryScope[week.weekNumber] ?? 'in_month';
  };

  const buildCashflowHref = (overrides: { centre?: string; month?: string }) => {
    const centre = overrides.centre ?? ledger.activeCentreId;
    const month = overrides.month ?? ledger.selectedMonth;
    const params = new URLSearchParams();
    params.set('view', 'cashflow');
    if (centre && centre !== 'all') {
      params.set('centre', centre);
    }
    if (month) {
      params.set('month', month);
    }
    return `/dashboard/finance?${params.toString()}`;
  };

  const prevMonth = addMonthsYm(ledger.selectedMonth, -1);
  const nextMonth = addMonthsYm(ledger.selectedMonth, 1);
  const canGoNextMonth = nextMonth <= ledger.currentMonth;
  const showCentreColumns = ledger.activeCentreId === 'all' && ledger.centreSummaries.length > 0;
  const totalTableColumns = 5 + (showCentreColumns ? ledger.centreSummaries.length : 0);

  return (
    <div className="space-y-8">
      {/* 1. Top Control Bar: Centre Switcher Pills + Month Selector */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Centre cashflow filter" className="flex flex-wrap items-center gap-2">
          <Link
            href={buildCashflowHref({ centre: 'all' })}
            aria-current={ledger.activeCentreId === 'all' ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${focusRing} ${
              ledger.activeCentreId === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-secondary'
            }`}
          >
            <span>All Centres</span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                ledger.activeCentreId === 'all'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {formatPenceToGBP(ledger.allCentresMonthTotalPence)}
            </span>
          </Link>

          {ledger.centreSummaries.map((centre) => {
            const isSelected = ledger.activeCentreId === centre.centreId;
            return (
              <Link
                key={centre.centreId}
                href={buildCashflowHref({ centre: centre.centreId })}
                aria-current={isSelected ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${focusRing} ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-secondary'
                }`}
              >
                <span>{centre.centreName}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {formatPenceToGBP(centre.monthPence)}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildCashflowHref({ month: prevMonth })}
            aria-label={`Previous month (${prevMonth})`}
            className={`inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary ${focusRing}`}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span>Prev</span>
          </Link>

          <div
            role="group"
            aria-label="Quick month selector"
            className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1"
          >
            {ledger.availableMonths.slice(0, 6).map((m) => {
              const active = m.yearMonth === ledger.selectedMonth;
              return (
                <Link
                  key={m.yearMonth}
                  href={buildCashflowHref({ month: m.yearMonth })}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${focusRing} ${
                    active
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.shortLabel}
                </Link>
              );
            })}
          </div>

          {canGoNextMonth ? (
            <Link
              href={buildCashflowHref({ month: nextMonth })}
              aria-label={`Next month (${nextMonth})`}
              className={`inline-flex min-h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary ${focusRing}`}
            >
              <span>Next</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-10 cursor-not-allowed items-center gap-1 rounded-xl border border-border bg-card/50 px-3 py-2 text-sm font-medium text-muted-foreground/50"
            >
              <span>Next</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </span>
          )}

          {!ledger.isViewingCurrentMonth && (
            <Link
              href={buildCashflowHref({ month: ledger.currentMonth })}
              className={`inline-flex min-h-10 items-center rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 ${focusRing}`}
            >
              Jump to current month
            </Link>
          )}
        </div>
      </div>

      {/* 2. 4-Column Divided Executive Ledger Strip */}
      <dl
        aria-label="Executive cashflow summary"
        className="grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-card md:grid-cols-2 md:divide-y-0 lg:grid-cols-4 lg:divide-x"
      >
        {/* Column 1: This Week (Mon–Sun) */}
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm font-medium text-muted-foreground">This Week (Mon–Sun)</dt>
              <DeltaBadge comparison={ledger.thisWeekVsLastWeek} />
            </div>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatPenceToGBP(ledger.thisWeekVsLastWeek.currentPence)}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {ledger.thisWeekVsLastWeek.currentPeriodLabel} ·{' '}
              {ledger.thisWeekVsLastWeek.currentCount} verified payment
              {ledger.thisWeekVsLastWeek.currentCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
            {ledger.thisWeekVsLastWeek.comparisonStatus === 'insufficient_history' ? (
              <span>Prior week ({ledger.thisWeekVsLastWeek.priorPeriodLabel}) predates records</span>
            ) : (
              <span>
                {formatSignedPenceDelta(ledger.thisWeekVsLastWeek.deltaPence)} vs last week (
                {ledger.thisWeekVsLastWeek.priorPeriodLabel}:{' '}
                {formatPenceToGBP(ledger.thisWeekVsLastWeek.priorPence)})
              </span>
            )}
          </div>
        </div>

        {/* Column 2: [Month] Rolling Tally */}
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm font-medium text-muted-foreground">
                {ledger.selectedMonthLabel} Tally
              </dt>
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground tabular-nums">
                {ledger.monthPaymentCount} payment{ledger.monthPaymentCount === 1 ? '' : 's'}
              </span>
            </div>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatPenceToGBP(ledger.monthTotalPence)}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground">
              {ledger.isViewingCurrentMonth
                ? `Month-to-date cash received (${ledger.activeCentreName})`
                : `Completed calendar month (${ledger.activeCentreName})`}
            </p>
          </div>

          {ledger.activeCentreId === 'all' && ledger.centreSummaries.length > 1 ? (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <div
                aria-hidden="true"
                className="flex h-2 w-full overflow-hidden rounded-full bg-secondary"
              >
                {ledger.centreSummaries.map((c, idx) => (
                  <div
                    key={c.centreId}
                    style={{ width: `${c.sharePercent}%` }}
                    className={idx === 0 ? 'bg-primary' : 'bg-emerald-500'}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {ledger.centreSummaries.map((c, idx) => (
                  <Fragment key={c.centreId}>
                    {idx > 0 && ' · '}
                    <span className="font-medium text-foreground">
                      {shortCentreName(c.centreName)}
                    </span>{' '}
                    {formatPenceToGBP(c.monthPence)} ({c.sharePercent}%)
                  </Fragment>
                ))}
              </p>
            </div>
          ) : (
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
              All centres in {ledger.selectedMonthShortLabel}:{' '}
              <span className="font-medium text-foreground">
                {formatPenceToGBP(ledger.allCentresMonthTotalPence)}
              </span>{' '}
              ({ledger.allCentresMonthPaymentCount} payments)
            </div>
          )}
        </div>

        {/* Column 3: Month-on-Month (MoM) */}
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm font-medium text-muted-foreground">
                {ledger.momComparison.mode === 'mtd_same_day'
                  ? 'Month-on-Month (MTD Pace)'
                  : 'Month-on-Month (MoM)'}
              </dt>
              <DeltaBadge comparison={ledger.momComparison} />
            </div>

            {ledger.momComparison.comparisonStatus === 'insufficient_history' ? (
              <>
                <dd className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  No prior month baseline
                </dd>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Records start {ledger.firstRecordedMonthLabel ?? 'this month'}
                </p>
              </>
            ) : (
              <>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
                  {formatSignedPenceDelta(ledger.momComparison.deltaPence)}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {ledger.momComparison.comparisonRangeLabel}
                </p>
              </>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
            Prior pace ({ledger.momComparison.priorPeriodLabel}):{' '}
            <span className="font-medium text-foreground">
              {formatPenceToGBP(ledger.momComparison.priorPence)}
            </span>
            {ledger.momComparison.mode === 'mtd_same_day' && (
              <>
                {' · '}Full {ledger.momComparison.fullPriorPeriodLabel}:{' '}
                <span className="font-medium text-foreground">
                  {formatPenceToGBP(ledger.momComparison.fullPriorPeriodPence)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Column 4: Year-on-Year (YoY) */}
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm font-medium text-muted-foreground">Year-on-Year (YoY)</dt>
              <DeltaBadge comparison={ledger.yoyComparison} />
            </div>

            {ledger.yoyComparison.comparisonStatus === 'insufficient_history' ? (
              <>
                <dd className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Baseline building — records start {ledger.firstRecordedMonthLabel ?? 'recently'}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ledger.yoyComparison.fullPriorPeriodLabel} predates the earliest verified payment
                  in the ledger.
                </p>
              </>
            ) : (
              <>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
                  {formatSignedPenceDelta(ledger.yoyComparison.deltaPence)}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {ledger.yoyComparison.comparisonRangeLabel}
                </p>
              </>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
            {ledger.yoyComparison.comparisonStatus === 'insufficient_history' ? (
              <span>YoY % comparison activates automatically at 12 months of history</span>
            ) : (
              <span>
                Prior year ({ledger.yoyComparison.priorPeriodLabel}):{' '}
                <span className="font-medium text-foreground">
                  {formatPenceToGBP(ledger.yoyComparison.priorPence)}
                </span>
              </span>
            )}
          </div>
        </div>
      </dl>

      {/* 3. Weekly Cash Received & Rolling Tally Table (Mon–Sun Weeks) */}
      <section aria-labelledby="weekly-cash-heading" className="space-y-3">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
          <h2
            id="weekly-cash-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Weekly cash received & rolling tally — {ledger.selectedMonthLabel}
          </h2>
          <p className="text-sm text-muted-foreground">
            Monday–Sunday weeks. Boundary weeks clip days outside {ledger.selectedMonthShortLabel}{' '}
            so the monthly rolling tally never double-counts across months.
          </p>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="weekly-cash-heading"
          className="overflow-x-auto rounded-2xl border border-border bg-card"
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Weekly Monday to Sunday cash received and rolling monthly tally for{' '}
              {ledger.selectedMonthLabel}
            </caption>
            <thead className="sticky top-0 z-10 border-b border-border bg-secondary/70 backdrop-blur-xs">
              <tr>
                <th scope="col" className="px-4 py-3.5 font-medium text-muted-foreground">
                  Week (Mon–Sun)
                </th>
                {showCentreColumns &&
                  ledger.centreSummaries.map((c) => (
                    <th
                      key={c.centreId}
                      scope="col"
                      title={c.centreName}
                      className="px-4 py-3.5 text-right font-medium text-muted-foreground"
                    >
                      {shortCentreName(c.centreName)}
                    </th>
                  ))}
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Received in {ledger.selectedMonthShortLabel}
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Full Mon–Sun Week
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Rolling {ledger.selectedMonthShortLabel} Tally
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Payments
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ledger.weeks.map((week) => {
                const isExpanded = Boolean(expandedWeeks[week.weekNumber]);
                const scope = getWeekScope(week);
                const visiblePayments =
                  scope === 'in_month'
                    ? week.payments.filter((p) => p.inSelectedMonth)
                    : week.payments;
                const isBoundary = week.isBoundaryStart || week.isBoundaryEnd;

                return (
                  <Fragment key={week.weekKey}>
                    <tr
                      className={
                        week.state === 'current'
                          ? 'bg-primary/5 transition-colors hover:bg-primary/10'
                          : week.state === 'upcoming'
                            ? 'bg-card/60 text-muted-foreground transition-colors hover:bg-secondary/30'
                            : 'bg-card transition-colors hover:bg-secondary/30'
                      }
                    >
                      <th
                        scope="row"
                        className="px-4 py-4 font-medium text-foreground align-top whitespace-nowrap"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            Week {week.weekNumber}: {week.weekRangeLabel}
                          </span>
                          {week.state === 'current' && (
                            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                              Current week
                            </span>
                          )}
                          {week.state === 'upcoming' && (
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              Upcoming
                            </span>
                          )}
                        </div>
                        {week.isBoundaryStart && (
                          <p className="mt-1 text-xs font-normal text-muted-foreground tabular-nums">
                            Spills from {week.spillBeforeMonthLabel} · {week.inMonthDays} day
                            {week.inMonthDays === 1 ? '' : 's'} in {ledger.selectedMonthShortLabel}{' '}
                            ({week.clippedRangeLabel})
                          </p>
                        )}
                        {week.isBoundaryEnd && (
                          <p className="mt-1 text-xs font-normal text-muted-foreground tabular-nums">
                            Spills into {week.spillAfterMonthLabel} · {week.inMonthDays} day
                            {week.inMonthDays === 1 ? '' : 's'} in {ledger.selectedMonthShortLabel}{' '}
                            ({week.clippedRangeLabel})
                          </p>
                        )}
                      </th>

                      {showCentreColumns &&
                        week.byCentre.map((c) => (
                          <td
                            key={c.centreId}
                            className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap"
                          >
                            <span
                              className={
                                c.inMonthPence > 0
                                  ? 'font-medium text-foreground'
                                  : 'text-muted-foreground'
                              }
                            >
                              {formatPenceToGBP(c.inMonthPence)}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {c.inMonthCount} payment{c.inMonthCount === 1 ? '' : 's'}
                            </span>
                          </td>
                        ))}

                      <td className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap">
                        <span
                          className={`text-base font-semibold ${
                            week.inMonthPence > 0 ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {formatPenceToGBP(week.inMonthPence)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {week.inMonthCount} payment{week.inMonthCount === 1 ? '' : 's'} in{' '}
                          {ledger.selectedMonthShortLabel}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap">
                        <span className="font-medium text-foreground">
                          {formatPenceToGBP(week.fullWeekPence)}
                        </span>
                        {week.isBoundaryStart && week.spillBeforePence > 0 ? (
                          <span className="block text-xs text-amber-800 dark:text-amber-200">
                            incl. {formatPenceToGBP(week.spillBeforePence)} in{' '}
                            {week.spillBeforeMonthLabel}
                          </span>
                        ) : week.isBoundaryEnd && week.spillAfterPence > 0 ? (
                          <span className="block text-xs text-amber-800 dark:text-amber-200">
                            incl. {formatPenceToGBP(week.spillAfterPence)} in{' '}
                            {week.spillAfterMonthLabel}
                          </span>
                        ) : isBoundary ? (
                          <span className="block text-xs text-muted-foreground">
                            7-day Mon–Sun ({formatPenceToGBP(0)} outside{' '}
                            {ledger.selectedMonthShortLabel})
                          </span>
                        ) : (
                          <span className="block text-xs text-muted-foreground">
                            7-day Mon–Sun total
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap">
                        <span className="text-base font-semibold text-foreground">
                          {formatPenceToGBP(week.rollingMonthTallyPence)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {week.rollingMonthPaymentCount} cumulative in{' '}
                          {ledger.selectedMonthShortLabel}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.weekNumber)}
                          aria-expanded={isExpanded}
                          aria-controls={`week-drilldown-${week.weekNumber}`}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${focusRing} ${
                            week.fullWeekCount > 0
                              ? 'border-border bg-card text-primary hover:bg-secondary'
                              : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-secondary/50'
                          }`}
                        >
                          <span>
                            {week.fullWeekCount > 0
                              ? `${isExpanded ? 'Hide' : 'View'} ${week.fullWeekCount} payment${
                                  week.fullWeekCount === 1 ? '' : 's'
                                }`
                              : '0 payments'}
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-3.5 w-3.5 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr id={`week-drilldown-${week.weekNumber}`} className="bg-secondary/25">
                        <td colSpan={totalTableColumns} className="px-4 py-4 sm:px-6">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                                Verified payments in Week {week.weekNumber} ({week.weekRangeLabel})
                              </p>

                              {isBoundary && (
                                <div
                                  role="group"
                                  aria-label={`Boundary week ${week.weekNumber} payment scope`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1"
                                >
                                  <button
                                    type="button"
                                    aria-pressed={scope === 'in_month'}
                                    onClick={() =>
                                      setBoundaryScope((prev) => ({
                                        ...prev,
                                        [week.weekNumber]: 'in_month',
                                      }))
                                    }
                                    className={`rounded-md px-2.5 py-1 text-xs font-medium tabular-nums ${focusRing} ${
                                      scope === 'in_month'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    Only days in {ledger.selectedMonthShortLabel} ({week.inMonthCount})
                                  </button>
                                  <button
                                    type="button"
                                    aria-pressed={scope === 'full_week'}
                                    onClick={() =>
                                      setBoundaryScope((prev) => ({
                                        ...prev,
                                        [week.weekNumber]: 'full_week',
                                      }))
                                    }
                                    className={`rounded-md px-2.5 py-1 text-xs font-medium tabular-nums ${focusRing} ${
                                      scope === 'full_week'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    All 7 days Mon–Sun ({week.fullWeekCount})
                                  </button>
                                </div>
                              )}
                            </div>

                            {visiblePayments.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">
                                {isBoundary && scope === 'in_month' && week.fullWeekCount > 0
                                  ? `No payments recorded on the ${ledger.selectedMonthShortLabel} day(s) of this boundary week. Switch to "All 7 days Mon–Sun" to inspect the ${week.fullWeekCount} payment(s) recorded in the adjacent month.`
                                  : 'No verified payments recorded during this week.'}
                              </p>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                                  <thead>
                                    <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                                      <th scope="col" className="px-3 py-2.5 font-medium">
                                        Date recorded
                                      </th>
                                      <th scope="col" className="px-3 py-2.5 font-medium">
                                        Parent
                                      </th>
                                      <th scope="col" className="px-3 py-2.5 font-medium">
                                        Student(s)
                                      </th>
                                      <th scope="col" className="px-3 py-2.5 font-medium">
                                        Centre
                                      </th>
                                      <th scope="col" className="px-3 py-2.5 font-medium">
                                        Invoice
                                      </th>
                                      <th scope="col" className="px-3 py-2.5 font-medium">
                                        Method
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2.5 text-right font-medium"
                                      >
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {visiblePayments.map((payment) => (
                                      <tr key={payment.id} className="hover:bg-secondary/20">
                                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                                          <span className="font-medium text-foreground">
                                            {formatInvoiceDate(payment.businessDate)}
                                          </span>
                                          {!payment.inSelectedMonth && (
                                            <span className="ml-2 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                              {formatMonthShortOnly(payment.businessDate)} tally
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <Link
                                            href={`/dashboard/parents/${payment.parentId}`}
                                            className={`font-medium text-primary hover:underline ${focusRing}`}
                                          >
                                            {payment.parentName}
                                          </Link>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {payment.students.length > 0 ? (
                                            <span className="flex flex-wrap gap-x-2 gap-y-1">
                                              {payment.students.map((s, idx) => (
                                                <Fragment key={s.id}>
                                                  {idx > 0 && (
                                                    <span className="text-muted-foreground">·</span>
                                                  )}
                                                  <Link
                                                    href={`/dashboard/students/${s.id}`}
                                                    className={`text-primary hover:underline ${focusRing}`}
                                                  >
                                                    {s.name}
                                                  </Link>
                                                </Fragment>
                                              ))}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              See invoice
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                          {shortCentreName(payment.centreName)}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                          <Link
                                            href={`/dashboard/finance/invoices/${payment.invoiceId}`}
                                            className={`font-medium text-primary hover:underline ${focusRing}`}
                                          >
                                            {payment.invoiceNumber}
                                          </Link>
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                          {formatPaymentMethod(payment.method)}
                                          {payment.transactionReference && (
                                            <span className="ml-1.5 text-xs text-muted-foreground/80">
                                              ({payment.transactionReference})
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                                          {formatPenceToGBP(payment.amountPence)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-secondary/40 font-semibold text-foreground">
              <tr>
                <th scope="row" className="px-4 py-3.5 text-left">
                  {ledger.selectedMonthLabel} Total
                </th>
                {showCentreColumns &&
                  ledger.centreSummaries.map((c) => (
                    <td
                      key={c.centreId}
                      className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap"
                    >
                      {formatPenceToGBP(c.monthPence)}
                    </td>
                  ))}
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  {formatPenceToGBP(ledger.monthTotalPence)}
                </td>
                <td className="px-4 py-3.5 text-right text-xs font-normal text-muted-foreground">
                  Clipped to {ledger.selectedMonthShortLabel}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  {formatPenceToGBP(ledger.monthTotalPence)}
                </td>
                <td className="px-4 py-3.5 text-right text-xs font-normal text-muted-foreground tabular-nums">
                  {ledger.monthPaymentCount} verified
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 4. 6-Month Comparison & YoY Trajectory Table */}
      <section aria-labelledby="six-month-trend-heading" className="space-y-3">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
          <h2
            id="six-month-trend-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            6-month cash trajectory & MoM / YoY comparison
          </h2>
          <p className="text-sm text-muted-foreground">
            Select any month to inspect its weekly Monday–Sunday breakdown above.
          </p>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="six-month-trend-heading"
          className="overflow-x-auto rounded-2xl border border-border bg-card"
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Six-month cash received trajectory with Month-on-Month and Year-on-Year comparisons
            </caption>
            <thead className="border-b border-border bg-secondary/70">
              <tr>
                <th scope="col" className="px-4 py-3.5 font-medium text-muted-foreground">
                  Month
                </th>
                {showCentreColumns &&
                  ledger.centreSummaries.map((c) => (
                    <th
                      key={c.centreId}
                      scope="col"
                      className="px-4 py-3.5 text-right font-medium text-muted-foreground"
                    >
                      {shortCentreName(c.centreName)}
                    </th>
                  ))}
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Monthly Total
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  MoM Change
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  YoY Comparison
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ledger.sixMonthTrend.map((row) => (
                <tr
                  key={row.yearMonth}
                  className={
                    row.isSelectedMonth
                      ? 'bg-primary/5 font-medium'
                      : 'bg-card transition-colors hover:bg-secondary/30'
                  }
                >
                  <th scope="row" className="px-4 py-3.5 font-medium text-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link
                        href={buildCashflowHref({ month: row.yearMonth })}
                        className={`text-primary hover:underline ${focusRing}`}
                      >
                        {row.monthLabel}
                      </Link>
                      {row.isCurrentMonth && (
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                          Current MTD
                        </span>
                      )}
                      {row.isSelectedMonth && !row.isCurrentMonth && (
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                          Viewing
                        </span>
                      )}
                    </div>
                  </th>

                  {showCentreColumns &&
                    row.byCentre.map((c) => (
                      <td
                        key={c.centreId}
                        className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap"
                      >
                        <span
                          className={
                            c.monthPence > 0 ? 'text-foreground' : 'text-muted-foreground'
                          }
                        >
                          {formatPenceToGBP(c.monthPence)}
                        </span>
                      </td>
                    ))}

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    <span className="font-semibold text-foreground">
                      {formatPenceToGBP(row.totalPence)}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.paymentCount} payment{row.paymentCount === 1 ? '' : 's'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    {row.momComparison.comparisonStatus === 'insufficient_history' ? (
                      <span className="text-xs text-muted-foreground">Prior predates records</span>
                    ) : (
                      <div className="inline-flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {formatSignedPenceDelta(row.momComparison.deltaPence)}
                          </span>
                          <DeltaBadge comparison={row.momComparison} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          vs {formatPenceToGBP(row.momComparison.priorPence)} (
                          {row.momComparison.priorPeriodLabel})
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    {row.yoyComparison.comparisonStatus === 'insufficient_history' ? (
                      <span className="text-xs text-muted-foreground">
                        Baseline building (starts{' '}
                        {row.yoyComparison.firstRecordedMonthLabel ?? 'recently'})
                      </span>
                    ) : (
                      <div className="inline-flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {formatSignedPenceDelta(row.yoyComparison.deltaPence)}
                          </span>
                          <DeltaBadge comparison={row.yoyComparison} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          vs {formatPenceToGBP(row.yoyComparison.priorPence)} (
                          {row.yoyComparison.priorPeriodLabel})
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
