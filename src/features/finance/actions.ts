'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { db } from '@/db';
import { children, parents, centres, invoices, payments, bookings, bookingAttendees, registrationChildren, registrations, auditEvents, billingConfigs, billingRuns, portalNotifications } from '@/db/schema';
import { eq, ilike, or, and, desc, inArray, sql, ne, isNull } from 'drizzle-orm';
import { requireTenantSession } from '@/lib/session';
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
        billingConfigId?: string | null;
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
        billingConfigId: params.billingConfigId ?? null,
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

/**
 * Category C — Authoritative invoice status recalculation.
 *
 * Recalculates invoice status from ONLY verified payments.
 * Must be called after any payment state change that affects balance.
 *
 * Rules:
 * - draft: untouched (not payment-driven)
 * - void: untouched (terminal; reversal on void invoice is allowed
 *   but does NOT resurrect the invoice — see reversePayment)
 * - verified total >= invoice amount → paid
 * - verified total > 0 → partially_paid
 * - verified total === 0 → sent
 *
 * Must be called inside a db.transaction() tx.
 */
async function recalculateInvoiceStatus(
    tx: any, // Using any for transaction to match existing codebase patterns
    invoiceId: string
): Promise<void> {
    const invoice = await tx.query.invoices.findFirst({
        where: eq(invoices.id, invoiceId),
        columns: { status: true, amount: true },
    });
    if (!invoice) return;
    // draft and void are not payment-driven states
    if (invoice.status === 'draft' || invoice.status === 'void') return;

    const allPayments = await tx.query.payments.findMany({
        where: eq(payments.invoiceId, invoiceId),
        columns: { status: true, amount: true },
    });
    const totalVerified = allPayments
        .filter((p: any) => p.status === 'verified')
        .reduce((s: number, p: any) => s + Number(p.amount), 0);

    let newStatus: 'sent' | 'partially_paid' | 'paid';
    if (totalVerified >= Number(invoice.amount)) {
        newStatus = 'paid';
    } else if (totalVerified > 0) {
        newStatus = 'partially_paid';
    } else {
        newStatus = 'sent';
    }

    if (newStatus !== invoice.status) {
        await tx.update(invoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(invoices.id, invoiceId));
    }
}

export async function getParents(query: string) {
    const session = await requireTenantSession();
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
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const results = await db.query.children.findMany({
        where: and(
            eq(children.parentId, parentId),
            eq(children.organisationId, session.user.organisationId)
        ),
        with: {
            centre: { columns: { id: true, name: true } }
        },
        orderBy: (children, { asc }) => [asc(children.firstName)]
    });

    return results.map(child => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        centreId: child.centreId || null,
        centreName: child.centre?.name || null,
        schoolYear: child.schoolYear,
    }));
}

