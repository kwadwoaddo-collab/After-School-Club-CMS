import { NextRequest, NextResponse } from 'next/server';

/**
 * Super diagnostic - calls the staff invite endpoint directly as if it came from the form
 * This bypasses authentication to test email sending
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[Super Diagnostic] Testing staff invite email flow...');

        // Import the email service directly
        const { emailService } = await import('@/lib/services/email');

        console.log('[Super Diagnostic] Email service imported successfully');
        console.log('[Super Diagnostic] Calling sendStaffInvitation...');

        const result = await emailService.sendStaffInvitation({
            email: 'brakatuaddo@gmail.com',
            role: 'MANAGER',
            inviteLink: 'https://after-school-club-cms.vercel.app/accept-invite?token=superdiag123',
            organisationName: 'Super Diagnostic Test',
            inviterName: 'Diagnostic System',
        });

        console.log('[Super Diagnostic] Result:', JSON.stringify(result));

        return NextResponse.json({
            testType: 'super-diagnostic',
            emailServiceResult: result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Super Diagnostic] Exception:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
