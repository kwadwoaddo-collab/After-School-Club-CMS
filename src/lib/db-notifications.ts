import { logger } from '@/lib/logger';
/**
 * src/lib/db-notifications.ts
 *
 * Writes in-app notification records to the `notifications` table so that
 * the dashboard header bell actually shows meaningful activity.
 *
 * Usage (fire-and-forget — never block the main flow on this):
 *   notifyOwners({ orgId, centreId, type, title, message, bookingId }).catch(() => {});
 */

import { db } from '@/db';
import { notifications, orgMemberships, centreMemberships } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

type NotificationType =
    | 'booking_created'
    | 'booking_cancelled'
    | 'booking_rescheduled'
    | 'assessment_reminder'
    | 'system';

export interface NotifyOptions {
    /** Organisation to notify */
    orgId: string;
    /** Optional centre scope — restricts MANAGER recipients to those assigned to this centre */
    centreId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    /** Optional — links the bell item to a specific booking */
    bookingId?: string;
    /** Restrict to specific user IDs (e.g. just the ORG_OWNER).
     *  If omitted, ORG_OWNER + eligible MANAGER recipients in the org are notified. */
    userIds?: string[];
}

/**
 * Insert an in-app notification for ORG_OWNERs and eligible MANAGERs
 * of an organisation via authoritative `orgMemberships` (never broadcasting
 * operational/medical/finance alerts to TUTOR or FRONT_DESK accounts).
 */
export async function notifyOwners(opts: NotifyOptions): Promise<void> {
    try {
        let targetUserIds = opts.userIds;

        if (!targetUserIds || targetUserIds.length === 0) {
            const members = await db
                .select({
                    userId: orgMemberships.userId,
                    role: orgMemberships.role,
                })
                .from(orgMemberships)
                .where(
                    and(
                        eq(orgMemberships.organisationId, opts.orgId),
                        inArray(orgMemberships.role, ['ORG_OWNER', 'MANAGER'])
                    )
                );

            const ownerIds = members
                .filter((m) => m.role === 'ORG_OWNER')
                .map((m) => m.userId);
            let managerIds = members
                .filter((m) => m.role === 'MANAGER')
                .map((m) => m.userId);

            if (opts.centreId && managerIds.length > 0) {
                const assignedManagers = await db
                    .select({ userId: centreMemberships.userId })
                    .from(centreMemberships)
                    .where(
                        and(
                            eq(centreMemberships.centreId, opts.centreId),
                            inArray(centreMemberships.userId, managerIds)
                        )
                    );
                const assignedSet = new Set(assignedManagers.map((m) => m.userId));
                managerIds = managerIds.filter((id) => assignedSet.has(id));
            }

            targetUserIds = Array.from(new Set([...ownerIds, ...managerIds]));
        } else {
            targetUserIds = Array.from(new Set(targetUserIds));
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