/**
 * Milestone 3G, L2a/L2: this function previously checked only that the
 * caller belonged to an organisation — it never verified that the supplied
 * parentId/childIds/centreId actually belonged to that organisation, and had
 * no role restriction at all, unlike every other Finance mutation in this
 * file (deleteInvoice/voidInvoice/resendInvoiceEmail are ORG_OWNER-only;
 * recordPayment/updateInvoiceDate/updateInvoiceNotes/verifyPayment/
 * failPayment allow non-owner + centre-check). This applies the same
 * ORG_OWNER-or-centre-check policy plus explicit org-ownership verification
 * of every caller-supplied id. See
 * project-notes/milestone-3g-finance-audit.md, L2a.
 */
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
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(data.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }

    // Verify the centre belongs to this organisation
    const centreRecord = await db.query.centres.findFirst({
        where: and(eq(centres.id, data.centreId), eq(centres.organisationId, orgId)),
        columns: { id: true }
    });
    if (!centreRecord) throw new Error('Centre not found');

    // Verify the parent belongs to this organisation
    const parentRecord = await db.query.parents.findFirst({
        where: and(eq(parents.id, data.parentId), eq(parents.organisationId, orgId)),
        columns: { id: true }
    });
    if (!parentRecord) throw new Error('Parent not found');

    // Fetch child names for the description if multiple are selected — org-scoped
    const selectedChildren = data.childIds.length > 0
        ? await db.select().from(children).where(
            and(
                inArray(children.id, data.childIds),
                eq(children.organisationId, orgId),
                eq(children.parentId, data.parentId),
                eq(children.centreId, data.centreId),
                isNull(children.deletedAt)
            )
        )
        : [];
    if (selectedChildren.length !== data.childIds.length) {
        throw new Error('One or more children not found or do not belong to this family/centre');
    }

    const coveredChildren = selectedChildren.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

    // Check if the family has an existing recurring billing configuration for this centre
    const existingConfig = await db.query.billingConfigs.findFirst({
        where: and(
            eq(billingConfigs.parentId,       data.parentId),
            eq(billingConfigs.centreId,       data.centreId),
            eq(billingConfigs.organisationId, orgId),
        ),
        columns: { id: true, status: true },
    });

    const billingConfigId = existingConfig?.id || null;

    // Execute database operations atomically in a transaction
    const newInvoice = await db.transaction(async (tx) => {
        // If billingPeriodStart is provided, serialize concurrency via advisory lock
        if (data.billingPeriodStart) {
            const periodKey = data.billingPeriodStart.toISOString().split('T')[0];
            const lockKey = billingConfigId
                ? `billing_config:${billingConfigId}:${periodKey}`
                : `manual_invoice:${data.centreId}:${data.parentId}:${periodKey}`;
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

            // Check if active invoice already exists for this parent, centre, and period
            const existingActive = await tx.query.invoices.findFirst({
                where: and(
                    eq(invoices.organisationId,     orgId),
                    eq(invoices.centreId,           data.centreId),
                    eq(invoices.parentId,           data.parentId),
                    eq(invoices.billingPeriodStart, data.billingPeriodStart),
                    ne(invoices.status,             'void'),
                ),
            });

            if (existingActive) {
                throw new Error(`An active invoice already exists for this family and billing period (${periodKey})`);
            }
        }

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
            billingConfigId,
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
        }).catch(e => logger.error('[Email] Failed to send invoice created email:', e));
    }

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    if (data.parentId) {
        revalidatePath(`/dashboard/parents/${data.parentId}`);
    }
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
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(data.invoice.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }
    const centreRecord = await db.query.centres.findFirst({
        where: and(eq(centres.id, data.invoice.centreId), eq(centres.organisationId, orgId)),
        columns: { id: true }
    });
    if (!centreRecord) throw new Error('Centre not found');

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

        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/invoices');
        revalidatePath('/dashboard/parents');
        revalidatePath('/dashboard/students');
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
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(data.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }
    const centreRecord = await db.query.centres.findFirst({
        where: and(eq(centres.id, data.centreId), eq(centres.organisationId, orgId)),
        columns: { id: true }
    });
    if (!centreRecord) throw new Error('Centre not found');
    if (data.parentId) {
        const existingParent = await db.query.parents.findFirst({
            where: and(eq(parents.id, data.parentId), eq(parents.organisationId, orgId)),
            columns: { id: true }
        });
        if (!existingParent) throw new Error('Parent not found');
    }

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
        revalidatePath('/dashboard/finance/invoices');
        if (parentId) {
            revalidatePath(`/dashboard/parents/${parentId}`);
        }
        return newInvoice;
    });
}

