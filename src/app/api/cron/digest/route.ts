import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verifyCronAuthorization } from '@/app/api/cron/broadcasts/route';
import { organisations } from '@/db/schema';
import {
    fetchDraftsToReview,
    fetchBillingSetupRequired,
    fetchPaymentsExpected,
    fetchOverdueInvoices,
} from '@/features/billing/queries';

/**
 * POST /api/cron/digest
 *
 * Daily operational finance digest cron job (§49, B17).
 * Runs at 07:00 UTC daily (after the 06:00 UTC billing generation run).
 * Compiles operational metrics per active organisation:
 *  - Draft invoices to review
 *  - Billing configs requiring setup
 *  - Payments expected
 *  - Overdue invoices
 *
 * Secured by CRON_SECRET header (timing-safe).
 */
export async function POST(request: NextRequest) {
    const authCheck = verifyCronAuthorization(request);
    if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status ?? 401 });
    }

    try {
        const activeOrgs = await db.query.organisations.findMany();

        const summaries = [];

        for (const org of activeOrgs) {
            const drafts = await fetchDraftsToReview(org.id, 'all');
            const setupRequired = await fetchBillingSetupRequired(org.id, 'all');
            const paymentsExpected = await fetchPaymentsExpected(org.id, 'all');
            const overdueInvoices = await fetchOverdueInvoices(org.id, 'all');

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

            const summary = {
                organisationId: org.id,
                organisationName: org.name,
                draftsToReviewCount: drafts.length,
                draftsToReviewValuePounds: (totalDraftValuePence / 100).toFixed(2),
                billingSetupRequiredCount: setupRequired.length,
                paymentsExpectedCount: paymentsExpected.length,
                overdueInvoicesCount: overdueInvoices.length,
                overdueInvoicesValuePounds: (totalOverdueValuePence / 100).toFixed(2),
            };

            logger.info(
                `[Cron Digest] Org: ${org.name} (${org.id}) | Drafts: ${drafts.length} (£${summary.draftsToReviewValuePounds}) | Setup Required: ${setupRequired.length} | Payments Expected: ${paymentsExpected.length} | Overdue: ${overdueInvoices.length} (£${summary.overdueInvoicesValuePounds})`
            );

            summaries.push(summary);
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            organisationsCount: activeOrgs.length,
            summaries,
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
