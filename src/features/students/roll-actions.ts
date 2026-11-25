'use server';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { requireTenantSession } from '@/lib/session';
import { db } from '@/db';
import { auditEvents, children } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export interface RollResult {
  success: boolean;
  rolledCount: number;
  message: string;
}

function getAcademicRolloverYear(now: Date = new Date()): number {
  // UK academic year cycle begins 1st September (UTC month index 8).
  // Matches GET /api/cron/school-year-roll's September 1st `rolloverYear`.
  return now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export async function rollSchoolYearsAction(): Promise<RollResult> {
  const session = await requireTenantSession();
  if (!session?.user?.organisationId) {
    throw new Error('Unauthorized');
  }

  // Only ORG_OWNER can roll school years
  if ((session.user as any).role !== 'ORG_OWNER') {
    throw new Error('Forbidden');
  }

  const organisationId = session.user.organisationId;
  const rolloverYear = getAcademicRolloverYear();

  try {
    const txOutcome = await db.transaction(async (tx) => {
      // 1. Concurrency guard: org-scoped transactional advisory lock
      const lockRes = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtext(${`school_year_rollover:${organisationId}:${rolloverYear}`})) AS locked`
      );
      const lockRow = lockRes as unknown as {
        rows?: Array<{ locked: boolean }>;
        [0]?: { locked: boolean };
      };
      const isLocked = lockRow?.[0]?.locked ?? lockRow?.rows?.[0]?.locked;

      if (isLocked === false) {
        logger.warn(
          `[Roll Action] Concurrent school year rollover blocked for org ${organisationId} (${rolloverYear}).`
        );
        return {
          status: 'locked' as const,
          rolledCount: 0,
        };
      }

      // 2. Durable idempotency guard: prevent double-promotion within the same academic year
      const existingRuns = await tx
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.organisationId, organisationId),
            eq(auditEvents.eventType, 'school_year_rollover_completed'),
            sql`${auditEvents.eventData}::jsonb ->> 'rolloverYear' = ${String(rolloverYear)}`
          )
        )
        .limit(1);

      if (existingRuns.length > 0) {
        logger.info(
          `[Roll Action] School year rollover already completed for org ${organisationId} (${rolloverYear}).`
        );
        return {
          status: 'already_completed' as const,
          rolledCount: 0,
        };
      }

      // 3. Single set-based canonical school-year transition (matching /api/cron/school-year-roll).
      // Preserves composite labels ('Year 3/4', 'Y5/6') and excludes soft-deleted children.
      const activeOrgFilter = and(
        eq(children.organisationId, organisationId),
        isNull(children.deletedAt)
      );

      const updateRes = await tx.execute<{ rolled_count: number }>(sql`
        WITH mapped AS (
          SELECT
            id,
            CASE
              WHEN lower(btrim(school_year)) IN ('nursery', 'nur', 'n', 'year n', 'yr n', 'year nursery', 'yr nursery')
                THEN 'Reception'
              WHEN lower(btrim(school_year)) IN ('reception', 'rec', 'r', 'year r', 'yr r', 'year reception', 'yr reception')
                THEN 'Y1'
              WHEN lower(btrim(school_year)) ~ '^(?:year[[:space:]]*|yr[.]?[[:space:]]*|y)?(0?[0-9]|1[0-3])$' THEN
                CASE (regexp_match(lower(btrim(school_year)), '^(?:year[[:space:]]*|yr[.]?[[:space:]]*|y)?([0-9]{1,2})$'))[1]::int
                  WHEN 0 THEN 'Y1'
                  WHEN 13 THEN 'Graduated'
                  ELSE 'Y' || (((regexp_match(lower(btrim(school_year)), '^(?:year[[:space:]]*|yr[.]?[[:space:]]*|y)?([0-9]{1,2})$'))[1]::int) + 1)::text
                END
              ELSE school_year
            END AS next_year
          FROM ${children}
          WHERE ${activeOrgFilter}
        ),
        updated AS (
          UPDATE ${children} AS c
          SET school_year = m.next_year,
              updated_at = NOW()
          FROM mapped AS m
          WHERE c.id = m.id
            AND c.organisation_id = ${organisationId}
            AND c.deleted_at IS NULL
            AND m.next_year IS NOT NULL
            AND c.school_year IS DISTINCT FROM m.next_year
          RETURNING c.id
        )
        SELECT COUNT(*)::int AS rolled_count FROM updated
      `);

      const updateRow = updateRes as unknown as {
        rows?: Array<{ rolled_count: number | string }>;
        [0]?: { rolled_count: number | string };
      };
      const rawRolledCount = updateRow?.[0]?.rolled_count ?? updateRow?.rows?.[0]?.rolled_count ?? 0;
      const rolledCount = Number(rawRolledCount) || 0;

      // 4. Record completion audit event for academic-year idempotency
      await tx.insert(auditEvents).values({
        organisationId,
        userId: session.user.id,
        eventType: 'school_year_rollover_completed',
        eventData: JSON.stringify({
          rolloverYear,
          academicYearLabel: `${rolloverYear}/${rolloverYear + 1}`,
          totalRolled: rolledCount,
          source: 'manual',
          completedAt: new Date().toISOString(),
        }),
      });

      return {
        status: 'rolled' as const,
        rolledCount,
      };
    });

    if (txOutcome.status === 'locked') {
      return {
        success: false,
        rolledCount: 0,
        message: 'School year rollover is currently in progress. Please wait and refresh.',
      };
    }

    if (txOutcome.status === 'already_completed') {
      return {
        success: false,
        rolledCount: 0,
        message: 'School years have already been rolled for this academic year.',
      };
    }

    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      rolledCount: txOutcome.rolledCount,
      message: `Successfully rolled school years forward for ${txOutcome.rolledCount} student${txOutcome.rolledCount !== 1 ? 's' : ''}.`,
    };
  } catch (err) {
    logger.error('[Roll Action] Failed to roll school years:', err);
    return {
      success: false,
      rolledCount: 0,
      message: 'Failed to roll school years. Please try again.',
    };
  }
}
