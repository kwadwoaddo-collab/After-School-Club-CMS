'use client';

import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  addMonthsYm,
  formatMonthShortOnly,
  formatPenceToGBP,
  formatSignedPenceDelta,
  type CashReceiptsLedgerResult,
  type CashReceiptsWeekRow,
  type PeriodComparison,
  type WeekCashReceiptExpense,
} from '../domain/cash-receipts-ledger';
import { formatInvoiceDate } from '../domain/invoice-display';
import {
  createFinanceExpense,
  deleteFinanceExpense,
  updateFinanceExpense,
} from '../expense-actions';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'supplies_snacks', label: 'Supplies & snacks' },
  { value: 'staff_wages', label: 'Staff & wages' },
  { value: 'premises_hire', label: 'Premises & hall hire' },
  { value: 'activities_equipment', label: 'Activities & equipment' },
  { value: 'admin_transport', label: 'Admin & transport' },
] as const;

function formatExpenseCategory(category: string): string {
  const match = EXPENSE_CATEGORY_OPTIONS.find((c) => c.value === category);
  if (match) return match.label;
  return category.replace(/_/g, ' ');
}

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

function getBoundaryEntriesButtonLabel(
  week: CashReceiptsWeekRow,
  selectedMonthShortLabel: string,
  isExpanded: boolean
): string {
  const inMonthTotal = week.inMonthCount + week.inMonthExpenseCount;
  const fullWeekTotal = week.fullWeekCount + week.fullWeekExpenseCount;
  const spillBeforeTotal = week.spillBeforeCount + week.spillBeforeExpenseCount;
  const spillAfterTotal = week.spillAfterCount + week.spillAfterExpenseCount;
  const isBoundary = week.isBoundaryStart || week.isBoundaryEnd;

  if (fullWeekTotal === 0) {
    return isExpanded ? 'Hide week' : '0 entries · + Add';
  }

  if (isBoundary) {
    const spillCount = spillBeforeTotal + spillAfterTotal;
    const spillMonth = week.spillBeforeMonthLabel ?? week.spillAfterMonthLabel ?? 'adj.';
    if (inMonthTotal === 0 && spillCount > 0) {
      return `${isExpanded ? 'Hide · ' : ''}0 in ${selectedMonthShortLabel} (${spillCount} in ${spillMonth})`;
    }
    if (inMonthTotal > 0 && spillCount > 0) {
      return `${isExpanded ? 'Hide' : 'View'} ${inMonthTotal} in ${selectedMonthShortLabel} (+${spillCount} ${spillMonth})`;
    }
  }

  const verb = isExpanded ? 'Hide' : 'View';
  if (week.fullWeekExpenseCount > 0 && week.fullWeekCount > 0) {
    return `${verb} ${week.fullWeekCount} in · ${week.fullWeekExpenseCount} out`;
  }
  if (week.fullWeekExpenseCount > 0) {
    return `${verb} ${week.fullWeekExpenseCount} outgoing${
      week.fullWeekExpenseCount === 1 ? '' : 's'
    }`;
  }
  return `${verb} ${week.fullWeekCount} payment${week.fullWeekCount === 1 ? '' : 's'}`;
}

export interface CashReceiptsOwnerViewProps {
  ledger: CashReceiptsLedgerResult;
  activeView?: 'cashflow' | 'outgoings';
}

