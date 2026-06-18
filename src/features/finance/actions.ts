'use server';

import { db } from '@/db';
import { children, parents, invoices, bookings, bookingAttendees, registrationChildren, registrations, auditEvents } from '@/db/schema';
import { eq, ilike, or, and, desc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

export async function getParents(query: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const matchingChildren = await db.select({ parentId: children.parentId }).from(children).where(
        or(
            ilike(children.firstName, `%${query}%`),
            ilike(children.lastName, `%${query}%`)
        )
    ).limit(20);

    const parentIdsFromChildren = matchingChildren.map(c => c.parentId).filter((id): id is string => id !== null);

    const orClauses = [
        ilike(parents.firstName, `%${query}%`),
        ilike(parents.lastName, `%${query}%`),
        ilike(parents.email, `%${query}%`)
    ];

    if (parentIdsFromChildren.length > 0) {
        orClauses.push(inArray(parents.id, parentIdsFromChildren));
    }

    const results = await db.query.parents.findMany({
        where: and(
            eq(parents.organisationId, session.user.organisationId),
            or(...orClauses)
        ),
        with: {
            children: true
        },
        limit: 10
    });

    return results;
}

export async function getChildrenByParent(parentId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const results = await db.query.children.findMany({
        where: eq(children.parentId, parentId),
        with: {
            bookings: {
                limit: 1,
                orderBy: (bookings, { desc }) => [desc(bookings.createdAt)]
            },
            attendances: {
                limit: 1,
                with: { booking: true },
                orderBy: (attendances, { desc }) => [desc(attendances.updatedAt)]
            }
        }
    });

    // Also fetch registration child links just in case
    const childIds = results.map(c => c.id);
    const regChildrenMap: Record<string, string> = {};
    if (childIds.length > 0) {
        const regLinks = await db
            .select({
                childId: registrationChildren.childId,
                centreId: registrations.centreId,
            })
            .from(registrationChildren)
            .innerJoin(registrations, eq(registrations.id, registrationChildren.registrationId))
            .where(inArray(registrationChildren.childId, childIds as string[]));
            
        regLinks.forEach(link => {
            if (link.childId && link.centreId) {
                regChildrenMap[link.childId] = link.centreId;
            }
        });
    }

    return results.map(child => {
        let centreId = regChildrenMap[child.id] || null;
        if (!centreId && child.bookings && child.bookings.length > 0 && child.bookings[0].centreId) {
            centreId = child.bookings[0].centreId;
        } else if (!centreId && child.attendances && child.attendances.length > 0 && child.attendances[0].booking?.centreId) {
            centreId = child.attendances[0].booking.centreId;
        }
        
        // Remove relationships from output for clean serialization
        const { bookings, attendances, ...cleanChild } = child;
        return {
            ...cleanChild,
            centreId
        };
    });
}

export async function createInvoice(data: {
    parentId: string;
    childIds: string[];
    amount: string;
    invoiceDate: Date;
    dueDate: Date;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    notes?: string;
    centreId: string;
}) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Fetch child names for the description if multiple are selected
    const selectedChildren = await db.select().from(children).where(inArray(children.id, data.childIds));
    const childNames = selectedChildren.map(c => `${c.firstName} ${c.lastName}`).join(', ');
    
    const description = data.notes 
        ? `${data.notes}${selectedChildren.length > 1 ? `\n(Includes: ${childNames})` : ''}`
        : `After School Club Childcare Services${selectedChildren.length > 0 ? ` for ${childNames}` : ''}`;

    const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

    const [newInvoice] = await db.insert(invoices).values({
        organisationId: session.user.organisationId,
        centreId: data.centreId,
        parentId: data.parentId,
        childId: data.childIds[0] || null, 
        invoiceNumber,
        amount: data.amount,
        status: 'draft',
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        billingPeriodStart: data.billingPeriodStart,
        billingPeriodEnd: data.billingPeriodEnd,
        notes: description,
    }).returning();

    await db.insert(auditEvents).values({
        organisationId: session.user.organisationId,
        userId: session.user.id,
        eventType: 'invoice_created',
        eventData: JSON.stringify({ invoiceId: newInvoice.id, invoiceNumber: newInvoice.invoiceNumber, amount: newInvoice.amount })
    });

    revalidatePath('/dashboard/finance');
    return newInvoice;
}

