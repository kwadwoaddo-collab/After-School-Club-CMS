import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

        // Find parent
        const parent = await db.query.parents.findFirst({
            where: eq(parents.email, email),
        });

        if (!parent) {
            // Security: Don't reveal existence. 
            // But for MVP/Debugging, returning a hint might be useful if needed, but sticking to standard.
            return NextResponse.json({ success: true, message: 'If an account exists with this email, a login link has been sent.' });
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await db.update(parents)
            .set({ magicLinkToken: token, magicLinkExpiresAt: expiresAt })
            .where(eq(parents.id, parent.id));

        // Mock Email Sending
        const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/verify?token=${token}`;
        console.log('=============================================');
        console.log('MAGIC LINK FOR:', email);
        console.log(magicLink);
        console.log('=============================================');

        return NextResponse.json({
            success: true,
            message: 'Check your email for the login link.',
            // Including link in response for easier testing in preview
            debugLink: magicLink
        });
    } catch (error) {
        console.error('Portal login error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
