import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 5 login attempts per minute per IP
        const ip = getClientIP(req);
        const { success: allowed } = await checkRateLimit(strictRateLimit, `portal:${ip}`);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

        // Find parent
        const parent = await db.query.parents.findFirst({
            where: eq(parents.email, email),
        });

        if (!parent) {
            // Security: Don't reveal existence.
            return NextResponse.json({ success: true, message: 'If an account exists with this email, a login link has been sent.' });
        }

        const rawToken = crypto.randomUUID();
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await db.update(parents)
            .set({ magicLinkToken: hashedToken, magicLinkExpiresAt: expiresAt })
            .where(eq(parents.id, parent.id));

        // TODO: Replace console.log with actual email sending
        const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/verify?token=${rawToken}`;
        console.log('[PortalLogin] Magic link generated for:', email);

        // Only expose the link in development (never in production)
        const response: Record<string, any> = {
            success: true,
            message: 'Check your email for the login link.',
        };
        if (process.env.NODE_ENV === 'development') {
            response.debugLink = magicLink;
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Portal login error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
