'use server';

import { db } from '@/db';
import { invoices, payments, children, centres, users } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

export async function getFinanceStudents() {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Filter by organisationId through parent
    const results = await db.query.children.findMany({
        with: {
            parent: true
        }
    });

    // Manual filter for now or use proper relational query in drizzle
    return results.filter(c => c.parent?.organisationId === session.user.organisationId);
}

export async function createManualInvoice(data: {
    childId: string;
    amount: number;
    invoiceDate: Date;
    dueDate: Date;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Get centreId from the student (via latest booking or registration)
    // For simplicity, we'll fetch the child and find their centre
    const child = await db.query.children.findFirst({
        where: eq(children.id, data.childId),
        with: {
            parent: true
        }
    });

    if (!child) throw new Error('Student not found');

    // Find a centreId. We'll pick the first centre in the org for now if not found via link
    // Better: let the user pick centre or derive from student's primary centre
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId)
    });

    if (orgCentres.length === 0) throw new Error('No centres found for this organisation');
    const centreId = orgCentres[0].id;

    const invoiceNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${nanoid(6).toUpperCase()}`;

    const [newInvoice] = await db.insert(invoices).values({
        organisationId: session.user.organisationId,
        centreId,
        childId: data.childId,
        invoiceNumber,
        amount: data.amount.toString(),
        status: 'sent', // Default to sent for manual creation
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        billingPeriodStart: data.billingPeriodStart,
        billingPeriodEnd: data.billingPeriodEnd,
        notes: data.notes,
    }).returning();

    revalidatePath('/dashboard/finance');
    return newInvoice;
}

export async function recordManualPayment(data: {
    invoiceId: string;
    amount: number;
    method: 'cash' | 'bank_transfer' | 'voucher' | 'other';
    recordedAt: Date;
    reference?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    // 1. Insert Payment
    await db.insert(payments).values({
        invoiceId: data.invoiceId,
        amount: data.amount.toString(),
        method: data.method,
        transactionReference: data.reference,
        recordedAt: data.recordedAt,
    });

    // 2. Fetch Invoice and all payments to recalculate status
    const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, data.invoiceId),
        with: {
            payments: true
        }
    });

    if (!invoice) throw new Error('Invoice not found');

    const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalAmount = Number(invoice.amount);

    let newStatus: 'paid' | 'partially_paid' | 'sent' = 'sent';
    if (totalPaid >= totalAmount) {
        newStatus = 'paid';
    } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
    }

    // 3. Update Invoice Status
    await db.update(invoices)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(invoices.id, data.invoiceId));

    revalidatePath('/dashboard/finance');
    revalidatePath(`/dashboard/finance/invoices/${data.invoiceId}`);
    
    return { success: true, status: newStatus };
}

export async function getInvoiceDetails(id: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    return await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, id),
            eq(invoices.organisationId, session.user.organisationId)
        ),
        with: {
            child: {
                with: {
                    parent: true
                }
            },
            centre: true,
            payments: {
                orderBy: [desc(payments.recordedAt)]
            }
        }
    });
}
