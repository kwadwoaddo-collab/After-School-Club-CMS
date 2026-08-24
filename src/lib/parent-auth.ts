import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';

// Use PARENT_SESSION_SECRET or AUTH_SECRET for signing, with a fallback for local dev if missing
const JWT_SECRET = new TextEncoder().encode(
    process.env.PARENT_SESSION_SECRET || process.env.AUTH_SECRET || 'default-dev-secret-do-not-use-in-prod'
);

/**
 * Sign a new parent session JWT.
 *
 * This is the ONLY legitimate path for creating a parent session.
 * Called exclusively from /portal/verify after the magic-link token has been
 * cryptographically verified against the hashed DB record and the expiry
 * has been confirmed.
 */
export async function signParentToken(parentId: string): Promise<string> {
    return new SignJWT({ parentId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(JWT_SECRET);
}

/**
 * Verify a parent session token (HS256 JWT only).
 *
 * AUTH-2 fix: The original implementation fell back to accepting any
 * UUID-shaped cookie value as a valid parentId when JWT verification failed.
 * A raw UUID provides no cryptographic guarantee of identity — no signature,
 * no expiry, no revocation. This fallback is removed. All parent sessions
 * MUST be JWT-signed via signParentToken(). Parents with legacy plain-UUID
 * cookies will receive null here and will be redirected to /portal/login to
 * obtain a proper signed session via magic link.
 */
export async function verifyParentToken(token: string): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return (payload.parentId as string) || null;
    } catch {
        // JWT verification failed (invalid signature, expired, malformed).
        // No fallback — return null unconditionally.
        return null;
    }
}

/**
 * Resolve the authenticated parent for the current request.
 *
 * S-2 fix: added isNull(parents.deletedAt) so soft-deleted parents can no
 * longer authenticate. A staff-initiated GDPR deletion immediately revokes
 * portal access even if the parent holds a valid unexpired JWT.
 *
 * S-4 fix: children relation filtered with isNull(children.deletedAt) so
 * soft-deleted children do not appear in the portal child list or booking
 * selector.
 *
 * The result is cached per-request via React cache() so that repeated calls
 * in the same RSC tree incur only a single DB round-trip.
 */
export const getCurrentParent = cache(async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_session')?.value;

    if (!token) return null;

    const parentId = await verifyParentToken(token);
    if (!parentId) return null;

    try {
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, parentId),
                isNull(parents.deletedAt)   // S-2: exclude soft-deleted parents
            ),
            with: {
                children: {
                    where: isNull(children.deletedAt), // S-4: exclude soft-deleted children
                },
                bookings: {
                    with: {
                        centre: {
                            with: {
                                organisation: {
                                    columns: {
                                        id: true,
                                        slug: true,
                                    }
                                }
                            }
                        },
                    },
                    limit: 20
                }
            }
        });
        return parent || null;
    } catch (e) {
        logger.error('Parent auth error', e);
        return null;
    }
});
