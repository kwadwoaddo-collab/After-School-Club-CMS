'use server';
import { logger } from '@/lib/logger';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centreAvailabilityRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { canUserAccessCentre } from '@/lib/permissions';

export type DayRule = {
    dayOfWeek: number;
    isOpen: boolean;
    startTime: string;
    endTime: string;
};

export async function updateAvailability(centreId: string, rules: DayRule[]) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    const hasAccess = await canUserAccessCentre(session.user.id, centreId);
    if (!hasAccess) {
        throw new Error('Unauthorized access to this centre');
    }

    try {
        // Transaction: Delete all existing rules for this centre and re-insert active ones
        await db.transaction(async (tx) => {
            // 1. Delete existing
            await tx
                .delete(centreAvailabilityRules)
                .where(eq(centreAvailabilityRules.centreId, centreId));

            // 2. Insert new
            const activeRules = rules
                .filter(r => r.isOpen)
                .map(r => ({
                    centreId,
                    dayOfWeek: r.dayOfWeek,
                    startTime: r.startTime,
                    endTime: r.endTime,
                }));

            if (activeRules.length > 0) {
                await tx.insert(centreAvailabilityRules).values(activeRules);
            }
        });

        revalidatePath('/dashboard/availability');
        revalidatePath(`/dashboard/availability/${centreId}`);

        return { success: true };
    } catch (error) {
        logger.error('Failed to update availability:', error);
        return { success: false, error: 'Failed to update settings' };
    }
}
