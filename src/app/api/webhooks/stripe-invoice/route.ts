import { recalculateInvoiceStatus } from '@/lib/finance/recalculate-invoice-status';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/services/stripe';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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
 *   3. Revalidates affected Finance & Portal routes
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
            // Milestone 3G, L4: Stripe redelivers webhooks on retry (a normal
            // part of its delivery model, not a hypothetical), and this
            // handler previously had no guard against inserting the same
            // payment twice — unlike reconcilePayment's own transactionReference
            // uniqueness check. session.id is stable per checkout session, so
            // it doubles as the idempotency key here too.
            const existingPayment = await db.query.payments.findFirst({
                where: and(eq(payments.invoiceId, invoiceId), eq(payments.transactionReference, session.id)),
                columns: { id: true },
            });
            if (existingPayment) {
                logger.info(`[stripe-invoice webhook] Duplicate delivery for session ${session.id} on invoice ${invoiceId} — skipping.`);
                return NextResponse.json({ ok: true, duplicate: true });
            }

            // Verify invoice exists and satisfies Category A invariants
            const invoice = await db.query.invoices.findFirst({
                where: eq(invoices.id, invoiceId),
                columns: { id: true, status: true, parentId: true, centreId: true },
            });
            if (!invoice) {
                logger.error(`[stripe-invoice webhook] Invoice ${invoiceId} not found`);
                return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
            }
            if (invoice.status === 'draft') {
                logger.warn(`[stripe-invoice webhook] Cannot record payment against draft invoice ${invoiceId}`);
                return NextResponse.json({ ok: true, skipped: true, reason: 'draft_invoice' });
            }
            if (invoice.status === 'void') {
                logger.warn(`[stripe-invoice webhook] Cannot record payment against void invoice ${invoiceId}`);
                return NextResponse.json({ ok: true, skipped: true, reason: 'void_invoice' });
            }

            // 1. Record the payment atomically
            await db.transaction(async (tx) => {
                await tx.insert(payments).values({
                    invoiceId,
                    amount: String(amountPaid),
                    method: 'stripe',
                    status: 'verified',
                    transactionReference: session.id,
                });

                // 2. Recalculate invoice status
                await recalculateInvoiceStatus(tx, invoiceId);
            });

            logger.info(`[stripe-invoice webhook] Invoice ${invoiceNumber} (${invoiceId}) marked as paid. Amount: £${amountPaid}`);

            // 3. Post-commit revalidation (MAINT-REL-1 / CACHE-M1 pattern)
            try {
                revalidatePath('/dashboard/finance');
                revalidatePath('/dashboard/finance/invoices');
                revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
                revalidatePath('/portal/billing');
                if (invoice.parentId) {
                    revalidatePath(`/dashboard/parents/${invoice.parentId}`);
                }
                if (invoice.centreId) {
                    revalidatePath(`/dashboard/centres/${invoice.centreId}/billing`);
                }
            } catch (revalErr) {
                // Secondary revalidation failure must never rollback or fail an already-committed Stripe payment
                logger.warn('[stripe-invoice webhook] Post-commit revalidation warning:', revalErr);
            }
        } catch (err) {
            logger.error('[stripe-invoice webhook] DB error processing payment:', err);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
    }

    return NextResponse.json({ ok: true });
}
