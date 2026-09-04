import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const session = await getApiSession();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Milestone 3J: Defect 1 — missing role check. Only ORG_OWNER may update
        // organisation-level branding (matches policy on all other org settings mutations).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((session.user as any).role !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { primaryColor } = await request.json();

        if (!primaryColor) {
            return NextResponse.json({ error: 'Primary color is required' }, { status: 400 });
        }

        // Validate hex color format
        if (!/^#[0-9A-F]{6}$/i.test(primaryColor)) {
            return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
        }

        // Update organization branding
        await db
            .update(organisations)
            .set({ brandColor: primaryColor })
            .where(eq(organisations.id, session.user.organisationId));

        return NextResponse.json({
            success: true,
            message: 'Branding updated successfully'
        });
    } catch (error) {
        logger.error('Branding update error:', error);
        return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
    }
}
