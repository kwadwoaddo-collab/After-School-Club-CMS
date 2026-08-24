import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signParentToken } from '@/lib/parent-auth';
import { hashToken } from '@/lib/magic-link';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        redirect('/portal/login?error=InvalidToken');
    }

    // AUTH-1 fix: only compare the hashed form of the token against the DB.
    // The original code also compared the raw (unhashed) token as a
    // backwards-compatibility fallback, but this is architecturally incorrect:
    // if the DB were to contain a raw token (e.g. from a legacy migration),
    // an attacker who obtained the raw token could authenticate without
    // going through the canonical hash path.
    //
    // The canonical magic-link generation path always:
    //   1. generateMagicLinkToken()  → rawToken (random bytes, never stored)
    //   2. hashToken(rawToken)       → stored in parents.magicLinkToken
    //   3. rawToken embedded in URL  → delivered to parent's email
    //
    // Verification must therefore always hash the URL token before comparison.
    // Raw-token acceptance is removed. Any DB row with an unhashed token cannot
    // be matched (which is safe — such rows represent the old scheme and should
    // be migrated by re-requesting a magic link).
    const hashedToken = hashToken(token);

    const parent = await db.query.parents.findFirst({
        where: and(
            eq(parents.magicLinkToken, hashedToken),
            gt(parents.magicLinkExpiresAt, new Date()),
            isNull(parents.deletedAt)   // S-2: do not issue a session for a soft-deleted parent
        )
    });

    if (!parent) {
        redirect('/portal/login?error=ExpiredOrInvalid');
    }

    // Invalidate the token immediately after consumption (single-use).
    await db.update(parents)
        .set({ magicLinkToken: null, magicLinkExpiresAt: null })
        .where(eq(parents.id, parent.id));

    // Issue a signed JWT session cookie.
    const cookieStore = await cookies();
    const sessionToken = await signParentToken(parent.id);
    
    cookieStore.set('parent_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
    });

    redirect('/portal');
}
