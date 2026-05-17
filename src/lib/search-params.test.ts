import { describe, it, expect } from 'vitest';
import { normalizeString, normalizeEnum, normalizeDate } from './search-params';

describe('searchParams normalization utilities', () => {
    describe('normalizeString', () => {
        it('handles undefined', () => {
            expect(normalizeString(undefined)).toBeUndefined();
            expect(normalizeString(undefined, 'default')).toBe('default');
        });

        it('handles string', () => {
            expect(normalizeString('foo')).toBe('foo');
            expect(normalizeString('foo', 'default')).toBe('foo');
        });

        it('handles array of strings', () => {
            expect(normalizeString(['foo', 'bar'])).toBe('foo');
            expect(normalizeString(['foo', 'bar'], 'default')).toBe('foo');
        });
    });

    describe('normalizeEnum', () => {
        const allowed = ['foo', 'bar'] as const;

        it('returns valid value', () => {
            expect(normalizeEnum('foo', allowed, 'bar')).toBe('foo');
            expect(normalizeEnum(['foo', 'invalid'], allowed, 'bar')).toBe('foo');
        });

        it('returns fallback for invalid value', () => {
            expect(normalizeEnum('invalid', allowed, 'bar')).toBe('bar');
            expect(normalizeEnum(['invalid'], allowed, 'bar')).toBe('bar');
            expect(normalizeEnum(undefined, allowed, 'bar')).toBe('bar');
        });
    });

    describe('normalizeDate', () => {
        it('returns valid date string', () => {
            expect(normalizeDate('2026-05-17')).toBe('2026-05-17');
            expect(normalizeDate(['2026-05-17', 'invalid'])).toBe('2026-05-17');
        });

        it('returns undefined for invalid date string', () => {
            expect(normalizeDate('invalid')).toBeUndefined();
            expect(normalizeDate(['invalid', '2026-05-17'])).toBeUndefined();
            expect(normalizeDate(undefined)).toBeUndefined();
        });
    });
});
