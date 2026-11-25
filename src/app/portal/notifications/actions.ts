'use server';
import { db } from '@/db';
import { parents, portalNotifications } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { getCurrentParent } from '@/lib/parent-auth';
import {
  createRegistrationNotification as createServerRegistrationNotification,
  type CreateRegistrationNotificationParams,
} from '@/lib/parent-notifications';

const ALLOWED_NOTIFICATION_STAFF_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] as const;

async function requireStaffPortalNotificationAccess(): Promise<
  | { ok: true; organisationId: string }
  | { ok: false; error: string }
> {
  const { getApiSession } = await import('@/lib/session');
  const session = await getApiSession();
  if (!session?.user?.id || !session.user.organisationId) {
    return { ok: false, error: 'Unauthorised' };
  }

  const role = session.user.role as string | undefined;
  if (!role || !(ALLOWED_NOTIFICATION_STAFF_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: 'Forbidden' };
  }

  return { ok: true, organisationId: session.user.organisationId };
}

export async function getNotifications() {
  const parent = await getCurrentParent();
  if (!parent?.id) return [];

  const scopeFilter = parent.organisationId
    ? and(
        eq(portalNotifications.parentId, parent.id),
        eq(portalNotifications.organisationId, parent.organisationId),
      )
    : eq(portalNotifications.parentId, parent.id);

  return db
    .select()
    .from(portalNotifications)
    .where(scopeFilter)
    .orderBy(desc(portalNotifications.createdAt))
    .limit(20);
}

export async function markAllRead() {
  const parent = await getCurrentParent();
  if (!parent?.id) return;

  const scopeFilter = parent.organisationId
    ? and(
        eq(portalNotifications.parentId, parent.id),
        eq(portalNotifications.organisationId, parent.organisationId),
        isNull(portalNotifications.readAt),
      )
    : and(
        eq(portalNotifications.parentId, parent.id),
        isNull(portalNotifications.readAt),
      );

  await db
    .update(portalNotifications)
    .set({ readAt: new Date() })
    .where(scopeFilter);
}

export async function markRead(notificationId: string) {
  const parent = await getCurrentParent();
  if (!parent?.id) return;

  const scopeFilter = parent.organisationId
    ? and(
        eq(portalNotifications.id, notificationId),
        eq(portalNotifications.parentId, parent.id),
        eq(portalNotifications.organisationId, parent.organisationId),
      )
    : and(
        eq(portalNotifications.id, notificationId),
        eq(portalNotifications.parentId, parent.id),
      );

  await db
    .update(portalNotifications)
    .set({ readAt: new Date() })
    .where(scopeFilter);
}

/**
 * Staff-authenticated Server Action wrapper for registration notifications.
 * Enforces `ORG_OWNER` / `MANAGER` / `FRONT_DESK` RBAC AND verifies that `parentId`
 * belongs to `session.user.organisationId` before creating any notification.
 * Internal server modules should prefer `@/lib/parent-notifications`.
 */
export async function createRegistrationNotification(
  params: CreateRegistrationNotificationParams,
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireStaffPortalNotificationAccess();
  if (!access.ok) {
    return access;
  }

  if (params.organisationId !== access.organisationId) {
    return { ok: false, error: 'Forbidden' };
  }

  const parent = await db.query.parents.findFirst({
    where: and(
      eq(parents.id, params.parentId),
      isNull(parents.deletedAt),
    ),
    columns: { id: true, organisationId: true },
  });

  if (!parent || parent.organisationId !== access.organisationId) {
    return { ok: false, error: 'Forbidden' };
  }

  return createServerRegistrationNotification({
    ...params,
    organisationId: access.organisationId,
  });
}
