'use server';

import { db } from '@/db';
import { parents, broadcasts, bookings, clubSessions } from '@/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { sendEmail } from '@/lib/services/email';
import { logger } from '@/lib/logger';

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
 * Fixed: organisationId is now derived from the session (never trusted from
 * the caller); the recipient query is scoped to that organisation and
 * re-derives communicationsConsent itself via the same bookings join
 * getParentsForCentre already uses, rather than trusting a field that
 * doesn't even exist on a raw `parents` row; and centreId (when supplied)
 * is verified against the caller's accessible centres for non-owner roles,
 * matching the pattern already established in finance/actions.ts and
 * billing/actions.ts. C8: only ORG_OWNER/MANAGER may send, matching the
 * one sibling precedent for bulk messaging in this codebase
 * (src/app/api/register/bulk-email/route.ts).
 */
export async function sendBroadcast(data: {
  centreId?: string;
  audienceParentIds: string[];
  subject: string;
  message: string;
}) {
  const session = await auth();
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
        WHERE ${bookings.parentId} = ${parents.id}
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

  const targetParents = consentRows.filter((p) => p.communicationsConsent);

  if (targetParents.length === 0) {
    return { success: true, count: 0, sent: 0, failed: 0 };
  }

  // Create broadcast record immediately
  const [broadcast] = await db.insert(broadcasts).values({
    organisationId,
    centreId: data.centreId && data.centreId !== 'all' ? data.centreId : null,
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
        const result = await sendEmail({
          to: parent.email,
          subject: data.subject,
          html: `<p>Dear ${escapeHtml(parent.firstName)},</p><p>${escapeHtml(data.message)}</p>`,
          organisationId,
        });
        // Milestone 3H, C10: sendEmail's contract is to resolve with
        // {success: boolean}, not to throw on failure (see
        // src/lib/services/email.ts's own try/catch, which always
        // returns rather than rejecting) — this catch block alone never
        // ran for a failed send, so every failure (unconfigured provider,
        // a rejected Resend API call, an invalid recipient) was counted
        // as a success. Confirmed live in Stage C: with Resend
        // unconfigured in this dev environment, a real send recorded
        // successCount=1/failureCount=0 despite no email ever being sent.
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
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
  session: NonNullable<Awaited<ReturnType<typeof auth>>>,
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
  const session = await auth();
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
  const session = await auth();
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
  const session = await auth();
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
        WHERE ${bookings.parentId} = ${parents.id}
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
