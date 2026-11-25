'use server';

import { db } from '@/db';
import { parents, broadcasts, broadcastDeliveries, bookings, clubSessions, auditEvents } from '@/db/schema';
import { eq, inArray, and, isNull, sql } from 'drizzle-orm';
import { requireTenantSession, TypedSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { processBroadcastDeliveries } from './delivery';

/**
 * Milestone 3H, C1-C4 & Wave 4B:
 * Durable transactional broadcast queueing with server-side communications
 * consent re-derivation, centre RBAC scoping, and soft-deleted parent exclusion.
 */
export async function sendBroadcast(data: {
  centreId?: string;
  audienceParentIds: string[];
  subject: string;
  message: string;
  skipImmediateProcessing?: boolean;
}) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) {
    return { success: false, count: 0, sent: 0, failed: 0, error: 'Unauthorized' };
  }
  const organisationId = session.user.organisationId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session.user.role isn't in the base NextAuth type; same cast pattern used throughout src/features/finance/actions.ts
  const userRole = (session.user as any).role;
  if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
    return { success: false, count: 0, sent: 0, failed: 0, error: 'Unauthorized: only Owner/Manager may send broadcasts' };
  }

  let accessibleCentreIds: string[] | null = null;
  if (userRole !== 'ORG_OWNER') {
    accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (data.centreId && data.centreId !== 'all') {
      if (!accessibleCentreIds.includes(data.centreId)) {
        return { success: false, count: 0, sent: 0, failed: 0, error: 'Unauthorized: No access to this centre' };
      }
    } else if (!accessibleCentreIds || accessibleCentreIds.length === 0) {
      return { success: false, count: 0, sent: 0, failed: 0, error: 'Unauthorized: No access to this centre' };
    }
  }

  if (!data.audienceParentIds || data.audienceParentIds.length === 0) {
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  const scopedCentreIdsForConsent =
    data.centreId && data.centreId !== 'all'
      ? [data.centreId]
      : userRole !== 'ORG_OWNER' && accessibleCentreIds
        ? accessibleCentreIds
        : null;

  const consentBookingFilter =
    scopedCentreIdsForConsent && scopedCentreIdsForConsent.length > 0
      ? sql`AND ${inArray(bookings.centreId, scopedCentreIdsForConsent)}`
      : sql``;

  // Re-derive CURRENT consent server-side rather than trusting the client's own filtering,
  // excluding soft-deleted parents (UK GDPR erasure / bin isolation).
  const consentRows = await db.select({
    id: parents.id,
    firstName: parents.firstName,
    email: parents.email,
    communicationsConsent: sql<boolean>`COALESCE(
      (
        SELECT ${bookings.communicationsConsent}
        FROM ${bookings}
        WHERE ${bookings.parentId} = ${sql`parents.id`}
        ${consentBookingFilter}
        ORDER BY ${bookings.createdAt} DESC, ${bookings.id} DESC
        LIMIT 1
      ),
      false
    )`.mapWith(Boolean).as('communicationsConsent'),
  })
    .from(parents)
    .where(and(
      inArray(parents.id, data.audienceParentIds),
      eq(parents.organisationId, organisationId),
      isNull(parents.deletedAt),
    ));

  const targetParents = consentRows.filter(
    (p) =>
      p.communicationsConsent &&
      p.email &&
      !(p as { deletedAt?: Date | null }).deletedAt &&
      (!scopedCentreIdsForConsent || !(p as { centreId?: string }).centreId || scopedCentreIdsForConsent.includes((p as { centreId?: string }).centreId!))
  );

  // PM-2B.C: Deduplicate by destination email address deterministically.
  const seenEmails = new Set<string>();
  const uniqueTargetParents: typeof targetParents = [];

  for (const parent of targetParents) {
    const normalisedEmail = parent.email!.trim().toLowerCase();
    if (!seenEmails.has(normalisedEmail)) {
      seenEmails.add(normalisedEmail);
      uniqueTargetParents.push({
        ...parent,
        email: normalisedEmail,
      });
    }
  }

  if (uniqueTargetParents.length === 0) {
    return {
      success: false,
      count: 0,
      sent: 0,
      failed: 0,
      error: 'No eligible recipients with communications consent and valid email address found',
    };
  }

  // Atomically persist broadcast header, delivery outbox records, and queued audit event
  const broadcast = await db.transaction(async (tx) => {
    const [createdBroadcast] = await tx.insert(broadcasts).values({
      organisationId,
      centreId: data.centreId && data.centreId !== 'all' ? data.centreId : null,
      subject: data.subject,
      message: data.message,
      recipientCount: uniqueTargetParents.length,
      successCount: 0,
      failureCount: 0,
      status: 'QUEUED',
    }).returning();

    const deliveryRows = uniqueTargetParents.map((parent) => ({
      organisationId,
      broadcastId: createdBroadcast.id,
      parentId: parent.id,
      recipientEmail: parent.email!,
      recipientName: parent.firstName || null,
      channel: 'email',
      status: 'PENDING',
    }));

    await tx.insert(broadcastDeliveries).values(deliveryRows);

    await tx.insert(auditEvents).values({
      organisationId,
      eventType: 'broadcast.queued',
      eventData: JSON.stringify({
        broadcastId: createdBroadcast.id,
        subject: data.subject,
        recipientCount: uniqueTargetParents.length,
        centreId: data.centreId && data.centreId !== 'all' ? data.centreId : null,
      }),
    });

    return createdBroadcast;
  });

  if (!data.skipImmediateProcessing) {
    try {
      await processBroadcastDeliveries({ broadcastId: broadcast.id, limit: 50 });
    } catch (err) {
      logger.warn('[Communications] Immediate dispatch batch caught error; pending work remains in durable ledger', err);
    }
  }

  revalidatePath('/dashboard/communications');

  return {
    success: true,
    broadcastId: broadcast.id,
    count: uniqueTargetParents.length,
    sent: 0,
    failed: 0,
    status: 'QUEUED',
  };
}

