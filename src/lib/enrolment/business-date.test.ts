import { describe, expect, it } from 'vitest';
import { enrolmentBusinessDate } from './business-date';
describe('UK enrolment business date', () => {
    it('applies a new effective date at London midnight during BST, before UTC midnight', () => {
        expect(enrolmentBusinessDate(new Date('2026-06-01T22:59:59Z'))).toBe('2026-06-01');
        expect(enrolmentBusinessDate(new Date('2026-06-01T23:00:00Z'))).toBe('2026-06-02');
    });
    it('keeps UTC and London dates aligned during GMT', () => {
        expect(enrolmentBusinessDate(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-01');
    });
});
