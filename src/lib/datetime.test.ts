import { describe, expect, it } from 'vitest';
import {
  parseInTimezone,
  formatInTimezone,
  formatDisplayTimeInTimezone,
  formatDateInTimezone,
  formatShortDateInTimezone,
} from './datetime';

describe('Timezone Utility (datetime.ts)', () => {
  it('correctly parses and formats in BST (summer time)', () => {
    // 22nd July is during BST (British Summer Time, UTC+1)
    const date = parseInTimezone('2026-07-22', '15:30', 'Europe/London');

    // In UTC, 15:30 BST must be 14:30 UTC
    expect(date.getUTCHours()).toBe(14);
    expect(date.getUTCMinutes()).toBe(30);

    // Formatting it back in Europe/London should yield 15:30
    expect(formatInTimezone(date, 'Europe/London')).toBe('15:30');
    expect(formatDisplayTimeInTimezone(date, 'Europe/London')).toBe('3:30 PM');
  });

  it('correctly parses and formats in GMT (winter time)', () => {
    // 22nd December is during GMT (Greenwich Mean Time, UTC+0)
    const date = parseInTimezone('2026-12-22', '15:30', 'Europe/London');

    // In UTC, this should be 15:30
    expect(date.getUTCHours()).toBe(15);
    expect(date.getUTCMinutes()).toBe(30);

    // Formatting it back in Europe/London should yield 15:30
    expect(formatInTimezone(date, 'Europe/London')).toBe('15:30');
    expect(formatDisplayTimeInTimezone(date, 'Europe/London')).toBe('3:30 PM');
  });

  it('handles the spring DST transition hour boundaries', () => {
    // In the UK, DST starts on the last Sunday of March (clocks forward at 01:00 GMT to 02:00 BST)
    // 1. Immediately before transition: 00:30 GMT
    const before = parseInTimezone('2026-03-29', '00:30', 'Europe/London');
    expect(before.getUTCHours()).toBe(0);
    expect(before.getUTCMinutes()).toBe(30);
    expect(formatInTimezone(before, 'Europe/London')).toBe('00:30');

    // 2. Nonexistent time in spring-forward gap: 01:30
    // Policy: Deterministically advances into valid DST time
    const gap = parseInTimezone('2026-03-29', '01:30', 'Europe/London');
    expect(gap.getUTCHours()).toBe(1);
    expect(gap.getUTCMinutes()).toBe(30);

    // 3. Immediately after transition: 02:30 BST
    const after = parseInTimezone('2026-03-29', '02:30', 'Europe/London');
    expect(after.getUTCHours()).toBe(1);
    expect(after.getUTCMinutes()).toBe(30);
    expect(formatInTimezone(after, 'Europe/London')).toBe('02:30');
  });

  it('handles the autumn DST fall-back transition hour boundaries', () => {
    // In the UK, DST ends on the last Sunday of October (clocks fall back from 02:00 BST to 01:00 GMT)
    // Ambiguous repeated hour 01:30 resolves deterministically to standard time (GMT, UTC+0)
    const fold = parseInTimezone('2026-10-25', '01:30', 'Europe/London');
    expect(fold.getUTCHours()).toBe(1);
    expect(fold.getUTCMinutes()).toBe(30);
    expect(formatInTimezone(fold, 'Europe/London')).toBe('01:30');
  });

  it('handles calendar date boundary close to midnight', () => {
    // 2026-07-22 00:00 BST is 2026-07-21 23:00 UTC
    const midnight = parseInTimezone('2026-07-22', '00:00', 'Europe/London');
    expect(midnight.getUTCHours()).toBe(23);
    expect(midnight.getUTCDate()).toBe(21);
    expect(formatInTimezone(midnight, 'Europe/London')).toBe('00:00');
    expect(formatDateInTimezone(midnight, 'Europe/London')).toBe('22 Jul 2026');

    // Late evening: 23:45 BST is 22:45 UTC on same day
    const late = parseInTimezone('2026-07-22', '23:45', 'Europe/London');
    expect(late.getUTCHours()).toBe(22);
    expect(late.getUTCMinutes()).toBe(45);
    expect(late.getUTCDate()).toBe(22);
    expect(formatInTimezone(late, 'Europe/London')).toBe('23:45');
  });

  it('formats dates consistently in London centre time regardless of viewer', () => {
    const bstDate = parseInTimezone('2026-07-22', '15:30', 'Europe/London');
    expect(formatDisplayTimeInTimezone(bstDate, 'Europe/London')).toBe('3:30 PM');
    expect(formatShortDateInTimezone(bstDate, 'Europe/London')).toBe('Wed, Jul 22');
  });
});
