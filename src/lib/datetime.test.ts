import { describe, expect, it } from 'vitest';
import { parseInTimezone, formatInTimezone } from './datetime';

describe('Timezone Utility (datetime.ts)', () => {
  it('correctly parses and formats in BST (summer time)', () => {
    // 22nd July is during BST (British Summer Time, UTC+1)
    const date = parseInTimezone('2026-07-22', '15:47', 'Europe/London');
    
    // In UTC, this should be 14:47
    expect(date.getUTCHours()).toBe(14);
    expect(date.getUTCMinutes()).toBe(47);
    
    // Formatting it back in Europe/London should yield 15:47
    expect(formatInTimezone(date, 'Europe/London')).toBe('15:47');
  });

  it('correctly parses and formats in GMT (winter time)', () => {
    // 22nd December is during GMT (Greenwich Mean Time, UTC+0)
    const date = parseInTimezone('2026-12-22', '15:47', 'Europe/London');
    
    // In UTC, this should be 15:47
    expect(date.getUTCHours()).toBe(15);
    expect(date.getUTCMinutes()).toBe(47);
    
    // Formatting it back in Europe/London should yield 15:47
    expect(formatInTimezone(date, 'Europe/London')).toBe('15:47');
  });

  it('handles the spring DST transition hour boundary', () => {
    // In the UK, DST starts on the last Sunday of March (clocks forward at 01:00 GMT to 02:00 BST)
    // 2026-03-29 02:30 Europe/London is valid BST.
    const date = parseInTimezone('2026-03-29', '02:30', 'Europe/London');
    
    // 02:30 BST should be 01:30 UTC
    expect(date.getUTCHours()).toBe(1);
    expect(date.getUTCMinutes()).toBe(30);
    expect(formatInTimezone(date, 'Europe/London')).toBe('02:30');
  });
});
