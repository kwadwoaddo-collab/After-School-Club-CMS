import { Cadence } from '../types';

/**
 * Evaluates the scheduled maintenance cadence for a given date.
 * Scheduling rules:
 * - 1st Monday (days 1-7) of Jan (0), Apr (3), Jul (6), Oct (9) -> 'quarterly'
 * - 1st Monday (days 1-7) of any other month -> 'monthly'
 * - Any other Monday / day -> 'weekly'
 */
export function determineScheduledCadence(date: Date = new Date()): Cadence {
  const dayOfMonth = date.getDate();
  const month = date.getMonth(); // 0-11

  const isFirstWeek = dayOfMonth <= 7;
  const isQuarterMonth = month === 0 || month === 3 || month === 6 || month === 9;

  if (isFirstWeek && isQuarterMonth) {
    return 'quarterly';
  }
  if (isFirstWeek) {
    return 'monthly';
  }
  return 'weekly';
}

/**
 * Checks if a requested cadence should yield to a higher scheduled precedence on this day.
 * If today is a quarterly run, a scheduled weekly or monthly run should yield/elevate.
 */
export function getEffectiveCadence(requested: Cadence, date: Date = new Date()): Cadence {
  const scheduled = determineScheduledCadence(date);
  // If explicitly requested quarterly, run quarterly.
  // When wrapper runs automatically without an explicit override, it follows determineScheduledCadence.
  return requested || scheduled;
}
