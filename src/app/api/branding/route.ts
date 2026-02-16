import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        console.error('Branding update error:', error);
        return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
    }
}
