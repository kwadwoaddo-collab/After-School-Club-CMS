import { describe, expect, it } from 'vitest';
import { ImportFamilyReviewError, safeImportRowError, unconfirmedImportResult, IMPORT_ROW_UNCONFIRMED, IMPORT_FAMILY_REVIEW_REQUIRED } from './import-errors';
describe('safe import recovery', () => {
  it.each([new Error('postgres constraint secret_table user@example.com'), new Error('Failed query: insert into parents'), new Error('NEXT_REDIRECT'), 'private details', null])('does not expose arbitrary caught details', error => {
    expect(safeImportRowError(error)).toBe(IMPORT_ROW_UNCONFIRMED);
  });
  it('preserves the actionable family-review guard without copying record details', () => {
    expect(safeImportRowError(new ImportFamilyReviewError('internal family name'))).toBe(IMPORT_FAMILY_REVIEW_REQUIRED);
  });
  it('marks a missing response as unknown, not zero saved records', () => {
    const result = unconfirmedImportResult(12);
    expect(result.countsUnavailable).toBe(true);
    expect(result.outcomeUnconfirmed).toBe(true);
    expect(result.errors[0].message).toContain('Some records may have been saved');
    expect(result.stats.totalRows).toBe(12);
  });
});
