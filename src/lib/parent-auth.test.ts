/**
 * parent-auth.ts unit tests.
 *
 * AUTH-2 change note: the original test asserted that a raw UUID cookie was
 * accepted as a valid session (the "backwards compatibility" fallback). That
 * fallback is removed — verifyParentToken() now returns null for any input
 * that does not verify as a properly signed JWT. The test has been updated
 * to reflect (and enforce) the new secure behaviour.
 */
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

    it('AUTH-2: rejects a raw UUID cookie (no JWT signature)', async () => {
        // Previously this returned the UUID as a valid parentId.
        // After the AUTH-2 security fix, a raw UUID must never constitute
        // authentication — only a cryptographically signed JWT is accepted.
        const rawUuid = '123e4567-e89b-12d3-a456-426614174000';
        const verifiedId = await verifyParentToken(rawUuid);

        expect(verifiedId).toBeNull();
    });

    it('returns null for invalid tokens that are not UUIDs', async () => {
        const invalidToken = 'invalid.jwt.token.thatisnotauuid';
        const verifiedId = await verifyParentToken(invalidToken);

        expect(verifiedId).toBeNull();
    });

    it('returns null for a malformed JWT (tampered signature)', async () => {
        const parentId = '123e4567-e89b-12d3-a456-426614174000';
        const token = await signParentToken(parentId);
        // Tamper: replace the signature part
        const parts = token.split('.');
        const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
        const verifiedId = await verifyParentToken(tampered);

        expect(verifiedId).toBeNull();
    });

    it('returns null for an empty string', async () => {
        const verifiedId = await verifyParentToken('');
        expect(verifiedId).toBeNull();
    });
});
