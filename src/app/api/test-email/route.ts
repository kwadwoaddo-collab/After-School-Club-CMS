import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email';

/**
 * Diagnostic endpoint to test email functionality
 * DELETE THIS FILE after testing!
 */
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
        // Test email sending
        const result = await emailService.sendStaffInvitation({
            email: 'brakatuaddo@gmail.com', // Your Gmail
            role: 'MANAGER',
            inviteLink: 'https://after-school-club-cms.vercel.app/accept-invite?token=test123',
            organisationName: 'Test Organization',
            inviterName: 'System Test',
        });

        return NextResponse.json({
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            env: {
                hasResendKey: !!process.env.RESEND_API_KEY,
                resendKeyStart: process.env.RESEND_API_KEY?.substring(0, 5),
                fromEmail: process.env.FROM_EMAIL,
            }
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
