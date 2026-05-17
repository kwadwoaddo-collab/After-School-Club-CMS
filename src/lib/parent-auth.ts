import { cookies } from 'next/headers';
import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';

// Use AUTH_SECRET for signing, with a fallback for local dev if missing
const JWT_SECRET = new TextEncoder().encode(
    process.env.AUTH_SECRET || 'default-dev-secret-do-not-use-in-prod'
);

export async function signParentToken(parentId: string): Promise<string> {
    return new SignJWT({ parentId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(JWT_SECRET);
}

export async function verifyParentToken(token: string): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload.parentId as string;
    } catch (error) {
        return null; // Invalid or expired token
    }
}

export const getCurrentParent = cache(async () => {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_session')?.value;

    if (!token) return null;

    const parentId = await verifyParentToken(token);
    if (!parentId) return null;

    try {
        const parent = await db.query.parents.findFirst({
            where: eq(parents.id, parentId),
            with: {
                children: true,
                bookings: {
                    with: {
                        centre: {
                            with: {
                                organisation: true
                            }
                        },
                    },
                    // orderBy: (bookings, { desc }) => [desc(bookings.startAt)], // Drizzle query builder syntax varies, usually separate
                    limit: 20
                }
            }
        });
        return parent || null;
    } catch (e) {
        console.error('Parent auth error', e);
        return null;
    }
});
