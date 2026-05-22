'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export interface CentreBillingPayload {
    centreId: string;
    bankName: string;
    sortCode: string;
    accountNo: string;
    ofstedId: string;
    managerName: string;
    billingPhone: string;
    billingEmail: string;
}

export async function updateCentreBilling(payload: CentreBillingPayload) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owners can update billing settings');

    const orgId = (session.user as any).organisationId as string | undefined;
    if (!orgId) throw new Error('No organisation found');

    // Verify the centre belongs to this org
    const centre = await db.query.centres.findFirst({
        where: and(
            eq(centres.id, payload.centreId),
            eq(centres.organisationId, orgId)
        ),
        columns: { id: true },
    });
    if (!centre) throw new Error('Centre not found');

    await db.update(centres)
        .set({
            bankName: payload.bankName || null,
            sortCode: payload.sortCode || null,
            accountNo: payload.accountNo || null,
            ofstedId: payload.ofstedId || null,
            managerName: payload.managerName || null,
            billingPhone: payload.billingPhone || null,
            billingEmail: payload.billingEmail || null,
            updatedAt: new Date(),
        })
        .where(eq(centres.id, payload.centreId));

    revalidatePath(`/dashboard/centres/${payload.centreId}/billing`);
    revalidatePath('/dashboard/centres');
    return { success: true };
}
