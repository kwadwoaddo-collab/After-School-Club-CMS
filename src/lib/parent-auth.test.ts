import { describe, it, expect } from 'vitest';
import { signParentToken, verifyParentToken } from './parent-auth';

describe('Parent Auth Helpers', () => {
    it('signs and verifies a valid JWT token', async () => {
        const parentId = '123e4567-e89b-12d3-a456-426614174000';
        const token = await signParentToken(parentId);
        
        expect(token).toBeTypeOf('string');
        expect(token).not.toEqual(parentId);
        
        const verifiedId = await verifyParentToken(token);
        expect(verifiedId).toEqual(parentId);
    });

    it('falls back to verifying raw UUID cookies for backwards compatibility', async () => {
        const rawUuid = '123e4567-e89b-12d3-a456-426614174000';
        const verifiedId = await verifyParentToken(rawUuid);
        
        expect(verifiedId).toEqual(rawUuid);
    });

    it('returns null for invalid tokens that are not UUIDs', async () => {
        const invalidToken = 'invalid.jwt.token.thatisnotauuid';
        const verifiedId = await verifyParentToken(invalidToken);
        
        expect(verifiedId).toBeNull();
    });
});
