import { describe, it, expect } from 'vitest';
import { requiresAssessmentOutcome } from './assessment-outcome';
const now = new Date('2026-10-21T12:00:00Z');
describe('assessment follow-up', () => {
    it('flags past booked and pending appointments without claiming attendance', () => {
        expect(requiresAssessmentOutcome('confirmed', '2026-10-20T12:00:00Z', now)).toBe(true);
        expect(requiresAssessmentOutcome('pending', '2026-10-20T12:00:00Z', now)).toBe(true);
    });
    it('does not chase an outcome already recorded for every attendee', () => {
        expect(requiresAssessmentOutcome('confirmed', '2026-10-20', now, ['no_show'])).toBe(false);
        expect(requiresAssessmentOutcome('confirmed', '2026-10-20', now, ['present', null])).toBe(true);
    });
    it('preserves actual outcomes and future bookings', () => {
        for (const status of ['completed', 'rescheduled', 'cancelled', 'signed_up']) expect(requiresAssessmentOutcome(status, '2026-10-20', now)).toBe(false);
        expect(requiresAssessmentOutcome('confirmed', '2026-10-22', now)).toBe(false);
    });
    it('does not invent an outcome for a missing or invalid date', () => {
        expect(requiresAssessmentOutcome('confirmed', null, now)).toBe(false);
        expect(requiresAssessmentOutcome('confirmed', 'invalid', now)).toBe(false);
    });
});
