import { describe, expect, it } from 'vitest';
import {
  buildCashReceiptsLedger,
  formatPenceToGBP,
  formatSignedPenceDelta,
  generateMonthMondaySundayWeeks,
  isQualifyingCashReceiptExpense,
  isQualifyingCashReceiptPayment,
  startOfMondayWeek,
  endOfMondayWeek,
  type CashReceiptExpenseInput,
  type CashReceiptPaymentInput,
  type CentreRef,
} from '../cash-receipts-ledger';

const CENTRES: CentreRef[] = [
  { id: 'centre-sydenham', name: 'Sydenham After School Club' },
  { id: 'centre-dagenham', name: 'Dagenham After School Club' },
];

function makePayment(
  id: string,
  overrides: Partial<CashReceiptPaymentInput> = {}
): CashReceiptPaymentInput {
  return {
    id,
    amount: '100.00',
    method: 'bank_transfer',
    status: 'verified',
    reversedAt: null,
    transactionReference: `REF-${id}`,
    recordedAt: '2026-11-05T10:00:00Z',
    invoiceId: `inv-${id}`,
    invoiceNumber: `INV-${id}`,
    invoiceStatus: 'paid',
    centreId: 'centre-sydenham',
    centreName: 'Sydenham After School Club',
    parentId: `parent-${id}`,
    parentName: 'Jane Doe',
    students: [{ id: `child-${id}`, name: 'Alex Doe' }],
    ...overrides,
  };
}

