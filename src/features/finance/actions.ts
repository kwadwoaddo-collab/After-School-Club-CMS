'use server';

import { db } from '@/db';
import { children, parents, centres, invoices, payments, bookings, bookingAttendees, registrationChildren, registrations, auditEvents } from '@/db/schema';
import { eq, ilike, or, and, desc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';
import { emailService } from '@/lib/services/email';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { notifyOwners } from '@/lib/db-notifications';

async function insertInvoiceAndLog(
    tx: any,
    orgId: string,
    userId: string,
    params: {
        centreId: string;
        parentId: string;
        childId: string | null;
        amount: string;
        invoiceDate: Date;
        dueDate: Date;
        billingPeriodStart?: Date;
        billingPeriodEnd?: Date;
        notes: string | null;
        adhoc?: boolean;
        childName?: string;
        coveredChildrenJson?: any;
    }
) {
    const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;
    const [inv] = await tx.insert(invoices).values({
        organisationId: orgId,
        centreId: params.centreId,
        parentId: params.parentId,
        childId: params.childId,
        invoiceNumber,
        amount: params.amount,
        status: 'draft',
        invoiceDate: params.invoiceDate,
        dueDate: params.dueDate,
        billingPeriodStart: params.billingPeriodStart,
        billingPeriodEnd: params.billingPeriodEnd,
        notes: params.notes,
        coveredChildrenJson: params.coveredChildrenJson,
    }).returning();

    await tx.insert(auditEvents).values({
        organisationId: orgId,
        userId,
        eventType: 'invoice_created',
        eventData: JSON.stringify({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: inv.amount,
            adhoc: params.adhoc,
            childName: params.childName,
        })
    });

    return inv;
}

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
    
    const coveredChildren = selectedChildren.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
    
    const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

    // Execute database operations atomically in a transaction
    const newInvoice = await db.transaction(async (tx) => {
        return await insertInvoiceAndLog(tx, session.user.organisationId!, session.user.id, {
            centreId: data.centreId,
            parentId: data.parentId,
            childId: data.childIds[0] || null,
            amount: data.amount,
            invoiceDate: data.invoiceDate,
            dueDate: data.dueDate,
            billingPeriodStart: data.billingPeriodStart,
            billingPeriodEnd: data.billingPeriodEnd,
            notes: data.notes || null,
            coveredChildrenJson: coveredChildren,
        });
    });

    // Send invoice email notification to parent (fire-and-forget)
    const parent = await db.query.parents.findFirst({ where: eq(parents.id, data.parentId), columns: { firstName: true, email: true } });
    const centre = await db.query.centres.findFirst({ where: eq(centres.id, data.centreId), columns: { name: true } });
    if (parent?.email) {
        emailService.sendInvoiceCreated({
            parentFirstName: parent.firstName,
            parentEmail: parent.email,
            invoiceNumber: newInvoice.invoiceNumber,
            amount: Number(newInvoice.amount),
            dueDate: newInvoice.dueDate,
            centreName: centre?.name || 'the centre',
            portalUrl: `${process.env.NEXTAUTH_URL || ''}/portal/billing`,
        }).catch(e => console.error('[Email] Failed to send invoice created email:', e));
    }

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
        const coveredChildren = createdChildren.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
 
        const newInvoice = await insertInvoiceAndLog(tx, session.user.organisationId!, session.user.id, {
            centreId: data.invoice.centreId,
            parentId: newParent.id,
            childId: createdChildren[0]?.id || null,
            amount: data.invoice.amount,
            invoiceDate: data.invoice.invoiceDate,
            dueDate: data.invoice.dueDate,
            billingPeriodStart: data.invoice.billingPeriodStart,
            billingPeriodEnd: data.invoice.billingPeriodEnd,
            notes: data.invoice.notes || null,
            coveredChildrenJson: coveredChildren,
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

        // 2. Build ad-hoc child details
        const childLabel = data.childName.trim();
        const coveredChildren = [{ childName: childLabel }];
 
        const newInvoice = await insertInvoiceAndLog(tx, session.user.organisationId!, session.user.id, {
            centreId: data.centreId,
            parentId,
            childId: null,
            amount: data.amount,
            invoiceDate: data.invoiceDate,
            dueDate: data.dueDate,
            billingPeriodStart: data.billingPeriodStart,
            billingPeriodEnd: data.billingPeriodEnd,
            notes: data.notes || null,
            adhoc: true,
            childName: childLabel,
            coveredChildrenJson: coveredChildren,
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

    // Derive childDisplayName: from child record if linked, otherwise covered children list or notes
    let childDisplayName: string | null = null;
    if (result.child) {
        childDisplayName = `${result.child.firstName} ${result.child.lastName}`.trim();
    } else if (result.coveredChildrenJson && Array.isArray(result.coveredChildrenJson)) {
        const covered = result.coveredChildrenJson as any[];
        childDisplayName = covered.map(c => c.name || c.childName || '').filter(Boolean).join(', ');
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
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, data.invoiceId),
                eq(invoices.organisationId, orgId)
            ),
            columns: { centreId: true }
        });
        if (!invoice || !accessibleCentreIds.includes(invoice.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }

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
            organisationId: session.user.organisationId!,
            userId: session.user.id!,
            eventType: 'payment_recorded',
            eventData: JSON.stringify({ invoiceId: data.invoiceId, paymentId: newPayment.id, amount: data.amount, method: data.method })
        });

        return newPayment;
    });

    revalidatePath(`/dashboard/finance/invoices/${data.invoiceId}`);
    revalidatePath('/dashboard/finance');

    // In-app notification: payment recorded (fire-and-forget)
    notifyOwners({
        orgId,
        type: 'system',
        title: 'Payment Recorded',
        message: `A £${Number(data.amount).toFixed(2)} payment (${data.method.replace('_', ' ')}) has been recorded.`,
    }).catch(() => {});

    return result;
}

