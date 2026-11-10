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

export interface WeekCashReceiptPayment extends NormalizedCashReceiptPayment {
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
  rollingMonthTallyPence: number;
  rollingMonthPaymentCount: number;
  byCentre: WeekCentreBreakdown[];
  state: WeekLifecycleState;
  payments: WeekCashReceiptPayment[];
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

export interface MonthlyTrendRow {
  yearMonth: string; // YYYY-MM
  monthLabel: string; // e.g. "November 2026"
  shortMonthLabel: string; // e.g. "Nov 2026"
  isCurrentMonth: boolean;
  isSelectedMonth: boolean;
  totalPence: number;
  paymentCount: number;
  byCentre: CentreMonthSummary[];
  momComparison: PeriodComparison;
  yoyComparison: PeriodComparison;
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
  allCentresMonthTotalPence: number;
  allCentresMonthPaymentCount: number;
  centreSummaries: CentreMonthSummary[];
  thisWeekVsLastWeek: PeriodComparison;
  momComparison: PeriodComparison;
  yoyComparison: PeriodComparison;
  weeks: CashReceiptsWeekRow[];
  sixMonthTrend: MonthlyTrendRow[];
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
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(pence / 100);
}

/**
 * Formats signed integer pence delta as a GBP string with explicit + or - prefix.
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
 * Primary Pure Domain Engine for Owner Cash Received, Weekly Rolling Tally, and MoM/YoY Comparisons.
 */
export function buildCashReceiptsLedger(params: {
  payments: CashReceiptPaymentInput[];
  centres: CentreRef[];
  selectedMonth?: string | null;
  activeCentreId?: string | null;
  today?: Date | string;
  earliestRecordedBusinessDate?: string | null;
}): CashReceiptsLedgerResult {
  const {
    payments: rawPayments,
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

  // Earliest recorded business date for INV-9 history guards
  let firstRecordedBusinessDate: string | null = earliestRecordedBusinessDate ?? null;
  for (const p of scopedPayments) {
    if (!firstRecordedBusinessDate || p.businessDate < firstRecordedBusinessDate) {
      firstRecordedBusinessDate = p.businessDate;
    }
  }
  // Fallback to org-wide earliest payment if scoped centre has no payments yet but org has history
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
  const centreTotalsMap = new Map<string, { pence: number; count: number }>();
  for (const c of centres) {
    centreTotalsMap.set(c.id, { pence: 0, count: 0 });
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

  // Build Monday–Sunday weeks for selectedMonth
  const rawWeeks = generateMonthMondaySundayWeeks(selectedMonth);
  let rollingMonthTallyPence = 0;
  let rollingMonthPaymentCount = 0;
  const rollingCentreTallyMap = new Map<string, number>();
  for (const c of centres) {
    rollingCentreTallyMap.set(c.id, 0);
  }

  const weeks: CashReceiptsWeekRow[] = rawWeeks.map((w) => {
    const weekPaymentsRaw = scopedPayments.filter(
      (p) => p.businessDate >= w.weekStart && p.businessDate <= w.weekEnd
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

    rollingMonthTallyPence += inMonthPence;
    rollingMonthPaymentCount += inMonthCount;

    // Per-centre breakdown for this week (always computed from allNormalized so All Centres columns work seamlessly)
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

      const nextRolling = (rollingCentreTallyMap.get(c.id) ?? 0) + cInMonthPence;
      rollingCentreTallyMap.set(c.id, nextRolling);

      return {
        centreId: c.id,
        centreName: c.name,
        inMonthPence: cInMonthPence,
        inMonthCount: cInMonthCount,
        fullWeekPence: cFullWeekPence,
        fullWeekCount: cFullWeekCount,
        rollingTallyPence: nextRolling,
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
      rollingMonthTallyPence,
      rollingMonthPaymentCount,
      byCentre,
      state,
      payments: weekPayments,
    };
  });

  // Month total strictly equals the final rollingMonthTallyPence (zero double-counting across months)
  const monthTotalPence = rollingMonthTallyPence;
  const monthPaymentCount = rollingMonthPaymentCount;

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
      byCentre,
      momComparison: comparisons.momComparison,
      yoyComparison: comparisons.yoyComparison,
    });
  }

  // Available quick-jump months (last 6 months ending at currentMonth, plus selectedMonth if older)
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
    allCentresMonthTotalPence,
    allCentresMonthPaymentCount,
    centreSummaries,
    thisWeekVsLastWeek,
    momComparison,
    yoyComparison,
    weeks,
    sixMonthTrend,
    availableMonths,
  };
}
