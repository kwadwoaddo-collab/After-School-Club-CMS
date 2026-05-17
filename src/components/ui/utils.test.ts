import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('UI Utilities', () => {
    describe('cn()', () => {
        it('merges class names correctly', () => {
            expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
        });

        it('filters out falsy values', () => {
            expect(cn('base', false, null, undefined, 'active')).toBe('base active');
        });

        it('handles conditional classes properly', () => {
            const isActive = true;
            const isDisabled = false;
            expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
        });
    });
});
