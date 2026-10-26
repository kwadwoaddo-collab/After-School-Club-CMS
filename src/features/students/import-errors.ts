import type { ImportResult } from './import-actions';

export const IMPORT_OUTCOME_UNCONFIRMED = 'We couldn’t confirm the import result. Some records may have been saved. Check the Students and Parents lists before trying again.';
export const IMPORT_ROW_UNCONFIRMED = 'We couldn’t confirm this row’s import result. Check the Students and Parents lists before importing this row again.';
export const IMPORT_FAMILY_REVIEW_REQUIRED = 'This family’s record needs a manager’s review before another student can be linked. Ask your manager to check the family in data review.';

/** Only messages originating in explicit application guards are safe to display. */
export class ImportFamilyReviewError extends Error {}
export function safeImportRowError(error: unknown): string {
  return error instanceof ImportFamilyReviewError ? IMPORT_FAMILY_REVIEW_REQUIRED : IMPORT_ROW_UNCONFIRMED;
}
export function unconfirmedImportResult(totalRows: number): ImportResult {
  return { success: false, outcomeUnconfirmed: true, countsUnavailable: true,
    stats: { totalRows, createdParents: 0, matchedParents: 0, createdStudents: 0, skippedStudents: 0 },
    errors: [{ row: 0, message: IMPORT_OUTCOME_UNCONFIRMED }] };
}
