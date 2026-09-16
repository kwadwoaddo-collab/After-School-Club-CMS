/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { requireTenantSession } from '@/lib/session';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export async function updateCentreAction(centreId: string, data: any) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Forbidden: Insufficient privileges.');
    }

    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(centreId)) {
            throw new Error('Forbidden: You do not have access to this centre.');
        }
    }

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
