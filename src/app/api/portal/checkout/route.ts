import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { stripeService } from '@/lib/services/stripe';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import { isValidUuid } from '@/lib/uuid';
import { parseStoredDecimalToPence } from '@/features/finance/domain/payment-eligibility';
import { assertOrgActive, OrgNotActiveError } from '@/lib/org-approval-guard';

const NO_STORE_HEADERS: Record<string, string> = {
    'Cache-Control': 'private, no-store',
};

function jsonNoStore(payload: Record<string, unknown>, status: number = 200) {
    return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

/**
 * POST /api/portal/checkout
 *
 * Creates a Stripe Hosted Checkout session for a specific invoice.
 * Parent must be authenticated via portal JWT and belong to an ACTIVE organisation.
 * Only works for outstanding (non-paid, non-void, non-draft) invoices owned by the authenticated parent.
 *
 * Body: { invoiceId: string }
 * Returns: { sessionUrl: string }
 */
export async function POST(req: NextRequest) {
    try {
        const parent = await getCurrentParent();
        if (!parent) {
            return jsonNoStore({ error: 'Unauthorised' }, 401);
        }

        if (!stripeService.isConfigured()) {
            return jsonNoStore({ error: 'Online payments not configured' }, 503);
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return jsonNoStore({ error: 'Invalid request body' }, 400);
        }

        const { invoiceId } = body as { invoiceId?: unknown };
        if (!invoiceId || typeof invoiceId !== 'string') {
            return jsonNoStore({ error: 'invoiceId is required' }, 400);
        }
        if (!isValidUuid(invoiceId)) {
            return jsonNoStore({ error: 'Invalid invoiceId' }, 400);
        }

        // Fetch the invoice — must belong to this parent and not be paid/void/draft
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.parentId, parent.id),
                ne(invoices.status, 'paid'),
                ne(invoices.status, 'void'),
                ne(invoices.status, 'draft')
            ),
            with: {
                centre: { columns: { name: true } },
                payments: { columns: { amount: true, status: true, reversedAt: true } },
            },
        });

        if (!invoice) {
            return jsonNoStore({ error: 'Invoice not found or not payable' }, 404);
        }

        // SEC-W4-04: Enforce ACTIVE organisation status before creating live Stripe Checkout sessions
        try {
            await assertOrgActive(invoice.organisationId);
        } catch (orgErr) {
            if (orgErr instanceof OrgNotActiveError || (orgErr instanceof Error && orgErr.name === 'OrgNotActiveError')) {
                return jsonNoStore({ error: 'Organisation is not active' }, 403);
            }
            throw orgErr;
        }

        // Calculate remaining balance in exact integer pence, excluding reversed payments
        const paidPence = (invoice.payments ?? []).reduce(
            (sum, p) => (p.status === 'verified' && !p.reversedAt ? sum + parseStoredDecimalToPence(p.amount) : sum),
            0
        );
        const remainingPence = parseStoredDecimalToPence(invoice.amount) - paidPence;

        if (remainingPence <= 0) {
            return jsonNoStore({ error: 'Invoice is already fully paid' }, 400);
        }

        const baseUrl = getTrustedApplicationUrl();
        const description = `Invoice #${invoice.invoiceNumber}${invoice.centre ? ` — ${invoice.centre.name}` : ''}`;

        const result = await stripeService.createInvoicePaymentSession({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amountPence: remainingPence,
            parentEmail: parent.email ?? '',
            description,
            successUrl: `${baseUrl}/portal/billing?payment=success&invoice=${invoice.invoiceNumber}`,
            cancelUrl: `${baseUrl}/portal/billing?payment=cancelled`,
        });

        if (!result.success || !result.sessionUrl) {
            logger.error('[portal/checkout] Stripe session creation failed:', result.error);
            return jsonNoStore({ error: 'Failed to create payment session' }, 500);
        }

        return jsonNoStore({ sessionUrl: result.sessionUrl }, 200);
    } catch (error) {
        logger.error('[portal/checkout] Unexpected error:', error);
        return jsonNoStore({ error: 'Failed to create payment session' }, 500);
    }
}
