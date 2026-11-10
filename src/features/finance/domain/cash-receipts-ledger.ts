import {
  formatPenceToDecimal,
  parseStoredDecimalToPence,
  toEuropeLondonBusinessDate,
} from './payment-eligibility';

export interface CashReceiptStudentRef {
  id: string;
  name: string;
}

export interface CentreRef {
  id: string;
  name: string;
}

export interface CashReceiptPaymentInput {
  id: string;
  amount: string | number;
  amountPence?: number;
  method: string;
  status: string;
  reversedAt?: Date | string | null;
  transactionReference?: string | null;
  recordedAt: Date | string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  centreId: string;
  centreName: string;
  parentId: string;
  parentName: string;
  students: CashReceiptStudentRef[];
}

export interface CashReceiptExpenseInput {
  id: string;
  expenseDate: string | Date;
  amountPence?: number;
  amount?: string | number;
  description: string;
  category?: string | null;
  centreId: string;
  centreName: string;
  createdAt?: Date | string;
  deletedAt?: Date | string | null;
}

export interface NormalizedCashReceiptPayment {
  id: string;
  amountPence: number;
  amountDecimal: string;
  method: string;
  transactionReference: string | null;
  recordedAtIso: string;
  businessDate: string; // YYYY-MM-DD in Europe/London
  yearMonth: string; // YYYY-MM in Europe/London
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  centreId: string;
  centreName: string;
  parentId: string;
  parentName: string;
  students: CashReceiptStudentRef[];
}

export interface NormalizedCashReceiptExpense {
  id: string;
  expenseDate: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM
  amountPence: number;
  amountDecimal: string;
  description: string;
  category: string;
  centreId: string;
  centreName: string;
  createdAtIso: string;
}

export interface WeekCashReceiptPayment extends NormalizedCashReceiptPayment {
  inSelectedMonth: boolean;
  spillDirection: 'before' | 'in_month' | 'after';
}

export interface WeekCashReceiptExpense extends NormalizedCashReceiptExpense {
  inSelectedMonth: boolean;
  spillDirection: 'before' | 'in_month' | 'after';
}

export interface WeekCentreBreakdown {
  centreId: string;
  centreName: string;
  inMonthPence: number;
  inMonthCount: number;
  fullWeekPence: number;
  fullWeekCount: number;
  rollingTallyPence: number;
  inMonthExpensePence: number;
  inMonthExpenseCount: number;
  fullWeekExpensePence: number;
  fullWeekExpenseCount: number;
  rollingExpenseTallyPence: number;
  inMonthNetPence: number;
  fullWeekNetPence: number;
  rollingNetTallyPence: number;
}

export type WeekLifecycleState = 'completed' | 'current' | 'upcoming';

export interface CashReceiptsWeekRow {
  weekNumber: number; // 1..N within selectedMonth
  weekKey: string; // YYYY-MM-DD_YYYY-MM-DD
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  clippedStart: string; // max(weekStart, monthStart)
  clippedEnd: string; // min(weekEnd, monthEnd)
  weekRangeLabel: string; // e.g. "Mon 2 Nov – Sun 8 Nov"
  clippedRangeLabel: string; // e.g. "Sun 1 Nov" or "Mon 2 Nov – Sun 8 Nov"
  isBoundaryStart: boolean;
  isBoundaryEnd: boolean;
  inMonthDays: number;
  spillBeforeDays: number;
  spillAfterDays: number;
  spillBeforeMonthLabel: string | null;
  spillAfterMonthLabel: string | null;
  inMonthPence: number;
  inMonthCount: number;
  fullWeekPence: number;
  fullWeekCount: number;
  spillBeforePence: number;
  spillBeforeCount: number;
  spillAfterPence: number;
  spillAfterCount: number;
  inMonthExpensePence: number;
  inMonthExpenseCount: number;
  fullWeekExpensePence: number;
  fullWeekExpenseCount: number;
  spillBeforeExpensePence: number;
  spillBeforeExpenseCount: number;
  spillAfterExpensePence: number;
  spillAfterExpenseCount: number;
  inMonthNetPence: number;
  fullWeekNetPence: number;
  rollingMonthTallyPence: number;
  rollingMonthPaymentCount: number;
  rollingMonthExpenseTallyPence: number;
  rollingMonthExpensePaymentCount: number;
  rollingMonthNetTallyPence: number;
  byCentre: WeekCentreBreakdown[];
  state: WeekLifecycleState;
  payments: WeekCashReceiptPayment[];
  expenses: WeekCashReceiptExpense[];
}

export type ComparisonStatus = 'available' | 'insufficient_history' | 'zero_prior_base';

export interface PeriodComparison {
  mode: 'mtd_same_day' | 'full_month' | 'week_on_week';
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  comparisonRangeLabel: string;
  currentStart: string;
  currentEnd: string;
  priorStart: string;
  priorEnd: string;
  currentPence: number;
  currentCount: number;
  priorPence: number;
  priorCount: number;
  fullPriorPeriodPence: number;
  fullPriorPeriodCount: number;
  fullPriorPeriodLabel: string;
  deltaPence: number;
  deltaPercent: number | null;
  comparisonStatus: ComparisonStatus;
  partialHistoryInPrior: boolean;
  firstRecordedBusinessDate: string | null;
  firstRecordedMonthLabel: string | null;
}

export interface CentreMonthSummary {
  centreId: string;
  centreName: string;
  monthPence: number;
  monthCount: number;
  sharePercent: number; // 0..100
}

export interface CentreCashflowSummary {
  centreId: string;
  centreName: string;
  monthIncomePence: number;
  monthIncomeCount: number;
  monthExpensePence: number;
  monthExpenseCount: number;
  monthNetPence: number;
  incomeSharePercent: number; // 0..100
}

export interface MonthlyTrendRow {
  yearMonth: string; // YYYY-MM
  monthLabel: string; // e.g. "November 2026"
  shortMonthLabel: string; // e.g. "Nov 2026"
  isCurrentMonth: boolean;
  isSelectedMonth: boolean;
  totalPence: number;
  paymentCount: number;
  expensePence: number;
  expenseCount: number;
  netPence: number;
  byCentre: CentreMonthSummary[];
  momComparison: PeriodComparison;
  yoyComparison: PeriodComparison;
}

export interface YearlyRunningCentreBreakdown {
  centreId: string;
  centreName: string;
  incomePence: number;
  incomeCount: number;
  expensePence: number;
  expenseCount: number;
  netPence: number;
  runningIncomePence: number;
  runningExpensePence: number;
  runningNetPence: number;
}

export interface YearlyRunningMonthRow {
  yearMonth: string; // YYYY-MM
  monthLabel: string; // e.g. "January 2026"
  shortMonthLabel: string; // e.g. "Jan 2026"
  isCurrentMonth: boolean;
  isSelectedMonth: boolean;
  incomePence: number;
  incomeCount: number;
  expensePence: number;
  expenseCount: number;
  netPence: number;
  netMarginPercent: number | null;
  runningYearlyIncomePence: number;
  runningYearlyIncomeCount: number;
  runningYearlyExpensePence: number;
  runningYearlyExpenseCount: number;
  runningYearlyNetPence: number;
  byCentre: YearlyRunningCentreBreakdown[];
  momIncomeComparison: PeriodComparison;
}

