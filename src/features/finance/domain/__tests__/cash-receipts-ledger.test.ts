import { describe, expect, it } from 'vitest';
import {
  buildCashReceiptsLedger,
  formatPenceToGBP,
  formatSignedPenceDelta,
  generateMonthMondaySundayWeeks,
  isQualifyingCashReceiptPayment,
  startOfMondayWeek,
  endOfMondayWeek,
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
});