export async function getInvoiceDetails(invoiceId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    // Milestone 3G, L2b: this read previously had no role or centre check —
    // only org scoping. Applying the same non-owner centre-check pattern
    // used by recordPayment/verifyPayment/etc for defense in depth, since
    // this is an independently-callable server action regardless of the
    // ORG_OWNER-only page that's currently the only UI surface reaching it.
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        const target = await db.query.invoices.findFirst({
            where: and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)),
            columns: { centreId: true }
        });
        if (!target || !accessibleCentreIds.includes(target.centreId)) {
            throw new Error('Unauthorized: No access to this centre');
        }
    }

    const result = await db.query.invoices.findFirst({
        where: and(
            eq(invoices.id, invoiceId),
            eq(invoices.organisationId, orgId)
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
    method: 'tax_free_childcare' | 'other' | 'cash' | 'bank_transfer' | 'stripe' | 'voucher' | 'gocardless';
    transactionReference?: string | null;
    recordedAt: Date;
}) {

    const session = await requireTenantSession();
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
        const invoice = await tx.query.invoices.findFirst({
            where: eq(invoices.id, data.invoiceId)
        });
        if (!invoice) throw new Error('Invoice not found');
        if (invoice.status === 'draft') throw new Error('Cannot record payment against a draft invoice. Issue the invoice first.');
        if (invoice.status === 'void') throw new Error('Cannot record payment against a voided invoice.');

        // 1. Insert payment record
        const [newPayment] = await tx.insert(paymentsTable).values({
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            transactionReference: data.transactionReference,
            recordedAt: data.recordedAt,
        }).returning();

        // 2. Recalculate invoice status
        await recalculateInvoiceStatus(tx, data.invoiceId);

        // Check for overpayment warning
        const allPayments = await tx.query.payments.findMany({
            where: eq(paymentsTable.invoiceId, data.invoiceId),
            columns: { status: true, amount: true }
        });
        const totalVerified = allPayments
            .filter((p: any) => p.status === 'verified')
            .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const isOverpaid = totalVerified > Number(invoice.amount);

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId!,
            userId: session.user.id!,
            eventType: 'payment_recorded',
            eventData: JSON.stringify({
                invoiceId: data.invoiceId,
                paymentId: newPayment.id,
                amount: data.amount,
                method: data.method,
                warning: isOverpaid ? 'Payment resulted in overpayment.' : undefined
            })
        });

        return { ...newPayment, parentId: invoice.parentId };
    });

    revalidatePath(`/dashboard/finance/invoices/${data.invoiceId}`);
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    if (result.parentId) {
        revalidatePath(`/dashboard/parents/${result.parentId}`);
    }

    // In-app notification: payment recorded (fire-and-forget)
    notifyOwners({
        orgId,
        type: 'system',
        title: 'Payment Recorded',
        message: `A £${Number(data.amount).toFixed(2)} payment (${data.method.replace('_', ' ')}) has been recorded.`,
    }).catch(() => {});

    // Send receipt email after successful payment (non-blocking)
    try {
        const { organisations } = await import('@/db/schema');
        const invoiceRecord = await db.query.invoices.findFirst({
            where: eq(invoices.id, data.invoiceId),
            with: { parent: true }
        });
        const orgRecord = await db.query.organisations.findFirst({
            where: eq(organisations.id, orgId)
        });

        if (invoiceRecord?.parent?.email) {
            await emailService.sendPaymentReceiptEmail({
                parentEmail: invoiceRecord.parent.email,
                parentName: invoiceRecord.parent.firstName,
                invoiceNumber: invoiceRecord.invoiceNumber,
                paymentId: result.id,
                amountPaid: Number(data.amount),
                organisationName: orgRecord?.name || 'Our Centre',
                invoiceId: data.invoiceId
            });
        }
    } catch (err) {
        logger.error('[recordPayment] Failed to send receipt email:', err);
    }

    return result;
}

export async function updateInvoiceDate(invoiceId: string, newInvoiceDate: Date) {
    const session = await requireTenantSession();
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
    revalidatePath('/dashboard/finance/invoices');
    return result;
}

export async function updateInvoiceNotes(invoiceId: string, notes: string | null) {
    const session = await requireTenantSession();
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
    revalidatePath('/dashboard/finance/invoices');
    return result;
}

export async function deleteInvoice(invoiceId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owner can delete invoices');

    const result = await db.transaction(async (tx) => {
        const invoice = await tx.query.invoices.findFirst({
            where: eq(invoices.id, invoiceId),
            with: { payments: true }
        });

        if (!invoice) throw new Error('Invoice not found');
        if (invoice.organisationId !== session.user.organisationId) throw new Error('Unauthorized');

        if (invoice.status !== 'draft') {
            throw new Error('Only draft invoices can be deleted. Use voidInvoice instead.');
        }

        if (invoice.payments && invoice.payments.length > 0) {
            throw new Error('Cannot delete this draft because payment records are associated with it. Review the payment records before continuing.');
        }

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId,
            userId: session.user.id,
            eventType: 'invoice_deleted',
            eventData: JSON.stringify({ invoiceId })
        });

        await tx.delete(invoices).where(eq(invoices.id, invoiceId));
        return invoice;
    });

    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    if (result.parentId) {
        revalidatePath(`/dashboard/parents/${result.parentId}`);
    }

    return { success: true };
}

