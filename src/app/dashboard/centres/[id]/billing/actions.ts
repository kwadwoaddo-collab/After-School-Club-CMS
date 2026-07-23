'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export interface CentreBillingPayload {
    centreId: string;
    bankName: string;
    sortCode: string;
    accountNo: string;
    ofstedId: string;
    managerName: string;
    billingPhone: string;
    billingEmail: string;
    address: string;
}

const billingSchema = z.object({
    centreId: z.string().uuid('Invalid centre ID format'),
    bankName: z.string().trim().max(100, 'Bank name must be under 100 characters'),
    sortCode: z.string()
        .transform(val => val.replace(/[-\s]/g, ''))
        .refine(val => val === '' || /^\d{6}$/.test(val), {
            message: 'Sort code must be exactly 6 digits (e.g. 20-00-00 or 200000)'
        }),
    accountNo: z.string()
        .transform(val => val.replace(/[-\s]/g, ''))
        .refine(val => val === '' || /^\d{8}$/.test(val), {
            message: 'Account number must be exactly 8 digits'
        }),
    ofstedId: z.string().trim().max(50, 'Ofsted ID must be under 50 characters'),
    managerName: z.string().trim().max(100, 'Manager name must be under 100 characters'),
    billingPhone: z.string().trim().max(20, 'Billing phone must be under 20 characters'),
    billingEmail: z.string()
        .transform(val => val.trim())
        .refine(val => val === '' || z.string().email().safeParse(val).success, {
            message: 'Invalid email format'
        }),
    address: z.string().trim().max(500, 'Address must be under 500 characters'),
});

export async function updateCentreBilling(payload: CentreBillingPayload) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owners can update billing settings');

    const parsed = billingSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message);
    }
    const data = parsed.data;

    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');

    // Verify the centre belongs to this org
    const centre = await db.query.centres.findFirst({
        where: and(
            eq(centres.id, data.centreId),
            eq(centres.organisationId, orgId)
        ),
        columns: { id: true },
    });
    if (!centre) throw new Error('Centre not found');

    await db.update(centres)
        .set({
            bankName: data.bankName || null,
            sortCode: data.sortCode || null,
            accountNo: data.accountNo || null,
            ofstedId: data.ofstedId || null,
            managerName: data.managerName || null,
            billingPhone: data.billingPhone || null,
            billingEmail: data.billingEmail || null,
            address: data.address || null,
            updatedAt: new Date(),
        })
        .where(eq(centres.id, data.centreId));

    revalidatePath(`/dashboard/centres/${data.centreId}/billing`);
    revalidatePath('/dashboard/centres');
    return { success: true };
}
