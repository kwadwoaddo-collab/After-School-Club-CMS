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
    getBillingPeriodByIndex,
    getBillingPeriodForDate,
    previewBillingPeriods,
    toUtcDate,
    createUtcDate,
    formatIsoDate,
} from '../date-engine';

describe('date-engine.ts — Comprehensive Verification Matrix', () => {
    describe('1. Primitive Date Utilities & Invariants', () => {
        it('daysInMonth returns exact days for standard and leap years', () => {
            expect(daysInMonth(2026, 1)).toBe(31);
            expect(daysInMonth(2026, 2)).toBe(28); // non-leap
            expect(daysInMonth(2028, 2)).toBe(29); // leap year
            expect(daysInMonth(2026, 4)).toBe(30);
            expect(daysInMonth(2026, 12)).toBe(31);
        });

        it('clampToMonthEnd clamps values correctly without mutating out of range', () => {
            expect(clampToMonthEnd(2026, 1, 31)).toBe(31);
            expect(clampToMonthEnd(2026, 2, 31)).toBe(28);
            expect(clampToMonthEnd(2028, 2, 31)).toBe(29);
            expect(clampToMonthEnd(2026, 4, 31)).toBe(30);
            expect(clampToMonthEnd(2026, 4, 15)).toBe(15);
        });

        it('isLastDayOfMonth detects final days of months accurately', () => {
            expect(isLastDayOfMonth(createUtcDate(2026, 1, 31))).toBe(true);
            expect(isLastDayOfMonth(createUtcDate(2026, 1, 30))).toBe(false);
            expect(isLastDayOfMonth(createUtcDate(2026, 2, 28))).toBe(true);
            expect(isLastDayOfMonth(createUtcDate(2028, 2, 29))).toBe(true);
            expect(isLastDayOfMonth(createUtcDate(2028, 2, 28))).toBe(false);
            expect(isLastDayOfMonth(createUtcDate(2026, 4, 30))).toBe(true);
        });

        it('toUtcDate handles Date objects, strings, and BST 23:00 UTC shifts safely', () => {
            const fromStr = toUtcDate('2026-09-06');
            expect(formatIsoDate(fromStr)).toBe('2026-09-06');

            const fromDate = toUtcDate(new Date(Date.UTC(2026, 8, 6, 0, 0, 0)));
            expect(formatIsoDate(fromDate)).toBe('2026-09-06');

            // 23:00 UTC BST shift artifact (e.g. from British Summer Time local midnight parse)
            const bstArtifact = new Date(Date.UTC(2026, 8, 5, 23, 0, 0));
            const adjusted = toUtcDate(bstArtifact);
            expect(formatIsoDate(adjusted)).toBe('2026-09-06');
        });
    });

    describe('2. Calendar Month Arithmetic (subtractCalendarMonths & addCalendarMonths)', () => {
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

        it('addCalendarMonths preserves month end correctly', () => {
            const jan31 = createUtcDate(2026, 1, 31);
            expect(formatIsoDate(addCalendarMonths(jan31, 1))).toBe('2026-02-28');
            expect(formatIsoDate(addCalendarMonths(jan31, 2))).toBe('2026-03-31');
        });
    });

    describe('3. Canonical Anchor Calculations & Invariants Across Anchor Days', () => {
        it('Anchor Day 1: 01/09/2026 -> 01/09/2026 to 30/09/2026 (label: September 2026)', () => {
            const p0 = getBillingPeriodByIndex('2026-09-01', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-09-01');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-09-30');
            expect(p0.periodLabel).toBe('September 2026');

            const p1 = getBillingPeriodByIndex('2026-09-01', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-10-01');
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-10-31');
            expect(p1.periodLabel).toBe('October 2026');
        });

        it('Anchor Day 6 (The Production Bug Baseline): 06/09/2026 generates correct recurring spans without month-end clamping', () => {
            const p0 = getBillingPeriodByIndex('2026-09-06', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-09-06');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-10-05');
            expect(p0.periodLabel).toBe('6 Sept 2026 to 5 Oct 2026');

            const p1 = getBillingPeriodByIndex('2026-09-06', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-10-06');
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-11-05');

            const p2 = getBillingPeriodByIndex('2026-09-06', 2);
            expect(formatIsoDate(p2.periodStart)).toBe('2026-11-06');
            expect(formatIsoDate(p2.periodEnd)).toBe('2026-12-05');

            const p3 = getBillingPeriodByIndex('2026-09-06', 3);
            expect(formatIsoDate(p3.periodStart)).toBe('2026-12-06');
            expect(formatIsoDate(p3.periodEnd)).toBe('2027-01-05');

            const p4 = getBillingPeriodByIndex('2026-09-06', 4);
            expect(formatIsoDate(p4.periodStart)).toBe('2027-01-06');
            expect(formatIsoDate(p4.periodEnd)).toBe('2027-02-05');
        });

        it('Anchor Day 15: 15/09/2026 -> 15/09/2026 to 14/10/2026', () => {
            const p0 = getBillingPeriodByIndex('2026-09-15', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-09-15');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-10-14');

            const p1 = getBillingPeriodByIndex('2026-09-15', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-10-15');
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-11-14');
        });

        it('Anchor Day 28: 28/01/2026 -> 28/01/2026 to 27/02/2026', () => {
            const p0 = getBillingPeriodByIndex('2026-01-28', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-01-28');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-02-27');

            const p1 = getBillingPeriodByIndex('2026-01-28', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-02-28');
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-03-27');
        });

        it('Anchor Day 29: Non-leap clamping to 28 Feb and restoration in March', () => {
            const p0 = getBillingPeriodByIndex('2026-01-29', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-01-29');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-02-27');

            const p1 = getBillingPeriodByIndex('2026-01-29', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-02-28'); // clamped
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-03-28');

            const p2 = getBillingPeriodByIndex('2026-01-29', 2);
            expect(formatIsoDate(p2.periodStart)).toBe('2026-03-29'); // restored!
            expect(formatIsoDate(p2.periodEnd)).toBe('2026-04-28');
        });

        it('Anchor Day 30: Non-leap clamping to 28 Feb and restoration in March', () => {
            const p0 = getBillingPeriodByIndex('2026-01-30', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-01-30');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-02-27');

            const p1 = getBillingPeriodByIndex('2026-01-30', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-02-28'); // clamped
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-03-29');

            const p2 = getBillingPeriodByIndex('2026-01-30', 2);
            expect(formatIsoDate(p2.periodStart)).toBe('2026-03-30'); // restored!
            expect(formatIsoDate(p2.periodEnd)).toBe('2026-04-29');
        });

        it('Anchor Day 31: Full progression Jan -> Feb -> Mar -> Apr -> May', () => {
            const p0 = getBillingPeriodByIndex('2026-01-31', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2026-01-31');
            expect(formatIsoDate(p0.periodEnd)).toBe('2026-02-27');

            const p1 = getBillingPeriodByIndex('2026-01-31', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2026-02-28'); // clamped to Feb 28
            expect(formatIsoDate(p1.periodEnd)).toBe('2026-03-30');

            const p2 = getBillingPeriodByIndex('2026-01-31', 2);
            expect(formatIsoDate(p2.periodStart)).toBe('2026-03-31'); // restored to 31!
            expect(formatIsoDate(p2.periodEnd)).toBe('2026-04-29');

            const p3 = getBillingPeriodByIndex('2026-01-31', 3);
            expect(formatIsoDate(p3.periodStart)).toBe('2026-04-30'); // clamped to Apr 30
            expect(formatIsoDate(p3.periodEnd)).toBe('2026-05-30');

            const p4 = getBillingPeriodByIndex('2026-01-31', 4);
            expect(formatIsoDate(p4.periodStart)).toBe('2026-05-31'); // restored to 31!
            expect(formatIsoDate(p4.periodEnd)).toBe('2026-06-29');
        });

        it('Anchor Day 31 Leap Year (2028): Feb has 29 days', () => {
            const p0 = getBillingPeriodByIndex('2028-01-31', 0);
            expect(formatIsoDate(p0.periodStart)).toBe('2028-01-31');
            expect(formatIsoDate(p0.periodEnd)).toBe('2028-02-28');

            const p1 = getBillingPeriodByIndex('2028-01-31', 1);
            expect(formatIsoDate(p1.periodStart)).toBe('2028-02-29'); // clamped to Feb 29
            expect(formatIsoDate(p1.periodEnd)).toBe('2028-03-30');

            const p2 = getBillingPeriodByIndex('2028-01-31', 2);
            expect(formatIsoDate(p2.periodStart)).toBe('2028-03-31'); // restored to 31!
            expect(formatIsoDate(p2.periodEnd)).toBe('2028-04-29');
        });
    });

    describe('4. 60-Month Continuous Invariant Check (Zero Gaps, Zero Overlaps)', () => {
        const testAnchorDays = [1, 6, 15, 28, 29, 30, 31];

        testAnchorDays.forEach((day) => {
            it(`Anchor Day ${day}: perfectly contiguous over 60 consecutive months`, () => {
                const anchorDate = `2026-01-${String(day).padStart(2, '0')}`;
                for (let k = 0; k < 60; k++) {
                    const current = getBillingPeriodByIndex(anchorDate, k);
                    const next = getBillingPeriodByIndex(anchorDate, k + 1);

                    // Invariant: nextPeriod.start = currentPeriod.end + 1 day
                    const expectedNextStart = new Date(current.periodEnd.getTime() + 86_400_000);
                    expect(formatIsoDate(next.periodStart)).toBe(formatIsoDate(expectedNextStart));

                    // Invariant: currentPeriod.end = nextPeriod.start - 1 day
                    const expectedCurrentEnd = new Date(next.periodStart.getTime() - 86_400_000);
                    expect(formatIsoDate(current.periodEnd)).toBe(formatIsoDate(expectedCurrentEnd));
                }
            });
        });
    });

    describe('5. Current Period Resolution (getBillingPeriodForDate)', () => {
        it('Resolves period containing target date accurately for anchor day 6', () => {
            const anchor = '2026-09-06';

            // Target on period start
            const pStart = getBillingPeriodForDate(anchor, '2026-09-06');
            expect(pStart.periodIndex).toBe(0);
            expect(formatIsoDate(pStart.periodStart)).toBe('2026-09-06');
            expect(formatIsoDate(pStart.periodEnd)).toBe('2026-10-05');

            // Target mid-period (e.g. today = 29 Sep 2026)
            const pMid = getBillingPeriodForDate(anchor, '2026-09-29');
            expect(pMid.periodIndex).toBe(0);
            expect(formatIsoDate(pMid.periodStart)).toBe('2026-09-06');
            expect(formatIsoDate(pMid.periodEnd)).toBe('2026-10-05');

            // Target on period end
            const pEnd = getBillingPeriodForDate(anchor, '2026-10-05');
            expect(pEnd.periodIndex).toBe(0);
            expect(formatIsoDate(pEnd.periodStart)).toBe('2026-09-06');
            expect(formatIsoDate(pEnd.periodEnd)).toBe('2026-10-05');

            // Target on next period start
            const pNext = getBillingPeriodForDate(anchor, '2026-10-06');
            expect(pNext.periodIndex).toBe(1);
            expect(formatIsoDate(pNext.periodStart)).toBe('2026-10-06');
            expect(formatIsoDate(pNext.periodEnd)).toBe('2026-11-05');

            // Target before anchor returns Period 0
            const pBefore = getBillingPeriodForDate(anchor, '2026-08-15');
            expect(pBefore.periodIndex).toBe(0);
            expect(formatIsoDate(pBefore.periodStart)).toBe('2026-09-06');
        });
    });

    describe('6. Expected Payment Date & Due Date', () => {
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

    describe('7. Draft Creation Date & Lead Times', () => {
        const expectedPaymentDate = createUtcDate(2026, 10, 15);

        it('leadTimeUnit = CALENDAR_MONTHS (1 month): 15 Oct -> 15 Sep', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
            });
            expect(formatIsoDate(draft)).toBe('2026-09-15');
        });

        it('leadTimeUnit = CALENDAR_MONTHS for month-end dates (31 Mar -> 28 Feb)', () => {
            const mar31 = createUtcDate(2026, 3, 31);
            const draft = computeDraftCreationDate({
                expectedPaymentDate: mar31,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
            });
            expect(formatIsoDate(draft)).toBe('2026-02-28');
        });

        it('leadTimeUnit = CALENDAR_MONTHS leap year (31 Mar 2028 -> 29 Feb 2028)', () => {
            const mar31Leap = createUtcDate(2028, 3, 31);
            const draft = computeDraftCreationDate({
                expectedPaymentDate: mar31Leap,
                leadTimeUnit: 'CALENDAR_MONTHS',
                leadTimeValue: 1,
            });
            expect(formatIsoDate(draft)).toBe('2028-02-29');
        });

        it('leadTimeUnit = DAYS (0 days): same as expected payment date', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 0,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-15');
        });

        it('leadTimeUnit = DAYS (1 day): 15 Oct -> 14 Oct', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 1,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-14');
        });

        it('leadTimeUnit = DAYS (7 days): 15 Oct -> 8 Oct', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 7,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-08');
        });

        it('leadTimeUnit = DAYS (14 days): 15 Oct -> 1 Oct', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 14,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-01');
        });

        it('leadTimeUnit = DAYS (30 days): 15 Oct -> 15 Sep', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                leadTimeUnit: 'DAYS',
                leadTimeValue: 30,
            });
            expect(formatIsoDate(draft)).toBe('2026-09-15');
        });

        it('Legacy fallback invoiceLeadDays (7 days) when leadTimeUnit is null', () => {
            const draft = computeDraftCreationDate({
                expectedPaymentDate,
                invoiceLeadDays: 7,
            });
            expect(formatIsoDate(draft)).toBe('2026-10-08');
        });
    });

    describe('8. UI Live Preview Generator (previewBillingPeriods)', () => {
        it('Generates 4 periods for anchor 06/09/2026 matching canonical specification', () => {
            const previews = previewBillingPeriods('2026-09-06', 4);
            expect(previews).toHaveLength(4);

            expect(previews[0].label).toBe('First Period');
            expect(previews[0].periodSpan).toBe('6 Sept 2026 – 5 Oct 2026');
            expect(formatIsoDate(previews[0].draftDate)).toBe('2026-08-06');

            expect(previews[1].label).toBe('Next');
            expect(previews[1].periodSpan).toBe('6 Oct 2026 – 5 Nov 2026');
            expect(formatIsoDate(previews[1].draftDate)).toBe('2026-09-06');

            expect(previews[2].label).toBe('Then');
            expect(previews[2].periodSpan).toBe('6 Nov 2026 – 5 Dec 2026');
            expect(formatIsoDate(previews[2].draftDate)).toBe('2026-10-06');

            expect(previews[3].label).toBe('Later');
            expect(previews[3].periodSpan).toBe('6 Dec 2026 – 5 Jan 2027');
            expect(formatIsoDate(previews[3].draftDate)).toBe('2026-11-06');
        });

        it('Generates live preview with custom lead days override', () => {
            const previews = previewBillingPeriods('2026-09-06', 2, {
                leadTimeUnit: 'DAYS',
                leadTimeValue: 14,
            });
            expect(previews).toHaveLength(2);
            // Period 1 start is 6 Oct 2026. 14 days before is 22 Sep 2026.
            expect(formatIsoDate(previews[1].draftDate)).toBe('2026-09-22');
        });
    });

    describe('9. UK Timezone / BST / GMT Immunity', () => {
        it('Preserves date arithmetic across UK Daylight Saving Time start (March transition)', () => {
            // UK clocks jump forward on last Sunday in March (29 March 2026)
            const p = getBillingPeriodByIndex('2026-03-25', 0);
            expect(formatIsoDate(p.periodStart)).toBe('2026-03-25');
            expect(formatIsoDate(p.periodEnd)).toBe('2026-04-24');

            const next = getBillingPeriodByIndex('2026-03-25', 1);
            expect(formatIsoDate(next.periodStart)).toBe('2026-04-25');
            expect(formatIsoDate(next.periodEnd)).toBe('2026-05-24');
        });

        it('Preserves date arithmetic across UK Daylight Saving Time end (October transition)', () => {
            // UK clocks fall back on last Sunday in October (25 October 2026)
            const p = getBillingPeriodByIndex('2026-10-20', 0);
            expect(formatIsoDate(p.periodStart)).toBe('2026-10-20');
            expect(formatIsoDate(p.periodEnd)).toBe('2026-11-19');

            const next = getBillingPeriodByIndex('2026-10-20', 1);
            expect(formatIsoDate(next.periodStart)).toBe('2026-11-20');
            expect(formatIsoDate(next.periodEnd)).toBe('2026-12-19');
        });
    });

    describe('10. Full computeBillingSchedule Integration & Missed Eligibility', () => {
        it('Initial setup (unbilled): returns Period 0 as candidate even when reference date is well past draft date (Requirement 38)', () => {
            const schedule = computeBillingSchedule(
                {
                    id: 'cfg-test',
                    billingAnchorDate: '2026-09-06',
                    invoiceLeadDays: 30,
                    leadTimeUnit: 'CALENDAR_MONTHS',
                    leadTimeValue: 1,
                    lastBilledPeriodStart: null,
                },
                createUtcDate(2026, 9, 29) // Reference date: 29 Sep (after 6 Aug draft date)
            );

            // Candidate must be Period 0, not skipped to November!
            expect(formatIsoDate(schedule.periodStart)).toBe('2026-09-06');
            expect(formatIsoDate(schedule.periodEnd)).toBe('2026-10-05');
            expect(formatIsoDate(schedule.draftCreationDate)).toBe('2026-08-06');
            expect(schedule.cycleKey).toBe('cfg-test:2026-09-06');
        });

        it('Advances to Period 1 when lastBilledPeriodStart is Period 0', () => {
            const schedule = computeBillingSchedule(
                {
                    id: 'cfg-test',
                    billingAnchorDate: '2026-09-06',
                    invoiceLeadDays: 30,
                    leadTimeUnit: 'CALENDAR_MONTHS',
                    leadTimeValue: 1,
                    lastBilledPeriodStart: '2026-09-06',
                },
                createUtcDate(2026, 9, 29)
            );

            expect(formatIsoDate(schedule.periodStart)).toBe('2026-10-06');
            expect(formatIsoDate(schedule.periodEnd)).toBe('2026-11-05');
            expect(formatIsoDate(schedule.draftCreationDate)).toBe('2026-09-06');
            expect(schedule.cycleKey).toBe('cfg-test:2026-10-06');
        });

        it('Advances to Period 2 when lastBilledPeriodStart is Period 1', () => {
            const schedule = computeBillingSchedule(
                {
                    id: 'cfg-test',
                    billingAnchorDate: '2026-09-06',
                    invoiceLeadDays: 30,
                    leadTimeUnit: 'CALENDAR_MONTHS',
                    leadTimeValue: 1,
                    lastBilledPeriodStart: '2026-10-06',
                },
                createUtcDate(2026, 9, 29)
            );

            expect(formatIsoDate(schedule.periodStart)).toBe('2026-11-06');
            expect(formatIsoDate(schedule.periodEnd)).toBe('2026-12-05');
            expect(formatIsoDate(schedule.draftCreationDate)).toBe('2026-10-06');
            expect(schedule.cycleKey).toBe('cfg-test:2026-11-06');
        });
    });
});