export async function updateInvoiceDate(invoiceId: string, newInvoiceDate: Date) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.organisationId, orgId)
            ),
            columns: { centreId: true }
        });
        if (!invoice || !accessibleCentreIds.includes(invoice.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }

    const result = await db.transaction(async (tx) => {
        const [updatedInvoice] = await tx
            .update(invoices)
            .set({ invoiceDate: newInvoiceDate, updatedAt: new Date() })
            .where(and(
                eq(invoices.id, invoiceId),
                eq(invoices.organisationId, orgId)
            ))
            .returning();

        if (!updatedInvoice) throw new Error('Invoice not found');

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'invoice_date_updated',
            eventData: JSON.stringify({ invoiceId, newInvoiceDate })
        });

        return updatedInvoice;
    });

    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    revalidatePath('/dashboard/finance');
    return result;
}

export async function updateInvoiceNotes(invoiceId: string, notes: string | null) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const invoice = await db.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.organisationId, orgId)
            ),
            columns: { centreId: true }
        });
        if (!invoice || !accessibleCentreIds.includes(invoice.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }

    const result = await db.transaction(async (tx) => {
        const [updatedInvoice] = await tx
            .update(invoices)
            .set({ notes: notes || null, updatedAt: new Date() })
            .where(and(
                eq(invoices.id, invoiceId),
                eq(invoices.organisationId, orgId)
            ))
            .returning();

        if (!updatedInvoice) throw new Error('Invoice not found');

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'invoice_notes_updated',
            eventData: JSON.stringify({ invoiceId, notes })
        });

        return updatedInvoice;
    });

    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
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
        if (invoice.organisationId !== session.user.organisationId) throw new Error('Unauthorized');

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
    const orgId = session?.user?.organisationId;
    if (!orgId) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owner can void invoices');

    // Run the lookup, validation, update, and log inside the transaction
    const invoice = await db.transaction(async (tx) => {
        const inv = await tx.query.invoices.findFirst({
            where: and(
                eq(invoices.id, invoiceId),
                eq(invoices.organisationId, orgId),
            ),
        });

        if (!inv) throw new Error('Invoice not found');
        if (inv.status === 'void') throw new Error('Invoice is already voided');

        await tx
            .update(invoices)
            .set({ status: 'void', updatedAt: new Date() })
            .where(eq(invoices.id, invoiceId));

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'invoice_voided',
            eventData: JSON.stringify({ invoiceId })
        });

        return inv;
    });

    // Revalidate paths using the safely retrieved invoice parentId
    revalidatePath('/dashboard/finance');
    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    if (invoice.parentId) {
        revalidatePath(`/dashboard/parents/${invoice.parentId}`);
    }

    return { success: true };
}

