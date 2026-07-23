import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/services/stripe';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/webhooks/stripe-invoice
 *
 * Stripe webhook endpoint for parent invoice payments.
 * Handles 'checkout.session.completed' events where the session
 * has metadata.source = 'portal_invoice_payment'.
 *
 * On successful payment:
 *   1. Records a payment row linked to the invoice
 *   2. Updates invoice status to 'paid'
 *
 * Env vars required:
 *   STRIPE_INVOICE_WEBHOOK_SECRET (or falls back to STRIPE_WEBHOOK_SECRET)
 */
export async function POST(req: NextRequest) {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature') ?? '';

    const event = stripeService.constructInvoiceWebhookEvent(payload, signature);

    if (!event) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as {
            id: string;
            payment_status: string;
            amount_total: number | null;
            metadata: Record<string, string>;
            customer_email?: string | null;
        };

        // Only handle portal invoice payments
        if (session.metadata?.source !== 'portal_invoice_payment') {
            return NextResponse.json({ ok: true, skipped: true });
        }

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ ok: true, skipped: true });
        }

        const { invoiceId, invoiceNumber } = session.metadata;
        if (!invoiceId) {
            logger.error('[stripe-invoice webhook] Missing invoiceId in session metadata');
            return NextResponse.json({ error: 'Missing invoiceId in metadata' }, { status: 400 });
        }

        const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

        try {
            // 1. Record the payment
            await db.insert(payments).values({
                invoiceId,
                amount: String(amountPaid),
                method: 'stripe',
                status: 'verified',
                transactionReference: session.id,
            });

            // 2. Update invoice status to paid
            await db
                .update(invoices)
                .set({ status: 'paid', updatedAt: new Date() })
                .where(eq(invoices.id, invoiceId));

            logger.info(`[stripe-invoice webhook] Invoice ${invoiceNumber} (${invoiceId}) marked as paid. Amount: £${amountPaid}`);
        } catch (err) {
            logger.error('[stripe-invoice webhook] DB error processing payment:', err);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
    }

    return NextResponse.json({ ok: true });
}
