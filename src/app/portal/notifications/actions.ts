'use server';
import { db } from '@/db';
import { portalNotifications } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { getCurrentParent } from '@/lib/parent-auth';

export async function getNotifications() {
  const parent = await getCurrentParent();
  if (!parent?.id) return [];
  
  return db
    .select()
    .from(portalNotifications)
    .where(eq(portalNotifications.parentId, parent.id))
    .orderBy(desc(portalNotifications.createdAt))
    .limit(20);
}

export async function markAllRead() {
  const parent = await getCurrentParent();
  if (!parent?.id) return;
  
  await db
    .update(portalNotifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(portalNotifications.parentId, parent.id),
      isNull(portalNotifications.readAt)
    ));
}

export async function markRead(notificationId: string) {
  const parent = await getCurrentParent();
  if (!parent?.id) return;
  
  await db
    .update(portalNotifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(portalNotifications.id, notificationId),
      eq(portalNotifications.parentId, parent.id)
    ));
}

export async function createRegistrationNotification({
  parentId,
  organisationId,
  status,
  childName,
  registrationId,
}: {
  parentId: string;
  organisationId: string;
  status: 'approved' | 'rejected';
  childName: string;
  registrationId: string;
}) {
  await db.insert(portalNotifications).values({
    parentId,
    organisationId,
    type: status === 'approved' ? 'registration_approved' : 'registration_rejected',
    title: status === 'approved' ? 'Registration Approved ✓' : 'Registration Update',
    body: status === 'approved'
      ? `${childName}'s registration has been approved. Welcome aboard!`
      : `${childName}'s registration requires further information.`,
    href: `/portal`,
  });
}