export async function createLegacyFamilyAndInvoice(data: {
    parent: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    };
    children: Array<{
        firstName: string;
        lastName: string;
        schoolYear: string;
    }>;
    invoice: {
        amount: string;
        invoiceDate: Date;
        dueDate: Date;
        billingPeriodStart?: Date;
        billingPeriodEnd?: Date;
        notes?: string;
        centreId: string;
    };
}) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    return await db.transaction(async (tx) => {
        // 1. Create Parent
        const [newParent] = await tx.insert(parents).values({
            organisationId: session.user.organisationId!,
            firstName: data.parent.firstName,
            lastName: data.parent.lastName,
            email: data.parent.email,
            phone: data.parent.phone,
            preferredContact: 'email', // Default
        }).returning();

        // 2. Create Children
        const createdChildren = [];
        for (const child of data.children) {
            const [newChild] = await tx.insert(children).values({
                parentId: newParent.id,
                firstName: child.firstName,
                lastName: child.lastName,
                schoolYear: child.schoolYear,
            }).returning();
            createdChildren.push(newChild);
        }

        // 3. Create Invoice
        const childNames = createdChildren.map(c => `${c.firstName} ${c.lastName}`).join(', ');
        const description = data.invoice.notes 
            ? `${data.invoice.notes}\n(Includes: ${childNames})`
            : `After School Club Childcare Services for ${childNames}`;

        const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;
        const [newInvoice] = await tx.insert(invoices).values({
            organisationId: session.user.organisationId!,
            centreId: data.invoice.centreId,
            parentId: newParent.id,
            childId: createdChildren[0]?.id || null,
            invoiceNumber,
            amount: data.invoice.amount,
            status: 'draft',
            invoiceDate: data.invoice.invoiceDate,
            dueDate: data.invoice.dueDate,
            billingPeriodStart: data.invoice.billingPeriodStart,
            billingPeriodEnd: data.invoice.billingPeriodEnd,
            notes: description,
        }).returning();

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId!,
            userId: session.user.id,
            eventType: 'invoice_created',
            eventData: JSON.stringify({ invoiceId: newInvoice.id, invoiceNumber: newInvoice.invoiceNumber, amount: newInvoice.amount })
        });

        return { parent: newParent, children: createdChildren, invoice: newInvoice };
    });
}

export async function createAdHocInvoice(data: {
    // Existing parent OR new parent details
    parentId?: string;
    newParent?: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
    };
    // Free-text child name — stored in notes, printed on PDF, no DB record created
    childName: string;
    amount: string;
    invoiceDate: Date;
    dueDate: Date;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    notes?: string;
    centreId: string;
}) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    return await db.transaction(async (tx) => {
        // 1. Resolve parent — either existing or create a minimal new one
        let parentId = data.parentId;
        if (!parentId) {
            if (!data.newParent?.firstName) throw new Error('Parent name is required for ad-hoc invoices');
            const [newParent] = await tx.insert(parents).values({
                organisationId: session.user.organisationId!,
                firstName: data.newParent.firstName,
                lastName: data.newParent.lastName || '',
                email: data.newParent.email || null,
                phone: data.newParent.phone || null,
                preferredContact: 'email',
            }).returning();
            parentId = newParent.id;
        }

        // 2. Build description — child name stored in notes so it prints on PDF
        const childLabel = data.childName.trim();
        const baseDescription = data.notes
            ? `${data.notes}\nChild: ${childLabel}`
            : `After School Club Childcare Services\nChild: ${childLabel}`;

        // 3. Create invoice with childId: null
        const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;
        const [newInvoice] = await tx.insert(invoices).values({
            organisationId: session.user.organisationId!,
            centreId: data.centreId,
            parentId,
            childId: null,
            invoiceNumber,
            amount: data.amount,
            status: 'draft',
            invoiceDate: data.invoiceDate,
            dueDate: data.dueDate,
            billingPeriodStart: data.billingPeriodStart,
            billingPeriodEnd: data.billingPeriodEnd,
            notes: baseDescription,
        }).returning();

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId!,
            userId: session.user.id,
            eventType: 'invoice_created',
            eventData: JSON.stringify({
                invoiceId: newInvoice.id,
                invoiceNumber: newInvoice.invoiceNumber,
                amount: newInvoice.amount,
                adhoc: true,
                childName: childLabel,
            })
        });

        revalidatePath('/dashboard/finance');
        return newInvoice;
    });
}

