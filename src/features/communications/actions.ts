'use server';

import { db } from '@/db';
import { parents, children, broadcasts, bookings, clubSessions } from '@/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/services/email';
import { logger } from '@/lib/logger';

export async function sendBroadcast(data: {
  organisationId: string;
  centreId?: string;
  audienceParentIds: string[];
  subject: string;
  message: string;
}) {
  if (!data.audienceParentIds || data.audienceParentIds.length === 0) {
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  const targetParents = await db.query.parents.findMany({
    where: inArray(parents.id, data.audienceParentIds),
  });

  if (targetParents.length === 0) {
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  // Create broadcast record immediately
  const [broadcast] = await db.insert(broadcasts).values({
    organisationId: data.organisationId,
    centreId: data.centreId || null,
    subject: data.subject,
    message: data.message,
    recipientCount: targetParents.length,
    successCount: 0,
    failureCount: 0,
  }).returning();

  // Background queue architecture: execute without awaiting
  const sendEmailsTask = async () => {
    let successCount = 0;
    let failureCount = 0;

    for (const parent of targetParents) {
      if (!parent.email) {
        failureCount++;
        continue;
      }
      try {
        await sendEmail({
          to: parent.email,
          subject: data.subject,
          html: `<p>Dear ${parent.firstName},</p><p>${data.message}</p>`,
          organisationId: data.organisationId,
        });
        successCount++;
      } catch (e) {
        failureCount++;
      }
    }

    // Update broadcast record with final delivery status
    await db.update(broadcasts)
      .set({ successCount, failureCount })
      .where(eq(broadcasts.id, broadcast.id));
  };

  sendEmailsTask().catch((e) => logger.error('Broadcast email task failed', e));

  return { success: true, count: targetParents.length, sent: 0, failed: 0 };
}

export async function getBroadcasts(centreId: string) {
  const session = await auth();
  if (!session?.user?.organisationId) return [];

  return db.select()
    .from(broadcasts)
    .where(eq(broadcasts.centreId, centreId))
    .orderBy(broadcasts.createdAt);
}

export async function getClassesForCentre(centreId: string) {
  const session = await auth();
  if (!session?.user?.organisationId) return [];

  const query = db.select({
      id: clubSessions.id,
      type: clubSessions.type,
      weekday: clubSessions.weekday,
      startTime: clubSessions.startTime,
      endTime: clubSessions.endTime,
  })
  .from(clubSessions);

  if (centreId === 'all') {
    query.where(eq(clubSessions.organisationId, session.user.organisationId));
  } else {
    query.where(eq(clubSessions.centreId, centreId));
  }

  return await query;
}

export async function getParentsForCentre(centreId: string, classId?: string) {
  const session = await auth();
  if (!session?.user?.organisationId) return [];

  const baseQuery = db.select({
    id: parents.id,
    firstName: parents.firstName,
    lastName: parents.lastName,
    email: parents.email,
    communicationsConsent: sql<boolean>`COALESCE(bool_or(${bookings.communicationsConsent}), false)`.mapWith(Boolean).as('communicationsConsent'),
  })
  .from(parents)
  .leftJoin(bookings, eq(parents.id, bookings.parentId));
  
  const conditions = [eq(parents.organisationId, session.user.organisationId)];

  if (centreId !== 'all') {
    conditions.push(eq(bookings.centreId, centreId));
  }

  if (classId && classId !== 'all') {
    conditions.push(eq(bookings.sessionId, classId));
  }

  baseQuery.where(and(...conditions)).groupBy(parents.id);
  
  return await baseQuery;
}
