import 'server-only';
import { db } from '@/db';
import { parents, portalNotifications } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export interface CreateRegistrationNotificationParams {
  parentId: string;
  organisationId: string;
  status: 'approved' | 'rejected';
  childName: string;
  registrationId: string;
}

/**
 * Server-only helper that records an in-app Parent Portal registration status notification.
 * Verifies that `parentId` is an active (non-deleted) parent belonging to `organisationId`
 * before inserting, preventing cross-tenant notification injection (IDOR).
 */
export async function createRegistrationNotification({
  parentId,
  organisationId,
  status,
  childName,
}: CreateRegistrationNotificationParams): Promise<{ ok: boolean; error?: string }> {
  if (!parentId || !organisationId) {
    return { ok: false, error: 'Missing parent or organisation context' };
  }

  const parent = await db.query.parents.findFirst({
    where: and(
      eq(parents.id, parentId),
      eq(parents.organisationId, organisationId),
      isNull(parents.deletedAt),
    ),
    columns: {
      id: true,
      organisationId: true,
    },
  });

  if (!parent || parent.organisationId !== organisationId) {
    return { ok: false, error: 'Parent does not belong to organisation' };
  }

  await db.insert(portalNotifications).values({
    parentId: parent.id,
    organisationId,
    type: status === 'approved' ? 'registration_approved' : 'registration_rejected',
    title: status === 'approved' ? 'Registration Approved ✓' : 'Registration Update',
    body:
      status === 'approved'
        ? `${childName}'s registration has been approved. Welcome aboard!`
        : `${childName}'s registration requires further information.`,
    href: '/portal',
  });

  return { ok: true };
}
