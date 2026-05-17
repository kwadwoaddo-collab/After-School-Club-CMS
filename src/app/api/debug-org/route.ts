import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, session.user.organisationId),
        });

        return NextResponse.json({
            success: true,
            organisation: org,
            organisationId: session.user.organisationId,
        });
    } catch (error) {
        console.error('[Debug Org] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
