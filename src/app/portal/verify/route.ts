import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        redirect('/portal/login?error=InvalidToken');
    }

    const parent = await db.query.parents.findFirst({
        where: and(
            eq(parents.magicLinkToken, token),
            gt(parents.magicLinkExpiresAt, new Date())
        )
    });

    if (!parent) {
        redirect('/portal/login?error=ExpiredOrInvalid');
    }

    // Invalidate token
    await db.update(parents)
        .set({ magicLinkToken: null, magicLinkExpiresAt: null })
        .where(eq(parents.id, parent.id));

    // Set Session Cookie
    // TODO: In production, sign this cookie or use a proper session store
    const cookieStore = await cookies();
    cookieStore.set('parent_session', parent.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
    });

    redirect('/portal');
}