export async function voidInvoice(invoiceId: string) {
    const session = await requireTenantSession();
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

        // Count verified payments — these block void
        const verifiedPayments = await tx.query.payments.findMany({
            where: and(
                eq(payments.invoiceId, invoiceId),
                eq(payments.status, 'verified')
            ),
            columns: { id: true, amount: true },
        });
        if (verifiedPayments.length > 0) {
            const verifiedTotal = verifiedPayments.reduce((s, p) => s + Number(p.amount), 0);
            throw new Error(
                `This invoice has ${verifiedPayments.length} verified payment(s) totalling £${verifiedTotal.toFixed(2)}. ` +
                `Reverse the verified payments before voiding this invoice.`
            );
        }

        // Section 11 / Critic Policy: Pending payments represent unresolved financial activity
        // (e.g. parent voucher submissions in flight). Block void until staff accept or reject them.
        const pendingPayments = await tx.query.payments.findMany({
            where: and(
                eq(payments.invoiceId, invoiceId),
                eq(payments.status, 'pending')
            ),
            columns: { id: true, amount: true },
        });
        if (pendingPayments.length > 0) {
            const pendingTotal = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);
            throw new Error(
                `This invoice has ${pendingPayments.length} pending payment(s) totalling £${pendingTotal.toFixed(2)}. ` +
                `Please verify or reject pending payments before voiding this invoice.`
            );
        }

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
    revalidatePath('/dashboard/finance/invoices');
    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    if (invoice.parentId) {
        revalidatePath(`/dashboard/parents/${invoice.parentId}`);
    }

    return { success: true };
}

export async function verifyPayment(paymentId: string) {
    const session = await requireTenantSession();
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

        // 3. Recalculate invoice status
        await recalculateInvoiceStatus(tx, payment.invoiceId);

        // Fetch verified total for email notification
        const allInvoicePayments = await tx.query.payments.findMany({
            where: eq(payments.invoiceId, payment.invoiceId),
            columns: { status: true, amount: true }
        });
        const totalVerified = allInvoicePayments
            .filter((p: any) => p.status === 'verified')
            .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

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
            }).catch(e => logger.error('[Email] Failed to send voucher verified email:', e));
        }

        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/invoices');
        revalidatePath(`/dashboard/finance/invoices/${payment.invoiceId}`);
        if (payment.invoice.parentId) {
            revalidatePath(`/dashboard/parents/${payment.invoice.parentId}`);
        }
        return { success: true };
    });
}

export async function failPayment(paymentId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    return await db.transaction(async (tx) => {
        const payment = await tx.query.payments.findFirst({
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

        // SAFE approach: We allow failing both 'pending' and 'verified' (existing behavior),
        // but typically it should be used for pending payments. Reversal is preferred for verified.
        // We ensure recalculation runs regardless.
        await tx.update(payments)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(payments.id, paymentId));

        await recalculateInvoiceStatus(tx, payment.invoiceId);

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId!,
            userId: session.user.id!,
            eventType: 'payment_failed',
            eventData: JSON.stringify({ paymentId, invoiceId: payment.invoiceId, amount: payment.amount, previousStatus: payment.status })
        });

        // Send email notification to parent (fire-and-forget)
        const parentRecord = await tx.query.parents.findFirst({ where: eq(parents.id, payment.invoice.parentId), columns: { firstName: true, email: true } });
        if (parentRecord?.email) {
            emailService.sendVoucherPaymentFailed({
                parentFirstName: parentRecord.firstName,
                parentEmail: parentRecord.email,
                invoiceNumber: payment.invoice.invoiceNumber,
                amount: Number(payment.amount),
                portalUrl: `${process.env.NEXTAUTH_URL || ''}/portal/billing`,
            }).catch(e => logger.error('[Email] Failed to send voucher failed email:', e));
        }

        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/invoices');
        revalidatePath(`/dashboard/finance/invoices/${payment.invoiceId}`);
        if (payment.invoice.parentId) {
            revalidatePath(`/dashboard/parents/${payment.invoice.parentId}`);
        }
        return { success: true };
    });
}