export async function verifyPayment(paymentId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    return await db.transaction(async (tx) => {
        // 1. Fetch payment and its invoice
        const payment = await tx.query.payments.findFirst({
            where: eq(payments.id, paymentId),
            with: { invoice: true }
        });

        if (!payment || !payment.invoice) throw new Error('Payment not found');
        if (payment.status === 'verified') throw new Error('Payment is already verified');
        if (payment.invoice.organisationId !== session.user.organisationId) throw new Error('Unauthorized');

        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(payment.invoice.centreId)) {
                throw new Error('Unauthorized: No access to this centre');
            }
        }

        // 2. Mark payment as verified
        await tx.update(payments)
            .set({ status: 'verified', updatedAt: new Date() })
            .where(eq(payments.id, paymentId));

        // 3. Check if all verified payments sum up to the invoice amount
        const allInvoicePayments = await tx.query.payments.findMany({
            where: eq(payments.invoiceId, payment.invoiceId)
        });

        // Calculate total of verified payments (including the one we just verified)
        const totalVerified = allInvoicePayments.reduce((sum, p) => {
            const isVerified = p.id === paymentId ? true : p.status === 'verified';
            return isVerified ? sum + Number(p.amount) : sum;
        }, 0);

        // 4. Update invoice status if fully paid
        if (totalVerified >= Number(payment.invoice.amount)) {
            await tx.update(invoices)
                .set({ status: 'paid', updatedAt: new Date() })
                .where(eq(invoices.id, payment.invoiceId));
        }

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId,
            userId: session.user.id,
            eventType: 'payment_verified',
            eventData: JSON.stringify({ paymentId, invoiceId: payment.invoiceId, amount: payment.amount })
        });

        // Send email notification to parent (fire-and-forget)
        const invoiceFullyPaid = totalVerified >= Number(payment.invoice.amount);
        const parentRecord = await tx.query.parents.findFirst({ where: eq(parents.id, payment.invoice.parentId), columns: { firstName: true, email: true } });
        if (parentRecord?.email) {
            emailService.sendVoucherPaymentVerified({
                parentFirstName: parentRecord.firstName,
                parentEmail: parentRecord.email,
                invoiceNumber: payment.invoice.invoiceNumber,
                amount: Number(payment.amount),
                invoiceFullyPaid,
                portalUrl: `${process.env.NEXTAUTH_URL || ''}/portal/billing`,
            }).catch(e => console.error('[Email] Failed to send voucher verified email:', e));
        }

        revalidatePath('/dashboard/finance');
        revalidatePath(`/dashboard/finance/invoices/${payment.invoiceId}`);
        return { success: true };
    });
}

export async function failPayment(paymentId: string) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
        with: { invoice: true }
    });

    if (!payment || !payment.invoice) throw new Error('Payment not found');
    if (payment.invoice.organisationId !== session.user.organisationId) throw new Error('Unauthorized');

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(payment.invoice.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }

    await db.update(payments)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(payments.id, paymentId));

    await db.insert(auditEvents).values({
        organisationId: session.user.organisationId,
        userId: session.user.id,
        eventType: 'payment_failed',
        eventData: JSON.stringify({ paymentId, invoiceId: payment.invoiceId, amount: payment.amount })
    });

    // Send email notification to parent (fire-and-forget)
    const parentRecord = await db.query.parents.findFirst({ where: eq(parents.id, payment.invoice.parentId), columns: { firstName: true, email: true } });
    if (parentRecord?.email) {
        emailService.sendVoucherPaymentFailed({
            parentFirstName: parentRecord.firstName,
            parentEmail: parentRecord.email,
            invoiceNumber: payment.invoice.invoiceNumber,
            amount: Number(payment.amount),
            portalUrl: `${process.env.NEXTAUTH_URL || ''}/portal/billing`,
        }).catch(e => console.error('[Email] Failed to send voucher failed email:', e));
    }

    revalidatePath('/dashboard/finance');
    revalidatePath(`/dashboard/finance/invoices/${payment.invoiceId}`);
    return { success: true };
}

// ─── Resend Invoice Email ───────────────────────────────────────────────────

/**
 * Manually resend the invoice notification email to the parent.
 * Only allowed for invoices that are not already paid or voided.
 */
export async function resendInvoiceEmail(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.organisationId) return { success: false, error: 'Unauthorized' };
    if ((session.user as any).role !== 'ORG_OWNER') return { success: false, error: 'Insufficient permissions' };

    const invoice = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, invoiceId),
            eq(invoices.organisationId, session.user.organisationId)
        ),
        with: {
            parent: { columns: { firstName: true, email: true } },
            centre: { columns: { name: true } },
        },
    });

    if (!invoice) return { success: false, error: 'Invoice not found' };
    if (invoice.status === 'paid') return { success: false, error: 'This invoice is already marked as paid.' };
    if (invoice.status === 'void') return { success: false, error: 'Cannot send a voided invoice.' };

    const parentEmail = invoice.parent?.email;
    const parentName = invoice.parent?.firstName ?? 'Parent';
    const centreName = invoice.centre?.name ?? 'After School Club';
    const portalUrl = `${process.env.NEXTAUTH_URL || ''}/portal/billing`;

    if (!parentEmail) {
        return { success: false, error: 'No email address on file for this parent.' };
    }

    const result = await emailService.sendInvoiceCreated({
        parentFirstName: parentName,
        parentEmail,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        dueDate: invoice.dueDate ?? new Date(),
        centreName,
        portalUrl,
    });

    if (!result.success) {
        return { success: false, error: result.error ?? 'Email could not be sent. Check RESEND_API_KEY.' };
    }

    return { success: true };
}
