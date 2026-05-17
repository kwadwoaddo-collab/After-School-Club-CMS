import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email';

/**
 * Diagnostic endpoint to test staff invitation email from actual API
 * This simulates what the staff invite route does
 */
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
        console.log('[Diagnostic] Starting staff invitation test...');

        // Simulate the exact same call as the staff invite route
        const result = await emailService.sendStaffInvitation({
            email: 'brakatuaddo@gmail.com',
            role: 'MANAGER',
            inviteLink: 'https://after-school-club-cms.vercel.app/accept-invite?token=diagnostic123',
            organisationName: 'Diagnostic Test Org',
            inviterName: 'System Diagnostic',
        });

        console.log('[Diagnostic] Result:', JSON.stringify(result));

        return NextResponse.json({
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Diagnostic] Exception:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
