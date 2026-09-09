'use server';

import { db } from '@/db';
import { parents, broadcasts, broadcastDeliveries, bookings, clubSessions, auditEvents } from '@/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { requireTenantSession, TypedSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { processBroadcastDeliveries } from './delivery';

/**
 * Milestone 3H: narrow, local escaping helper for the one HTML template this
 * file builds by hand. Not a new shared abstraction — src/lib/services/
 * email.ts's own templated methods have the same unescaped-interpolation
 * pattern throughout, but that file is shared with Bookings/Finance/Staff
 * and is out of this milestone's scope (see project-notes/
 * milestone-3h-communications-audit.md, §G/§P). This helper only protects
 * the interpolation this file itself owns.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Milestone 3H, C1-C4: `sendBroadcast` previously took `organisationId` as a
 * caller-supplied argument and never called `auth()` at all — no session
 * check of any kind. Its recipient query
 * (`db.query.parents.findMany({ where: inArray(parents.id, audienceParentIds) })`)
 * had no organisation filter, and `communicationsConsent` was filtered only
 * client-side in CommunicationsClient.tsx, never re-verified here. Any
 * request that could reach this server action could broadcast a real email,
 * under any organisation's name, to any parent in the database — consented
 * or not. See project-notes/milestone-3h-communications-audit.md, C1-C4.
 *
 * PM-2B: Replaced detached in-memory execution with a durable transactional
 * outbox. Broadcast headers, recipient delivery ledger rows, and audit events
 * are atomically committed to PostgreSQL before any external transmission.
 */
export async function sendBroadcast(data: {
  centreId?: string;
  audienceParentIds: string[];
  subject: string;
  message: string;
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

  if (data.centreId && data.centreId !== 'all' && userRole !== 'ORG_OWNER') {
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (!accessibleCentreIds.includes(data.centreId)) {
      return { success: false, count: 0, sent: 0, failed: 0, error: 'Unauthorized: No access to this centre' };
    }
  }

  if (!data.audienceParentIds || data.audienceParentIds.length === 0) {
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  // Re-derive CURRENT consent server-side rather than trusting the client's own filtering.
  // Instead of bool_or (which caused any historical true booking to permanently override later withdrawals),
  // we select the latest booking's communicationsConsent ordered by createdAt DESC, id DESC.
  const consentRows = await db.select({
    id: parents.id,
    firstName: parents.firstName,
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
    .where(and(
      inArray(parents.id, data.audienceParentIds),
      eq(parents.organisationId, organisationId),
    ));

  const targetParents = consentRows.filter((p) => p.communicationsConsent && p.email);

  // PM-2B.C: Deduplicate by destination email address deterministically.
  // If multiple eligible parent records share the same email (e.g. family sharing an account),
  // exactly one delivery record is queued per destination address to prevent spam and preserve
  // the UNIQUE(broadcast_id, recipient_email) database constraint.
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

  // Short post-commit bounded immediate processing attempt.
  // All work is already safely persisted in the database outbox; if this process
  // dies or serverless invocation halts, the recovery cron picks up remaining rows.
  try {
    await processBroadcastDeliveries({ broadcastId: broadcast.id, limit: 50 });
  } catch (err) {
    logger.warn('[Communications] Immediate dispatch batch caught error; pending work remains in durable ledger', err);
  }

  return {
    success: true,
    broadcastId: broadcast.id,
    count: uniqueTargetParents.length,
    sent: 0,
    failed: 0,
    status: 'QUEUED',
  };
}

/**
 * Milestone 3H, C4/C5: none of the three read functions below checked
 * getUserAccessibleCentreIds for non-owner roles — a caller-supplied
 * centreId was trusted outright, so a MANAGER/FRONT_DESK assigned only to
 * Centre A could call any of these with Centre B's id (same org) and read
 * Centre B's parent contact data / broadcast history / class list. Fixed
 * with the same non-owner centre-check pattern used throughout
 * finance/actions.ts. Kept as a small local helper rather than a new
 * shared module since it's only used by the three functions in this file.
 */
async function assertReadableCentre(
  session: TypedSession,
  centreId: string
): Promise<boolean> {
  if (centreId === 'all') return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- session.user.role isn't in the base NextAuth type; same cast pattern used throughout src/features/finance/actions.ts
  const userRole = (session.user as any).role;
  if (userRole === 'ORG_OWNER') return true;
  const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
  return accessibleCentreIds.includes(centreId);
}

export async function getBroadcasts(centreId: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return [];
  if (!(await assertReadableCentre(session, centreId))) return [];

  const conditions = [eq(broadcasts.organisationId, session.user.organisationId)];
  if (centreId !== 'all') {
    conditions.push(eq(broadcasts.centreId, centreId));
  }

  return db.select()
    .from(broadcasts)
    .where(and(...conditions))
    .orderBy(broadcasts.createdAt);
}

export async function getClassesForCentre(centreId: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return [];
  if (!(await assertReadableCentre(session, centreId))) return [];

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
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return [];
  if (!(await assertReadableCentre(session, centreId))) return [];

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

/**
 * PM-2B: Fetches authoritative delivery statistics and ledger records
 * for a broadcast, strictly scoped to the authenticated tenant.
 */
export async function getBroadcastDeliveryStats(broadcastId: string) {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) return null;

  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(
      eq(broadcasts.id, broadcastId),
      eq(broadcasts.organisationId, session.user.organisationId)
    ))
    .limit(1);

  if (!broadcast) return null;

  const deliveries = await db
    .select({
      id: broadcastDeliveries.id,
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
