import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { users, notifications, auditEvents } from '@/db/schema';
import { eq, and, inArray, gte, lt } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { sendEmail } from '@/lib/services/email';
import {
    fetchDraftsToReview,
    fetchBillingSetupRequired,
    fetchPaymentsExpected,
    fetchOverdueInvoices,
} from '@/features/billing/queries';

export const maxDuration = 60;

const CRON_BUDGET_MS = 50_000;
const DIGEST_AUDIT_EVENT_TYPES = ['daily_digest_sent', 'daily_digest_dispatched'] as const;

/**
 * POST /api/cron/digest
 *
 * Daily operational finance digest cron job (§49, B17, Issue C).
 * Runs at 07:00 UTC daily (`0 7 * * *` in `vercel.json`, after the 06:00 UTC billing generation run).
 *
 * Recipient Resolution:
 *  - ORG_OWNER: Organisation-wide metrics
 *  - MANAGER: Centre-scoped metrics for their assigned centres
 *
 * Exception-Based & Idempotent Delivery:
 *  - Per-recipient daily idempotency (`(organisationId, userId, todayUtc)`) prevents duplicate
 *    emails/notifications when a partial run is retried on the same UTC date.
 *  - If totalExceptions === 0, digest delivery is suppressed (no empty spam).
 *  - When exceptions exist: inserts in-app notification, sends email, and logs `daily_digest_sent` audit event.
 *
 * Secured by CRON_SECRET header (timing-safe via verifyCronAuthorization).
 */
export async function POST(request: NextRequest) {
    const authCheck = verifyCronAuthorization(request);
    if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status ?? 401 });
    }

    const startedAt = Date.now();
    const runDate = new Date(startedAt);
    const todayUtc = runDate.toISOString().slice(0, 10);
    const todayUtcStart = new Date(Date.UTC(
        runDate.getUTCFullYear(),
        runDate.getUTCMonth(),
        runDate.getUTCDate(),
        0, 0, 0, 0,
    ));
    const tomorrowUtcStart = new Date(todayUtcStart.getTime() + 86_400_000);

    try {
        const activeOrgs = await db.query.organisations.findMany();

        let totalNotificationsSent = 0;
        let totalEmailsSent = 0;
        let totalSuppressed = 0;
        let totalSkippedAlreadySent = 0;
        let partial = false;
        const orgSummaries = [];

        for (const org of activeOrgs) {
            if (Date.now() - startedAt >= CRON_BUDGET_MS) {
                partial = true;
                break;
            }

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
            let orgSkippedAlreadySent = 0;
            let recipientsChecked = 0;

            for (const user of recipients) {
                if (Date.now() - startedAt >= CRON_BUDGET_MS) {
                    partial = true;
                    break;
                }
                recipientsChecked++;

                // Per-recipient daily UTC idempotency check via auditEvents
                const existingDigest = await db.query.auditEvents?.findFirst({
                    where: and(
                        eq(auditEvents.organisationId, org.id),
                        eq(auditEvents.userId, user.id),
                        inArray(auditEvents.eventType, [...DIGEST_AUDIT_EVENT_TYPES]),
                        gte(auditEvents.createdAt, todayUtcStart),
                        lt(auditEvents.createdAt, tomorrowUtcStart),
                    ),
                });

                if (existingDigest) {
                    orgSkippedAlreadySent++;
                    totalSkippedAlreadySent++;
                    continue;
                }

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
                            (pSum, p) => (p.status === 'verified' && !p.reversedAt) ? pSum + Math.round(Number(p.amount) * 100) : pSum,
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
                const digestMessage = `${draftsCount} draft(s) (£${draftPounds}) to review, ${setupCount} schedule setup required, ${overdueCount} overdue past assessment period (£${overduePounds}), ${expectedCount} payment(s) expected (in period / upcoming).`;

                // 1. Deliver in-app notification (guarded against duplicate same-day notification on email retry)
                let notificationDelivered = false;
                try {
                    const existingNotif = await db.query.notifications?.findFirst({
                        where: and(
                            eq(notifications.organisationId, org.id),
                            eq(notifications.userId, user.id),
                            eq(notifications.title, digestTitle),
                            gte(notifications.createdAt, todayUtcStart),
                            lt(notifications.createdAt, tomorrowUtcStart),
                        ),
                    });

                    if (!existingNotif) {
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
                    }
                    notificationDelivered = true;
                } catch (notifErr) {
                    logger.error('[Cron Digest] Failed to insert notification for user', { userId: user.id, err: notifErr });
                }

                // 2. Dispatch email (fire & log, never fail the cron or alter billing state)
                let emailDelivered = !user.email;
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
                                        <td style="padding: 10px;">Overdue Invoices (Past Assessment Period)</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold; color: #e11d48;">${overdueCount}</td>
                                        <td style="padding: 10px; text-align: right; color: #e11d48;">£${overduePounds}</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 10px;">Payments Expected (In Period &amp; Upcoming)</td>
                                        <td style="padding: 10px; text-align: right; font-weight: bold;">${expectedCount}</td>
                                        <td style="padding: 10px; text-align: right;">—</td>
                                    </tr>
                                </table>
                                <p style="font-size: 13px; color: #64748b;">Log in to the dashboard to review and action these items.</p>
                            </div>
                        `;

                        const emailRes = await sendEmail({
                            to: user.email,
                            subject: digestTitle,
                            html: emailHtml,
                            organisationId: org.id,
                            idempotencyKey: `daily-digest:${org.id}:${user.id}:${todayUtc}`,
                        });
                        if (emailRes?.success !== false) {
                            orgEmails++;
                            totalEmailsSent++;
                            emailDelivered = true;
                        } else {
                            logger.warn('[Cron Digest] Provider declined digest email for user', {
                                userId: user.id,
                                error: emailRes.error,
                            });
                        }
                    } catch (emailErr) {
                        logger.warn('[Cron Digest] Failed to send email digest to user', { userId: user.id, err: emailErr });
                    }
                }

                // 3. Insert per-recipient daily idempotency & audit log once dispatched
                if (emailDelivered && (notificationDelivered || Boolean(user.email))) {
                    try {
                        await db.insert(auditEvents).values({
                            organisationId: org.id,
                            userId: user.id,
                            eventType: 'daily_digest_sent',
                            eventData: JSON.stringify({
                                digestDate: todayUtc,
                                recipientId: user.id,
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
            }

            orgSummaries.push({
                organisationId: org.id,
                organisationName: org.name,
                recipientsChecked,
                notificationsSent: orgNotifications,
                emailsSent: orgEmails,
                suppressedEmpty: orgSuppressed,
                skippedAlreadySent: orgSkippedAlreadySent,
            });

            if (partial) {
                break;
            }
        }

        if (partial) {
            logger.warn('[Cron Digest] Cooperative time budget reached; exiting cleanly with partial progress', {
                organisationsProcessed: orgSummaries.length,
                organisationsCount: activeOrgs.length,
            });
        }

        return NextResponse.json({
            success: true,
            partial,
            timestamp: new Date().toISOString(),
            organisationsCount: activeOrgs.length,
            totalNotificationsSent,
            totalEmailsSent,
            totalSuppressed,
            totalSkippedAlreadySent,
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
