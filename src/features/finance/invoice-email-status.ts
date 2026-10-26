import { db } from '@/db';
import { auditEvents } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { emailService } from '@/lib/services/email';
import { logger } from '@/lib/logger';

export type InvoiceEmailStatus = {
    status: 'sending' | 'accepted' | 'failed' | 'no_address' | 'unknown';
    attemptedAt: string;
};

// Call only after the invoice's organisation, role and centre have been authorised.
export async function readInvoiceEmailStatus(invoiceId: string, organisationId: string): Promise<InvoiceEmailStatus | null> {
    try {
        const event = await db.query.auditEvents.findFirst({
            where: and(eq(auditEvents.organisationId, organisationId), eq(auditEvents.eventType, 'invoice_email_status'),
                sql`${auditEvents.eventData}::jsonb ->> 'invoiceId' = ${invoiceId}`),
            orderBy: [sql`(${auditEvents.eventData}::jsonb ->> 'attemptedAt') desc`, desc(auditEvents.createdAt)],
        });
        if (!event?.eventData) return null;
        const data = JSON.parse(event.eventData);
        if (!['sending', 'accepted', 'failed', 'no_address', 'unknown'].includes(data.status) || typeof data.attemptedAt !== 'string') return null;
        return { status: data.status, attemptedAt: data.attemptedAt };
    } catch (error) {
        logger.error('[Invoice email] Status unavailable', error);
        return { status: 'unknown', attemptedAt: '' };
    }
}

export async function sendAuditedInvoiceEmail(input: {
    invoiceId: string; organisationId: string; userId: string;
    parentEmail: string | null | undefined; parentFirstName: string;
    invoiceNumber: string; amount: number; dueDate: Date;
    centreName: string; portalUrl: string;
}): Promise<InvoiceEmailStatus> {
    const attemptedAt = new Date().toISOString();
    const record = async (status: InvoiceEmailStatus['status'], messageId?: string) => {
        await db.insert(auditEvents).values({
            organisationId: input.organisationId, userId: input.userId,
            eventType: 'invoice_email_status',
            eventData: JSON.stringify({ invoiceId: input.invoiceId, status, attemptedAt, messageId }),
        });
    };
    // Do not send if the attempt cannot first be recorded. Never retry automatically.
    try { await record(input.parentEmail ? 'sending' : 'no_address'); }
    catch (error) {
        logger.error('[Invoice email] Could not record attempt; not sent', error);
        return { status: 'unknown', attemptedAt };
    }
    if (!input.parentEmail) return { status: 'no_address', attemptedAt };
    let status: InvoiceEmailStatus['status'];
    let messageId: string | undefined;
    try {
        const result = await emailService.sendInvoiceCreated({ ...input, parentEmail: input.parentEmail });
        status = result.success ? 'accepted' : result.outcome === 'not_sent' ? 'failed' : 'unknown';
        messageId = result.messageId;
    } catch (error) {
        // A transport error may follow provider acceptance. Do not claim non-delivery.
        logger.error('[Invoice email] Provider outcome unknown', error);
        status = 'unknown';
    }
    try { await record(status, messageId); }
    catch (error) {
        logger.error('[Invoice email] Could not record outcome', error);
        return { status: 'unknown', attemptedAt };
    }
    return { status, attemptedAt };
}
