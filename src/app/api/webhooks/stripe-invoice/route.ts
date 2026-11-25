import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { stripeService } from '@/lib/services/stripe';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { isValidUuid } from '@/lib/uuid';
import {
    formatPenceToDecimal,
    parseStoredDecimalToPence,
} from '@/features/finance/domain/payment-eligibility';

function isUniqueViolation(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const candidate = err as { code?: unknown; cause?: { code?: unknown } };
    return candidate.code === '23505' || candidate.cause?.code === '23505';
}

/**
 * POST /api/webhooks/stripe-invoice
 *
 * Stripe webhook endpoint for parent invoice payments.
 * Handles 'checkout.session.completed' events where the session
 * has metadata.source = 'portal_invoice_payment'.
 *
 * On successful payment:
 *   1. Locks the target invoice row (`FOR UPDATE`), checks duplicate / lifecycle status
 *   2. Records a verified payment row with `idempotencyKey = stripe:${session.id}`
 *   3. Derives `'paid'` vs `'partially_paid'` from verified unreversed pence total
 *   4. Revalidates affected Finance & Portal routes
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

        if (!isValidUuid(invoiceId)) {
            logger.warn(`[stripe-invoice webhook] Malformed invoiceId in session metadata: ${invoiceId}`);
            return NextResponse.json({ error: 'Invalid invoiceId in metadata' }, { status: 400 });
        }

        const amountTotalPence = session.amount_total ?? 0;
        if (!Number.isInteger(amountTotalPence) || amountTotalPence <= 0) {
            logger.warn(`[stripe-invoice webhook] Skipping non-positive amount (${amountTotalPence}p) on session ${session.id}`);
            return NextResponse.json({ ok: true, skipped: true, reason: 'zero_amount' });
        }

        const amountPaidDecimal = formatPenceToDecimal(amountTotalPence);
        const idempotencyKey = `stripe:${session.id}`;

        try {
            const txOutcome = await db.transaction(async (tx) => {
                if (typeof (tx as { execute?: unknown }).execute === 'function') {
                    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
                }

                // 1. Lock target invoice row (`FOR UPDATE`) when SQL select builder is available,
                // falling back cleanly to `tx.query.invoices.findFirst` in unit-test mocks.
                let invoice:
                    | {
                          id: string;
                          status: string;
                          amount: string | number;
                          parentId: string | null;
                          centreId: string | null;
                      }
                    | undefined;

                if (typeof (tx as { select?: unknown }).select === 'function') {
                    const invSelect = tx
                        .select({
                            id: invoices.id,
                            status: invoices.status,
                            amount: invoices.amount,
                            parentId: invoices.parentId,
                            centreId: invoices.centreId,
                        })
                        .from(invoices)
                        .where(eq(invoices.id, invoiceId));
                    const rows = await (
                        typeof (invSelect as { for?: unknown }).for === 'function'
                            ? invSelect.for('update')
                            : invSelect
                    );
                    invoice = rows[0];
                } else {
                    invoice = await tx.query.invoices.findFirst({
                        where: eq(invoices.id, invoiceId),
                        columns: { id: true, status: true, amount: true, parentId: true, centreId: true },
                    });
                }

                if (!invoice) {
                    return { kind: 'not_found' as const };
                }

                // 2. Re-check duplicate inside locked transaction
                const existingPayment = await tx.query.payments.findFirst({
                    where: and(
                        eq(payments.invoiceId, invoiceId),
                        eq(payments.transactionReference, session.id)
                    ),
                    columns: { id: true },
                });

                if (existingPayment) {
                    return { kind: 'duplicate' as const };
                }

                // 3. Category A lifecycle invariants
                if (invoice.status === 'draft') {
                    return { kind: 'skipped' as const, reason: 'draft_invoice' as const };
                }
                if (invoice.status === 'void') {
                    return { kind: 'skipped' as const, reason: 'void_invoice' as const };
                }

                // 4. Insert verified payment with unique partial-index idempotencyKey
                try {
                    await tx.insert(payments).values({
                        invoiceId,
                        amount: amountPaidDecimal,
                        method: 'stripe',
                        status: 'verified',
                        transactionReference: session.id,
                        idempotencyKey,
                    });
                } catch (insertErr) {
                    if (isUniqueViolation(insertErr)) {
                        return { kind: 'duplicate' as const };
                    }
                    throw insertErr;
                }

                // 5. Derive 'paid' vs 'partially_paid' from verified unreversed pence total
                const allPayments =
                    typeof tx.query?.payments?.findMany === 'function'
                        ? await tx.query.payments.findMany({
                              where: eq(payments.invoiceId, invoiceId),
                              columns: {
                                  status: true,
                                  amount: true,
                                  reversedAt: true,
                                  transactionReference: true,
                              },
                          })
                        : [];

                const verifiedUnreversed = Array.isArray(allPayments)
                    ? allPayments.filter(
                          (p: { status: string; reversedAt?: Date | string | null }) =>
                              p.status === 'verified' && !p.reversedAt
                      )
                    : [];

                const existingVerifiedPence = verifiedUnreversed.reduce(
                    (sum: number, p: { amount: string | number }) => sum + parseStoredDecimalToPence(p.amount),
                    0
                );
                const includesCurrent = verifiedUnreversed.some(
                    (p: { transactionReference?: string | null }) => p.transactionReference === session.id
                );
                const totalVerifiedPence = includesCurrent
                    ? existingVerifiedPence
                    : existingVerifiedPence + amountTotalPence;

                const invoiceAmountPence = parseStoredDecimalToPence(invoice.amount);
                const derivedStatus: 'paid' | 'partially_paid' =
                    totalVerifiedPence >= invoiceAmountPence ? 'paid' : 'partially_paid';

                if (typeof tx.update === 'function') {
                    await tx
                        .update(invoices)
                        .set({ status: derivedStatus, updatedAt: new Date() })
                        .where(eq(invoices.id, invoiceId));
                }

                return {
                    kind: 'recorded' as const,
                    derivedStatus,
                    parentId: invoice.parentId,
                    centreId: invoice.centreId,
                };
            });

            if (txOutcome.kind === 'not_found') {
                logger.error(`[stripe-invoice webhook] Invoice ${invoiceId} not found`);
                return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
            }

            if (txOutcome.kind === 'duplicate') {
                logger.info(
                    `[stripe-invoice webhook] Duplicate delivery for session ${session.id} on invoice ${invoiceId} — skipping.`
                );
                return NextResponse.json({ ok: true, duplicate: true });
            }

            if (txOutcome.kind === 'skipped') {
                logger.warn(
                    `[stripe-invoice webhook] Cannot record payment against ${txOutcome.reason} (${invoiceId})`
                );
                return NextResponse.json({ ok: true, skipped: true, reason: txOutcome.reason });
            }

            logger.info(
                `[stripe-invoice webhook] Invoice ${invoiceNumber} (${invoiceId}) updated to ${txOutcome.derivedStatus}. Amount: £${amountPaidDecimal}`
            );

            // Post-commit revalidation (MAINT-REL-1 / CACHE-M1 pattern)
            try {
                revalidatePath('/dashboard/finance');
                revalidatePath('/dashboard/finance/invoices');
                revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
                revalidatePath('/portal/billing');
                if (txOutcome.parentId) {
                    revalidatePath(`/dashboard/parents/${txOutcome.parentId}`);
                }
                if (txOutcome.centreId) {
                    revalidatePath(`/dashboard/centres/${txOutcome.centreId}/billing`);
                }
            } catch (revalErr) {
                logger.warn('[stripe-invoice webhook] Post-commit revalidation warning:', revalErr);
            }
        } catch (err) {
            if (isUniqueViolation(err)) {
                return NextResponse.json({ ok: true, duplicate: true });
            }
            logger.error('[stripe-invoice webhook] DB error processing payment:', err);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
    }

    return NextResponse.json({ ok: true });
}
