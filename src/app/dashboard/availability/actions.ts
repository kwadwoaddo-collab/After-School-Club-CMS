'use server';
import { logger } from '@/lib/logger';

import { requireTenantSession } from '@/lib/session';
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

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function updateAvailability(centreId: string, rules: DayRule[]) {
    const session = await requireTenantSession();
    if (!session?.user?.id || !session.user.organisationId) {
        throw new Error('Unauthorized');
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Forbidden: Only Managers and Owners can update availability');
    }

    const hasAccess = await canUserAccessCentre(session.user.id, centreId);
    if (!hasAccess) {
        throw new Error('Unauthorized access to this centre');
    }

    if (!Array.isArray(rules) || rules.length > 14) {
        return { success: false, error: 'Invalid availability rules' };
    }

    for (const r of rules) {
        if (
            !r ||
            !Number.isInteger(r.dayOfWeek) ||
            r.dayOfWeek < 0 ||
            r.dayOfWeek > 6 ||
            typeof r.isOpen !== 'boolean'
        ) {
            return { success: false, error: 'Invalid availability rule structure' };
        }
        if (r.isOpen) {
            if (
                typeof r.startTime !== 'string' ||
                typeof r.endTime !== 'string' ||
                !HH_MM_RE.test(r.startTime) ||
                !HH_MM_RE.test(r.endTime) ||
                r.startTime >= r.endTime
            ) {
                return {
                    success: false,
                    error: 'Start time and end time must be valid HH:MM times with start time earlier than end time',
                };
            }
        }
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
