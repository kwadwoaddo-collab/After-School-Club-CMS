import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { organisations, users, notifications, auditEvents } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { sendEmail } from '@/lib/services/email';
import {
    fetchDraftsToReview,
    fetchBillingSetupRequired,
    fetchPaymentsExpected,
    fetchOverdueInvoices,
} from '@/features/billing/queries';

/**
 * POST /api/cron/digest
 *
 * Daily operational finance digest cron job (§49, B17, Issue C).
 * Runs at 07:00 UTC daily (after the 06:00 UTC billing generation run).
 *
 * Recipient Resolution:
 *  - ORG_OWNER: Organisation-wide metrics
 *  - MANAGER: Centre-scoped metrics for their assigned centres
 *
 * Exception-Based Delivery:
 *  - If totalExceptions === 0, digest delivery is suppressed (no empty spam)
 *  - When exceptions exist: inserts in-app notification, sends email, and logs audit event.
 *
 * Secured by CRON_SECRET header (timing-safe via verifyCronAuthorization).
 */
export async function POST(request: NextRequest) {
    const authCheck = verifyCronAuthorization(request);
    if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status ?? 401 });
    }

    try {
        const activeOrgs = await db.query.organisations.findMany();

        let totalNotificationsSent = 0;
        let totalEmailsSent = 0;
        let totalSuppressed = 0;
        const orgSummaries = [];

        for (const org of activeOrgs) {
            // Find all potential recipients: ORG_OWNER and MANAGER users
            const recipients = await db.query.users.findMany({
                where: and(
                    eq(users.organisationId, org.id),
                    inArray(users.role, ['ORG_OWNER', 'MANAGER']),
                ),
            });

            let orgNotifications = 0;
            let orgEmails = 0;
            let orgSuppressed = 0;

            for (const user of recipients) {
                // Determine centre scope based on role
                let centreScope: string | string[] = 'all';
                let userCentres: string[] = [];

                if (user.role === 'MANAGER') {
                    userCentres = await getUserAccessibleCentreIds(user.id);
                    if (userCentres.length === 0) {
                        // Manager with no assigned centres gets no digest
                        continue;
                    }
                    centreScope = userCentres;
                }

                // Query metrics for this recipient's scope
                const drafts = await fetchDraftsToReview(org.id, centreScope);
                const setupRequired = await fetchBillingSetupRequired(org.id, centreScope);
                const paymentsExpected = await fetchPaymentsExpected(org.id, centreScope);
                const overdueInvoices = await fetchOverdueInvoices(org.id, centreScope);

                const draftsCount = drafts.length;
                const setupCount = setupRequired.length;
                const expectedCount = paymentsExpected.length;
                const overdueCount = overdueInvoices.length;

                const totalExceptions = draftsCount + setupCount + expectedCount + overdueCount;

                // Exception-based suppression: suppress if 0 exceptions
                if (totalExceptions === 0) {
                    orgSuppressed++;
                    totalSuppressed++;
                    continue;
                }

                const totalDraftValuePence = drafts.reduce(
                    (sum, d) => sum + Math.round(Number(d.amount) * 100),
                    0
                );
                const totalOverdueValuePence = overdueInvoices.reduce(
                    (sum, inv) => {
                        const totalPaid = (inv.payments ?? []).reduce(
                            (pSum, p) => p.status === 'verified' ? pSum + Math.round(Number(p.amount) * 100) : pSum,
                            0
                        );
                        const invPence = Math.round(Number(inv.amount) * 100);
                        return sum + Math.max(0, invPence - totalPaid);
                    },
                    0
                );

                const draftPounds = (totalDraftValuePence / 100).toFixed(2);
                const overduePounds = (totalOverdueValuePence / 100).toFixed(2);

                const digestTitle = `Daily Finance Digest — ${org.name}`;
                const digestMessage = `${draftsCount} draft(s) (£${draftPounds}) to review, ${setupCount} schedule setup required, ${overdueCount} overdue (£${overduePounds}), ${expectedCount} payment(s) expected.`;

                // 1. Deliver in-app notification
                try {
                    await db.insert(notifications).values({
                        organisationId: org.id,
                        userId: user.id,
                        type: 'system',
                        title: digestTitle,
                        message: digestMessage,
                        isRead: false,
                    });
                    orgNotifications++;
                    totalNotificationsSent++;
                } catch (notifErr) {
                    logger.error('[Cron Digest] Failed to insert notification for user', { userId: user.id, err: notifErr });
                }

                // 2. Dispatch email (fire & log, never fail the cron or alter billing state)
                if (user.email) {
                    try {
                        const scopeLabel = user.role === 'ORG_OWNER' ? 'Organisation-wide' : `Centres: ${userCentres.join(', ')}`;
                        const emailHtml = `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
                                <h2 style="color: #4338ca; margin-bottom: 8px;">${digestTitle}</h2>
                                <p style="color: #64748b; font-size: 14px; margin-top: 0;">Scope: ${scopeLabel}</p>
                                <p>Here is your operational finance summary for today:</p>
                                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                    <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                        <th style="padding: 10px; text-align: left;">Category</th>
                                        <th style="padding: 10px; text-align: right;">Count</th>
                                        <th style="padding: 10px; text-align: right;">Amount</th>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 10px;">Drafts Awaiting Review</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold;">${draftsCount}</td>
                                        <td style="padding: 10px; text-align: right;">£${draftPounds}</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 10px;">Billing Schedules Needing Setup</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold;">${setupCount}</td>
                                        <td style="padding: 10px; text-align: right;">—</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 10px;">Overdue Invoices</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold; color: #e11d48;">${overdueCount}</td>
                                        <td style="padding: 10px; text-align: right; color: #e11d48;">£${overduePounds}</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 10px;">Upcoming Payments Expected</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold;">${expectedCount}</td>
                                        <td style="padding: 10px; text-align: right;">—</td>
                                    </tr>
                                </table>
                                <p style="font-size: 13px; color: #64748b;">Log in to the dashboard to review and action these items.</p>
                            </div>
                        `;

                        await sendEmail({
                            to: user.email,
                            subject: digestTitle,
                            html: emailHtml,
                            organisationId: org.id,
                        });
                        orgEmails++;
                        totalEmailsSent++;
                    } catch (emailErr) {
                        logger.warn('[Cron Digest] Failed to send email digest to user', { email: user.email, err: emailErr });
                    }
                }

                // 3. Insert audit log
                try {
                    await db.insert(auditEvents).values({
                        organisationId: org.id,
                        userId: user.id,
                        eventType: 'daily_digest_dispatched',
                        eventData: JSON.stringify({
                            recipientId: user.id,
                            recipientEmail: user.email,
                            recipientRole: user.role,
                            centreScope: user.role === 'ORG_OWNER' ? 'all' : userCentres,
                            totalExceptions,
                            draftsCount,
                            setupCount,
                            overdueCount,
                            expectedCount,
                        }),
                    });
                } catch (auditErr) {
                    logger.warn('[Cron Digest] Failed to record audit event for digest', { err: auditErr });
                }
            }

            orgSummaries.push({
                organisationId: org.id,
                organisationName: org.name,
                recipientsChecked: recipients.length,
                notificationsSent: orgNotifications,
                emailsSent: orgEmails,
                suppressedEmpty: orgSuppressed,
            });
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            organisationsCount: activeOrgs.length,
            totalNotificationsSent,
            totalEmailsSent,
            totalSuppressed,
            summaries: orgSummaries,
        });
    } catch (error) {
        logger.error('[Cron Digest] Failed to generate daily finance digest', { error });
        return NextResponse.json(
            { error: 'Internal server error while executing daily finance digest' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return POST(request);
}
