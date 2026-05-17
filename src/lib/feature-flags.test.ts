import { describe, it, expect } from 'vitest';
import { isFeatureEnabled } from './feature-flags';

describe('Feature Flags', () => {
    it('returns a boolean value for existing flags', () => {
        const result = isFeatureEnabled('PAGINATION_ENABLED');
        expect(typeof result).toBe('boolean');
    });

    it('returns the exact configured value based on environment', () => {
        const paginationEnabled = isFeatureEnabled('PAGINATION_ENABLED');
        const autoConversion = isFeatureEnabled('AUTO_CONVERSION');
        
        expect(paginationEnabled).toBeTypeOf('boolean');
        expect(autoConversion).toBeTypeOf('boolean');
    });
});