export async function reversePayment(
    paymentId: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length > 500) {
        throw new Error('Invalid reason for reversal.');
    }

    return await db.transaction(async (tx) => {
        const payment = await tx.query.payments.findFirst({
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
            if (userRole !== 'MANAGER') {
                throw new Error('Unauthorized');
            }
        }

        if (payment.status !== 'verified') {
            throw new Error('This payment has already been corrected or is not eligible for reversal.');
        }

        const [updated] = await tx.update(payments)
            .set({ status: 'reversed', reversalReason: trimmedReason, reversedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(payments.id, paymentId), eq(payments.status, 'verified')))
            .returning({ id: payments.id });

        if (!updated) {
            throw new Error('This payment has already been corrected or is not eligible for reversal.');
        }

        if (payment.invoice.status !== 'void') {
            await recalculateInvoiceStatus(tx, payment.invoiceId);
        }

        await tx.insert(auditEvents).values({
            organisationId: session.user.organisationId,
            userId: session.user.id,
            eventType: 'payment_reversed',
            eventData: JSON.stringify({
                paymentId,
                invoiceId: payment.invoiceId,
                invoiceNumber: payment.invoice.invoiceNumber,
                amount: payment.amount,
                method: payment.method,
                reason: trimmedReason,
                previousStatus: 'verified',
                invoiceWasVoid: payment.invoice.status === 'void',
            })
        });

        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/finance/invoices');
        revalidatePath(`/dashboard/finance/invoices/${payment.invoiceId}`);
        if (payment.invoice.parentId) {
            revalidatePath(`/dashboard/parents/${payment.invoice.parentId}`);
        }
        return { success: true };
    });
}

// ─── Resend Invoice Email ───────────────────────────────────────────────────

/**
 * Manually resend the invoice notification email to the parent.
 * Only allowed for invoices that are not already paid or voided.
 */
export async function resendInvoiceEmail(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) return { success: false, error: 'Unauthorized' };
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return { success: false, error: 'Insufficient permissions' };
    }

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
    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!invoice.centreId || !accessibleCentreIds.includes(invoice.centreId)) {
            return { success: false, error: 'Unauthorized: No access to this centre' };
        }
    }
    if (invoice.status === 'paid') return { success: false, error: 'This invoice is already marked as paid.' };
    if (invoice.status === 'void') return { success: false, error: 'Cannot send a voided invoice.' };
    if (invoice.status === 'draft') return { success: false, error: 'Cannot resend a draft invoice — use Issue Invoice to dispatch.' };

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

// ─── Category B: Draft Invoice Lifecycle Actions ─────────────────────────────

/**
 * Transition a draft invoice to 'sent' (issued) status (§13, B1).
 * Idempotent, enforced with row-locking, checks amount > 0 and dueDate,
 * updates status, logs audit event, and dispatches email/notifications.
 */