function makeExpense(
  id: string,
  overrides: Partial<CashReceiptExpenseInput> = {}
): CashReceiptExpenseInput {
  return {
    id,
    expenseDate: '2026-11-05',
    amountPence: 4500,
    description: 'Fruit and snacks for Sydenham',
    category: 'supplies_snacks',
    centreId: 'centre-sydenham',
    centreName: 'Sydenham After School Club',
    createdAt: '2026-11-05T14:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('cash-receipts-ledger domain engine', () => {
  describe('isQualifyingCashReceiptPayment (INV-3)', () => {
    it('accepts verified unreversed payments on sent, partially_paid, and paid invoices', () => {
      expect(isQualifyingCashReceiptPayment(makePayment('1', { invoiceStatus: 'sent' }))).toBe(true);
      expect(isQualifyingCashReceiptPayment(makePayment('2', { invoiceStatus: 'partially_paid' }))).toBe(true);
      expect(isQualifyingCashReceiptPayment(makePayment('3', { invoiceStatus: 'paid' }))).toBe(true);
    });

    it('rejects pending, failed, and reversed payments or payments with reversedAt timestamp', () => {
      expect(isQualifyingCashReceiptPayment(makePayment('1', { status: 'pending' }))).toBe(false);
      expect(isQualifyingCashReceiptPayment(makePayment('2', { status: 'failed' }))).toBe(false);
      expect(isQualifyingCashReceiptPayment(makePayment('3', { status: 'reversed' }))).toBe(false);
      expect(
        isQualifyingCashReceiptPayment(
          makePayment('4', { status: 'verified', reversedAt: '2026-11-06T09:00:00Z' })
        )
      ).toBe(false);
    });

    it('rejects payments attached to draft or void invoices', () => {
      expect(isQualifyingCashReceiptPayment(makePayment('1', { invoiceStatus: 'draft' }))).toBe(false);
      expect(isQualifyingCashReceiptPayment(makePayment('2', { invoiceStatus: 'void' }))).toBe(false);
    });

    it('rejects internal CREDIT-* synthetic allocations so only real cash is counted', () => {
      expect(
        isQualifyingCashReceiptPayment(
          makePayment('1', { transactionReference: 'CREDIT-2026-001' })
        )
      ).toBe(false);
      expect(
        isQualifyingCashReceiptPayment(
          makePayment('2', { transactionReference: '  credit-alloc-99 ' })
        )
      ).toBe(false);
    });
  });

  describe('Monday–Sunday week generation & boundary weeks (Option A/C synthesis)', () => {
    it('calculates Monday and Sunday boundaries accurately across week days', () => {
      // 2026-11-01 is a Sunday
      expect(startOfMondayWeek('2026-11-01')).toBe('2026-10-26');
      expect(endOfMondayWeek('2026-11-01')).toBe('2026-11-01');

      // 2026-11-02 is a Monday
      expect(startOfMondayWeek('2026-11-02')).toBe('2026-11-02');
      expect(endOfMondayWeek('2026-11-02')).toBe('2026-11-08');
    });

    it('generates all overlapping Monday–Sunday weeks for November 2026 with boundary clipping', () => {
      const weeks = generateMonthMondaySundayWeeks('2026-11');
      expect(weeks).toHaveLength(6);

      // Week 1: Mon 26 Oct – Sun 1 Nov (1 day in Nov, 6 days spill from Oct)
      expect(weeks[0]).toMatchObject({
        weekNumber: 1,
        weekStart: '2026-10-26',
        weekEnd: '2026-11-01',
        clippedStart: '2026-11-01',
        clippedEnd: '2026-11-01',
        isBoundaryStart: true,
        isBoundaryEnd: false,
        inMonthDays: 1,
        spillBeforeDays: 6,
        spillAfterDays: 0,
        spillBeforeMonthLabel: 'Oct',
      });

      // Week 6: Mon 30 Nov – Sun 6 Dec (1 day in Nov, 6 days spill into Dec)
      expect(weeks[5]).toMatchObject({
        weekNumber: 6,
        weekStart: '2026-11-30',
        weekEnd: '2026-12-06',
        clippedStart: '2026-11-30',
        clippedEnd: '2026-11-30',
        isBoundaryStart: false,
        isBoundaryEnd: true,
        inMonthDays: 1,
        spillBeforeDays: 0,
        spillAfterDays: 6,
        spillAfterMonthLabel: 'Dec',
      });
    });

    it('guarantees zero double-counting across boundary weeks and builds rollingMonthTallyPence to 100% of monthTotalPence', () => {
      const payments: CashReceiptPaymentInput[] = [
        // Fri 30 Oct 2026: in Week 1 of Nov (Mon 26 Oct – Sun 1 Nov), but belongs to October!
        makePayment('oct-30', { amount: '250.00', recordedAt: '2026-10-30T14:00:00Z' }),
        // Sun 1 Nov 2026: in Week 1 of Nov, belongs to November!
        makePayment('nov-01', { amount: '120.50', recordedAt: '2026-11-01T11:00:00Z' }),
        // Wed 4 Nov 2026: in Week 2 of Nov
        makePayment('nov-04', { amount: '300.25', recordedAt: '2026-11-04T15:00:00Z' }),
        // Mon 30 Nov 2026: in Week 6 of Nov (Mon 30 Nov – Sun 6 Dec), belongs to November!
        makePayment('nov-30', { amount: '179.25', recordedAt: '2026-11-30T16:00:00Z' }),
        // Tue 1 Dec 2026: in Week 6 of Nov, but belongs to December!
        makePayment('dec-01', { amount: '400.00', recordedAt: '2026-12-01T10:00:00Z' }),
      ];

      const novLedger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-11',
        activeCentreId: 'all',
        today: '2026-11-10',
      });

      // Week 1: inMonth = £120.50 (12050p), spillBefore = £250.00 (25000p), fullWeek = £370.50 (37050p)
      expect(novLedger.weeks[0].inMonthPence).toBe(12050);
      expect(novLedger.weeks[0].spillBeforePence).toBe(25000);
      expect(novLedger.weeks[0].fullWeekPence).toBe(37050);
      expect(novLedger.weeks[0].rollingMonthTallyPence).toBe(12050);
      expect(novLedger.weeks[0].payments).toHaveLength(2);
      expect(novLedger.weeks[0].payments.map((p) => ({ id: p.id, inSelectedMonth: p.inSelectedMonth }))).toEqual([
        { id: 'oct-30', inSelectedMonth: false },
        { id: 'nov-01', inSelectedMonth: true },
      ]);

      // Week 2: inMonth = £300.25 (30025p), rolling = 12050 + 30025 = 42075p (£420.75)
      expect(novLedger.weeks[1].inMonthPence).toBe(30025);
      expect(novLedger.weeks[1].rollingMonthTallyPence).toBe(42075);

      // Weeks 3, 4, 5: £0 collected, rolling tally stays 42075p
      expect(novLedger.weeks[2].inMonthPence).toBe(0);
      expect(novLedger.weeks[2].rollingMonthTallyPence).toBe(42075);
      expect(novLedger.weeks[3].rollingMonthTallyPence).toBe(42075);
      expect(novLedger.weeks[4].rollingMonthTallyPence).toBe(42075);

      // Week 6: inMonth = £179.25 (17925p), spillAfter = £400.00 (40000p), fullWeek = £579.25 (57925p)
      // Final rolling tally = 42075 + 17925 = 60000p (£600.00) === monthTotalPence
      expect(novLedger.weeks[5].inMonthPence).toBe(17925);
      expect(novLedger.weeks[5].spillAfterPence).toBe(40000);
      expect(novLedger.weeks[5].fullWeekPence).toBe(57925);
      expect(novLedger.weeks[5].rollingMonthTallyPence).toBe(60000);
      expect(novLedger.monthTotalPence).toBe(60000);

      // Verify October ledger counts oct-30 in-month and nov-01 as spillAfter
      const octLedger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-10',
        activeCentreId: 'all',
        today: '2026-11-10',
      });
      expect(octLedger.monthTotalPence).toBe(25000);
      const octLastWeek = octLedger.weeks[octLedger.weeks.length - 1];
      expect(octLastWeek.inMonthPence).toBe(25000);
      expect(octLastWeek.spillAfterPence).toBe(12050);
      expect(octLastWeek.fullWeekPence).toBe(37050);
    });
  });

  describe('Europe/London BST timezone boundary handling', () => {
    it('buckets 2026-07-31 23:30 UTC (00:30 BST on 1 Aug) into August 2026', () => {
      const payments = [
        makePayment('bst-edge', {
          amount: '95.00',
          recordedAt: '2026-07-31T23:30:00.000Z',
        }),
      ];

      const julLedger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-07',
        today: '2026-08-15',
      });
      const augLedger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-08',
        today: '2026-08-15',
      });

      expect(julLedger.monthTotalPence).toBe(0);
      expect(augLedger.monthTotalPence).toBe(9500);
    });
  });

  describe('MoM, YoY & INV-9 Earliest History / Zero-Base Guards', () => {
    it('uses Same-Day Month-to-Date (MTD) pace when viewing the live current month', () => {
      const payments: CashReceiptPaymentInput[] = [
        // Prior month (Oct 2026): £500 on 5 Oct (within 1–10 Oct MTD window) and £800 on 20 Oct (after day 10)
        makePayment('oct-05', { amount: '500.00', recordedAt: '2026-10-05T12:00:00Z' }),
        makePayment('oct-20', { amount: '800.00', recordedAt: '2026-10-20T12:00:00Z' }),
        // Current month (Nov 2026, today is 10 Nov): £750 on 6 Nov
        makePayment('nov-06', { amount: '750.00', recordedAt: '2026-11-06T12:00:00Z' }),
      ];

      const ledger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-11',
        today: '2026-11-10',
      });

      expect(ledger.momComparison.mode).toBe('mtd_same_day');
      expect(ledger.momComparison.currentPence).toBe(75000);
      expect(ledger.momComparison.priorPence).toBe(50000); // 1–10 Oct only!
      expect(ledger.momComparison.fullPriorPeriodPence).toBe(130000); // Full Oct (£1,300)
      expect(ledger.momComparison.deltaPence).toBe(25000);
      expect(ledger.momComparison.deltaPercent).toBe(50);
      expect(ledger.momComparison.comparisonStatus).toBe('available');
      expect(ledger.momComparison.comparisonRangeLabel).toBe('1–10 Nov 2026 vs 1–10 Oct 2026');

      // YoY should trigger insufficient_history because earliest payment is 2026-10-05
      expect(ledger.yoyComparison.comparisonStatus).toBe('insufficient_history');
      expect(ledger.yoyComparison.deltaPercent).toBeNull();
      expect(ledger.yoyComparison.firstRecordedMonthLabel).toBe('Oct 2026');
    });

    it('uses full-month comparison when viewing a completed past month', () => {
      const payments: CashReceiptPaymentInput[] = [
        makePayment('sep-15', { amount: '1000.00', recordedAt: '2026-09-15T12:00:00Z' }),
        makePayment('oct-05', { amount: '500.00', recordedAt: '2026-10-05T12:00:00Z' }),
        makePayment('oct-25', { amount: '700.00', recordedAt: '2026-10-25T12:00:00Z' }),
      ];

      const ledger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-10',
        today: '2026-11-10',
      });

      expect(ledger.momComparison.mode).toBe('full_month');
      expect(ledger.momComparison.currentPence).toBe(120000);
      expect(ledger.momComparison.priorPence).toBe(100000);
      expect(ledger.momComparison.deltaPence).toBe(20000);
      expect(ledger.momComparison.deltaPercent).toBe(20);
    });

    it('guards against division by zero with zero_prior_base when history predates a £0 prior period', () => {
      const payments: CashReceiptPaymentInput[] = [
        // History exists in Aug 2026, £0 in Sep 2026, £400 in Oct 2026
        makePayment('aug-10', { amount: '300.00', recordedAt: '2026-08-10T12:00:00Z' }),
        makePayment('oct-10', { amount: '400.00', recordedAt: '2026-10-10T12:00:00Z' }),
      ];

      const ledger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-10',
        today: '2026-11-10',
      });

      expect(ledger.momComparison.comparisonStatus).toBe('zero_prior_base');
      expect(ledger.momComparison.deltaPercent).toBeNull();
      expect(ledger.momComparison.deltaPence).toBe(40000);
    });
  });

  describe('Per-centre breakdown & currency formatting', () => {
    it('computes accurate Sydenham and Dagenham split and filters weekly ledger when a single centre is active', () => {
      const payments: CashReceiptPaymentInput[] = [
        makePayment('syd-1', {
          amount: '600.00',
          centreId: 'centre-sydenham',
          centreName: 'Sydenham After School Club',
          recordedAt: '2026-11-03T10:00:00Z',
        }),
        makePayment('dag-1', {
          amount: '400.00',
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
          recordedAt: '2026-11-04T10:00:00Z',
        }),
      ];

      const allLedger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-11',
        activeCentreId: 'all',
        today: '2026-11-10',
      });

      expect(allLedger.monthTotalPence).toBe(100000);
      expect(allLedger.centreSummaries).toEqual([
        {
          centreId: 'centre-sydenham',
          centreName: 'Sydenham After School Club',
          monthPence: 60000,
          monthCount: 1,
          sharePercent: 60,
        },
        {
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
          monthPence: 40000,
          monthCount: 1,
          sharePercent: 40,
        },
      ]);

      const dagLedger = buildCashReceiptsLedger({
        payments,
        centres: CENTRES,
        selectedMonth: '2026-11',
        activeCentreId: 'centre-dagenham',
        today: '2026-11-10',
      });

      expect(dagLedger.monthTotalPence).toBe(40000);
      // Centre switcher pills still retain all-centre totals so the Owner sees both centres' numbers
      expect(dagLedger.allCentresMonthTotalPence).toBe(100000);
      expect(formatPenceToGBP(dagLedger.monthTotalPence)).toBe('£400.00');
      expect(formatSignedPenceDelta(-15050)).toBe('−£150.50');
      expect(formatSignedPenceDelta(25000)).toBe('+£250.00');
    });
  });

  describe('Weekly Outgoings / Expenses & Net Cashflow Ledger', () => {
    it('filters out soft-deleted, empty-description, and zero/negative expenses', () => {
      expect(isQualifyingCashReceiptExpense(makeExpense('1'))).toBe(true);
      expect(
        isQualifyingCashReceiptExpense(makeExpense('2', { deletedAt: '2026-11-06T10:00:00Z' }))
      ).toBe(false);
      expect(isQualifyingCashReceiptExpense(makeExpense('3', { amountPence: 0 }))).toBe(false);
      expect(isQualifyingCashReceiptExpense(makeExpense('4', { amountPence: -500 }))).toBe(false);
      expect(isQualifyingCashReceiptExpense(makeExpense('5', { description: '   ' }))).toBe(false);
    });

    it('clips boundary-week outgoings accurately and computes rolling monthly net tallies', () => {
      const payments: CashReceiptPaymentInput[] = [
        makePayment('nov-01', { amount: '200.00', recordedAt: '2026-11-01T11:00:00Z' }),
        makePayment('nov-05', { amount: '500.00', recordedAt: '2026-11-05T11:00:00Z' }),
      ];

      const expenses: CashReceiptExpenseInput[] = [
        // Fri 30 Oct: in Week 1 of Nov (Mon 26 Oct – Sun 1 Nov), but belongs to October!
        makeExpense('exp-oct-30', { expenseDate: '2026-10-30', amountPence: 8000 }),
        // Sun 1 Nov: in Week 1 of Nov, belongs to November!
        makeExpense('exp-nov-01', { expenseDate: '2026-11-01', amountPence: 5000 }),
        // Thu 5 Nov: in Week 2 of Nov, belongs to Dagenham
        makeExpense('exp-nov-05', {
          expenseDate: '2026-11-05',
          amountPence: 12000,
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
        }),
        // Soft-deleted expense in Nov (must be ignored)
        makeExpense('exp-deleted', {
          expenseDate: '2026-11-06',
          amountPence: 99900,
          deletedAt: '2026-11-07T09:00:00Z',
        }),
      ];

      const ledger = buildCashReceiptsLedger({
        payments,
        expenses,
        centres: CENTRES,
        selectedMonth: '2026-11',
        activeCentreId: 'all',
        today: '2026-11-10',
      });

      // Week 1 (Mon 26 Oct – Sun 1 Nov):
      // Income in Nov = 20000p (£200), Outgoings in Nov = 5000p (£50), SpillBefore Outgoings = 8000p (£80)
      expect(ledger.weeks[0].inMonthExpensePence).toBe(5000);
      expect(ledger.weeks[0].spillBeforeExpensePence).toBe(8000);
      expect(ledger.weeks[0].fullWeekExpensePence).toBe(13000);
      expect(ledger.weeks[0].inMonthNetPence).toBe(15000); // £200 - £50 = £150
      expect(ledger.weeks[0].rollingMonthExpenseTallyPence).toBe(5000);
      expect(ledger.weeks[0].rollingMonthNetTallyPence).toBe(15000);

      // Week 2 (Mon 2 Nov – Sun 8 Nov):
      // Income = 50000p (£500), Outgoings = 12000p (£120), Net = 38000p (£380)
      // Cumulative Rolling Income = 70000p (£700), Rolling Outgoings = 17000p (£170), Rolling Net = 53000p (£530)
      expect(ledger.weeks[1].inMonthExpensePence).toBe(12000);
      expect(ledger.weeks[1].inMonthNetPence).toBe(38000);
      expect(ledger.weeks[1].rollingMonthTallyPence).toBe(70000);
      expect(ledger.weeks[1].rollingMonthExpenseTallyPence).toBe(17000);
      expect(ledger.weeks[1].rollingMonthNetTallyPence).toBe(53000);

      // Month totals
      expect(ledger.monthTotalPence).toBe(70000);
      expect(ledger.monthExpenseTotalPence).toBe(17000);
      expect(ledger.monthNetPence).toBe(53000);
      expect(ledger.centreCashflowSummaries).toEqual([
        {
          centreId: 'centre-sydenham',
          centreName: 'Sydenham After School Club',
          monthIncomePence: 70000,
          monthIncomeCount: 2,
          monthExpensePence: 5000,
          monthExpenseCount: 1,
          monthNetPence: 65000,
          incomeSharePercent: 100,
        },
        {
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
          monthIncomePence: 0,
          monthIncomeCount: 0,
          monthExpensePence: 12000,
          monthExpenseCount: 1,
          monthNetPence: -12000,
          incomeSharePercent: 0,
        },
      ]);
    });
  });

  describe('Yearly Running Ledger (Jan–Dec Cumulative Income, Outgoings & Net)', () => {
    it('computes chronological Jan–Nov YTD cumulative running totals for Income, Outgoings, and Net', () => {
      const payments: CashReceiptPaymentInput[] = [
        makePayment('jan-1', { amount: '1000.00', recordedAt: '2026-01-15T10:00:00Z' }),
        makePayment('Jun-1', { amount: '2000.00', recordedAt: '2026-06-10T10:00:00Z' }),
        makePayment('nov-1', {
          amount: '1500.00',
          recordedAt: '2026-11-04T10:00:00Z',
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
        }),
      ];

      const expenses: CashReceiptExpenseInput[] = [
        makeExpense('exp-jan', { expenseDate: '2026-01-20', amountPence: 30000 }), // £300
        makeExpense('exp-jun', { expenseDate: '2026-06-18', amountPence: 50000 }), // £500
        makeExpense('exp-nov', {
          expenseDate: '2026-11-05',
          amountPence: 40000, // £400
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
        }),
      ];

      const ledger = buildCashReceiptsLedger({
        payments,
        expenses,
        centres: CENTRES,
        selectedMonth: '2026-11',
        activeCentreId: 'all',
        today: '2026-11-10',
      });

      const ytd = ledger.yearlyRunningLedger;
      expect(ytd.selectedYear).toBe(2026);
      expect(ytd.rangeLabel).toBe('Jan – Nov 2026 (YTD)');
      expect(ytd.months).toHaveLength(11); // Jan..Nov

      // Jan (index 0): In £1,000, Out £300, Net £700 -> Running Net £700
      expect(ytd.months[0]).toMatchObject({
        yearMonth: '2026-01',
        incomePence: 100000,
        expensePence: 30000,
        netPence: 70000,
        runningYearlyIncomePence: 100000,
        runningYearlyExpensePence: 30000,
        runningYearlyNetPence: 70000,
      });

      // Feb..May (indices 1..4): £0 in month, Running stays In £1,000, Out £300, Net £700
      expect(ytd.months[1].runningYearlyNetPence).toBe(70000);
      expect(ytd.months[4].runningYearlyNetPence).toBe(70000);

      // Jun (index 5): In £2,000, Out £500, Net £1,500 -> Running In £3,000, Out £800, Net £2,200
      expect(ytd.months[5]).toMatchObject({
        yearMonth: '2026-06',
        incomePence: 200000,
        expensePence: 50000,
        netPence: 150000,
        runningYearlyIncomePence: 300000,
        runningYearlyExpensePence: 80000,
        runningYearlyNetPence: 220000,
      });

      // Nov (index 10): In £1,500, Out £400, Net £1,100 -> Running In £4,500, Out £1,200, Net £3,300
      expect(ytd.months[10]).toMatchObject({
        yearMonth: '2026-11',
        incomePence: 150000,
        expensePence: 40000,
        netPence: 110000,
        runningYearlyIncomePence: 450000,
        runningYearlyExpensePence: 120000,
        runningYearlyNetPence: 330000,
      });

      expect(ytd.totalIncomePence).toBe(450000);
      expect(ytd.totalExpensePence).toBe(120000);
      expect(ytd.totalNetPence).toBe(330000);
      expect(ytd.byCentre).toEqual([
        {
          centreId: 'centre-sydenham',
          centreName: 'Sydenham After School Club',
          totalIncomePence: 300000,
          totalIncomeCount: 2,
          totalExpensePence: 80000,
          totalExpenseCount: 2,
          totalNetPence: 220000,
        },
        {
          centreId: 'centre-dagenham',
          centreName: 'Dagenham After School Club',
          totalIncomePence: 150000,
          totalIncomeCount: 1,
          totalExpensePence: 40000,
          totalExpenseCount: 1,
          totalNetPence: 110000,
        },
      ]);
    });
  });
});
