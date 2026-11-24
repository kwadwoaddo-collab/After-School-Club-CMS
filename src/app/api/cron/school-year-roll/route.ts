import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { children, auditEvents, organisations } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { verifyCronAuthorization } from '@/lib/cron-auth';

export const maxDuration = 60;

const NURSERY_ALIASES = new Set([
  'nursery',
  'nur',
  'n',
  'year n',
  'yr n',
  'year nursery',
  'yr nursery',
]);

const RECEPTION_ALIASES = new Set([
  'reception',
  'rec',
  'r',
  'year r',
  'yr r',
  'year reception',
  'yr reception',
]);

const SINGLE_NUMERIC_YEAR_RE = /^(?:year\s*|yr\.?\s*|y)?(0?[0-9]|1[0-3])$/i;

/**
 * Pure canonical school-year transition helper mirroring the set-based SQL CASE
 * expression executed by GET /api/cron/school-year-roll:
 * - Nursery aliases -> 'Reception'
 * - Reception aliases / Year 0 -> 'Y1'
 * - Year 1..12 ('1'..'12', 'Y1'..'Y12', 'Year 1'..'Year 12') -> 'Y2'..'Y13'
 * - Year 13 ('13', 'Y13', 'Year 13') -> 'Graduated'
 * - Already 'Graduated', composite labels ('Year 3/4'), or custom strings -> unchanged
 */
export function computeNextSchoolYear(current: string): string {
  const trimmed = current.trim();
  if (!trimmed) return current;

  const lower = trimmed.toLowerCase();
  if (NURSERY_ALIASES.has(lower)) {
    return 'Reception';
  }
  if (RECEPTION_ALIASES.has(lower)) {
    return 'Y1';
  }

  const match = lower.match(SINGLE_NUMERIC_YEAR_RE);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num === 0) return 'Y1';
    if (num >= 1 && num <= 12) return `Y${num + 1}`;
    if (num === 13) return 'Graduated';
  }

  return current;
}

/**
 * GET /api/cron/school-year-roll
 *
 * Secure global cron endpoint to roll all active student school years forward by 1 year.
 * Executes automatically on September 1st (03:00 UTC).
 *
 * Secured by Authorization: Bearer <CRON_SECRET> header.
 * Concurrency-safe and idempotent: Uses PostgreSQL transactional advisory locks
 * and audit_events check to guarantee that a given academic year transition
 * executes at most once, while excluding soft-deleted/GDPR-archived child rows.
 */
export async function GET(req: NextRequest) {
  // 1. Authenticate cron caller (timing-safe)
  const authCheck = verifyCronAuthorization(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status ?? 401 });
  }

  // Determine rollover target year (default to current calendar year, or override via searchParam for testing)
  const urlYearParam = req.nextUrl?.searchParams?.get('year');
  const rolloverYear = urlYearParam ? parseInt(urlYearParam, 10) : new Date().getFullYear();

  if (isNaN(rolloverYear) || rolloverYear < 2000 || rolloverYear > 2100) {
    return NextResponse.json({ error: 'Invalid year specified' }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 2. Concurrency guard: Acquire transactional advisory lock for this rollover year
      const lockRes = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtext(${`school_year_roll_${rolloverYear}`})) AS locked`
      );
      const lockRow = lockRes as unknown as { rows?: Array<{ locked: boolean }>; [0]?: { locked: boolean } };
      const isLocked = lockRow?.[0]?.locked ?? lockRow?.rows?.[0]?.locked;

      if (isLocked === false) {
        logger.warn(`[Cron Roll] Concurrent rollover attempt for ${rolloverYear} blocked by advisory lock.`);
        return {
          success: true,
          skipped: true,
          rolledCount: 0,
          reason: `Rollover for ${rolloverYear} is currently running in another process.`,
        };
      }

      // 3. Idempotency check: Has this rollover year already executed?
      const existingRuns = await tx
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.eventType, 'school_year_rollover_completed'),
            sql`${auditEvents.eventData}::jsonb ->> 'rolloverYear' = ${rolloverYear.toString()}`
          )
        )
        .limit(1);

      if (existingRuns.length > 0) {
        logger.info(`[Cron Roll] Rollover for ${rolloverYear} already completed previously. Skipping.`);
        return {
          success: true,
          skipped: true,
          rolledCount: 0,
          reason: `Rollover for ${rolloverYear} already completed.`,
        };
      }

      // 4. Fetch all organisations for completion audit recording
      const orgs = await tx.select({ id: organisations.id }).from(organisations);

      // 5. Set-based canonical school-year update across active (non-soft-deleted) children only.
      // Use backslash-free POSIX character classes inside Drizzle's cooked `sql` template tag.
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
          WHERE deleted_at IS NULL
        ),
        updated AS (
          UPDATE ${children} AS c
          SET school_year = m.next_year,
              updated_at = NOW()
          FROM mapped AS m
          WHERE c.id = m.id
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

      // 6. Bulk-insert completion audit events across organisations for durable idempotency
      if (orgs.length > 0) {
        const eventData = JSON.stringify({
          rolloverYear,
          academicYearLabel: `${rolloverYear}/${rolloverYear + 1}`,
          totalRolled: rolledCount,
          completedAt: new Date().toISOString(),
        });
        await tx.insert(auditEvents).values(
          orgs.map((org) => ({
            organisationId: org.id,
            eventType: 'school_year_rollover_completed',
            eventData,
          }))
        );
      }

      logger.info(
        `[Cron Roll] September 1st Rollover Completed for year ${rolloverYear}: updated ${rolledCount} students across ${orgs.length} orgs.`
      );
      return { success: true, skipped: false, rolledCount, rolloverYear };
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[Cron Roll] Failed to run rollover cron:', err);
    return NextResponse.json({ error: 'Internal database error' }, { status: 500 });
  }
}

// Support POST requests as fallback for cron platforms that trigger via POST
export async function POST(req: NextRequest) {
  return GET(req);
}