export async function issueDraftInvoice(invoiceId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    // RBAC: Manager or Owner
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Unauthorized: Only Managers and Owners can issue draft invoices');
    }

    // Inside transaction with row locking
    const result = await db.transaction(async (tx) => {
        const [invoice] = await tx.select()
            .from(invoices)
            .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)))
            .for('update');

        if (!invoice) throw new Error('Invoice not found');

        // Centre access check
        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(invoice.centreId)) {
                throw new Error('Unauthorized: No access to this centre');
            }
        }

        // Idempotency: if already sent/partially_paid/paid, return success without re-issuing
        if (invoice.status === 'sent' || invoice.status === 'partially_paid' || invoice.status === 'paid') {
            return { alreadyIssued: true, invoice };
        }

        if (invoice.status !== 'draft') {
            throw new Error(`Cannot issue invoice: Status is ${invoice.status}`);
        }

        const numAmount = Number(invoice.amount);
        if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
            throw new Error('Invoice cannot be issued without a valid amount greater than zero');
        }

        if (!invoice.dueDate) {
            throw new Error('Invoice cannot be issued without a due date');
        }

        const [updated] = await tx.update(invoices)
            .set({ status: 'sent', updatedAt: new Date() })
            .where(eq(invoices.id, invoiceId))
            .returning();

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'invoice_issued',
            eventData: JSON.stringify({
                invoiceId,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                issuedBy: session.user.id,
            }),
        });

        return { alreadyIssued: false, invoice: updated };
    });

    if (!result.alreadyIssued) {
        // Fire-and-forget email notification
        try {
            const parent = await db.query.parents.findFirst({
                where: eq(parents.id, result.invoice.parentId),
                columns: { firstName: true, email: true },
            });
            const centre = await db.query.centres.findFirst({
                where: eq(centres.id, result.invoice.centreId),
                columns: { name: true },
            });

            if (parent?.email) {
                emailService.sendInvoiceCreated({
                    parentFirstName: parent.firstName,
                    parentEmail: parent.email,
                    invoiceNumber: result.invoice.invoiceNumber,
                    amount: Number(result.invoice.amount),
                    dueDate: result.invoice.dueDate,
                    centreName: centre?.name || 'the centre',
                    portalUrl: `${process.env.NEXTAUTH_URL || ''}/portal/billing`,
                }).catch(e => logger.error('[Email] Failed to send issued invoice email:', e));
            }
        } catch (err) {
            logger.error('[issueDraftInvoice] Email dispatch failed:', err);
        }

        // Fire-and-forget portal notification
        try {
            await db.insert(portalNotifications).values({
                parentId: result.invoice.parentId,
                organisationId: orgId,
                type: 'invoice_issued',
                title: `Invoice ${result.invoice.invoiceNumber} Issued`,
                body: `An invoice for £${Number(result.invoice.amount).toFixed(2)} has been issued and is due on ${result.invoice.dueDate ? new Date(result.invoice.dueDate).toISOString().split('T')[0] : ''}.`,
                href: '/portal/billing',
            });
        } catch (err) {
            logger.error('[issueDraftInvoice] Portal notification failed:', err);
        }
    }

    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    return { success: true, alreadyIssued: result.alreadyIssued, invoiceId: result.invoice.id };
}

export interface UpdateDraftInvoiceData {
    amount?: string | number;
    dueDate?: Date;
    invoiceDate?: Date;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    billingPeriodLabel?: string;
    notes?: string | null;
    childIds?: string[];
}

/**
 * Edit fields of a draft invoice before issuance (§14, B2).
 * Strictly guards against modifying issued or void invoices.
 */