export interface YearlyRunningLedgerSummary {
  selectedYear: number;
  rangeLabel: string; // e.g. "Jan – Nov 2026 (YTD)" or "Jan – Dec 2025"
  ytdCutoffMonth: string; // YYYY-MM
  totalIncomePence: number;
  totalIncomeCount: number;
  totalExpensePence: number;
  totalExpenseCount: number;
  totalNetPence: number;
  netMarginPercent: number | null;
  throughSelectedMonthIncomePence: number;
  throughSelectedMonthExpensePence: number;
  throughSelectedMonthNetPence: number;
  byCentre: Array<{
    centreId: string;
    centreName: string;
    totalIncomePence: number;
    totalIncomeCount: number;
    totalExpensePence: number;
    totalExpenseCount: number;
    totalNetPence: number;
  }>;
  months: YearlyRunningMonthRow[];
  availableYears: number[];
}

export interface CashReceiptsLedgerResult {
  selectedMonth: string; // YYYY-MM
  selectedMonthLabel: string; // e.g. "November 2026"
  selectedMonthShortLabel: string; // e.g. "Nov"
  currentMonth: string; // YYYY-MM of todayBusinessDate
  todayBusinessDate: string; // YYYY-MM-DD
  isViewingCurrentMonth: boolean;
  activeCentreId: string; // 'all' or UUID
  activeCentreName: string;
  firstRecordedBusinessDate: string | null;
  firstRecordedMonthLabel: string | null;
  monthTotalPence: number;
  monthPaymentCount: number;
  monthExpenseTotalPence: number;
  monthExpenseCount: number;
  monthNetPence: number;
  allCentresMonthTotalPence: number;
  allCentresMonthPaymentCount: number;
  allCentresMonthExpenseTotalPence: number;
  allCentresMonthExpenseCount: number;
  allCentresMonthNetPence: number;
  thisWeekExpensePence: number;
  thisWeekExpenseCount: number;
  thisWeekNetPence: number;
  lastWeekExpensePence: number;
  lastWeekNetPence: number;
  centreSummaries: CentreMonthSummary[];
  centreCashflowSummaries: CentreCashflowSummary[];
  thisWeekVsLastWeek: PeriodComparison;
  momComparison: PeriodComparison;
  yoyComparison: PeriodComparison;
  weeks: CashReceiptsWeekRow[];
  sixMonthTrend: MonthlyTrendRow[];
  yearlyRunningLedger: YearlyRunningLedgerSummary;
  availableMonths: { yearMonth: string; label: string; shortLabel: string }[];
}

const VALID_INVOICE_STATUSES = new Set(['sent', 'partially_paid', 'paid']);

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Formats integer pence as a GBP currency string (e.g. £1,234.50).
 */
export function formatPenceToGBP(pence: number, options?: { maximumFractionDigits?: number }): string {
  const maxDigits = options?.maximumFractionDigits ?? 2;
  const minDigits = maxDigits === 0 ? 0 : 2;
  if (pence < 0) {
    const absFormatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(Math.abs(pence) / 100);
    return `−${absFormatted}`;
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(pence / 100);
}

/**
 * Formats signed integer pence delta as a GBP string with explicit + or − prefix.
 */
export function formatSignedPenceDelta(deltaPence: number): string {
  if (deltaPence === 0) return '£0.00';
  const sign = deltaPence > 0 ? '+' : '−';
  return `${sign}${formatPenceToGBP(Math.abs(deltaPence))}`;
}

/**
 * Validates whether a payment record qualifies as verified real cash received (INV-3).
 * Excludes:
 * - non-verified or reversed payments
 * - draft or void invoices
 * - internal credit allocations (transactionReference starting with 'CREDIT-')
 * - zero or negative amounts
 */
export function isQualifyingCashReceiptPayment(payment: CashReceiptPaymentInput): boolean {
  if (payment.status !== 'verified') return false;
  if (payment.reversedAt !== null && payment.reversedAt !== undefined && payment.reversedAt !== '') {
    return false;
  }
  if (!VALID_INVOICE_STATUSES.has(payment.invoiceStatus)) return false;

  if (
    typeof payment.transactionReference === 'string' &&
    payment.transactionReference.trim().toUpperCase().startsWith('CREDIT-')
  ) {
    return false;
  }

  const pence =
    typeof payment.amountPence === 'number'
      ? payment.amountPence
      : parseStoredDecimalToPence(payment.amount);

  return Number.isSafeInteger(pence) && pence > 0;
}

/**
 * Normalizes a raw payment input into integer pence and Europe/London business date.
 */
export function normalizeCashReceiptPayment(
  payment: CashReceiptPaymentInput
): NormalizedCashReceiptPayment | null {
  if (!isQualifyingCashReceiptPayment(payment)) return null;

  const amountPence =
    typeof payment.amountPence === 'number'
      ? payment.amountPence
      : parseStoredDecimalToPence(payment.amount);

  let businessDate: string;
  let recordedAtIso: string;

  if (typeof payment.recordedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payment.recordedAt.trim())) {
    businessDate = payment.recordedAt.trim();
    recordedAtIso = `${businessDate}T12:00:00.000Z`;
  } else {
    const dateObj =
      typeof payment.recordedAt === 'string' ? new Date(payment.recordedAt) : payment.recordedAt;
    if (isNaN(dateObj.getTime())) return null;
    businessDate = toEuropeLondonBusinessDate(dateObj);
    recordedAtIso = dateObj.toISOString();
  }

  return {
    id: payment.id,
    amountPence,
    amountDecimal: formatPenceToDecimal(amountPence),
    method: payment.method,
    transactionReference: payment.transactionReference?.trim() || null,
    recordedAtIso,
    businessDate,
    yearMonth: businessDate.slice(0, 7),
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoiceNumber,
    invoiceStatus: payment.invoiceStatus,
    centreId: payment.centreId,
    centreName: payment.centreName,
    parentId: payment.parentId,
    parentName: payment.parentName,
    students: payment.students ?? [],
  };
}

/**
 * Validates whether an expense record qualifies as an active outgoing.
 */
export function isQualifyingCashReceiptExpense(expense: CashReceiptExpenseInput): boolean {
  if (expense.deletedAt !== null && expense.deletedAt !== undefined && expense.deletedAt !== '') {
    return false;
  }
  const desc = typeof expense.description === 'string' ? expense.description.trim() : '';
  if (!desc) return false;

  const pence =
    typeof expense.amountPence === 'number'
      ? expense.amountPence
      : parseStoredDecimalToPence(expense.amount);

  return Number.isSafeInteger(pence) && pence > 0;
}

/**
 * Normalizes a raw expense input into integer pence and YYYY-MM-DD date.
 */
export function normalizeCashReceiptExpense(
  expense: CashReceiptExpenseInput
): NormalizedCashReceiptExpense | null {
  if (!isQualifyingCashReceiptExpense(expense)) return null;

  const amountPence =
    typeof expense.amountPence === 'number'
      ? expense.amountPence
      : parseStoredDecimalToPence(expense.amount);

  let expenseDate: string;
  if (typeof expense.expenseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense.expenseDate.trim())) {
    expenseDate = expense.expenseDate.trim();
  } else {
    const dateObj =
      typeof expense.expenseDate === 'string' ? new Date(expense.expenseDate) : expense.expenseDate;
    if (isNaN(dateObj.getTime())) return null;
    expenseDate = toEuropeLondonBusinessDate(dateObj);
  }

  let createdAtIso = `${expenseDate}T12:00:00.000Z`;
  if (expense.createdAt) {
    const cDate =
      typeof expense.createdAt === 'string' ? new Date(expense.createdAt) : expense.createdAt;
    if (!isNaN(cDate.getTime())) {
      createdAtIso = cDate.toISOString();
    }
  }

  return {
    id: expense.id,
    expenseDate,
    yearMonth: expenseDate.slice(0, 7),
    amountPence,
    amountDecimal: formatPenceToDecimal(amountPence),
    description: expense.description.trim(),
    category: expense.category?.trim() || 'general',
    centreId: expense.centreId,
    centreName: expense.centreName,
    createdAtIso,
  };
}