export async function getInvoiceDetails(invoiceId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const result = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, invoiceId),
            eq(invoices.organisationId, session.user.organisationId)
        ),
        with: {
            centre: true,
            child: true,
            parent: true,
            payments: {
                orderBy: (payments, { desc }) => [desc(payments.recordedAt)]
            }
        }
    });

    if (!result) return null;

    // Derive childDisplayName: from child record if linked, otherwise parse from notes
    let childDisplayName: string | null = null;
    if (result.child) {
        childDisplayName = `${result.child.firstName} ${result.child.lastName}`.trim();
    } else if (result.notes) {
        // Ad-hoc invoices store "Child: [name]" in notes
        const match = result.notes.match(/Child:\s*(.+)/);
        if (match) childDisplayName = match[1].trim();
    }

    return { ...result, childDisplayName };
}

export async function recordPayment(data: {
    invoiceId: string;
    amount: string;
    method: 'cash' | 'bank_transfer' | 'stripe' | 'voucher' | 'other';
    transactionReference?: string;
    recordedAt: Date;
}) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    // Link back to schema imports
    const { payments: paymentsTable } = await import('@/db/schema');

    const result = await db.transaction(async (tx) => {
        // 1. Insert payment record
        const [newPayment] = await tx.insert(paymentsTable).values({
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            transactionReference: data.transactionReference,
            recordedAt: data.recordedAt,
        }).returning();

        // 2. Fetch all payments and invoice total to update status
        const allPayments = await tx.query.payments.findMany({
            where: eq(paymentsTable.invoiceId, data.invoiceId)
        });

        const invoice = await tx.query.invoices.findFirst({
            where: eq(invoices.id, data.invoiceId)
        });

        if (invoice) {
            const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            const invoiceAmount = Number(invoice.amount);
            
            let newStatus: 'paid' | 'partially_paid' | 'sent' = 'sent';
            if (totalPaid >= invoiceAmount) {
                newStatus = 'paid';
            } else if (totalPaid > 0) {
                newStatus = 'partially_paid';
            }

            await tx.update(invoices).set({
                status: newStatus
            }).where(eq(invoices.id, data.invoiceId));
        }

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId as string,
            userId: session.user.id,
            eventType: 'payment_recorded',
            eventData: JSON.stringify({ invoiceId: data.invoiceId, paymentId: newPayment.id, amount: data.amount, method: data.method })
        });

        return newPayment;
    });

    revalidatePath(`/dashboard/finance/invoices/${data.invoiceId}`);
    revalidatePath('/dashboard/finance');
    return result;
}

export async function deleteInvoice(invoiceId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owner can delete invoices');

    const result = await db.transaction(async (tx) => {
        const invoice = await tx.query.invoices.findFirst({
            where: eq(invoices.id, invoiceId),
            with: { payments: true }
        });

        if (!invoice) throw new Error('Invoice not found');

        if (invoice.payments && invoice.payments.length > 0) {
            throw new Error('Please delete associated payments before deleting the invoice.');
        }

        await tx.delete(invoices).where(eq(invoices.id, invoiceId));
        return invoice;
    });

    revalidatePath('/dashboard/finance');
    if (result.parentId) {
        revalidatePath(`/dashboard/parents/${result.parentId}`);
    }
    
    return { success: true };
}

export async function voidInvoice(invoiceId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owner can void invoices');

    const invoice = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, invoiceId),
            eq(invoices.organisationId, session.user.organisationId),
        ),
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'void') throw new Error('Invoice is already voided');

    await db
        .update(invoices)
        .set({ status: 'void', updatedAt: new Date() })
        .where(eq(invoices.id, invoiceId));

    await db.insert(auditEvents).values({
        organisationId: session.user.organisationId,
        userId: session.user.id,
        eventType: 'invoice_voided',
        eventData: JSON.stringify({ invoiceId })
    });

    revalidatePath('/dashboard/finance');
    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    if (invoice.parentId) {
        revalidatePath(`/dashboard/parents/${invoice.parentId}`);
    }

    return { success: true };
}