export async function updateDraftInvoice(invoiceId: string, data: UpdateDraftInvoiceData) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Unauthorized: Only Managers and Owners can edit draft invoices');
    }

    const updated = await db.transaction(async (tx) => {
        const [invoice] = await tx.select()
            .from(invoices)
            .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)))
            .for('update');

        if (!invoice) throw new Error('Invoice not found');

        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(invoice.centreId)) {
                throw new Error('Unauthorized: No access to this centre');
            }
        }

        if (invoice.status !== 'draft') {
            throw new Error(`Invoice cannot be edited after issuance. Status: ${invoice.status}`);
        }

        let coveredChildrenJson = invoice.coveredChildrenJson;
        if (data.childIds !== undefined) {
            if (data.childIds.length > 0) {
                const validChildren = await tx.select()
                    .from(children)
                    .where(
                        and(
                            inArray(children.id, data.childIds),
                            eq(children.organisationId, orgId),
                            eq(children.parentId, invoice.parentId),
                            eq(children.centreId, invoice.centreId),
                            isNull(children.deletedAt),
                        )
                    );
                if (validChildren.length !== data.childIds.length) {
                    throw new Error('One or more children not found or do not belong to this family/centre');
                }
                coveredChildrenJson = validChildren.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
            } else {
                coveredChildrenJson = [];
            }
        }

        const updateSet: Record<string, any> = { updatedAt: new Date() };
        if (data.amount !== undefined) {
            const num = Number(data.amount);
            if (isNaN(num) || num < 0) throw new Error('Invalid invoice amount');
            updateSet.amount = num.toFixed(2);
        }
        if (data.dueDate !== undefined) updateSet.dueDate = data.dueDate;
        if (data.invoiceDate !== undefined) updateSet.invoiceDate = data.invoiceDate;
        if (data.billingPeriodStart !== undefined) updateSet.billingPeriodStart = data.billingPeriodStart;
        if (data.billingPeriodEnd !== undefined) updateSet.billingPeriodEnd = data.billingPeriodEnd;
        if (data.billingPeriodLabel !== undefined) updateSet.billingPeriodLabel = data.billingPeriodLabel;
        if (data.notes !== undefined) updateSet.notes = data.notes;
        if (data.childIds !== undefined) updateSet.coveredChildrenJson = coveredChildrenJson;

        const [res] = await tx.update(invoices)
            .set(updateSet)
            .where(eq(invoices.id, invoiceId))
            .returning();

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'invoice_draft_updated',
            eventData: JSON.stringify({
                invoiceId,
                updatedFields: Object.keys(data),
            }),
        });

        return res;
    });

    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    return { success: true, invoice: updated };
}

/**
 * Discard a draft invoice before issuance (§18, B3).
 * Marks invoice as 'void' and marks linked billingRuns row as success=false
 * so the period can be legitimately regenerated if desired.
 */
export async function discardDraftInvoice(invoiceId: string) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');
    const orgId = session.user.organisationId;

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Unauthorized: Only Managers and Owners can discard draft invoices');
    }

    const result = await db.transaction(async (tx) => {
        const [invoice] = await tx.select()
            .from(invoices)
            .where(and(eq(invoices.id, invoiceId), eq(invoices.organisationId, orgId)))
            .for('update');

        if (!invoice) throw new Error('Invoice not found');

        if (userRole !== 'ORG_OWNER') {
            const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
            if (!accessibleCentreIds.includes(invoice.centreId)) {
                throw new Error('Unauthorized: No access to this centre');
            }
        }

        if (invoice.status !== 'draft') {
            throw new Error(`Only draft invoices can be discarded. Status: ${invoice.status}`);
        }

        // Verify zero payments
        const paymentCount = await tx.select({ count: sql<number>`count(*)` })
            .from(payments)
            .where(eq(payments.invoiceId, invoiceId));
        if (Number(paymentCount[0]?.count ?? 0) > 0) {
            throw new Error('Cannot discard invoice with associated payments');
        }

        // If invoice was created from a billing config, mark the billingRun as success=false
        // and null the invoiceId pointer so no dangling pointer remains (§18, Issue A)
        if (invoice.billingConfigId) {
            await tx.update(billingRuns)
                .set({
                    success: false,
                    errorLog: `Draft discarded by user ${session.user.id}`,
                    invoiceId: null,
                })
                .where(eq(billingRuns.invoiceId, invoiceId));
        }

        // Delete the unissued draft invoice so it does not pollute the financial ledger with artificial voided obligations (Issue A)
        await tx.delete(invoices)
            .where(eq(invoices.id, invoiceId));

        await tx.insert(auditEvents).values({
            organisationId: orgId,
            userId: session.user.id,
            eventType: 'invoice_draft_discarded',
            eventData: JSON.stringify({
                invoiceId,
                invoiceNumber: invoice.invoiceNumber,
                discardedBy: session.user.id,
            }),
        });

        return { centreId: invoice.centreId, billingConfigId: invoice.billingConfigId };
    });

    revalidatePath(`/dashboard/finance/invoices/${invoiceId}`);
    revalidatePath('/dashboard/finance');
    revalidatePath('/dashboard/finance/invoices');
    if (result?.centreId && result?.billingConfigId) {
        revalidatePath(`/dashboard/centres/${result.centreId}/billing`);
    }
    return { success: true };
}
