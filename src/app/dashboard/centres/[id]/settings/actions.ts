/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateCentreAction(centreId: string, data: any) {
    const session = await auth();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    await db
        .update(centres)
        .set({
            name: data.name,
            address: data.address,
            ofstedId: data.ofstedId,
            sessionSlots: data.sessionSlots ? JSON.stringify(data.sessionSlots) : null,
            // Billing fields if provided
            bankName: data.bankName,
            sortCode: data.sortCode,
            accountNo: data.accountNo,
            feeSelfFinance: data.feeSelfFinance,
            feeAssistedFinance: data.feeAssistedFinance,
        })
        .where(
            and(
                eq(centres.id, centreId),
                eq(centres.organisationId, session.user.organisationId)
            )
        );

    revalidatePath('/dashboard/centres');
    revalidatePath(`/dashboard/centres/${centreId}/settings`);
    
    return { success: true };
}
