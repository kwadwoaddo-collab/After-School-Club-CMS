import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParent } from '@/lib/parent-auth';
import { db } from '@/db';
import { invoices, payments, organisations } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { stripeService } from '@/lib/services/stripe';

/**
 * POST /api/portal/checkout
 *
 * Creates a Stripe Hosted Checkout session for a specific invoice.
 * Parent must be authenticated via portal JWT.
 * Only works for outstanding (non-paid, non-void) invoices owned by the authenticated parent.
 *
 * Body: { invoiceId: string }
 * Returns: { sessionUrl: string }
 */
export async function POST(req: NextRequest) {
    const parent = await getCurrentParent();
    if (!parent) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    if (!stripeService.isConfigured()) {
        return NextResponse.json({ error: 'Online payments not configured' }, { status: 503 });
    }

    let body: { invoiceId?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { invoiceId } = body;
    if (!invoiceId || typeof invoiceId !== 'string') {
        return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    // Fetch the invoice — must belong to this parent and not be paid/void
    const invoice = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, invoiceId),
            eq(invoices.parentId, parent.id),
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'void')
        ),
        with: {
            centre: { columns: { name: true } },
            payments: { columns: { amount: true, status: true } },
        },
    });

    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found or not payable' }, { status: 404 });
    }

    // Calculate remaining balance
    const paidAmount = (invoice.payments ?? []).reduce(
        (sum, p) => p.status === 'verified' ? sum + Number(p.amount) : sum,
        0
    );
    const remaining = Number(invoice.amount) - paidAmount;

    if (remaining <= 0) {
        return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 });
    }

    // Fetch org name
    const [org] = await db
        .select({ name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, invoice.organisationId))
        .limit(1);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';
    const description = `Invoice #${invoice.invoiceNumber}${invoice.centre ? ` — ${invoice.centre.name}` : ''}`;

    const result = await stripeService.createInvoicePaymentSession({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amountPence: Math.round(remaining * 100),
        parentEmail: parent.email ?? '',
        description,
        successUrl: `${baseUrl}/portal/billing?payment=success&invoice=${invoice.invoiceNumber}`,
        cancelUrl: `${baseUrl}/portal/billing?payment=cancelled`,
    });

    if (!result.success || !result.sessionUrl) {
        console.error('[portal/checkout] Stripe session creation failed:', result.error);
        return NextResponse.json({ error: result.error || 'Failed to create payment session' }, { status: 500 });
    }

    return NextResponse.json({ sessionUrl: result.sessionUrl });
}
