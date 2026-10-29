'use server';
import { z } from 'zod';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditEvents, payments, invoices, parents, centres, orgMemberships, centreMemberships } from '@/db/schema';
import { requireTenantSession } from '@/lib/session';
import { emailService } from '@/lib/services/email';

const input = z.object({ paymentId: z.uuid(), requestId: z.uuid(), expectedRecipient: z.email().max(254) }).strict();
export async function sendReceiptEmail(raw: z.infer<typeof input>) {
    const session = await requireTenantSession();
    const parsed = input.safeParse(raw);
    if (!session.user.organisationId || !parsed.success) return { success: false, status: 'not_sent', error: 'Reload the invoice and check the receipt and recipient before sending.' };
    const data = parsed.data, orgId = session.user.organisationId, actorId = session.user.id;
    try {
        const claim = await db.transaction(async tx => {
            await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
            await tx.execute(sql`SET LOCAL statement_timeout = '15s'`);
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'receipt-email:' + orgId + ':' + data.requestId}))`);
            const [member] = await tx.select({ role: orgMemberships.role }).from(orgMemberships).where(and(eq(orgMemberships.userId, actorId), eq(orgMemberships.organisationId, orgId))).for('share');
            if (!member || !['ORG_OWNER', 'MANAGER'].includes(member.role)) return { error: 'Only an Owner or authorised Manager can send receipts.' };
            const [payment] = await tx.select().from(payments).where(eq(payments.id, data.paymentId)).for('share');
            if (!payment) return { error: 'Payment not found.' };
            const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, payment.invoiceId), eq(invoices.organisationId, orgId))).for('share');
            if (!invoice) return { error: 'Payment not found in this organisation.' };
            if (member.role !== 'ORG_OWNER') {
                const [centre] = await tx.select({ id: centreMemberships.id }).from(centreMemberships).where(and(eq(centreMemberships.userId, actorId), eq(centreMemberships.centreId, invoice.centreId))).for('share');
                if (!centre) return { error: 'You do not have access to this centre.' };
            }
            if (payment.status !== 'verified' || ['void', 'draft'].includes(invoice.status)) return { error: 'Only verified payments on an issued, non-void invoice can be emailed.' };
            const [parent] = await tx.select().from(parents).where(and(eq(parents.id, invoice.parentId), eq(parents.organisationId, orgId), isNull(parents.deletedAt))).for('share');
            if (!parent?.email || parent.email !== data.expectedRecipient) return { error: 'The recipient email address changed or is missing. Reload the invoice and review it.' };
            const [prior] = await tx.select().from(auditEvents).where(and(eq(auditEvents.organisationId, orgId), eq(auditEvents.eventType, 'receipt_email_status'), sql`${auditEvents.eventData}::jsonb->>'requestId' = ${data.requestId}`)).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
            if (prior) {
                const event = JSON.parse(prior.eventData ?? '{}');
                if (event.paymentId !== data.paymentId || event.recipient !== parent.email || prior.userId !== actorId) return { error: 'This email request changed. Reload the invoice.' };
                return { priorStatus: String(event.status) };
            }
            const [centre] = await tx.select({ name: centres.name }).from(centres).where(and(eq(centres.id, invoice.centreId), eq(centres.organisationId, orgId)));
            await tx.insert(auditEvents).values({ organisationId: orgId, userId: actorId, eventType: 'receipt_email_status', eventData: JSON.stringify({ requestId: data.requestId, paymentId: payment.id, invoiceId: invoice.id, recipient: parent.email, status: 'sending', deliberate: true }) });
            return { invoiceId: invoice.id, payload: { parentEmail: parent.email, parentName: parent.firstName, invoiceNumber: invoice.invoiceNumber, paymentId: payment.id, amountPaid: Number(payment.amount), organisationName: centre?.name || 'Our Centre', invoiceId: invoice.id, paymentDate: payment.recordedAt.toLocaleDateString('en-GB', { timeZone: 'Europe/London' }), childcarePeriod: invoice.billingPeriodStart && invoice.billingPeriodEnd ? `${invoice.billingPeriodStart.toLocaleDateString('en-GB', {timeZone:'UTC'})} to ${invoice.billingPeriodEnd.toLocaleDateString('en-GB', {timeZone:'UTC'})}` : undefined, idempotencyKey: `receipt:${orgId}:${data.requestId}` } };
        });
        if ('error' in claim) return { success: false, status: 'not_sent', error: claim.error };
        if ('priorStatus' in claim) return { success: claim.priorStatus === 'accepted', status: claim.priorStatus, error: claim.priorStatus === 'accepted' ? undefined : 'This sending request is already recorded. Check its outcome before making a new request.' };
        const result = await emailService.sendPaymentReceiptEmail(claim.payload);
        const status = result.success ? 'accepted' : result.outcome === 'not_sent' ? 'not_sent' : 'unknown';
        await db.insert(auditEvents).values({ organisationId: orgId, userId: actorId, eventType: 'receipt_email_status', eventData: JSON.stringify({ requestId: data.requestId, paymentId: data.paymentId, invoiceId: claim.invoiceId, recipient: claim.payload.parentEmail, status, messageId: result.messageId, deliberate: true }) });
        revalidatePath(`/dashboard/finance/invoices/${claim.invoiceId}`);
        return { success: status === 'accepted', status, error: status === 'accepted' ? undefined : status === 'not_sent' ? 'Email was not sent. The receipt and payment are unchanged.' : 'Email outcome is not confirmed. Check before sending again.' };
    } catch {
        return { success: false, status: 'unknown', error: 'Email outcome is not confirmed. Check before sending again; the provider may have accepted it.' };
    }
}
