import { cookies } from 'next/headers';
import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cache } from 'react';

export const getCurrentParent = cache(async () => {
    const cookieStore = await cookies();
    const parentId = cookieStore.get('parent_session')?.value;

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
