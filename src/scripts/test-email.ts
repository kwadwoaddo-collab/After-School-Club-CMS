
import dotenv from 'dotenv';
// import { emailService } from '@/lib/services/email';

dotenv.config({ path: '.env.local' });

async function testEmail() {
    console.log('--- Testing Email Configuration ---');

    if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY is missing from .env.local');
        process.exit(1);
    }

    if (process.env.RESEND_API_KEY.startsWith('re_xxx')) {
        console.warn('⚠️ RESEND_API_KEY appears to be a placeholder (starts with "re_xxx").');
    } else {
        console.log('✅ RESEND_API_KEY is present.');
    }

    console.log(`Sending from: ${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`);

    // Use a hardcoded test email or one from environment to avoid sending to real users accidentally in production, 
    // but for this dev test we'll use a dummy one. Ideally user provides one.
    // Use CLI argument if provided, otherwise default to Resend's test address (which won't reach your inbox unless you verified the domain)
    const testEmail = process.argv[2] || 'delivered@resend.dev';


    console.log(`Attempting to send test email to ${testEmail}...`);

    // Import service after dotenv config
    const { emailService } = await import('@/lib/services/email');
    const result = await emailService.sendBookingConfirmation({
        parentFirstName: 'Test Parent',
        parentEmail: testEmail,
        children: [{ firstName: 'Test Child', lastName: 'One', subjects: ['Maths'] }],
        centreName: 'Test Centre',
        centreAddress: '123 Test St',
        modality: 'in_person',
        startAt: new Date(),
        duration: 30,
        confirmationCode: 'TEST-CODE-123',
        magicLink: 'http://localhost:3000/booking/test',
    });

    if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', result.messageId);
    } else {
        console.error('❌ Failed to send email.');
        console.error('Error:', result.error);
    }
}

testEmail();
