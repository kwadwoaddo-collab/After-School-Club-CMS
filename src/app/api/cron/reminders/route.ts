import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bookings, invoices, payments } from '@/db/schema';
import { and, gte, lte, inArray } from 'drizzle-orm';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { emailService } from '@/lib/services/email';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_xxx')
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@sprintscaleit.co.uk';


/**
 * POST /api/cron/reminders
 *
 * 1. Sends "Session Tomorrow" reminder emails to parents with confirmed bookings tomorrow.
 * 2. Sends invoice due / overdue reminders for invoices due within 7 days.
 *
 * Secured by a CRON_SECRET header. Configure your cron provider (e.g. Vercel Cron, GitHub Actions)
 * to call this at 5pm daily.
 *
 * Environment variable required: CRON_SECRET=<random-secret>
 */
export async function POST(req: NextRequest) {
    // ── 1. Authenticate cron caller ─────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        logger.error('[Reminder] CRON_SECRET is not set — endpoint locked.');
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const tomorrow = addDays(new Date(), 1);
    const tomorrowStart = startOfDay(tomorrow);
    const tomorrowEnd = endOfDay(tomorrow);

    // ── 2. Fetch tomorrow's confirmed bookings ───────────────────────────────
    let upcomingBookings: unknown[];
    try {
        upcomingBookings = await db.query.bookings.findMany({
            where: and(
                gte(bookings.startAt, tomorrowStart),
                lte(bookings.startAt, tomorrowEnd)
            ),
            with: {
                parent: true,
                centre: {
                    with: { organisation: true },
                },
                attendees: {
                    with: { child: true },
                },
            },
        });
    } catch (dbError) {
        logger.error('[Reminder] Failed to query bookings:', dbError);
        return NextResponse.json({ error: 'Failed to query bookings' }, { status: 500 });
    }

    let sent = 0;
    let errors = 0;

    for (const booking of upcomingBookings) {
        if (!booking.parent?.email) continue;
        if (booking.status === 'cancelled') continue;

        const orgName = booking.centre?.organisation?.name || 'After School Club';
        const centreName = booking.centre?.name || '';
        const parentName = booking.parent.firstName;
        const sessionTime = booking.startAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
        });
        const sessionDate = booking.startAt.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London'
        });
        const childNames = (booking.attendees ?? []).map((a: any) => a.child?.firstName).filter(Boolean).join(', ');

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Session Reminder — ${orgName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:36px 32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:10px;">⏰</div>
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">Session Reminder</h1>
      <p style="color:rgba(255,255,255,0.65);font-size:14px;margin:6px 0 0;">${orgName}</p>
    </div>
    <div style="padding:36px 32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 6px;">Hi ${parentName},</p>
      <p style="color:#6b7280;font-size:15px;margin:0 0 28px;">
        Just a reminder that ${childNames ? `<strong>${childNames}</strong> has` : 'you have'} a session tomorrow.
      </p>
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:6px;width:40%;">Date</td>
            <td style="font-size:14px;color:#1e293b;font-weight:600;padding-bottom:6px;">${sessionDate}</td>
          </tr>
          <tr>
            <td style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:6px;">Time</td>
            <td style="font-size:14px;color:#1e293b;font-weight:600;padding-bottom:6px;">${sessionTime}</td>
          </tr>
          ${centreName ? `<tr><td style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Location</td><td style="font-size:14px;color:#1e293b;font-weight:600;">${centreName}</td></tr>` : ''}
        </table>
      </div>
      <p style="color:#9ca3af;font-size:13px;">
        If you need to cancel or reschedule, please contact us as soon as possible.
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by SprintScale · support@sprintscaleit.co.uk</p>
    </div>
  </div>
</body>
</html>`;

        try {
            if (!resend) { errors++; continue; }
            await resend.emails.send({
                from: `${orgName} via SprintScale <${FROM_EMAIL}>`,
                to: booking.parent.email,
                subject: `Reminder: ${childNames ? `${childNames}'s` : 'Your'} session is tomorrow — ${orgName}`,
                html,
            });
            sent++;
        } catch (err) {
            logger.error('[Reminder] Failed to send for booking', booking.id, err);
            errors++;
        }
    }

    // ── 3. Invoice due reminders ─────────────────────────────────────────────
    // Send reminders for invoices due within 7 days or already overdue
    let invoiceSent = 0;
    try {
        const sevenDaysFromNow = addDays(new Date(), 7);
        const dueInvoices = await db.query.invoices.findMany({
            where: and(
                lte(invoices.dueDate, sevenDaysFromNow),
                inArray(invoices.status, ['sent', 'partially_paid', 'draft'])
            ),
            with: {
                parent: { columns: { firstName: true, email: true } },
                payments: true,
            }
        });

        for (const invoice of dueInvoices) {
            if (!invoice.parent?.email) continue;

            // Only count verified payments against the balance
            const verifiedTotal = (invoice.payments || []).reduce((sum: number, p: any) =>
                p.status === 'verified' ? sum + Number(p.amount) : sum, 0);
            const amountDue = Number(invoice.amount) - verifiedTotal;
            if (amountDue <= 0) continue; // Already paid, skip

            await emailService.sendInvoiceDue({
                parentFirstName: invoice.parent.firstName,
                parentEmail: invoice.parent.email,
                invoiceNumber: invoice.invoiceNumber,
                amountDue,
                dueDate: invoice.dueDate,
                portalUrl: `${process.env.NEXTAUTH_URL || ''}/portal/billing`,
            });
            invoiceSent++;
        }
    } catch (err) {
        logger.error('[Reminder] Failed to process invoice reminders:', err);
    }

    return NextResponse.json({
        sent,
        errors,
        total: upcomingBookings.length,
        invoiceRemindersSent: invoiceSent,
        message: `Sent ${sent} session reminder${sent !== 1 ? 's' : ''} and ${invoiceSent} invoice reminder${invoiceSent !== 1 ? 's' : ''}`,
    });
}
