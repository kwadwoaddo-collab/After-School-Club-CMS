'use server';
import { db } from '@/db';
import { payments, invoices, orgMemberships, centreMemberships, auditEvents } from '@/db/schema';
import { and, eq, like, sql } from 'drizzle-orm';
import { requireTenantSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { PaymentCorrectionSchema, correctionDate, correctableMethods, type PaymentCorrectionInput } from './domain/payment-correction';
class PaymentCorrectionError extends Error {}

async function applyPaymentCorrection(raw: PaymentCorrectionInput) {
    const session = await requireTenantSession();
    if (!session.user.organisationId)
        throw new PaymentCorrectionError('Sign in to your organisation before correcting a payment.');
    const parsed = PaymentCorrectionSchema.safeParse(raw);
    if (!parsed.success) throw new PaymentCorrectionError('Check the payment date, reference and reason, then try again.');
    const data = parsed.data, orgId = session.user.organisationId, userId = session.user.id;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    let date: Date;
    try { date = correctionDate(data.paymentDate, today); } catch { throw new PaymentCorrectionError('Enter a valid payment date that is not in the future.'); }
    const reference = data.reference?.trim() || null;
    const request = { paymentDate: data.paymentDate, reference, reason: data.reason, expectedRecordedAt: data.expectedRecordedAt, expectedReference: data.expectedReference };
    const result = await db.transaction(async (tx) => {
        await tx.execute(sql `SET LOCAL lock_timeout = '5s'`);
        await tx.execute(sql `SET LOCAL statement_timeout = '15s'`);
        const [membership] = await tx.select({ role: orgMemberships.role }).from(orgMemberships).where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.organisationId, orgId))).for('share');
        if (!membership || !['ORG_OWNER', 'MANAGER'].includes(membership.role))
            throw new PaymentCorrectionError('Only an Owner or authorised Manager can correct payment details.');
        const [probe] = await tx.select({ invoiceId: payments.invoiceId }).from(payments).where(eq(payments.id, data.paymentId));
        if (!probe)
            throw new PaymentCorrectionError('Payment not found.');
        const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, probe.invoiceId), eq(invoices.organisationId, orgId))).for('update');
        if (!invoice)
            throw new PaymentCorrectionError('Payment not found in this organisation.');
        if (membership.role !== 'ORG_OWNER') {
            const [centre] = await tx.select({ id: centreMemberships.id }).from(centreMemberships).where(and(eq(centreMemberships.userId, userId), eq(centreMemberships.centreId, invoice.centreId))).for('share');
            if (!centre)
                throw new PaymentCorrectionError('You do not have access to this centre.');
        }
        const [payment] = await tx.select().from(payments).where(and(eq(payments.id, data.paymentId), eq(payments.invoiceId, invoice.id))).for('update');
        if (!payment)
            throw new PaymentCorrectionError('Payment not found.');
        const [prior] = await tx.select().from(auditEvents).where(and(eq(auditEvents.organisationId, orgId), eq(auditEvents.eventType, 'payment_details_corrected'), like(auditEvents.eventData, `%"correctionId":"${data.correctionId}"%`)));
        if (prior) {
            const event = JSON.parse(prior.eventData ?? '{}');
            if (event.paymentId !== payment.id || event.actorId !== userId || JSON.stringify(event.request) !== JSON.stringify(request))
                throw new PaymentCorrectionError('This correction request has changed. Reload the invoice before trying again.');
            return { invoiceId: invoice.id, parentId: invoice.parentId, replay: true };
        }
        if (invoice.status === 'void' || payment.status !== 'verified' || !correctableMethods.includes(payment.method))
            throw new PaymentCorrectionError('Only verified, manually recorded payments on a non-void invoice can be corrected.');
        if (payment.recordedAt.toISOString() !== new Date(data.expectedRecordedAt).toISOString() || payment.transactionReference !== data.expectedReference)
            throw new PaymentCorrectionError('This payment changed while you were editing. Reload the invoice and review it before correcting it.');
        const sameBusinessDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(payment.recordedAt) === data.paymentDate;
        if (new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(payment.recordedAt) === data.paymentDate && payment.transactionReference === reference)
            throw new PaymentCorrectionError('Change the payment date or reference before saving a correction.');
        await tx.update(payments).set({ recordedAt: sameBusinessDate ? payment.recordedAt : date, transactionReference: reference, updatedAt: new Date() }).where(eq(payments.id, payment.id));
        await tx.insert(auditEvents).values({ organisationId: orgId, userId, eventType: 'payment_details_corrected', eventData: JSON.stringify({ correctionId: data.correctionId, actorId: userId, paymentId: payment.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, reason: data.reason, previousRecordedAt: payment.recordedAt.toISOString(), correctedRecordedAt: (sameBusinessDate ? payment.recordedAt : date).toISOString(), previousReference: payment.transactionReference, correctedReference: reference, amount: payment.amount, method: payment.method, paymentStatus: payment.status, request }) });
        return { invoiceId: invoice.id, parentId: invoice.parentId, replay: false };
    });
    revalidatePath('/dashboard/finance');
    revalidatePath(`/dashboard/finance/invoices/${result.invoiceId}`);
    revalidatePath(`/dashboard/parents/${result.parentId}`);
    revalidatePath('/portal/billing');
    return { success: true as const, isReplay: result.replay };
}

export async function correctPaymentDetails(raw: PaymentCorrectionInput) {
    try {
        return await applyPaymentCorrection(raw);
    } catch (error) {
        return { success: false as const, error: error instanceof PaymentCorrectionError ? error.message : 'The correction was not confirmed. Reload the invoice and review the payment before trying again.' };
    }
}
