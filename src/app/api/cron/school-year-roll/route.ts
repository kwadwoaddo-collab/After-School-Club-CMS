import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { children, auditEvents, organisations } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';

/**
 * GET /api/cron/school-year-roll
 *
 * Secure global cron endpoint to roll all student school years forward by 1 year.
 * Executes automatically on September 1st.
 *
 * Secured by Authorization: Bearer <CRON_SECRET> header.
 * Concurrency-safe and idempotent: Uses PostgreSQL transactional advisory locks
 * and audit_events check to guarantee that a given academic year transition
 * executes at most once.
 */
export async function GET(req: NextRequest) {
  // 1. Authenticate cron caller
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[Cron Roll] CRON_SECRET is not set — endpoint locked.');
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
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
      const lockRow = (lockRes as unknown as { rows?: Array<{ locked: boolean }>; [0]?: { locked: boolean } });
      const isLocked = lockRow?.[0]?.locked ?? lockRow?.rows?.[0]?.locked;

      if (isLocked === false) {
        logger.warn(`[Cron Roll] Concurrent rollover attempt for ${rolloverYear} blocked by advisory lock.`);
        return { success: true, skipped: true, rolledCount: 0, reason: `Rollover for ${rolloverYear} is currently running in another process.` };
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
        return { success: true, skipped: true, rolledCount: 0, reason: `Rollover for ${rolloverYear} already completed.` };
      }

      // 4. Fetch all organisations
      const orgs = await tx.select({ id: organisations.id }).from(organisations);

      // 5. Fetch all children globally
      const allChildren = await tx
        .select({ id: children.id, schoolYear: children.schoolYear, organisationId: children.organisationId })
        .from(children);

      let rolledCount = 0;

      for (const child of allChildren) {
        let newYear = child.schoolYear;
        const cleanYear = child.schoolYear.trim().toLowerCase();

        if (cleanYear === 'nursery') {
          newYear = 'Reception';
        } else if (cleanYear === 'reception') {
          newYear = '1';
        } else {
          // Parse numeric year
          const numericYear = parseInt(cleanYear.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(numericYear)) {
            if (numericYear >= 13) {
              newYear = 'Graduated';
            } else {
              newYear = (numericYear + 1).toString();
            }
          }
        }

        if (newYear !== child.schoolYear) {
          await tx
            .update(children)
            .set({ schoolYear: newYear, updatedAt: new Date() })
            .where(eq(children.id, child.id));
          rolledCount++;
        }
      }

      // 6. Record completion audit event for each organisation to ensure durable idempotency
      for (const org of orgs) {
        await tx.insert(auditEvents).values({
          organisationId: org.id,
          eventType: 'school_year_rollover_completed',
          eventData: JSON.stringify({
            rolloverYear,
            academicYearLabel: `${rolloverYear}/${rolloverYear + 1}`,
            totalRolled: rolledCount,
            completedAt: new Date().toISOString(),
          }),
        });
      }

      logger.info(`[Cron Roll] September 1st Rollover Completed for year ${rolloverYear}: updated ${rolledCount} students across ${orgs.length} orgs.`);
      return { success: true, skipped: false, rolledCount, rolloverYear };
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[Cron Roll] Failed to run rollover cron:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || 'Internal database error' }, { status: 500 });
  }
}

// Support POST requests as fallback for cron platforms that trigger via POST
export async function POST(req: NextRequest) {
  return GET(req);
}
