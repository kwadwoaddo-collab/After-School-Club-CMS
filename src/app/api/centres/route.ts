import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { getUserAccessibleCentres } from '@/lib/permissions';

export async function GET(request: NextRequest) {
    try {
        const session = await getApiSession();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userRole = (session.user as { role?: string })?.role;
        if (userRole === 'ORG_OWNER') {
            const orgCentres = await db
                .select({ id: centres.id, name: centres.name })
                .from(centres)
                .where(eq(centres.organisationId, session.user.organisationId));
            return NextResponse.json(orgCentres);
        }

        const accessibleCentres = await getUserAccessibleCentres(session.user.id);
        const mapped = accessibleCentres.map(c => ({ id: c.id, name: c.name }));
        return NextResponse.json(mapped);
    } catch (error) {
        logger.error('[Centres API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch centres' },
            { status: 500 }
        );
    }
}