// ==================== PURE CALENDAR HELPERS (YYYY-MM-DD) ====================

function parseYmdParts(ymd: string): { year: number; month: number; day: number } {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD date string: ${ymd}`);
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
  };
}

function parseYmParts(ym: string): { year: number; month: number } {
  const match = ym.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid YYYY-MM month string: ${ym}`);
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toUtcMs(ymd: string): number {
  const { year, month, day } = parseYmdParts(ymd);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const ms = toUtcMs(ymd) + days * 86_400_000;
  return fromUtcMs(ms);
}

export function diffDaysInclusive(startYmd: string, endYmd: string): number {
  const diff = Math.round((toUtcMs(endYmd) - toUtcMs(startYmd)) / 86_400_000);
  return diff >= 0 ? diff + 1 : 0;
}

/**
 * Returns the Monday (YYYY-MM-DD) of the Monday–Sunday week containing `ymd`.
 */
export function startOfMondayWeek(ymd: string): string {
  const d = new Date(toUtcMs(ymd));
  const utcDay = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const mondayOffset = (utcDay + 6) % 7; // 0 for Mon, 6 for Sun
  return addDaysYmd(ymd, -mondayOffset);
}

/**
 * Returns the Sunday (YYYY-MM-DD) of the Monday–Sunday week containing `ymd`.
 */
export function endOfMondayWeek(ymd: string): string {
  return addDaysYmd(startOfMondayWeek(ymd), 6);
}

