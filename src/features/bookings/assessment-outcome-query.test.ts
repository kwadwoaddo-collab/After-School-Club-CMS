import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { assessmentOutcomeRequiredSql } from './assessment-outcome-query';
import { requiresAssessmentOutcome } from './assessment-outcome';
describe('assessment outcome queue', () => {
    it('matches past booked/pending assessments with no or incomplete per-child outcomes', () => {
        const now = new Date('2026-10-26T12:00:00Z');
        expect(requiresAssessmentOutcome('confirmed', '2026-10-25', now, [])).toBe(true);
        expect(requiresAssessmentOutcome('pending', '2026-10-25', now, ['present', null])).toBe(true);
        expect(requiresAssessmentOutcome('confirmed', '2026-10-25', now, ['present', 'no_show'])).toBe(false);
        expect(requiresAssessmentOutcome('completed', '2026-10-25', now, [])).toBe(false);
        expect(requiresAssessmentOutcome('confirmed', '2026-10-27', now, [])).toBe(false);
        const query = new PgDialect().sqlToQuery(assessmentOutcomeRequiredSql(now));
        expect(query.sql).toContain("IN ('confirmed', 'pending')"); expect(query.sql).toContain('NOT EXISTS'); expect(query.sql).toContain('attendance_status IS NULL');
        expect(query.params).toContain(now);
    });
});
