import { describe, it, expect } from 'vitest';
import { neutralizeCsvFormula } from './csv-safety';

describe('neutralizeCsvFormula — Milestone 3I O.8', () => {
  it.each(['=cmd|\'/c calc\'!A1', '+1+1', '-1+1', '@SUM(A1:A2)'])(
    'prefixes a leading formula-trigger character (%s)',
    (value) => {
      expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
    }
  );

  it('leaves an ordinary value unchanged', () => {
    expect(neutralizeCsvFormula('Jane Smith')).toBe('Jane Smith');
  });

  it('leaves an empty value unchanged', () => {
    expect(neutralizeCsvFormula('')).toBe('');
  });

  it('does not touch a value that merely contains, but does not start with, a trigger character', () => {
    expect(neutralizeCsvFormula('Smith-Jones')).toBe('Smith-Jones');
    expect(neutralizeCsvFormula('email@example.com')).toBe('email@example.com');
  });
});