export function getDaysInYearMonth(ym: string): number {
  const { year, month } = parseYmParts(ym);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsYm(ym: string, deltaMonths: number): string {
  const { year, month } = parseYmParts(ym);
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${pad2(nextMonth)}`;
}

export function formatYearMonthFull(ym: string): string {
  const { year, month } = parseYmParts(ym);
  return `${FULL_MONTH_NAMES[month - 1]} ${year}`;
}

export function formatYearMonthShort(ym: string): string {
  const { year, month } = parseYmParts(ym);
  return `${SHORT_MONTH_NAMES[month - 1]} ${year}`;
}

export function formatMonthShortOnly(ymOrYmd: string): string {
  const month = parseInt(ymOrYmd.slice(5, 7), 10);
  return SHORT_MONTH_NAMES[month - 1] ?? '';
}

export function formatDayWithWeekdayShort(ymd: string): string {
  const { year, month, day } = parseYmdParts(ymd);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${SHORT_DAY_NAMES[utcDay]} ${day} ${SHORT_MONTH_NAMES[month - 1]}`;
}

export function formatWeekRangeLabel(startYmd: string, endYmd: string): string {
  if (startYmd === endYmd) {
    return formatDayWithWeekdayShort(startYmd);
  }
  return `${formatDayWithWeekdayShort(startYmd)} – ${formatDayWithWeekdayShort(endYmd)}`;
}

export function formatShortDateRange(
  startYmd: string,
  endYmd: string,
  includeYear = true
): string {
  const s = parseYmdParts(startYmd);
  const e = parseYmdParts(endYmd);
  const yearSuffix = includeYear ? ` ${e.year}` : '';
  if (s.year === e.year && s.month === e.month) {
    if (s.day === e.day) {
      return `${s.day} ${SHORT_MONTH_NAMES[s.month - 1]}${yearSuffix}`;
    }
    return `${s.day}–${e.day} ${SHORT_MONTH_NAMES[s.month - 1]}${yearSuffix}`;
  }
  if (s.year === e.year) {
    return `${s.day} ${SHORT_MONTH_NAMES[s.month - 1]} – ${e.day} ${SHORT_MONTH_NAMES[e.month - 1]}${yearSuffix}`;
  }
  return `${s.day} ${SHORT_MONTH_NAMES[s.month - 1]} ${s.year} – ${e.day} ${SHORT_MONTH_NAMES[e.month - 1]} ${e.year}`;
}

/**
 * Generates all Monday–Sunday week intervals overlapping the given calendar month `YYYY-MM`.
 */
export function generateMonthMondaySundayWeeks(yearMonth: string): Array<{
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  clippedStart: string;
  clippedEnd: string;
  isBoundaryStart: boolean;
  isBoundaryEnd: boolean;
  inMonthDays: number;
  spillBeforeDays: number;
  spillAfterDays: number;
  spillBeforeMonthLabel: string | null;
  spillAfterMonthLabel: string | null;
}> {
  const daysInMonth = getDaysInYearMonth(yearMonth);
  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-${pad2(daysInMonth)}`;

  const firstMonday = startOfMondayWeek(monthStart);
  const weeks = [];
  let cursor = firstMonday;
  let weekNumber = 1;

  while (cursor <= monthEnd) {
    const weekStart = cursor;
    const weekEnd = addDaysYmd(cursor, 6);
    const clippedStart = weekStart > monthStart ? weekStart : monthStart;
    const clippedEnd = weekEnd < monthEnd ? weekEnd : monthEnd;
    const isBoundaryStart = weekStart < monthStart;
    const isBoundaryEnd = weekEnd > monthEnd;

    const inMonthDays = diffDaysInclusive(clippedStart, clippedEnd);
    const spillBeforeDays = isBoundaryStart
      ? diffDaysInclusive(weekStart, addDaysYmd(monthStart, -1))
      : 0;
    const spillAfterDays = isBoundaryEnd
      ? diffDaysInclusive(addDaysYmd(monthEnd, 1), weekEnd)
      : 0;

    weeks.push({
      weekNumber,
      weekStart,
      weekEnd,
      clippedStart,
      clippedEnd,
      isBoundaryStart,
      isBoundaryEnd,
      inMonthDays,
      spillBeforeDays,
      spillAfterDays,
      spillBeforeMonthLabel: isBoundaryStart ? formatMonthShortOnly(weekStart) : null,
      spillAfterMonthLabel: isBoundaryEnd ? formatMonthShortOnly(weekEnd) : null,
    });

    cursor = addDaysYmd(cursor, 7);
    weekNumber += 1;
  }

  return weeks;
}

function sumRange(
  payments: NormalizedCashReceiptPayment[],
  startYmd: string,
  endYmd: string
): { totalPence: number; count: number } {
  let totalPence = 0;
  let count = 0;
  for (const p of payments) {
    if (p.businessDate >= startYmd && p.businessDate <= endYmd) {
      totalPence += p.amountPence;
      count += 1;
    }
  }
  return { totalPence, count };
}

function sumExpenseRange(
  expenses: NormalizedCashReceiptExpense[],
  startYmd: string,
  endYmd: string
): { totalPence: number; count: number } {
  let totalPence = 0;
  let count = 0;
  for (const e of expenses) {
    if (e.expenseDate >= startYmd && e.expenseDate <= endYmd) {
      totalPence += e.amountPence;
      count += 1;
    }
  }
  return { totalPence, count };
}

function buildComparison(params: {
  mode: PeriodComparison['mode'];
  payments: NormalizedCashReceiptPayment[];
  currentStart: string;
  currentEnd: string;
  currentPeriodLabel: string;
  priorStart: string;
  priorEnd: string;
  priorPeriodLabel: string;
  fullPriorStart: string;
  fullPriorEnd: string;
  fullPriorPeriodLabel: string;
  firstRecordedBusinessDate: string | null;
}): PeriodComparison {
  const {
    mode,
    payments,
    currentStart,
    currentEnd,
    currentPeriodLabel,
    priorStart,
    priorEnd,
    priorPeriodLabel,
    fullPriorStart,
    fullPriorEnd,
    fullPriorPeriodLabel,
    firstRecordedBusinessDate,
  } = params;

  const currentStats = sumRange(payments, currentStart, currentEnd);
  const priorStats = sumRange(payments, priorStart, priorEnd);
  const fullPriorStats = sumRange(payments, fullPriorStart, fullPriorEnd);

  const deltaPence = currentStats.totalPence - priorStats.totalPence;
  const firstRecordedMonthLabel = firstRecordedBusinessDate
    ? formatYearMonthShort(firstRecordedBusinessDate.slice(0, 7))
    : null;

  let comparisonStatus: ComparisonStatus = 'available';
  let deltaPercent: number | null = null;

  // INV-9: Earliest history & zero-base guards
  if (!firstRecordedBusinessDate || priorEnd < firstRecordedBusinessDate) {
    comparisonStatus = 'insufficient_history';
    deltaPercent = null;
  } else if (priorStats.totalPence === 0) {
    comparisonStatus = 'zero_prior_base';
    deltaPercent = null;
  } else {
    comparisonStatus = 'available';
    deltaPercent = Number(
      (((currentStats.totalPence - priorStats.totalPence) / priorStats.totalPence) * 100).toFixed(1)
    );
  }

  const partialHistoryInPrior = Boolean(
    firstRecordedBusinessDate &&
      firstRecordedBusinessDate > priorStart &&
      firstRecordedBusinessDate <= priorEnd
  );

  return {
    mode,
    currentPeriodLabel,
    priorPeriodLabel,
    comparisonRangeLabel: `${currentPeriodLabel} vs ${priorPeriodLabel}`,
    currentStart,
    currentEnd,
    priorStart,
    priorEnd,
    currentPence: currentStats.totalPence,
    currentCount: currentStats.count,
    priorPence: priorStats.totalPence,
    priorCount: priorStats.count,
    fullPriorPeriodPence: fullPriorStats.totalPence,
    fullPriorPeriodCount: fullPriorStats.count,
    fullPriorPeriodLabel,
    deltaPence,
    deltaPercent,
    comparisonStatus,
    partialHistoryInPrior,
    firstRecordedBusinessDate,
    firstRecordedMonthLabel,
  };
}

export function buildMonthComparisons(params: {
  targetMonth: string; // YYYY-MM
  todayBusinessDate: string; // YYYY-MM-DD
  payments: NormalizedCashReceiptPayment[];
  firstRecordedBusinessDate: string | null;
}): {
  momComparison: PeriodComparison;
  yoyComparison: PeriodComparison;
} {
  const { targetMonth, todayBusinessDate, payments, firstRecordedBusinessDate } = params;
  const currentMonth = todayBusinessDate.slice(0, 7);
  const isCurrentMonth = targetMonth === currentMonth;

  const targetDays = getDaysInYearMonth(targetMonth);
  const activeDay = isCurrentMonth
    ? Math.min(parseYmdParts(todayBusinessDate).day, targetDays)
    : targetDays;

  const currentStart = `${targetMonth}-01`;
  const currentEnd = `${targetMonth}-${pad2(activeDay)}`;
  const currentPeriodLabel = isCurrentMonth
    ? formatShortDateRange(currentStart, currentEnd, true)
    : formatYearMonthShort(targetMonth);

  // MoM (M - 1)
  const priorMonth = addMonthsYm(targetMonth, -1);
  const priorMonthDays = getDaysInYearMonth(priorMonth);
  const priorCompareDay = isCurrentMonth ? Math.min(activeDay, priorMonthDays) : priorMonthDays;
  const priorMonthStart = `${priorMonth}-01`;
  const priorMonthCompareEnd = `${priorMonth}-${pad2(priorCompareDay)}`;
  const priorMonthFullEnd = `${priorMonth}-${pad2(priorMonthDays)}`;
  const priorMonthLabel = isCurrentMonth
    ? formatShortDateRange(priorMonthStart, priorMonthCompareEnd, true)
    : formatYearMonthShort(priorMonth);

  const momComparison = buildComparison({
    mode: isCurrentMonth ? 'mtd_same_day' : 'full_month',
    payments,
    currentStart,
    currentEnd,
    currentPeriodLabel,
    priorStart: priorMonthStart,
    priorEnd: priorMonthCompareEnd,
    priorPeriodLabel: priorMonthLabel,
    fullPriorStart: priorMonthStart,
    fullPriorEnd: priorMonthFullEnd,
    fullPriorPeriodLabel: formatYearMonthShort(priorMonth),
    firstRecordedBusinessDate,
  });

  // YoY (M - 12)
  const priorYearMonth = addMonthsYm(targetMonth, -12);
  const priorYearDays = getDaysInYearMonth(priorYearMonth);
  const priorYearCompareDay = isCurrentMonth ? Math.min(activeDay, priorYearDays) : priorYearDays;
  const priorYearStart = `${priorYearMonth}-01`;
  const priorYearCompareEnd = `${priorYearMonth}-${pad2(priorYearCompareDay)}`;
  const priorYearFullEnd = `${priorYearMonth}-${pad2(priorYearDays)}`;
  const priorYearLabel = isCurrentMonth
    ? formatShortDateRange(priorYearStart, priorYearCompareEnd, true)
    : formatYearMonthShort(priorYearMonth);

  const yoyComparison = buildComparison({
    mode: isCurrentMonth ? 'mtd_same_day' : 'full_month',
    payments,
    currentStart,
    currentEnd,
    currentPeriodLabel,
    priorStart: priorYearStart,
    priorEnd: priorYearCompareEnd,
    priorPeriodLabel: priorYearLabel,
    fullPriorStart: priorYearStart,
    fullPriorEnd: priorYearFullEnd,
    fullPriorPeriodLabel: formatYearMonthShort(priorYearMonth),
    firstRecordedBusinessDate,
  });

  return { momComparison, yoyComparison };
}

/**
 * Normalizes a requested month parameter (`YYYY-MM`), falling back to `currentMonth` if invalid.
 */
export function resolveTargetYearMonth(
  requestedMonth: string | undefined | null,
  currentMonth: string
): string {
  if (!requestedMonth || typeof requestedMonth !== 'string') return currentMonth;
  const trimmed = requestedMonth.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) return currentMonth;
  const year = parseInt(trimmed.slice(0, 4), 10);
  if (year < 2020 || year > 2100) return currentMonth;
  return trimmed;
}

/**
 * Primary Pure Domain Engine for Owner Cash Received, Weekly Outgoings/Expenses,
 * Weekly Rolling Net Tally, MoM/YoY Comparisons, and Jan–Dec Yearly Running Totals.
 */
export function buildCashReceiptsLedger(params: {
  payments: CashReceiptPaymentInput[];
  expenses?: CashReceiptExpenseInput[];
  centres: CentreRef[];
  selectedMonth?: string | null;
  activeCentreId?: string | null;
  today?: Date | string;
  earliestRecordedBusinessDate?: string | null;
}): CashReceiptsLedgerResult {
  const {
    payments: rawPayments,
    expenses: rawExpenses = [],
    centres,
    selectedMonth: rawSelectedMonth,
    activeCentreId: rawActiveCentreId,
    today = new Date(),
    earliestRecordedBusinessDate,
  } = params;

  const todayBusinessDate =
    typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today.trim())
      ? today.trim()
      : toEuropeLondonBusinessDate(today);
  const currentMonth = todayBusinessDate.slice(0, 7);
  const selectedMonth = resolveTargetYearMonth(rawSelectedMonth, currentMonth);
  const isViewingCurrentMonth = selectedMonth === currentMonth;

  // Deduplicate and normalize all qualifying payments across the organisation
  const seenIds = new Set<string>();
  const allNormalized: NormalizedCashReceiptPayment[] = [];
  for (const raw of rawPayments) {
    if (!raw?.id || seenIds.has(raw.id)) continue;
    const norm = normalizeCashReceiptPayment(raw);
    if (norm) {
      seenIds.add(norm.id);
      allNormalized.push(norm);
    }
  }

  // Sort chronologically by businessDate ASC, then recordedAtIso ASC, then id ASC
  allNormalized.sort(
    (a, b) =>
      a.businessDate.localeCompare(b.businessDate) ||
      a.recordedAtIso.localeCompare(b.recordedAtIso) ||
      a.id.localeCompare(b.id)
  );

  // Deduplicate and normalize all qualifying expenses across the organisation
  const seenExpenseIds = new Set<string>();
  const allNormalizedExpenses: NormalizedCashReceiptExpense[] = [];
  for (const rawExp of rawExpenses) {
    if (!rawExp?.id || seenExpenseIds.has(rawExp.id)) continue;
    const normExp = normalizeCashReceiptExpense(rawExp);
    if (normExp) {
      seenExpenseIds.add(normExp.id);
      allNormalizedExpenses.push(normExp);
    }
  }

  allNormalizedExpenses.sort(
    (a, b) =>
      a.expenseDate.localeCompare(b.expenseDate) ||
      a.createdAtIso.localeCompare(b.createdAtIso) ||
      a.id.localeCompare(b.id)
  );

  // Determine active centre scope
  const validCentreIds = new Set(centres.map((c) => c.id));
  const activeCentreId =
    rawActiveCentreId && rawActiveCentreId !== 'all' && validCentreIds.has(rawActiveCentreId)
      ? rawActiveCentreId
      : 'all';
  const activeCentreName =
    activeCentreId === 'all'
      ? 'All Centres'
      : centres.find((c) => c.id === activeCentreId)?.name ?? 'Selected Centre';

  const scopedPayments =
    activeCentreId === 'all'
      ? allNormalized
      : allNormalized.filter((p) => p.centreId === activeCentreId);

  const scopedExpenses =
    activeCentreId === 'all'
      ? allNormalizedExpenses
      : allNormalizedExpenses.filter((e) => e.centreId === activeCentreId);

  // Earliest recorded business date for INV-9 history guards
  let firstRecordedBusinessDate: string | null = earliestRecordedBusinessDate ?? null;
  for (const p of scopedPayments) {
    if (!firstRecordedBusinessDate || p.businessDate < firstRecordedBusinessDate) {
      firstRecordedBusinessDate = p.businessDate;
    }
  }
  if (!firstRecordedBusinessDate && allNormalized.length > 0) {
    firstRecordedBusinessDate = allNormalized[0].businessDate;
  }
  const firstRecordedMonthLabel = firstRecordedBusinessDate
    ? formatYearMonthShort(firstRecordedBusinessDate.slice(0, 7))
    : null;

  // Compute selected month summary across all centres (for Centre Switcher pills & split bar)
  const monthDays = getDaysInYearMonth(selectedMonth);
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = `${selectedMonth}-${pad2(monthDays)}`;

  let allCentresMonthTotalPence = 0;
  let allCentresMonthPaymentCount = 0;
  let allCentresMonthExpenseTotalPence = 0;
  let allCentresMonthExpenseCount = 0;

  const centreTotalsMap = new Map<string, { pence: number; count: number }>();
  const centreExpensesMap = new Map<string, { pence: number; count: number }>();
  for (const c of centres) {
    centreTotalsMap.set(c.id, { pence: 0, count: 0 });
    centreExpensesMap.set(c.id, { pence: 0, count: 0 });
  }

  for (const p of allNormalized) {
    if (p.businessDate >= monthStart && p.businessDate <= monthEnd) {
      allCentresMonthTotalPence += p.amountPence;
      allCentresMonthPaymentCount += 1;
      const entry = centreTotalsMap.get(p.centreId) ?? { pence: 0, count: 0 };
      entry.pence += p.amountPence;
      entry.count += 1;
      centreTotalsMap.set(p.centreId, entry);
    }
  }

  for (const e of allNormalizedExpenses) {
    if (e.expenseDate >= monthStart && e.expenseDate <= monthEnd) {
      allCentresMonthExpenseTotalPence += e.amountPence;
      allCentresMonthExpenseCount += 1;
      const entry = centreExpensesMap.get(e.centreId) ?? { pence: 0, count: 0 };
      entry.pence += e.amountPence;
      entry.count += 1;
      centreExpensesMap.set(e.centreId, entry);
    }
  }

  const allCentresMonthNetPence = allCentresMonthTotalPence - allCentresMonthExpenseTotalPence;

  // Preserve exact CentreMonthSummary shape for existing consumers and tests
  const centreSummaries: CentreMonthSummary[] = centres.map((c) => {
    const entry = centreTotalsMap.get(c.id) ?? { pence: 0, count: 0 };
    const sharePercent =
      allCentresMonthTotalPence > 0
        ? Number(((entry.pence / allCentresMonthTotalPence) * 100).toFixed(1))
        : 0;
    return {
      centreId: c.id,
      centreName: c.name,
      monthPence: entry.pence,
      monthCount: entry.count,
      sharePercent,
    };
  });

  const centreCashflowSummaries: CentreCashflowSummary[] = centres.map((c) => {
    const inc = centreTotalsMap.get(c.id) ?? { pence: 0, count: 0 };
    const exp = centreExpensesMap.get(c.id) ?? { pence: 0, count: 0 };
    const incomeSharePercent =
      allCentresMonthTotalPence > 0
        ? Number(((inc.pence / allCentresMonthTotalPence) * 100).toFixed(1))
        : 0;
    return {
      centreId: c.id,
      centreName: c.name,
      monthIncomePence: inc.pence,
      monthIncomeCount: inc.count,
      monthExpensePence: exp.pence,
      monthExpenseCount: exp.count,
      monthNetPence: inc.pence - exp.pence,
      incomeSharePercent,
    };
  });

  // Build Monday–Sunday weeks for selectedMonth
  const rawWeeks = generateMonthMondaySundayWeeks(selectedMonth);
  let rollingMonthTallyPence = 0;
  let rollingMonthPaymentCount = 0;
  let rollingMonthExpenseTallyPence = 0;
  let rollingMonthExpensePaymentCount = 0;

  const rollingCentreTallyMap = new Map<string, number>();
  const rollingCentreExpenseTallyMap = new Map<string, number>();
  for (const c of centres) {
    rollingCentreTallyMap.set(c.id, 0);
    rollingCentreExpenseTallyMap.set(c.id, 0);
  }

  const weeks: CashReceiptsWeekRow[] = rawWeeks.map((w) => {
    const weekPaymentsRaw = scopedPayments.filter(
      (p) => p.businessDate >= w.weekStart && p.businessDate <= w.weekEnd
    );
    const weekExpensesRaw = scopedExpenses.filter(
      (e) => e.expenseDate >= w.weekStart && e.expenseDate <= w.weekEnd
    );

    let inMonthPence = 0;
    let inMonthCount = 0;
    let fullWeekPence = 0;
    let fullWeekCount = 0;
    let spillBeforePence = 0;
    let spillBeforeCount = 0;
    let spillAfterPence = 0;
    let spillAfterCount = 0;

    const weekPayments: WeekCashReceiptPayment[] = weekPaymentsRaw.map((p) => {
      const inSelectedMonth = p.businessDate >= w.clippedStart && p.businessDate <= w.clippedEnd;
      const spillDirection: WeekCashReceiptPayment['spillDirection'] =
        p.businessDate < monthStart
          ? 'before'
          : p.businessDate > monthEnd
            ? 'after'
            : 'in_month';

      fullWeekPence += p.amountPence;
      fullWeekCount += 1;

      if (inSelectedMonth) {
        inMonthPence += p.amountPence;
        inMonthCount += 1;
      } else if (spillDirection === 'before') {
        spillBeforePence += p.amountPence;
        spillBeforeCount += 1;
      } else {
        spillAfterPence += p.amountPence;
        spillAfterCount += 1;
      }

      return {
        ...p,
        inSelectedMonth,
        spillDirection,
      };
    });

    let inMonthExpensePence = 0;
    let inMonthExpenseCount = 0;
    let fullWeekExpensePence = 0;
    let fullWeekExpenseCount = 0;
    let spillBeforeExpensePence = 0;
    let spillBeforeExpenseCount = 0;
    let spillAfterExpensePence = 0;
    let spillAfterExpenseCount = 0;

    const weekExpenses: WeekCashReceiptExpense[] = weekExpensesRaw.map((e) => {
      const inSelectedMonth = e.expenseDate >= w.clippedStart && e.expenseDate <= w.clippedEnd;
      const spillDirection: WeekCashReceiptExpense['spillDirection'] =
        e.expenseDate < monthStart
          ? 'before'
          : e.expenseDate > monthEnd
            ? 'after'
            : 'in_month';

      fullWeekExpensePence += e.amountPence;
      fullWeekExpenseCount += 1;

      if (inSelectedMonth) {
        inMonthExpensePence += e.amountPence;
        inMonthExpenseCount += 1;
      } else if (spillDirection === 'before') {
        spillBeforeExpensePence += e.amountPence;
        spillBeforeExpenseCount += 1;
      } else {
        spillAfterExpensePence += e.amountPence;
        spillAfterExpenseCount += 1;
      }

      return {
        ...e,
        inSelectedMonth,
        spillDirection,
      };
    });

    const inMonthNetPence = inMonthPence - inMonthExpensePence;
    const fullWeekNetPence = fullWeekPence - fullWeekExpensePence;

    rollingMonthTallyPence += inMonthPence;
    rollingMonthPaymentCount += inMonthCount;
    rollingMonthExpenseTallyPence += inMonthExpensePence;
    rollingMonthExpensePaymentCount += inMonthExpenseCount;
    const rollingMonthNetTallyPence = rollingMonthTallyPence - rollingMonthExpenseTallyPence;

    // Per-centre breakdown for this week (always computed from allNormalized + allNormalizedExpenses)
    const byCentre: WeekCentreBreakdown[] = centres.map((c) => {
      let cInMonthPence = 0;
      let cInMonthCount = 0;
      let cFullWeekPence = 0;
      let cFullWeekCount = 0;

      for (const p of allNormalized) {
        if (p.centreId !== c.id) continue;
        if (p.businessDate >= w.weekStart && p.businessDate <= w.weekEnd) {
          cFullWeekPence += p.amountPence;
          cFullWeekCount += 1;
          if (p.businessDate >= w.clippedStart && p.businessDate <= w.clippedEnd) {
            cInMonthPence += p.amountPence;
            cInMonthCount += 1;
          }
        }
      }

      let cInMonthExpensePence = 0;
      let cInMonthExpenseCount = 0;
      let cFullWeekExpensePence = 0;
      let cFullWeekExpenseCount = 0;

      for (const e of allNormalizedExpenses) {
        if (e.centreId !== c.id) continue;
        if (e.expenseDate >= w.weekStart && e.expenseDate <= w.weekEnd) {
          cFullWeekExpensePence += e.amountPence;
          cFullWeekExpenseCount += 1;
          if (e.expenseDate >= w.clippedStart && e.expenseDate <= w.clippedEnd) {
            cInMonthExpensePence += e.amountPence;
            cInMonthExpenseCount += 1;
          }
        }
      }

      const nextRolling = (rollingCentreTallyMap.get(c.id) ?? 0) + cInMonthPence;
      rollingCentreTallyMap.set(c.id, nextRolling);

      const nextExpenseRolling =
        (rollingCentreExpenseTallyMap.get(c.id) ?? 0) + cInMonthExpensePence;
      rollingCentreExpenseTallyMap.set(c.id, nextExpenseRolling);

      return {
        centreId: c.id,
        centreName: c.name,
        inMonthPence: cInMonthPence,
        inMonthCount: cInMonthCount,
        fullWeekPence: cFullWeekPence,
        fullWeekCount: cFullWeekCount,
        rollingTallyPence: nextRolling,
        inMonthExpensePence: cInMonthExpensePence,
        inMonthExpenseCount: cInMonthExpenseCount,
        fullWeekExpensePence: cFullWeekExpensePence,
        fullWeekExpenseCount: cFullWeekExpenseCount,
        rollingExpenseTallyPence: nextExpenseRolling,
        inMonthNetPence: cInMonthPence - cInMonthExpensePence,
        fullWeekNetPence: cFullWeekPence - cFullWeekExpensePence,
        rollingNetTallyPence: nextRolling - nextExpenseRolling,
      };
    });

    let state: WeekLifecycleState;
    if (todayBusinessDate < w.weekStart) {
      state = 'upcoming';
    } else if (todayBusinessDate > w.weekEnd) {
      state = 'completed';
    } else {
      state = 'current';
    }

    return {
      weekNumber: w.weekNumber,
      weekKey: `${w.weekStart}_${w.weekEnd}`,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      clippedStart: w.clippedStart,
      clippedEnd: w.clippedEnd,
      weekRangeLabel: formatWeekRangeLabel(w.weekStart, w.weekEnd),
      clippedRangeLabel: formatWeekRangeLabel(w.clippedStart, w.clippedEnd),
      isBoundaryStart: w.isBoundaryStart,
      isBoundaryEnd: w.isBoundaryEnd,
      inMonthDays: w.inMonthDays,
      spillBeforeDays: w.spillBeforeDays,
      spillAfterDays: w.spillAfterDays,
      spillBeforeMonthLabel: w.spillBeforeMonthLabel,
      spillAfterMonthLabel: w.spillAfterMonthLabel,
      inMonthPence,
      inMonthCount,
      fullWeekPence,
      fullWeekCount,
      spillBeforePence,
      spillBeforeCount,
      spillAfterPence,
      spillAfterCount,
      inMonthExpensePence,
      inMonthExpenseCount,
      fullWeekExpensePence,
      fullWeekExpenseCount,
      spillBeforeExpensePence,
      spillBeforeExpenseCount,
      spillAfterExpensePence,
      spillAfterExpenseCount,
      inMonthNetPence,
      fullWeekNetPence,
      rollingMonthTallyPence,
      rollingMonthPaymentCount,
      rollingMonthExpenseTallyPence,
      rollingMonthExpensePaymentCount,
      rollingMonthNetTallyPence,
      byCentre,
      state,
      payments: weekPayments,
      expenses: weekExpenses,
    };
  });

  // Month totals strictly equal the final rollingMonthTallyPence (zero double-counting across months)
  const monthTotalPence = rollingMonthTallyPence;
  const monthPaymentCount = rollingMonthPaymentCount;
  const monthExpenseTotalPence = rollingMonthExpenseTallyPence;
  const monthExpenseCount = rollingMonthExpensePaymentCount;
  const monthNetPence = monthTotalPence - monthExpenseTotalPence;

  // Headline Pulse: Current Week (Mon–Sun) vs Last Week (Mon–Sun) relative to todayBusinessDate
  const currentWeekStart = startOfMondayWeek(todayBusinessDate);
  const currentWeekEnd = endOfMondayWeek(todayBusinessDate);
  const lastWeekStart = addDaysYmd(currentWeekStart, -7);
  const lastWeekEnd = addDaysYmd(currentWeekStart, -1);

  const thisWeekVsLastWeek = buildComparison({
    mode: 'week_on_week',
    payments: scopedPayments,
    currentStart: currentWeekStart,
    currentEnd: currentWeekEnd,
    currentPeriodLabel: formatShortDateRange(currentWeekStart, currentWeekEnd, false),
    priorStart: lastWeekStart,
    priorEnd: lastWeekEnd,
    priorPeriodLabel: formatShortDateRange(lastWeekStart, lastWeekEnd, false),
    fullPriorStart: lastWeekStart,
    fullPriorEnd: lastWeekEnd,
    fullPriorPeriodLabel: formatShortDateRange(lastWeekStart, lastWeekEnd, true),
    firstRecordedBusinessDate,
  });

  const thisWeekExpenseStats = sumExpenseRange(scopedExpenses, currentWeekStart, currentWeekEnd);
  const lastWeekExpenseStats = sumExpenseRange(scopedExpenses, lastWeekStart, lastWeekEnd);
  const thisWeekExpensePence = thisWeekExpenseStats.totalPence;
  const thisWeekExpenseCount = thisWeekExpenseStats.count;
  const thisWeekNetPence = thisWeekVsLastWeek.currentPence - thisWeekExpensePence;
  const lastWeekExpensePence = lastWeekExpenseStats.totalPence;
  const lastWeekNetPence = thisWeekVsLastWeek.priorPence - lastWeekExpensePence;

  // MoM and YoY Comparisons for selectedMonth
  const { momComparison, yoyComparison } = buildMonthComparisons({
    targetMonth: selectedMonth,
    todayBusinessDate,
    payments: scopedPayments,
    firstRecordedBusinessDate,
  });

  // 6-Month Comparison & YoY Trajectory Table (ending at selectedMonth, newest first)
  const sixMonthTrend: MonthlyTrendRow[] = [];
  for (let offset = 0; offset >= -5; offset -= 1) {
    const ym = addMonthsYm(selectedMonth, offset);
    const ymDays = getDaysInYearMonth(ym);
    const ymStart = `${ym}-01`;
    const ymEnd = `${ym}-${pad2(ymDays)}`;

    const scopedStats = sumRange(scopedPayments, ymStart, ymEnd);
    const scopedExpStats = sumExpenseRange(scopedExpenses, ymStart, ymEnd);
    const allCentresStats = sumRange(allNormalized, ymStart, ymEnd);

    const byCentre: CentreMonthSummary[] = centres.map((c) => {
      let cPence = 0;
      let cCount = 0;
      for (const p of allNormalized) {
        if (p.centreId === c.id && p.businessDate >= ymStart && p.businessDate <= ymEnd) {
          cPence += p.amountPence;
          cCount += 1;
        }
      }
      const sharePercent =
        allCentresStats.totalPence > 0
          ? Number(((cPence / allCentresStats.totalPence) * 100).toFixed(1))
          : 0;
      return {
        centreId: c.id,
        centreName: c.name,
        monthPence: cPence,
        monthCount: cCount,
        sharePercent,
      };
    });

    const comparisons = buildMonthComparisons({
      targetMonth: ym,
      todayBusinessDate,
      payments: scopedPayments,
      firstRecordedBusinessDate,
    });

    sixMonthTrend.push({
      yearMonth: ym,
      monthLabel: formatYearMonthFull(ym),
      shortMonthLabel: formatYearMonthShort(ym),
      isCurrentMonth: ym === currentMonth,
      isSelectedMonth: ym === selectedMonth,
      totalPence: scopedStats.totalPence,
      paymentCount: scopedStats.count,
      expensePence: scopedExpStats.totalPence,
      expenseCount: scopedExpStats.count,
      netPence: scopedStats.totalPence - scopedExpStats.totalPence,
      byCentre,
      momComparison: comparisons.momComparison,
      yoyComparison: comparisons.yoyComparison,
    });
  }

  // ==================== YEARLY RUNNING TOTAL LEDGER (JAN–DEC) ====================
  const selectedYear = parseYmParts(selectedMonth).year;
  const currentYear = parseYmParts(currentMonth).year;
  const activeEndMonthNum =
    selectedYear === currentYear
      ? Math.max(parseYmParts(currentMonth).month, parseYmParts(selectedMonth).month)
      : 12;
  const ytdCutoffMonth = `${selectedYear}-${pad2(activeEndMonthNum)}`;
  const rangeLabel =
    selectedYear === currentYear
      ? activeEndMonthNum === 1
        ? `Jan ${selectedYear} (YTD)`
        : `Jan – ${SHORT_MONTH_NAMES[activeEndMonthNum - 1]} ${selectedYear} (YTD)`
      : `Jan – Dec ${selectedYear}`;

  let runningYearlyIncomePence = 0;
  let runningYearlyIncomeCount = 0;
  let runningYearlyExpensePence = 0;
  let runningYearlyExpenseCount = 0;

  let throughSelectedMonthIncomePence = 0;
  let throughSelectedMonthExpensePence = 0;
  let throughSelectedMonthNetPence = 0;

  const yearlyCentreRunningMap = new Map<
    string,
    { incomePence: number; incomeCount: number; expensePence: number; expenseCount: number }
  >();
  for (const c of centres) {
    yearlyCentreRunningMap.set(c.id, {
      incomePence: 0,
      incomeCount: 0,
      expensePence: 0,
      expenseCount: 0,
    });
  }

  const yearlyMonths: YearlyRunningMonthRow[] = [];
  for (let m = 1; m <= activeEndMonthNum; m += 1) {
    const ym = `${selectedYear}-${pad2(m)}`;
    const ymDays = getDaysInYearMonth(ym);
    const ymStart = `${ym}-01`;
    const ymEnd = `${ym}-${pad2(ymDays)}`;

    const monthInc = sumRange(scopedPayments, ymStart, ymEnd);
    const monthExp = sumExpenseRange(scopedExpenses, ymStart, ymEnd);
    const monthNet = monthInc.totalPence - monthExp.totalPence;
    const netMarginPercent =
      monthInc.totalPence > 0
        ? Number(((monthNet / monthInc.totalPence) * 100).toFixed(1))
        : null;

    runningYearlyIncomePence += monthInc.totalPence;
    runningYearlyIncomeCount += monthInc.count;
    runningYearlyExpensePence += monthExp.totalPence;
    runningYearlyExpenseCount += monthExp.count;
    const runningYearlyNetPence = runningYearlyIncomePence - runningYearlyExpensePence;

    if (ym <= selectedMonth) {
      throughSelectedMonthIncomePence = runningYearlyIncomePence;
      throughSelectedMonthExpensePence = runningYearlyExpensePence;
      throughSelectedMonthNetPence = runningYearlyNetPence;
    }

    const byCentre: YearlyRunningCentreBreakdown[] = centres.map((c) => {
      let cIncPence = 0;
      let cIncCount = 0;
      for (const p of allNormalized) {
        if (p.centreId === c.id && p.businessDate >= ymStart && p.businessDate <= ymEnd) {
          cIncPence += p.amountPence;
          cIncCount += 1;
        }
      }
      let cExpPence = 0;
      let cExpCount = 0;
      for (const e of allNormalizedExpenses) {
        if (e.centreId === c.id && e.expenseDate >= ymStart && e.expenseDate <= ymEnd) {
          cExpPence += e.amountPence;
          cExpCount += 1;
        }
      }

      const prevRunning = yearlyCentreRunningMap.get(c.id) ?? {
        incomePence: 0,
        incomeCount: 0,
        expensePence: 0,
        expenseCount: 0,
      };
      const nextRunning = {
        incomePence: prevRunning.incomePence + cIncPence,
        incomeCount: prevRunning.incomeCount + cIncCount,
        expensePence: prevRunning.expensePence + cExpPence,
        expenseCount: prevRunning.expenseCount + cExpCount,
      };
      yearlyCentreRunningMap.set(c.id, nextRunning);

      return {
        centreId: c.id,
        centreName: c.name,
        incomePence: cIncPence,
        incomeCount: cIncCount,
        expensePence: cExpPence,
        expenseCount: cExpCount,
        netPence: cIncPence - cExpPence,
        runningIncomePence: nextRunning.incomePence,
        runningExpensePence: nextRunning.expensePence,
        runningNetPence: nextRunning.incomePence - nextRunning.expensePence,
      };
    });

    const { momComparison: momIncomeComparison } = buildMonthComparisons({
      targetMonth: ym,
      todayBusinessDate,
      payments: scopedPayments,
      firstRecordedBusinessDate,
    });

    yearlyMonths.push({
      yearMonth: ym,
      monthLabel: formatYearMonthFull(ym),
      shortMonthLabel: formatYearMonthShort(ym),
      isCurrentMonth: ym === currentMonth,
      isSelectedMonth: ym === selectedMonth,
      incomePence: monthInc.totalPence,
      incomeCount: monthInc.count,
      expensePence: monthExp.totalPence,
      expenseCount: monthExp.count,
      netPence: monthNet,
      netMarginPercent,
      runningYearlyIncomePence,
      runningYearlyIncomeCount,
      runningYearlyExpensePence,
      runningYearlyExpenseCount,
      runningYearlyNetPence,
      byCentre,
      momIncomeComparison,
    });
  }

  const totalYearlyNetPence = runningYearlyIncomePence - runningYearlyExpensePence;
  const totalYearlyNetMarginPercent =
    runningYearlyIncomePence > 0
      ? Number(((totalYearlyNetPence / runningYearlyIncomePence) * 100).toFixed(1))
      : null;

  const availableYearsSet = new Set<number>([currentYear, selectedYear, currentYear - 1]);
  for (const p of allNormalized) {
    const yr = parseInt(p.businessDate.slice(0, 4), 10);
    if (yr >= 2020 && yr <= 2100) availableYearsSet.add(yr);
  }
  for (const e of allNormalizedExpenses) {
    const yr = parseInt(e.expenseDate.slice(0, 4), 10);
    if (yr >= 2020 && yr <= 2100) availableYearsSet.add(yr);
  }
  const availableYears = Array.from(availableYearsSet).sort((a, b) => b - a);

  const yearlyRunningLedger: YearlyRunningLedgerSummary = {
    selectedYear,
    rangeLabel,
    ytdCutoffMonth,
    totalIncomePence: runningYearlyIncomePence,
    totalIncomeCount: runningYearlyIncomeCount,
    totalExpensePence: runningYearlyExpensePence,
    totalExpenseCount: runningYearlyExpenseCount,
    totalNetPence: totalYearlyNetPence,
    netMarginPercent: totalYearlyNetMarginPercent,
    throughSelectedMonthIncomePence,
    throughSelectedMonthExpensePence,
    throughSelectedMonthNetPence,
    byCentre: centres.map((c) => {
      const totals = yearlyCentreRunningMap.get(c.id) ?? {
        incomePence: 0,
        incomeCount: 0,
        expensePence: 0,
        expenseCount: 0,
      };
      return {
        centreId: c.id,
        centreName: c.name,
        totalIncomePence: totals.incomePence,
        totalIncomeCount: totals.incomeCount,
        totalExpensePence: totals.expensePence,
        totalExpenseCount: totals.expenseCount,
        totalNetPence: totals.incomePence - totals.expensePence,
      };
    }),
    months: yearlyMonths,
    availableYears,
  };

  // Available quick-jump months (last 12 months ending at currentMonth, plus selectedMonth if older)
  const availableMonthsMap = new Map<
    string,
    { yearMonth: string; label: string; shortLabel: string }
  >();
  for (let offset = 0; offset >= -11; offset -= 1) {
    const ym = addMonthsYm(currentMonth, offset);
    availableMonthsMap.set(ym, {
      yearMonth: ym,
      label: formatYearMonthFull(ym),
      shortLabel: formatYearMonthShort(ym),
    });
  }
  if (!availableMonthsMap.has(selectedMonth)) {
    availableMonthsMap.set(selectedMonth, {
      yearMonth: selectedMonth,
      label: formatYearMonthFull(selectedMonth),
      shortLabel: formatYearMonthShort(selectedMonth),
    });
  }
  const availableMonths = Array.from(availableMonthsMap.values()).sort((a, b) =>
    b.yearMonth.localeCompare(a.yearMonth)
  );

  return {
    selectedMonth,
    selectedMonthLabel: formatYearMonthFull(selectedMonth),
    selectedMonthShortLabel: formatMonthShortOnly(selectedMonth),
    currentMonth,
    todayBusinessDate,
    isViewingCurrentMonth,
    activeCentreId,
    activeCentreName,
    firstRecordedBusinessDate,
    firstRecordedMonthLabel,
    monthTotalPence,
    monthPaymentCount,
    monthExpenseTotalPence,
    monthExpenseCount,
    monthNetPence,
    allCentresMonthTotalPence,
    allCentresMonthPaymentCount,
    allCentresMonthExpenseTotalPence,
    allCentresMonthExpenseCount,
    allCentresMonthNetPence,
    thisWeekExpensePence,
    thisWeekExpenseCount,
    thisWeekNetPence,
    lastWeekExpensePence,
    lastWeekNetPence,
    centreSummaries,
    centreCashflowSummaries,
    thisWeekVsLastWeek,
    momComparison,
    yoyComparison,
    weeks,
    sixMonthTrend,
    yearlyRunningLedger,
    availableMonths,
  };
}
