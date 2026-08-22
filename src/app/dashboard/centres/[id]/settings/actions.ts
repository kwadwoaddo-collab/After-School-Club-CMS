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

    // Milestone 3D: this server action is independently callable regardless
    // of which role the Settings page itself renders for — a page-level
    // gate does not protect it. It previously had no role check at all.
    // Fixed to match the page's own ['ORG_OWNER','MANAGER'] gate as the
    // floor, plus an ORG_OWNER-only re-check on the bank-detail fields
    // specifically, matching the two other write paths for these same
    // columns (updateCentreBilling's explicit "Only Owners can update
    // billing settings" check, and api/centres/[id]/route.ts's identical
    // isUpdatingBilling re-check) — see project-notes/milestone-3d-centres-audit.md §5.
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Forbidden: Insufficient privileges.');
    }

    const isUpdatingBankDetails =
        data.bankName !== undefined || data.sortCode !== undefined || data.accountNo !== undefined;
    if (isUpdatingBankDetails && userRole !== 'ORG_OWNER') {
        throw new Error('Only Owners can update billing settings');
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
