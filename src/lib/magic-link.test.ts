import { describe, it, expect } from 'vitest';
import { generateMagicLinkToken, hashToken } from './magic-link';

describe('Magic Link Token Utilities', () => {
    it('generates a secure 64-character token', () => {
        const token = generateMagicLinkToken();
        expect(token).toHaveLength(64);
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hashes the token correctly and deterministically', () => {
        const token = '123456';
        const hash = hashToken(token);
        expect(hash).toHaveLength(64);
        expect(hashToken(token)).toEqual(hash);
        expect(hash).not.toEqual(token);
    });
});
