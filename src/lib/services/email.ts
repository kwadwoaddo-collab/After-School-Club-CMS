/**
 * Email Service using Resend
 * 
 * Handles booking confirmation emails and other transactional notifications.
 */

import { Resend } from 'resend';

// Initialize Resend client only if API key is allowed
const resendApiKey = process.env.RESEND_API_KEY;
const isResendConfigured = resendApiKey && !resendApiKey.startsWith('re_xxx');
const resend = isResendConfigured ? new Resend(resendApiKey) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@sprintscaleit.co.uk';
const FROM_NAME = process.env.FROM_NAME || 'SprintScale';

interface BookingEmailData {
  parentFirstName: string;
  parentEmail: string;
  children: { firstName: string; lastName: string; subjects: string[] }[];
  centreName?: string;
  centreAddress?: string;
  modality: 'in_person' | 'online';
  startAt: Date;
  duration: number;
  confirmationCode: string;
  magicLink: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service class for sending transactional emails
 */
export class EmailService {
  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: BookingEmailData): Promise<EmailResult> {
    // Check if API key is configured
    if (!resend) {
      console.warn('[EmailService] Resend client not initialized. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const formattedDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(data.startAt);

      const formattedTime = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(data.startAt);

      const childrenNames = data.children.map(c => `${c.firstName} ${c.lastName}`).join(', ');

      const childrenDetailsHtml = data.children.map(child => `
        <div class="details-row" style="background-color: #f9f9f9; border-left: 3px solid #4F46E5; margin-bottom: 8px;">
          <div style="padding: 10px;">
            <strong>${child.firstName} ${child.lastName}</strong><br/>
            <span style="color: #6b7280; font-size: 0.9em;">Subjects: ${child.subjects.join(', ')}</span>
          </div>
        </div>
      `).join('');

      const location = data.modality === 'in_person'
        ? `${data.centreName}<br/>${data.centreAddress}`
        : 'Online (link will be sent closer to the appointment)';

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed</title>
  <style>
    body { 
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      line-height: 1.6; 
      color: #1a1a1a; 
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header { 
      background: #4F46E5; 
      color: #ffffff; 
      padding: 40px 20px; 
      text-align: center; 
    }
    .header h1 { 
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .content { 
      padding: 40px; 
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .intro {
      color: #4b5563;
      margin-bottom: 32px;
    }
    .details-card { 
      background: #f1f5f9; 
      padding: 24px; 
      border-radius: 12px; 
      margin-bottom: 32px;
    }
    .details-row { 
      display: flex; 
      margin-bottom: 12px;
    }
    .details-row:last-child { margin-bottom: 0; }
    .details-label { 
      font-weight: 600; 
      width: 100px; 
      color: #64748b;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .details-value {
      color: #1e293b;
      font-weight: 500;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    .child-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #4F46E5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .child-name {
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .child-subjects {
      font-size: 14px;
      color: #64748b;
    }
    .code-box { 
      margin: 40px 0;
      text-align: center;
      padding: 24px;
      background: #eef2ff;
      border: 2px dashed #4F46E5;
      border-radius: 12px;
    }
    .code-label {
      font-size: 14px;
      color: #4F46E5;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .code-value {
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      color: #4F46E5;
      letter-spacing: 2px;
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .button { 
      display: inline-block; 
      background-color: #4F46E5; 
      color: #ffffff !important; 
      padding: 16px 32px; 
      text-decoration: none; 
      border-radius: 12px; 
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4);
    }
    .footer { 
      text-align: center; 
      padding: 40px 20px; 
      color: #94a3b8; 
      font-size: 14px; 
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Booking Confirmed!</h1>
      </div>
      <div class="content">
        <div class="greeting">Hi ${data.parentFirstName},</div>
        <p class="intro">Great news! Your assessment booking has been confirmed. We look forward to seeing you.</p>
        
        <div class="details-card">
          <div class="details-row">
            <span class="details-label">Date</span>
            <span class="details-value">${formattedDate}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Time</span>
            <span class="details-value">${formattedTime}</span>
          </div>
          <div class="details-row">
            <span class="details-label">Duration</span>
            <span class="details-value">${data.duration} minutes</span>
          </div>
          <div class="details-row">
            <span class="details-label">Location</span>
            <span class="details-value">${location}</span>
          </div>
        </div>

        <div class="section-title">Children for Assessment</div>
        ${data.children.map(child => `
          <div class="child-card">
            <div class="child-name">${child.firstName} ${child.lastName}</div>
            <div class="child-subjects">Subjects: ${child.subjects.join(', ')}</div>
          </div>
        `).join('')}

        <div class="code-box">
          <div class="code-label">Your Confirmation Code</div>
          <div class="code-value">${data.confirmationCode}</div>
        </div>

        <div class="button-container">
          <a href="${data.magicLink}" class="button" style="color: #ffffff;">View or Manage Booking</a>
        </div>

        <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 40px;">
          If you need to reschedule or cancel, please use the button above or reply to this email.
        </p>
      </div>
      <div class="footer">
        <p>Sent with ❤️ by ${data.centreName || 'our service'}</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      const { data: result, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: data.parentEmail,
        subject: `Booking Confirmed: Assessment for ${childrenNames} on ${formattedDate}`,
        html: htmlContent,
      });

      if (error) {
        console.error('[EmailService] Failed to send confirmation:', error);
        return { success: false, error: error.message };
      }

      console.log(`[EmailService] Confirmation email sent: ${result?.id}`);
      return { success: true, messageId: result?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Error sending email:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send staff invitation email
   */
  async sendStaffInvitation(data: {
    email: string;
    role: string;
    inviteLink: string;
    organisationName: string;
    inviterName: string;
  }): Promise<EmailResult> {
    if (!resend) {
      console.warn('[EmailService] Resend client not initialized. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const roleDisplay = data.role.replace('_', ' ').toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f9fafb;
      padding: 50px 20px;
    }
    .container { 
      max-width: 580px; 
      margin: 0 auto; 
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      border: 1px solid #e5e7eb;
    }
    .header { 
      background: linear-gradient(135deg, #10B981 0%, #059669 100%); 
      color: #ffffff; 
      padding: 48px 32px; 
      text-align: center; 
    }
    .header h1 { 
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content { 
      padding: 48px 40px; 
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }
    .intro {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.7;
      margin: 0 0 32px 0;
    }
    .org-name {
      color: #10B981;
      font-weight: 600;
    }
    .info-box {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      padding: 24px;
      margin: 32px 0;
    }
    .info-label {
      color: #6b7280;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .role-badge {
      display: inline-block;
      background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%);
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      letter-spacing: 0.3px;
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      color: #ffffff !important; 
      padding: 18px 48px; 
      text-decoration: none; 
      border-radius: 10px; 
      font-weight: 600;
      font-size: 17px;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3), 0 2px 4px -1px rgba(16, 185, 129, 0.2);
      transition: all 0.2s;
    }
    .button:hover {
      box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4), 0 4px 6px -2px rgba(16, 185, 129, 0.3);
    }
    .note-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px 20px;
      margin: 32px 0;
      border-radius: 6px;
    }
    .note-box p {
      margin: 0;
      color: #92400e;
      font-size: 14px;
      line-height: 1.6;
    }
    .expiry-note {
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
      margin-top: 32px;
      line-height: 1.5;
    }
    .footer { 
      background: #f9fafb;
      text-align: center; 
      padding: 32px 20px; 
      color: #9ca3af; 
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 4px 0;
    }
    .security-note {
      color: #6b7280;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Welcome to the Team!</h1>
      </div>
      <div class="content">
        <div class="greeting">Hello,</div>
        <p class="intro">
          <strong>${data.inviterName}</strong> has invited you to join <span class="org-name">${data.organisationName}</span> as a team member. We're excited to have you on board!
        </p>
        
        <div class="info-box">
          <div class="info-label">Your Role</div>
          <div><span class="role-badge">${roleDisplay}</span></div>
        </div>

        <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 28px 0;">
          To get started, click the button below to accept your invitation and create your account. You'll be able to access the platform and start collaborating with your team right away.
        </p>

        <div class="button-container">
          <a href="${data.inviteLink}" class="button" style="color: #ffffff;">Accept Invitation &rarr;</a>
        </div>

        <div class="note-box">
          <p><strong>Important:</strong> This invitation link will expire in 7 days. Please accept it soon to ensure you don't lose access.</p>
        </div>

        <p class="expiry-note">
          If you didn't expect this invitation or received it by mistake, you can safely ignore this email.
        </p>
        
        <p class="security-note" style="text-align: center; margin-top: 24px;">
          This is an automated email. Please do not reply to this message.
        </p>
      </div>
      <div class="footer">
        <p><strong>${data.organisationName}</strong></p>
        <p style="margin-top: 8px;">Powered by SprintScale</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      const senderName = `${data.organisationName} via SprintScale`;
      const { data: result, error } = await resend.emails.send({
        from: `${senderName} <${FROM_EMAIL}>`,
        to: data.email,
        subject: `Invitation to join ${data.organisationName}`,
        html: htmlContent,
      });

      if (error) {
        console.error('[EmailService] Failed to send staff invitation:', error);
        return { success: false, error: error.message };
      }

      console.log(`[EmailService] Staff invitation email sent: ${result?.id}`);
      return { success: true, messageId: result?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Error sending staff invitation email:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellation(data: {
    parentFirstName: string;
    parentEmail: string;
    childrenNames: string; // Pre-formatted string usually
    startAt: Date;
    confirmationCode: string;
  }): Promise<EmailResult> {
    if (!resend) {
      console.warn('[EmailService] Resend client not initialized. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const formattedDate = new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(data.startAt);

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi ${data.parentFirstName},</p>
      <p>Your assessment booking for <strong>${data.childrenNames}</strong> on ${formattedDate} has been cancelled.</p>
      <p>Confirmation Code: <strong>${data.confirmationCode}</strong></p>
      <p>If you'd like to book a new assessment, please visit our website.</p>
    </div>
  </div>
</body>
</html>
      `;

      const { data: result, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: data.parentEmail,
        subject: `Booking Cancelled: ${data.confirmationCode}`,
        html: htmlContent,
      });

      if (error) {
        console.error('[EmailService] Failed to send cancellation:', error);
        return { success: false, error: error.message };
      }

      console.log(`[EmailService] Cancellation email sent: ${result?.id}`);
      return { success: true, messageId: result?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Error sending email:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send magic login link to returning staff
   */
  async sendMagicLink(data: {
    email: string;
    name: string;
    magicLink: string;
    orgName?: string;
  }): Promise<EmailResult> {
    if (!resend) {
      return { success: false, error: 'Email service not configured' };
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Login Link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #3b82f6, #7c3aed); padding: 40px 32px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Your Login Link</h1>
    </div>
    <div style="padding: 40px 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi ${data.name},</p>
      <p style="color: #6b7280; font-size: 15px; margin: 0 0 32px;">
        Click the button below to sign in to your dashboard. This link expires in <strong>15 minutes</strong>.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${data.magicLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #7c3aed); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 40px; border-radius: 12px;">
          Sign In →
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">SprintScale · support@sprintscaleit.co.uk</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const magicLinkSender = data.orgName ? `${data.orgName} via SprintScale` : FROM_NAME;
      const { data: result, error } = await resend.emails.send({
        from: `${magicLinkSender} <${FROM_EMAIL}>`,
        to: data.email,
        subject: 'Your login link',
        html,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send password reset email to org admins/owners
   */
  async sendPasswordReset(data: {
    email: string;
    name: string;
    resetUrl: string;
  }): Promise<EmailResult> {
    if (!resend) {
      return { success: false, error: 'Email service not configured' };
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #3b82f6, #7c3aed); padding: 40px 32px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Reset Your Password</h1>
    </div>
    <div style="padding: 40px 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi ${data.name},</p>
      <p style="color: #6b7280; font-size: 15px; margin: 0 0 32px;">
        We received a request to reset your password. Click the button below to set a new password.
        This link expires in <strong>1 hour</strong>.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #7c3aed); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 40px; border-radius: 12px;">
          Reset Password &rarr;
        </a>
      </div>
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 14px; margin: 0;">
          <strong>Didn't request this?</strong> You can safely ignore this email. Your password won't change.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0;">
        If the button doesn't work, copy and paste this link into your browser.
      </p>
    </div>
    <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">SprintScale &middot; support@sprintscaleit.co.uk</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const { data: result, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: data.email,
        subject: 'Reset your SprintScale password',
        html,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send registration confirmation copy to parent
   */
  async sendRegistrationConfirmation(data: {
    parentName: string;
    parentEmail: string;
    orgName: string;
    children: { firstName: string; lastName: string; schoolYear: string }[];
    startDate: Date | null;
    fundingTypes: string[];
  }): Promise<EmailResult> {
    if (!resend) {
      return { success: false, error: 'Email service not configured' };
    }

    const formattedDate = data.startDate
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(data.startDate)
      : 'To be confirmed';

    const fundingLabel = (t: string) => ({
      tax_free_childcare: 'Tax-Free Childcare',
      childcare_vouchers: 'Childcare Vouchers',
      student_finance: 'Student Finance (CCG)',
      self_funded: 'Self-Funded',
      other: 'Other',
    }[t] ?? t);

    const childrenRows = data.children.map(c =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.firstName} ${c.lastName}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${c.schoolYear}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Registration Received</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#3b82f6,#7c3aed);padding:40px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0;">Registration Received</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:15px;">${data.orgName}</p>
    </div>
    <div style="padding:40px 32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 8px;">Hi ${data.parentName},</p>
      <p style="color:#6b7280;font-size:15px;margin:0 0 28px;">Thank you for submitting your registration. Here's a copy of what we received:</p>

      <div style="margin-bottom:24px;">
        <p style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Requested Start Date</p>
        <p style="font-size:15px;color:#111827;margin:0;">${formattedDate}</p>
      </div>

      <div style="margin-bottom:24px;">
        <p style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Children Registered</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280;">Name</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280;">Year Group</th>
          </tr></thead>
          <tbody>${childrenRows}</tbody>
        </table>
      </div>

      <div style="margin-bottom:28px;">
        <p style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Funding Method</p>
        <p style="font-size:15px;color:#111827;margin:0;">${data.fundingTypes.map(fundingLabel).join(', ') || 'Not specified'}</p>
      </div>

      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:6px;">
        <p style="color:#92400e;font-size:14px;margin:0;">The team at ${data.orgName} will be in touch to confirm your place and provide next steps.</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by SprintScale &middot; support@sprintscaleit.co.uk</p>
    </div>
  </div>
</body>
</html>`;

    try {
      const { data: result, error } = await resend.emails.send({
        from: `${data.orgName} via SprintScale <${FROM_EMAIL}>`,
        to: data.parentEmail,
        subject: `Registration received — ${data.orgName}`,
        html,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, messageId: result?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
