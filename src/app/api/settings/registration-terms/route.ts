import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgId = (session.user as any).organisationId;
        if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 400 });

        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, orgId),
            columns: { registrationTerms: true, slug: true },
        });

        return NextResponse.json(org ?? {});
    } catch (error) {
        logger.error('[GET /api/settings/registration-terms]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgId = (session.user as any).organisationId;
        if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 400 });

        // Only ORG_OWNER should update registration terms
        if ((session.user as any).role !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let body: { registrationTerms?: unknown };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { registrationTerms } = body;

        // Allow null/undefined to clear terms; cap string length to 50,000 chars
        if (registrationTerms !== null && registrationTerms !== undefined) {
            if (typeof registrationTerms !== 'string') {
                return NextResponse.json({ error: 'registrationTerms must be a string' }, { status: 400 });
            }
            if (registrationTerms.length > 50_000) {
                return NextResponse.json({ error: 'registrationTerms must be 50,000 characters or fewer' }, { status: 400 });
            }
        }

        await db.update(organisations)
            .set({ registrationTerms: registrationTerms as string | null ?? null, updatedAt: new Date() })
            .where(eq(organisations.id, orgId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[PATCH /api/settings/registration-terms]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