export default function CashReceiptsOwnerView({
  ledger,
  activeView = 'cashflow',
}: CashReceiptsOwnerViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Default-expand the current live week (or most recent week with in-month activity)
  const defaultExpandedWeek =
    ledger.weeks.find(
      (w) => w.state === 'current' && w.inMonthCount + w.inMonthExpenseCount > 0
    )?.weekNumber ??
    [...ledger.weeks]
      .reverse()
      .find((w) => w.inMonthCount + w.inMonthExpenseCount > 0)?.weekNumber ??
    ledger.weeks.find((w) => w.state === 'current')?.weekNumber ??
    null;

  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>(
    defaultExpandedWeek ? { [defaultExpandedWeek]: true } : {}
  );
  // Scope toggle for boundary weeks: 'in_month' vs 'full_week'
  const [boundaryScope, setBoundaryScope] = useState<Record<number, 'in_month' | 'full_week'>>({});

  // Quick-add outgoing bar state
  const defaultDateForMonth = ledger.isViewingCurrentMonth
    ? ledger.todayBusinessDate
    : `${ledger.selectedMonth}-01`;
  const defaultCentreOption =
    ledger.activeCentreId !== 'all'
      ? ledger.activeCentreId
      : ledger.centreSummaries[0]?.centreId ?? '';

  const [quickDate, setQuickDate] = useState<string>(defaultDateForMonth);
  const [quickCentreId, setQuickCentreId] = useState<string>(defaultCentreOption);
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickDescription, setQuickDescription] = useState<string>('');
  const [quickCategory, setQuickCategory] = useState<string>('general');
  const [quickFeedback, setQuickFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Sync quick-add defaults when month or activeCentreId changes
  useEffect(() => {
    setQuickDate(
      ledger.isViewingCurrentMonth ? ledger.todayBusinessDate : `${ledger.selectedMonth}-01`
    );
  }, [ledger.isViewingCurrentMonth, ledger.selectedMonth, ledger.todayBusinessDate]);

  useEffect(() => {
    if (ledger.activeCentreId !== 'all') {
      setQuickCentreId(ledger.activeCentreId);
    } else if (!quickCentreId && ledger.centreSummaries[0]?.centreId) {
      setQuickCentreId(ledger.centreSummaries[0].centreId);
    }
  }, [ledger.activeCentreId, ledger.centreSummaries, quickCentreId]);

  // Week-scoped inline add state
  const [addingInWeek, setAddingInWeek] = useState<number | null>(null);
  const [weekAddDate, setWeekAddDate] = useState<string>(defaultDateForMonth);
  const [weekAddCentreId, setWeekAddCentreId] = useState<string>(defaultCentreOption);
  const [weekAddAmount, setWeekAddAmount] = useState<string>('');
  const [weekAddDescription, setWeekAddDescription] = useState<string>('');
  const [weekAddCategory, setWeekAddCategory] = useState<string>('general');
  const [weekActionError, setWeekActionError] = useState<string | null>(null);

  // Inline edit expense state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editCentreId, setEditCentreId] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('general');

  // Inline delete confirmation state
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);
  const expenseMutationLockRef = useRef(false);

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
    params.set('view', activeView);
    if (centre && centre !== 'all') {
      params.set('centre', centre);
    }
    if (month) {
      params.set('month', month);
    }
    return `/dashboard/finance?${params.toString()}`;
  };

  const handleQuickAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (expenseMutationLockRef.current || isPending) return;
    expenseMutationLockRef.current = true;
    setQuickFeedback(null);

    startTransition(async () => {
      try {
        const res = await createFinanceExpense({
          centreId: quickCentreId,
          expenseDate: quickDate,
          amount: quickAmount,
          description: quickDescription,
          category: quickCategory,
        });

        if (!res.success) {
          setQuickFeedback({
            type: 'error',
            message: res.error ?? 'Could not record outgoing.',
          });
          return;
        }

        setQuickAmount('');
        setQuickDescription('');
        setQuickFeedback({
          type: 'success',
          message:
            res.createdCount && res.createdCount > 1
              ? `Outgoing split equally across ${res.createdCount} centres.`
              : 'Outgoing recorded in ledger.',
        });
        router.refresh();
      } catch (err) {
        setQuickFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Could not record outgoing.',
        });
      } finally {
        expenseMutationLockRef.current = false;
      }
    });
  };

  const openWeekInlineAdd = (week: CashReceiptsWeekRow) => {
    setWeekActionError(null);
    setAddingInWeek(week.weekNumber);
    const defaultDay =
      ledger.todayBusinessDate >= week.clippedStart && ledger.todayBusinessDate <= week.clippedEnd
        ? ledger.todayBusinessDate
        : week.clippedStart;
    setWeekAddDate(defaultDay);
    setWeekAddCentreId(
      ledger.activeCentreId !== 'all'
        ? ledger.activeCentreId
        : ledger.centreSummaries[0]?.centreId ?? ''
    );
    setWeekAddAmount('');
    setWeekAddDescription('');
    setWeekAddCategory('general');
  };

  const handleWeekInlineAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (expenseMutationLockRef.current || isPending) return;
    expenseMutationLockRef.current = true;
    setWeekActionError(null);

    startTransition(async () => {
      try {
        const res = await createFinanceExpense({
          centreId: weekAddCentreId,
          expenseDate: weekAddDate,
          amount: weekAddAmount,
          description: weekAddDescription,
          category: weekAddCategory,
        });

        if (!res.success) {
          setWeekActionError(res.error ?? 'Could not record outgoing.');
          return;
        }

        setAddingInWeek(null);
        setWeekAddAmount('');
        setWeekAddDescription('');
        router.refresh();
      } catch (err) {
        setWeekActionError(err instanceof Error ? err.message : 'Could not record outgoing.');
      } finally {
        expenseMutationLockRef.current = false;
      }
    });
  };

  const startEditingExpense = (exp: WeekCashReceiptExpense) => {
    setWeekActionError(null);
    setConfirmDeleteExpenseId(null);
    setEditingExpenseId(exp.id);
    setEditDate(exp.expenseDate);
    setEditCentreId(exp.centreId);
    setEditAmount(exp.amountDecimal);
    setEditDescription(exp.description);
    setEditCategory(exp.category);
  };

  const handleSaveExpenseEdit = (expenseId: string) => {
    if (expenseMutationLockRef.current || isPending) return;
    expenseMutationLockRef.current = true;
    setWeekActionError(null);
    startTransition(async () => {
      try {
        const res = await updateFinanceExpense({
          expenseId,
          centreId: editCentreId,
          expenseDate: editDate,
          amount: editAmount,
          description: editDescription,
          category: editCategory,
        });

        if (!res.success) {
          setWeekActionError(res.error ?? 'Could not update outgoing.');
          return;
        }

        setEditingExpenseId(null);
        router.refresh();
      } catch (err) {
        setWeekActionError(err instanceof Error ? err.message : 'Could not update outgoing.');
      } finally {
        expenseMutationLockRef.current = false;
      }
    });
  };

  const handleConfirmDeleteExpense = (expenseId: string) => {
    if (expenseMutationLockRef.current || isPending) return;
    expenseMutationLockRef.current = true;
    setWeekActionError(null);
    startTransition(async () => {
      try {
        const res = await deleteFinanceExpense({ expenseId });
        if (!res.success) {
          setWeekActionError(res.error ?? 'Could not delete outgoing.');
          return;
        }
        setConfirmDeleteExpenseId(null);
        router.refresh();
      } catch (err) {
        setWeekActionError(err instanceof Error ? err.message : 'Could not delete outgoing.');
      } finally {
        expenseMutationLockRef.current = false;
      }
    });
  };

  const prevMonth = addMonthsYm(ledger.selectedMonth, -1);
  const nextMonth = addMonthsYm(ledger.selectedMonth, 1);
  const canGoNextMonth = nextMonth <= ledger.currentMonth;
  const showCentreColumns = ledger.activeCentreId === 'all' && ledger.centreSummaries.length > 0;
  // Columns: Week + [Centres] + Money In + Outgoings + Weekly Net + Rolling Tally + Entries
  const totalTableColumns = 6 + (showCentreColumns ? ledger.centreSummaries.length : 0);
  const ytd = ledger.yearlyRunningLedger;

  // 3. Inline 3-Second Quick-Add Outgoing / Expense Bar
  const quickAddOutgoingSection = (
    <section
      aria-labelledby="quick-add-outgoing-heading"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
        <h2
          id="quick-add-outgoing-heading"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          Record weekly outgoing or expense
        </h2>
        <p className="text-xs text-muted-foreground">
          Deducts automatically from the matching Monday–Sunday week, monthly tally, and{' '}
          {ytd.selectedYear} yearly running total.
        </p>
      </div>

      <form
        aria-labelledby="quick-add-outgoing-heading"
        onSubmit={handleQuickAddSubmit}
        className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
      >
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="quick-expense-date" className="text-xs font-medium text-foreground">
            Date <span aria-hidden="true">*</span>
          </label>
          <input
            id="quick-expense-date"
            name="expenseDate"
            type="date"
            required
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            className={`min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground tabular-nums ${focusRing}`}
          />
        </div>

        <div className="flex flex-col gap-1 lg:col-span-3">
          <label htmlFor="quick-expense-centre" className="text-xs font-medium text-foreground">
            Centre <span aria-hidden="true">*</span>
          </label>
          <select
            id="quick-expense-centre"
            name="centreId"
            required
            value={quickCentreId}
            onChange={(e) => setQuickCentreId(e.target.value)}
            className={`min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground ${focusRing}`}
          >
            {ledger.centreSummaries.map((c) => (
              <option key={c.centreId} value={c.centreId}>
                {c.centreName}
              </option>
            ))}
            {ledger.centreSummaries.length > 1 && (
              <option value="split_all">
                Split equally across all {ledger.centreSummaries.length} centres
              </option>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="quick-expense-amount" className="text-xs font-medium text-foreground">
            Amount (£) <span aria-hidden="true">*</span>
          </label>
          <input
            id="quick-expense-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="e.g. 45.00"
            value={quickAmount}
            onChange={(e) => {
              setQuickAmount(e.target.value);
              if (quickFeedback?.type === 'error') setQuickFeedback(null);
            }}
            className={`min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground tabular-nums ${focusRing}`}
          />
        </div>

        <div className="flex flex-col gap-1 lg:col-span-3">
          <label
            htmlFor="quick-expense-description"
            className="text-xs font-medium text-foreground"
          >
            Description <span aria-hidden="true">*</span>
          </label>
          <input
            id="quick-expense-description"
            name="description"
            type="text"
            required
            maxLength={300}
            placeholder="Fruit & snacks, hall hire, supplies..."
            value={quickDescription}
            onChange={(e) => {
              setQuickDescription(e.target.value);
              if (quickFeedback?.type === 'error') setQuickFeedback(null);
            }}
            className={`min-h-10 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground ${focusRing}`}
          />
        </div>

        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="quick-expense-category" className="text-xs font-medium text-foreground">
            Category
          </label>
          <div className="flex items-center gap-2">
            <select
              id="quick-expense-category"
              name="category"
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value)}
              className={`min-h-10 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm text-foreground ${focusRing}`}
            >
              {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isPending}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 ${focusRing}`}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>{isPending ? 'Saving...' : 'Add'}</span>
            </button>
          </div>
        </div>
      </form>

      {quickFeedback && (
        <div
          role={quickFeedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`mt-3 text-xs font-medium ${
            quickFeedback.type === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {quickFeedback.message}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      {/* 1. Top Control Bar: Centre Switcher Pills + Month & Year Selector */}
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
              In {formatPenceToGBP(ledger.allCentresMonthTotalPence)} · Net{' '}
              {formatPenceToGBP(ledger.allCentresMonthNetPence)}
            </span>
          </Link>

          {ledger.centreCashflowSummaries.map((centre) => {
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
                  In {formatPenceToGBP(centre.monthIncomePence)} · Net{' '}
                  {formatPenceToGBP(centre.monthNetPence)}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year quick-switcher pills */}
          {ytd.availableYears.length > 1 && (
            <div
              role="group"
              aria-label="Year selector"
              className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1"
            >
              {ytd.availableYears.map((yr) => {
                const isActiveYear = yr === ytd.selectedYear;
                const currentYearNum = Number(ledger.currentMonth.slice(0, 4));
                const targetMonthForYear =
                  yr === currentYearNum ? ledger.currentMonth : `${yr}-12`;
                return (
                  <Link
                    key={yr}
                    href={buildCashflowHref({ month: targetMonthForYear })}
                    aria-current={isActiveYear ? 'true' : undefined}
                    className={`inline-flex min-h-8 items-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${focusRing} ${
                      isActiveYear
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {yr}
                  </Link>
                );
              })}
            </div>
          )}

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

      {activeView === 'outgoings' && quickAddOutgoingSection}

      {/* 2. 4-Column Divided Executive Ledger Strip */}
      <dl
        aria-label="Executive cashflow and running totals summary"
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
              Outgoings: −{formatPenceToGBP(ledger.thisWeekExpensePence)} ·{' '}
              <span className="font-semibold text-foreground">
                Net: {formatPenceToGBP(ledger.thisWeekNetPence)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
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
                {formatSignedPenceDelta(ledger.thisWeekVsLastWeek.deltaPence)} cash in vs last week
                ({ledger.thisWeekVsLastWeek.priorPeriodLabel}:{' '}
                {formatPenceToGBP(ledger.thisWeekVsLastWeek.priorPence)})
              </span>
            )}
          </div>
        </div>

        {/* Column 2: [Month] Cashflow & Rolling Tally */}
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm font-medium text-muted-foreground">
                {ledger.selectedMonthLabel} Tally
              </dt>
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground tabular-nums">
                {ledger.monthPaymentCount} in · {ledger.monthExpenseCount} out
              </span>
            </div>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatPenceToGBP(ledger.monthTotalPence)}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Outgoings: −{formatPenceToGBP(ledger.monthExpenseTotalPence)} ·{' '}
              <span
                className={`font-semibold ${
                  ledger.monthNetPence >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                Net: {formatPenceToGBP(ledger.monthNetPence)}
              </span>
            </p>
          </div>

          {ledger.activeCentreId === 'all' && ledger.centreCashflowSummaries.length > 1 ? (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <div
                aria-hidden="true"
                className="flex h-2 w-full overflow-hidden rounded-full bg-secondary"
              >
                {ledger.centreCashflowSummaries.map((c, idx) => (
                  <div
                    key={c.centreId}
                    style={{ width: `${c.incomeSharePercent}%` }}
                    className={idx === 0 ? 'bg-primary' : 'bg-emerald-500'}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {ledger.centreCashflowSummaries.map((c, idx) => (
                  <Fragment key={c.centreId}>
                    {idx > 0 && ' · '}
                    <span className="font-medium text-foreground">
                      {shortCentreName(c.centreName)}
                    </span>{' '}
                    In {formatPenceToGBP(c.monthIncomePence)} (Net{' '}
                    {formatPenceToGBP(c.monthNetPence)})
                  </Fragment>
                ))}
              </p>
            </div>
          ) : (
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
              All centres in {ledger.selectedMonthShortLabel}:{' '}
              <span className="font-medium text-foreground">
                In {formatPenceToGBP(ledger.allCentresMonthTotalPence)}
              </span>{' '}
              · Net {formatPenceToGBP(ledger.allCentresMonthNetPence)}
            </div>
          )}
        </div>

        {/* Column 3: Month-on-Month (MoM) & YoY */}
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
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  Prior pace: {formatPenceToGBP(ledger.momComparison.priorPence)}
                  {ledger.momComparison.mode === 'mtd_same_day' && (
                    <>
                      {' · '}Full {ledger.momComparison.fullPriorPeriodLabel}:{' '}
                      {formatPenceToGBP(ledger.momComparison.fullPriorPeriodPence)}
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
            {ledger.yoyComparison.comparisonStatus === 'insufficient_history' ? (
              <span>
                YoY: Baseline building (records start{' '}
                {ledger.firstRecordedMonthLabel ?? 'recently'})
              </span>
            ) : (
              <span>
                YoY ({ledger.yoyComparison.priorPeriodLabel}):{' '}
                <span className="font-medium text-foreground">
                  {formatSignedPenceDelta(ledger.yoyComparison.deltaPence)}
                </span>{' '}
                (vs {formatPenceToGBP(ledger.yoyComparison.priorPence)})
              </span>
            )}
          </div>
        </div>

        {/* Column 4: Yearly Running Total (YTD / Annual) */}
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-sm font-medium text-muted-foreground">
                {ytd.selectedYear} Yearly Running Total
              </dt>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                {ytd.rangeLabel}
              </span>
            </div>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {formatPenceToGBP(ytd.totalIncomePence)}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              Yearly Outgoings: −{formatPenceToGBP(ytd.totalExpensePence)} ·{' '}
              <span
                className={`font-semibold ${
                  ytd.totalNetPence >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                Yearly Net: {formatPenceToGBP(ytd.totalNetPence)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {ytd.totalIncomeCount} verified payment{ytd.totalIncomeCount === 1 ? '' : 's'} ·{' '}
              {ytd.totalExpenseCount} outgoing{ytd.totalExpenseCount === 1 ? '' : 's'} in{' '}
              {ytd.selectedYear}
            </p>
          </div>

          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
            {ledger.activeCentreId === 'all' && ytd.byCentre.length > 1 ? (
              <span>
                {ytd.byCentre.map((c, idx) => (
                  <Fragment key={c.centreId}>
                    {idx > 0 && ' · '}
                    <span className="font-medium text-foreground">
                      {shortCentreName(c.centreName)}
                    </span>{' '}
                    Net {formatPenceToGBP(c.totalNetPence)}
                  </Fragment>
                ))}
              </span>
            ) : (
              <span>
                Cumulative through {ledger.selectedMonthShortLabel} {ytd.selectedYear}:{' '}
                <span className="font-medium text-foreground">
                  Net {formatPenceToGBP(ytd.throughSelectedMonthNetPence)}
                </span>
              </span>
            )}
          </div>
        </div>
      </dl>

      {activeView === 'cashflow' && quickAddOutgoingSection}

      {/* 4. Weekly Cashflow, Outgoings & Rolling Tally Table (Mon–Sun Weeks) */}
      <section aria-labelledby="weekly-cash-heading" className="space-y-3">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
          <h2
            id="weekly-cash-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Weekly cashflow, outgoings & rolling tally — {ledger.selectedMonthLabel}
          </h2>
          <p className="text-sm text-muted-foreground">
            Monday–Sunday weeks. Boundary weeks clip days outside {ledger.selectedMonthShortLabel}{' '}
            so monthly totals never double-count across months.
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
              Weekly Monday to Sunday cash received, outgoings, net cashflow, and rolling monthly
              tally for {ledger.selectedMonthLabel}
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
                  Money In ({ledger.selectedMonthShortLabel})
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Outgoings ({ledger.selectedMonthShortLabel})
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Weekly Net ({ledger.selectedMonthShortLabel})
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Rolling {ledger.selectedMonthShortLabel} Tally
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Entries
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
                const visibleExpenses =
                  scope === 'in_month'
                    ? week.expenses.filter((e) => e.inSelectedMonth)
                    : week.expenses;
                const isBoundary = week.isBoundaryStart || week.isBoundaryEnd;
                const hasAnyEntries = week.fullWeekCount + week.fullWeekExpenseCount > 0;

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
                            {c.inMonthExpensePence > 0 ? (
                              <span className="block text-xs text-muted-foreground">
                                Out −{formatPenceToGBP(c.inMonthExpensePence)} · Net{' '}
                                {formatPenceToGBP(c.inMonthNetPence)}
                              </span>
                            ) : (
                              <span className="block text-xs text-muted-foreground">
                                {c.inMonthCount} payment{c.inMonthCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </td>
                        ))}

                      {/* Money In (Month) */}
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
                        {week.isBoundaryStart && week.spillBeforePence > 0 && (
                          <span className="block text-xs text-amber-800 dark:text-amber-200">
                            +{formatPenceToGBP(week.spillBeforePence)} in{' '}
                            {week.spillBeforeMonthLabel}
                          </span>
                        )}
                        {week.isBoundaryEnd && week.spillAfterPence > 0 && (
                          <span className="block text-xs text-amber-800 dark:text-amber-200">
                            +{formatPenceToGBP(week.spillAfterPence)} in{' '}
                            {week.spillAfterMonthLabel}
                          </span>
                        )}
                      </td>

                      {/* Outgoings (Month) */}
                      <td className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap">
                        <span
                          className={`text-base font-semibold ${
                            week.inMonthExpensePence > 0
                              ? 'text-amber-800 dark:text-amber-200'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {week.inMonthExpensePence > 0
                            ? `−${formatPenceToGBP(week.inMonthExpensePence)}`
                            : formatPenceToGBP(0)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {week.inMonthExpenseCount} outgoing
                          {week.inMonthExpenseCount === 1 ? '' : 's'} in{' '}
                          {ledger.selectedMonthShortLabel}
                        </span>
                        {week.isBoundaryStart && week.spillBeforeExpensePence > 0 && (
                          <span className="block text-xs text-amber-800 dark:text-amber-200">
                            +{formatPenceToGBP(week.spillBeforeExpensePence)} in{' '}
                            {week.spillBeforeMonthLabel}
                          </span>
                        )}
                        {week.isBoundaryEnd && week.spillAfterExpensePence > 0 && (
                          <span className="block text-xs text-amber-800 dark:text-amber-200">
                            +{formatPenceToGBP(week.spillAfterExpensePence)} in{' '}
                            {week.spillAfterMonthLabel}
                          </span>
                        )}
                      </td>

                      {/* Weekly Net (Month) */}
                      <td className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap">
                        <span
                          className={`text-base font-semibold ${
                            week.inMonthNetPence > 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : week.inMonthNetPence < 0
                                ? 'text-amber-800 dark:text-amber-200'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {formatPenceToGBP(week.inMonthNetPence)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {isBoundary
                            ? `7-day net: ${formatPenceToGBP(week.fullWeekNetPence)}`
                            : 'In minus outgoings'}
                        </span>
                      </td>

                      {/* Rolling [Month] Tally */}
                      <td className="px-4 py-4 text-right align-top tabular-nums whitespace-nowrap">
                        <span className="text-base font-semibold text-foreground">
                          Net {formatPenceToGBP(week.rollingMonthNetTallyPence)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          In {formatPenceToGBP(week.rollingMonthTallyPence)} · Out{' '}
                          {formatPenceToGBP(week.rollingMonthExpenseTallyPence)}
                        </span>
                      </td>

                      {/* Entries Button */}
                      <td className="px-4 py-4 text-right align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.weekNumber)}
                          aria-expanded={isExpanded}
                          aria-controls={`week-drilldown-${week.weekNumber}`}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${focusRing} ${
                            hasAnyEntries
                              ? 'border-border bg-card text-primary hover:bg-secondary'
                              : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-secondary/50'
                          }`}
                        >
                          <span>
                            {getBoundaryEntriesButtonLabel(
                              week,
                              ledger.selectedMonthShortLabel,
                              isExpanded
                            )}
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
                      <tr id={`week-drilldown-${week.weekNumber}`} className="bg-secondary/20">
                        <td colSpan={totalTableColumns} className="px-4 py-5 sm:px-6">
                          <div className="space-y-6">
                            {/* Boundary Scope Toggle + Week Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-foreground tabular-nums">
                                  Week {week.weekNumber} Ledger ({week.weekRangeLabel})
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  · In {formatPenceToGBP(week.inMonthPence)} · Out{' '}
                                  {formatPenceToGBP(week.inMonthExpensePence)} · Net{' '}
                                  {formatPenceToGBP(week.inMonthNetPence)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {isBoundary && (
                                  <div
                                    role="group"
                                    aria-label={`Boundary week ${week.weekNumber} entry scope`}
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
                                      Only days in {ledger.selectedMonthShortLabel} (
                                      {week.inMonthCount + week.inMonthExpenseCount})
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
                                      All 7 days Mon–Sun (
                                      {week.fullWeekCount + week.fullWeekExpenseCount})
                                    </button>
                                  </div>
                                )}

                                {addingInWeek !== week.weekNumber && (
                                  <button
                                    type="button"
                                    onClick={() => openWeekInlineAdd(week)}
                                    className={`inline-flex min-h-8 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 ${focusRing}`}
                                  >
                                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                                    <span>Add outgoing to Week {week.weekNumber}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {weekActionError && (
                              <div
                                role="alert"
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300"
                              >
                                {weekActionError}
                              </div>
                            )}

                            {/* Part A: Outgoings & Expenses in Week N */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold text-foreground">
                                  Outgoings & expenses ({visibleExpenses.length})
                                </h3>
                              </div>

                              {addingInWeek === week.weekNumber && (
                                <form
                                  aria-label={`Add outgoing to Week ${week.weekNumber}`}
                                  onSubmit={handleWeekInlineAddSubmit}
                                  className="grid grid-cols-1 gap-2.5 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
                                >
                                  <div className="flex flex-col gap-1 lg:col-span-2">
                                    <label
                                      htmlFor={`week-${week.weekNumber}-date`}
                                      className="text-xs font-medium text-foreground"
                                    >
                                      Date
                                    </label>
                                    <input
                                      id={`week-${week.weekNumber}-date`}
                                      name="expenseDate"
                                      type="date"
                                      required
                                      value={weekAddDate}
                                      onChange={(e) => setWeekAddDate(e.target.value)}
                                      className={`min-h-9 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground tabular-nums ${focusRing}`}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 lg:col-span-3">
                                    <label
                                      htmlFor={`week-${week.weekNumber}-centre`}
                                      className="text-xs font-medium text-foreground"
                                    >
                                      Centre
                                    </label>
                                    <select
                                      id={`week-${week.weekNumber}-centre`}
                                      name="centreId"
                                      required
                                      value={weekAddCentreId}
                                      onChange={(e) => setWeekAddCentreId(e.target.value)}
                                      className={`min-h-9 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground ${focusRing}`}
                                    >
                                      {ledger.centreSummaries.map((c) => (
                                        <option key={c.centreId} value={c.centreId}>
                                          {c.centreName}
                                        </option>
                                      ))}
                                      {ledger.centreSummaries.length > 1 && (
                                        <option value="split_all">
                                          Split equally across all centres
                                        </option>
                                      )}
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1 lg:col-span-2">
                                    <label
                                      htmlFor={`week-${week.weekNumber}-amount`}
                                      className="text-xs font-medium text-foreground"
                                    >
                                      Amount (£)
                                    </label>
                                    <input
                                      id={`week-${week.weekNumber}-amount`}
                                      name="amount"
                                      type="text"
                                      inputMode="decimal"
                                      required
                                      placeholder="0.00"
                                      value={weekAddAmount}
                                      onChange={(e) => setWeekAddAmount(e.target.value)}
                                      className={`min-h-9 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground tabular-nums ${focusRing}`}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 lg:col-span-3">
                                    <label
                                      htmlFor={`week-${week.weekNumber}-desc`}
                                      className="text-xs font-medium text-foreground"
                                    >
                                      Description
                                    </label>
                                    <input
                                      id={`week-${week.weekNumber}-desc`}
                                      name="description"
                                      type="text"
                                      required
                                      maxLength={300}
                                      placeholder="Description of outgoing"
                                      value={weekAddDescription}
                                      onChange={(e) => setWeekAddDescription(e.target.value)}
                                      className={`min-h-9 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground ${focusRing}`}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 lg:col-span-2">
                                    <label
                                      htmlFor={`week-${week.weekNumber}-cat`}
                                      className="text-xs font-medium text-foreground"
                                    >
                                      Category
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        id={`week-${week.weekNumber}-cat`}
                                        name="category"
                                        value={weekAddCategory}
                                        onChange={(e) => setWeekAddCategory(e.target.value)}
                                        className={`min-h-9 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground ${focusRing}`}
                                      >
                                        {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="submit"
                                        disabled={isPending}
                                        className={`min-h-9 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 ${focusRing}`}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAddingInWeek(null)}
                                        className={`min-h-9 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground ${focusRing}`}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </form>
                              )}

                              {visibleExpenses.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No outgoings recorded in this period.
                                </p>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                                  <table className="w-full border-collapse text-left text-xs sm:text-sm">
                                    <thead>
                                      <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                                        <th scope="col" className="px-3 py-2.5 font-medium">
                                          Date
                                        </th>
                                        <th scope="col" className="px-3 py-2.5 font-medium">
                                          Description
                                        </th>
                                        <th scope="col" className="px-3 py-2.5 font-medium">
                                          Category
                                        </th>
                                        <th scope="col" className="px-3 py-2.5 font-medium">
                                          Centre
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2.5 text-right font-medium"
                                        >
                                          Amount
                                        </th>
                                        <th
                                          scope="col"
                                          className="px-3 py-2.5 text-right font-medium"
                                        >
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {visibleExpenses.map((exp) => {
                                        const isEditing = editingExpenseId === exp.id;
                                        const isConfirmingDelete = confirmDeleteExpenseId === exp.id;

                                        if (isEditing) {
                                          return (
                                            <tr key={exp.id} className="bg-secondary/20">
                                              <td className="px-3 py-2">
                                                <input
                                                  type="date"
                                                  aria-label="Edit outgoing date"
                                                  value={editDate}
                                                  onChange={(e) => setEditDate(e.target.value)}
                                                  className={`min-h-8 rounded-lg border border-border bg-background px-2 py-1 text-xs tabular-nums ${focusRing}`}
                                                />
                                              </td>
                                              <td className="px-3 py-2">
                                                <input
                                                  type="text"
                                                  aria-label="Edit outgoing description"
                                                  maxLength={300}
                                                  value={editDescription}
                                                  onChange={(e) =>
                                                    setEditDescription(e.target.value)
                                                  }
                                                  className={`min-h-8 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs ${focusRing}`}
                                                />
                                              </td>
                                              <td className="px-3 py-2">
                                                <select
                                                  aria-label="Edit outgoing category"
                                                  value={editCategory}
                                                  onChange={(e) => setEditCategory(e.target.value)}
                                                  className={`min-h-8 rounded-lg border border-border bg-background px-2 py-1 text-xs ${focusRing}`}
                                                >
                                                  {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                      {opt.label}
                                                    </option>
                                                  ))}
                                                </select>
                                              </td>
                                              <td className="px-3 py-2">
                                                <select
                                                  aria-label="Edit outgoing centre"
                                                  value={editCentreId}
                                                  onChange={(e) => setEditCentreId(e.target.value)}
                                                  className={`min-h-8 rounded-lg border border-border bg-background px-2 py-1 text-xs ${focusRing}`}
                                                >
                                                  {ledger.centreSummaries.map((c) => (
                                                    <option key={c.centreId} value={c.centreId}>
                                                      {shortCentreName(c.centreName)}
                                                    </option>
                                                  ))}
                                                </select>
                                              </td>
                                              <td className="px-3 py-2 text-right">
                                                <input
                                                  type="text"
                                                  inputMode="decimal"
                                                  aria-label="Edit outgoing amount"
                                                  value={editAmount}
                                                  onChange={(e) => setEditAmount(e.target.value)}
                                                  className={`min-h-8 w-24 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs tabular-nums ${focusRing}`}
                                                />
                                              </td>
                                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5">
                                                  <button
                                                    type="button"
                                                    disabled={isPending}
                                                    onClick={() => handleSaveExpenseEdit(exp.id)}
                                                    className={`rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 ${focusRing}`}
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingExpenseId(null)}
                                                    className={`rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground ${focusRing}`}
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        }

                                        return (
                                          <tr key={exp.id} className="hover:bg-secondary/20">
                                            <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                                              <span className="font-medium text-foreground">
                                                {formatInvoiceDate(exp.expenseDate)}
                                              </span>
                                              {!exp.inSelectedMonth && (
                                                <span className="ml-2 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                                  {formatMonthShortOnly(exp.expenseDate)} tally
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-foreground">
                                              {exp.description}
                                            </td>
                                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                              <span className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                                                {formatExpenseCategory(exp.category)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                              {shortCentreName(exp.centreName)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-amber-800 dark:text-amber-200 tabular-nums whitespace-nowrap">
                                              −{formatPenceToGBP(exp.amountPence)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                              {isConfirmingDelete ? (
                                                <div className="inline-flex items-center gap-1.5">
                                                  <span className="text-xs text-muted-foreground">
                                                    Delete?
                                                  </span>
                                                  <button
                                                    type="button"
                                                    disabled={isPending}
                                                    onClick={() =>
                                                      handleConfirmDeleteExpense(exp.id)
                                                    }
                                                    className={`rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focusRing}`}
                                                  >
                                                    Yes
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteExpenseId(null)}
                                                    className={`rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground ${focusRing}`}
                                                  >
                                                    No
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="inline-flex items-center gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => startEditingExpense(exp)}
                                                    className={`text-xs font-medium text-primary hover:underline ${focusRing}`}
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setConfirmDeleteExpenseId(exp.id)
                                                    }
                                                    className={`text-xs font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 ${focusRing}`}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Part B: Verified Payments Received in Week N */}
                            <div className="space-y-2.5 border-t border-border pt-4">
                              <h3 className="text-xs font-semibold text-foreground">
                                Verified payments received ({visiblePayments.length})
                              </h3>

                              {visiblePayments.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {isBoundary && scope === 'in_month' && week.fullWeekCount > 0
                                    ? `No payments recorded on the ${ledger.selectedMonthShortLabel} day(s) of this boundary week. Switch to "All 7 days Mon–Sun" above to inspect the ${week.fullWeekCount} payment(s) recorded in the adjacent month.`
                                    : 'No verified payments recorded during this period.'}
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
                                                      <span className="text-muted-foreground">
                                                        ·
                                                      </span>
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
                  ledger.centreCashflowSummaries.map((c) => (
                    <td
                      key={c.centreId}
                      className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap"
                    >
                      <span>{formatPenceToGBP(c.monthIncomePence)}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Out −{formatPenceToGBP(c.monthExpensePence)} · Net{' '}
                        {formatPenceToGBP(c.monthNetPence)}
                      </span>
                    </td>
                  ))}
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  {formatPenceToGBP(ledger.monthTotalPence)}
                </td>
                <td className="px-4 py-3.5 text-right text-amber-800 dark:text-amber-200 tabular-nums whitespace-nowrap">
                  {ledger.monthExpenseTotalPence > 0
                    ? `−${formatPenceToGBP(ledger.monthExpenseTotalPence)}`
                    : formatPenceToGBP(0)}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  {formatPenceToGBP(ledger.monthNetPence)}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  Net {formatPenceToGBP(ledger.monthNetPence)}
                </td>
                <td className="px-4 py-3.5 text-right text-xs font-normal text-muted-foreground tabular-nums">
                  {ledger.monthPaymentCount} in · {ledger.monthExpenseCount} out
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 5. Yearly Running Totals & Monthly Trajectory Table (Jan–Dec) */}
      <section aria-labelledby="yearly-running-heading" className="space-y-3">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
          <h2
            id="yearly-running-heading"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            {ytd.selectedYear} yearly running totals & monthly trajectory ({ytd.rangeLabel})
          </h2>
          <p className="text-sm text-muted-foreground">
            Cumulative Jan–Dec cash received, outgoings, and net cashflow. Select any month to
            inspect its weekly breakdown above.
          </p>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby="yearly-running-heading"
          className="overflow-x-auto rounded-2xl border border-border bg-card"
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              {ytd.selectedYear} monthly cash received, outgoings, net cashflow, and cumulative
              yearly running totals
            </caption>
            <thead className="sticky top-0 z-10 border-b border-border bg-secondary/70 backdrop-blur-xs">
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
                  Money In
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Outgoings
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Monthly Net
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  MoM Cash In
                </th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium text-muted-foreground">
                  Yearly Running Total (Jan–Month)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ytd.months.map((row) => (
                <tr
                  key={row.yearMonth}
                  className={
                    row.isSelectedMonth
                      ? 'bg-primary/5 font-medium'
                      : 'bg-card transition-colors hover:bg-secondary/30'
                  }
                >
                  <th
                    scope="row"
                    className="px-4 py-3.5 font-medium text-foreground whitespace-nowrap"
                  >
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
                            c.incomePence > 0 ? 'text-foreground' : 'text-muted-foreground'
                          }
                        >
                          {formatPenceToGBP(c.incomePence)}
                        </span>
                        {c.expensePence > 0 && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            Out −{formatPenceToGBP(c.expensePence)} · Net{' '}
                            {formatPenceToGBP(c.netPence)}
                          </span>
                        )}
                      </td>
                    ))}

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={
                        row.incomePence > 0
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {formatPenceToGBP(row.incomePence)}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.incomeCount} payment{row.incomeCount === 1 ? '' : 's'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={
                        row.expensePence > 0
                          ? 'font-semibold text-amber-800 dark:text-amber-200'
                          : 'text-muted-foreground'
                      }
                    >
                      {row.expensePence > 0
                        ? `−${formatPenceToGBP(row.expensePence)}`
                        : formatPenceToGBP(0)}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {row.expenseCount} outgoing{row.expenseCount === 1 ? '' : 's'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        row.netPence > 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : row.netPence < 0
                            ? 'text-amber-800 dark:text-amber-200'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {formatPenceToGBP(row.netPence)}
                    </span>
                    {row.netMarginPercent !== null && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.netMarginPercent}% net margin
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    {row.momIncomeComparison.comparisonStatus === 'insufficient_history' ? (
                      <span className="text-xs text-muted-foreground">Prior predates records</span>
                    ) : (
                      <div className="inline-flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {formatSignedPenceDelta(row.momIncomeComparison.deltaPence)}
                          </span>
                          <DeltaBadge comparison={row.momIncomeComparison} />
                        </div>
                        <span className="text-xs font-normal text-muted-foreground">
                          vs {formatPenceToGBP(row.momIncomeComparison.priorPence)}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                    <span className="font-semibold text-foreground">
                      Net {formatPenceToGBP(row.runningYearlyNetPence)}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Cum. In {formatPenceToGBP(row.runningYearlyIncomePence)} · Out{' '}
                      {formatPenceToGBP(row.runningYearlyExpensePence)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-secondary/40 font-semibold text-foreground">
              <tr>
                <th scope="row" className="px-4 py-3.5 text-left">
                  {ytd.rangeLabel} Total
                </th>
                {showCentreColumns &&
                  ytd.byCentre.map((c) => (
                    <td
                      key={c.centreId}
                      className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap"
                    >
                      <span>{formatPenceToGBP(c.totalIncomePence)}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Out −{formatPenceToGBP(c.totalExpensePence)} · Net{' '}
                        {formatPenceToGBP(c.totalNetPence)}
                      </span>
                    </td>
                  ))}
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  <span>{formatPenceToGBP(ytd.totalIncomePence)}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {ytd.totalIncomeCount} payments
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-amber-800 dark:text-amber-200 tabular-nums whitespace-nowrap">
                  <span>
                    {ytd.totalExpensePence > 0
                      ? `−${formatPenceToGBP(ytd.totalExpensePence)}`
                      : formatPenceToGBP(0)}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {ytd.totalExpenseCount} outgoings
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  <span>{formatPenceToGBP(ytd.totalNetPence)}</span>
                  {ytd.netMarginPercent !== null && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {ytd.netMarginPercent}% YTD margin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right text-xs font-normal text-muted-foreground">
                  {ytd.months.length} month{ytd.months.length === 1 ? '' : 's'}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums whitespace-nowrap">
                  <span>Net {formatPenceToGBP(ytd.totalNetPence)}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    In {formatPenceToGBP(ytd.totalIncomePence)} · Out{' '}
                    {formatPenceToGBP(ytd.totalExpensePence)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
