import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites } from '@/db/schema';
import { desc } from 'drizzle-orm';

/**
 * Debug endpoint to check recent staff invitations in the database
 */
export async function GET(request: NextRequest) {
    try {
        // Get the last 5 staff invitations
        const recentInvites = await db
            .select()
            .from(staffInvites)
            .orderBy(desc(staffInvites.createdAt))
            .limit(5);

        return NextResponse.json({
            success: true,
            count: recentInvites.length,
            invites: recentInvites.map(inv => ({
                id: inv.id,
                email: inv.email,
                role: inv.role,
                status: inv.status,
                createdAt: inv.createdAt,
                expiresAt: inv.expiresAt,
            })),
        });
    } catch (error) {
        console.error('[Debug Invites] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
