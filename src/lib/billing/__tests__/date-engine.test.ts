import { describe, it, expect } from 'vitest';
import {
    daysInMonth,
    clampToMonthEnd,
    isLastDayOfMonth,
    subtractCalendarMonths,
    addCalendarMonths,
    nextPeriodStart,
    computePeriodEnd,
    computeExpectedPaymentDate,
    computeDraftCreationDate,
    formatPeriodLabel,
    generateCycleKey,
    computeBillingSchedule,
    createUtcDate,
    formatIsoDate,
} from '../date-engine';

describe('date-engine.ts — Comprehensive Verification', () => {
    describe('§22 Subtract One Calendar Month — Exhaustive Blueprint Edge Cases', () => {
        it('10 October -> 10 September (Standard)', () => {
            const input = createUtcDate(2026, 10, 10);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2026-09-10');
        });

        it('31 March -> 28 February (non-leap: 2027)', () => {
            const input = createUtcDate(2027, 3, 31);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2027-02-28');
        });

        it('31 March -> 29 February (leap year: 2028)', () => {
            const input = createUtcDate(2028, 3, 31);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2028-02-29');
        });

        it('28 Feb (non-leap, last day: 2027) -> 31 January (End-of-month preservation)', () => {
            const input = createUtcDate(2027, 2, 28);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2027-01-31');
        });

        it('30 April (last day) -> 31 March (End-of-month preservation)', () => {
            const input = createUtcDate(2026, 4, 30);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2026-03-31');
        });

        it('1 January -> 1 December (prior year wrap)', () => {
            const input = createUtcDate(2026, 1, 1);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2025-12-01');
        });

        it('31 January (last day) -> 31 December (prior year wrap + end-of-month)', () => {
            const input = createUtcDate(2026, 1, 31);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2025-12-31');
        });

        it('29 February 2024 (leap, last day) -> 31 January 2024 (End-of-month preservation)', () => {
            const input = createUtcDate(2024, 2, 29);
            const result = subtractCalendarMonths(input, 1);
            expect(formatIsoDate(result)).toBe('2024-01-31');
        });

        it('Multi-month subtraction: 31 March minus 2 months -> 31 January', () => {
            const input = createUtcDate(2026, 3, 31);
            const result = subtractCalendarMonths(input, 2);
            expect(formatIsoDate(result)).toBe('2026-01-31');
        });
    });

    describe('§20 Assessment Period Recurrence & Month-End Clamping', () => {
        it('UC 4th-3rd cycle: anchorDay=4 advances correctly across months', () => {
            const p1Start = createUtcDate(2026, 9, 4);
            const p1End = computePeriodEnd(p1Start, 4);
            expect(formatIsoDate(p1End)).toBe('2026-10-03');

            const p2Start = nextPeriodStart(p1Start, 4);
            expect(formatIsoDate(p2Start)).toBe('2026-10-04');
            const p2End = computePeriodEnd(p2Start, 4);
            expect(formatIsoDate(p2End)).toBe('2026-11-03');

            const p3Start = nextPeriodStart(p2Start, 4);
            expect(formatIsoDate(p3Start)).toBe('2026-11-04');
            const p3End = computePeriodEnd(p3Start, 4);
            expect(formatIsoDate(p3End)).toBe('2026-12-03');
        });

        it('15th-14th cycle: anchorDay=15 (15 Sep to 14 Oct) advances correctly', () => {
            const p1Start = createUtcDate(2026, 9, 15);
            const p1End = computePeriodEnd(p1Start, 15);
            expect(formatIsoDate(p1End)).toBe('2026-10-14');

            const p2Start = nextPeriodStart(p1Start, 15);
            expect(formatIsoDate(p2Start)).toBe('2026-10-15');
            const p2End = computePeriodEnd(p2Start, 15);
            expect(formatIsoDate(p2End)).toBe('2026-11-14');
        });

        it('Calendar month: anchorDay=1 spans full calendar months', () => {
            const p1Start = createUtcDate(2026, 9, 1);
            const p1End = computePeriodEnd(p1Start, 1);
            expect(formatIsoDate(p1End)).toBe('2026-09-30');

            const p2Start = nextPeriodStart(p1Start, 1);
            expect(formatIsoDate(p2Start)).toBe('2026-10-01');
            const p2End = computePeriodEnd(p2Start, 1);
            expect(formatIsoDate(p2End)).toBe('2026-10-31');
        });

        it('Anchor Day 31: Re-asserts in March after clamping to Feb 28', () => {
            const janStart = createUtcDate(2027, 1, 31);
            const febStart = nextPeriodStart(janStart, 31);
            expect(formatIsoDate(febStart)).toBe('2027-02-28');

            const janEnd = computePeriodEnd(janStart, 31);
            expect(formatIsoDate(janEnd)).toBe('2027-02-27');

            const marStart = nextPeriodStart(febStart, 31);
            expect(formatIsoDate(marStart)).toBe('2027-03-31'); // Re-asserts 31!
            const febEnd = computePeriodEnd(febStart, 31);
            expect(formatIsoDate(febEnd)).toBe('2027-03-30');
        });

        it('Year boundary wrapping: Dec 15 -> Jan 15', () => {
            const decStart = createUtcDate(2026, 12, 15);
            const janStart = nextPeriodStart(decStart, 15);
            expect(formatIsoDate(janStart)).toBe('2027-01-15');
        });
    });

    describe('§21 Expected Payment Date & Due Date', () => {
        it('When paymentDayOfMonth is set, computes clamped day in period month', () => {
            const periodStart = createUtcDate(2026, 9, 4);
            const payDate = computeExpectedPaymentDate(periodStart, 20);
            expect(formatIsoDate(payDate)).toBe('2026-09-20');
        });

        it('When paymentDayOfMonth exceeds days in month (e.g. 31 in Feb), clamps to month end', () => {
            const periodStart = createUtcDate(2027, 2, 4);
            const payDate = computeExpectedPaymentDate(periodStart, 31);
            expect(formatIsoDate(payDate)).toBe('2027-02-28');
        });

        it('When paymentDayOfMonth is null/undefined, defaults to periodStart', () => {
            const periodStart = createUtcDate(2026, 9, 4);
            const payDate = computeExpectedPaymentDate(periodStart, null);
            expect(formatIsoDate(payDate)).toBe('2026-09-04');
        });
    });

    describe('§23 Lead Time Calculations', () => {
        const expectedPaymentDate = createUtcDate(2026, 10, 15);

        it('leadTimeUnit = CALENDAR_MONTHS (1 month): 15 Oct -> 15 Sep', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
            });
            expect(formatIsoDate(draft)).toBe('2026-09-15');
        });

        it('leadTimeUnit = DAYS (14 days): 15 Oct -> 1 Oct', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 14,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-01');
        });

        it('Legacy fallback invoiceLeadDays (7 days): 15 Oct -> 8 Oct', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                invoiceLeadDays: 7,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-08');
        });
    });

    describe('Cycle Key and Period Labels', () => {
        it('Generates stable canonical cycleKey: configId:YYYY-MM-DD', () => {
            const key = generateCycleKey('cfg-123', createUtcDate(2026, 9, 1));
            expect(key).toBe('cfg-123:2026-09-01');
        });

        it('Full calendar month label formats as single month name', () => {
            const label = formatPeriodLabel(createUtcDate(2026, 9, 1), createUtcDate(2026, 9, 30));
            expect(label).toBe('September 2026');
        });

        it('Arbitrary period label formats as start to end span', () => {
            const label = formatPeriodLabel(createUtcDate(2026, 9, 4), createUtcDate(2026, 10, 3));
            expect(label).toBe('4 Sept 2026 to 3 Oct 2026');
        });
    });

    describe('Full computeBillingSchedule integration', () => {
        it('Computes full schedule for standard calendar month with 1 month lead time', () => {
            const schedule = computeBillingSchedule(
                {
                    id: 'cfg-abc',
                    billingAnchorDate: createUtcDate(2026, 10, 1),
                    paymentDayOfMonth: 1,
                    leadTimeUnit: 'CALENDAR_MONTHS',
                    leadTimeValue: 1,
                },
                createUtcDate(2026, 9, 1) // Reference date: 1 Sep (draft creation date for 1 Oct)
            );

            expect(formatIsoDate(schedule.periodStart)).toBe('2026-10-01');
            expect(formatIsoDate(schedule.periodEnd)).toBe('2026-10-31');
            expect(formatIsoDate(schedule.expectedPaymentDate)).toBe('2026-10-01');
            expect(formatIsoDate(schedule.draftCreationDate)).toBe('2026-09-01');
            expect(schedule.cycleKey).toBe('cfg-abc:2026-10-01');
            expect(schedule.periodLabel).toBe('October 2026');
        });

        it('Advances to next period when reference date is past draft creation date', () => {
            const schedule = computeBillingSchedule(
                {
                    id: 'cfg-abc',
                    billingAnchorDate: createUtcDate(2026, 10, 1),
                    paymentDayOfMonth: 1,
                    leadTimeUnit: 'CALENDAR_MONTHS',
                    leadTimeValue: 1,
                },
                createUtcDate(2026, 9, 5) // 5 Sep is past 1 Sep draft date for Oct cycle
            );

            expect(formatIsoDate(schedule.periodStart)).toBe('2026-11-01');
            expect(formatIsoDate(schedule.periodEnd)).toBe('2026-11-30');
            expect(formatIsoDate(schedule.draftCreationDate)).toBe('2026-10-01');
        });
    });
});
