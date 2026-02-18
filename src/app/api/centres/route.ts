import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgCentres = await db
            .select({ id: centres.id, name: centres.name })
            .from(centres)
            .where(eq(centres.organisationId, session.user.organisationId));

        return NextResponse.json(orgCentres);
    } catch (error) {
        console.error('[Centres API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch centres' },
            { status: 500 }
        );
    }
}