const COMMUNICATIONS_ALLOWED_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] as const;

async function resolveReadableCentreScope(
  session: TypedSession,
  centreId: string
): Promise<{ allowed: boolean; accessibleCentreIds: string[] | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session.user as any).role as string;
  if (userRole && !COMMUNICATIONS_ALLOWED_ROLES.includes(userRole as (typeof COMMUNICATIONS_ALLOWED_ROLES)[number])) {
    return { allowed: false, accessibleCentreIds: [] };
  }
  if (userRole === 'ORG_OWNER') {
    return { allowed: true, accessibleCentreIds: null };
  }
  const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
  if (centreId === 'all') {
    return { allowed: accessibleCentreIds.length > 0, accessibleCentreIds };
  }
  return { allowed: accessibleCentreIds.includes(centreId), accessibleCentreIds };
}

export async function getBroadcasts(centreId: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return [];
  const scope = await resolveReadableCentreScope(session, centreId);
  if (!scope.allowed) return [];

  const conditions = [eq(broadcasts.organisationId, session.user.organisationId)];
  if (centreId !== 'all') {
    conditions.push(eq(broadcasts.centreId, centreId));
  } else if (scope.accessibleCentreIds) {
    conditions.push(inArray(broadcasts.centreId, scope.accessibleCentreIds));
  }

  return db.select()
    .from(broadcasts)
    .where(and(...conditions))
    .orderBy(broadcasts.createdAt);
}

export async function getClassesForCentre(centreId: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return [];
  const scope = await resolveReadableCentreScope(session, centreId);
  if (!scope.allowed) return [];

  const query = db.select({
      id: clubSessions.id,
      type: clubSessions.type,
      weekday: clubSessions.weekday,
      startTime: clubSessions.startTime,
      endTime: clubSessions.endTime,
  })
  .from(clubSessions);

  if (centreId === 'all') {
    if (scope.accessibleCentreIds) {
      query.where(and(
        eq(clubSessions.organisationId, session.user.organisationId),
        inArray(clubSessions.centreId, scope.accessibleCentreIds)
      ));
    } else {
      query.where(eq(clubSessions.organisationId, session.user.organisationId));
    }
  } else {
    query.where(and(
      eq(clubSessions.organisationId, session.user.organisationId),
      eq(clubSessions.centreId, centreId)
    ));
  }

  return await query;
}

export async function getParentsForCentre(centreId: string, classId?: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return [];
  const scope = await resolveReadableCentreScope(session, centreId);
  if (!scope.allowed) return [];

  const baseQuery = db.select({
    id: parents.id,
    firstName: parents.firstName,
    lastName: parents.lastName,
    email: parents.email,
    communicationsConsent: sql<boolean>`COALESCE(
      (
        SELECT ${bookings.communicationsConsent}
        FROM ${bookings}
        WHERE ${bookings.parentId} = ${sql`parents.id`}
        ORDER BY ${bookings.createdAt} DESC, ${bookings.id} DESC
        LIMIT 1
      ),
      false
    )`.mapWith(Boolean).as('communicationsConsent'),
  })
  .from(parents)
  .leftJoin(bookings, eq(parents.id, bookings.parentId));

  const conditions = [
    eq(parents.organisationId, session.user.organisationId),
    isNull(parents.deletedAt),
  ];

  if (centreId !== 'all') {
    conditions.push(eq(bookings.centreId, centreId));
  } else if (scope.accessibleCentreIds) {
    conditions.push(inArray(bookings.centreId, scope.accessibleCentreIds));
  }

  if (classId && classId !== 'all') {
    conditions.push(eq(bookings.sessionId, classId));
  }

  baseQuery.where(and(...conditions)).groupBy(parents.id);

  return await baseQuery;
}

/**
 * PM-2B: Fetches authoritative delivery statistics and ledger records
 * for a broadcast, strictly scoped to the authenticated tenant and accessible centres.
 */
export async function getBroadcastDeliveryStats(broadcastId: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session.user as any).role as string;
  if (userRole && !COMMUNICATIONS_ALLOWED_ROLES.includes(userRole as (typeof COMMUNICATIONS_ALLOWED_ROLES)[number])) {
    return null;
  }

  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(
      eq(broadcasts.id, broadcastId),
      eq(broadcasts.organisationId, session.user.organisationId)
    ))
    .limit(1);

  if (!broadcast) return null;

  if (userRole && userRole !== 'ORG_OWNER') {
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (!broadcast.centreId || !accessibleCentreIds.includes(broadcast.centreId)) {
      return null;
    }
  }

  const deliveries = await db
    .select({
      id: broadcastDeliveries.id,
      parentId: broadcastDeliveries.parentId,
      recipientEmail: broadcastDeliveries.recipientEmail,
      recipientName: broadcastDeliveries.recipientName,
      channel: broadcastDeliveries.channel,
      status: broadcastDeliveries.status,
      attemptCount: broadcastDeliveries.attemptCount,
      sentAt: broadcastDeliveries.sentAt,
      lastError: broadcastDeliveries.lastError,
      createdAt: broadcastDeliveries.createdAt,
    })
    .from(broadcastDeliveries)
    .where(and(
      eq(broadcastDeliveries.broadcastId, broadcastId),
      eq(broadcastDeliveries.organisationId, session.user.organisationId)
    ))
    .orderBy(broadcastDeliveries.createdAt);

  return {
    broadcast,
    deliveries,
  };
}
