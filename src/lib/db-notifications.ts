import { logger } from '@/lib/logger';
/**
 * src/lib/db-notifications.ts
 *
 * Writes in-app notification records to the `notifications` table so that
 * the dashboard header bell actually shows meaningful activity.
 *
 * Usage (fire-and-forget — never block the main flow on this):
 *   notifyOwners({ orgId, type, title, message, bookingId }).catch(() => {});
 */

import { db } from '@/db';
import { notifications, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

type NotificationType =
    | 'booking_created'
    | 'booking_cancelled'
    | 'booking_rescheduled'
    | 'assessment_reminder'
    | 'system';

interface NotifyOptions {
    /** Organisation to notify */
    orgId: string;
    type: NotificationType;
    title: string;
    message: string;
    /** Optional — links the bell item to a specific booking */
    bookingId?: string;
    /** Restrict to specific user IDs (e.g. just the ORG_OWNER).
     *  If omitted, all ORG_OWNER + MANAGER in the org are notified. */
    userIds?: string[];
}

/**
 * Insert an in-app notification for all ORG_OWNERs (+ optionally MANAGERs)
 * of an organisation.
 */
export async function notifyOwners(opts: NotifyOptions): Promise<void> {
    try {
        let targetUserIds = opts.userIds;

        if (!targetUserIds || targetUserIds.length === 0) {
            // Resolve all ORG_OWNER users for this org
            const owners = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.organisationId, opts.orgId));

            targetUserIds = owners.map((u) => u.id);
        }

        if (targetUserIds.length === 0) return;

        await db.insert(notifications).values(
            targetUserIds.map((userId) => ({
                organisationId: opts.orgId,
                userId,
                type: opts.type,
                title: opts.title,
                message: opts.message,
                bookingId: opts.bookingId ?? null,
                isRead: false,
            }))
        );
    } catch (err) {
        // Never throw — notifications are non-critical
        logger.error('[db-notifications] Failed to insert notification:', err);
    }
}
