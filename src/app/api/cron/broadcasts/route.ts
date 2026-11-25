import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { processBroadcastDeliveries } from '@/features/communications/delivery';
import { verifyCronAuthorization } from '@/lib/cron-auth';

export const maxDuration = 60;

const CRON_BUDGET_MS = 50_000;
const SUB_BATCH_LIMIT = 25;

/**
 * Validates the Authorization header against CRON_SECRET using timing-safe comparison.
 *
 * Rules (Fail Closed):
 * 1. Missing CRON_SECRET in environment -> 503 Service Unavailable
 * 2. Missing Authorization header -> 401 Unauthorised
 * 3. Wrong scheme (not Bearer) -> 401 Unauthorised
 * 4. Unequal buffer lengths -> 401 Unauthorised (avoids timingSafeEqual range error)
 * 5. Secret mismatch -> 401 Unauthorised
 */
export { verifyCronAuthorization };

/**
 * GET /api/cron/broadcasts
 *
 * Background recovery processor for durable broadcast deliveries:
 * - Recovers any stalled/pending delivery records across all tenants
 * - Safely executes bounded batches with atomic work leasing
 * - Exits cleanly with `partial: true` if the 50s cooperative time budget is reached
 * - Idempotent and concurrency-safe
 */
export async function GET(req: NextRequest) {
  const authCheck = verifyCronAuthorization(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status || 401 });
  }

  const startedAt = Date.now();

  try {
    const urlLimitParam = req.nextUrl?.searchParams?.get('limit');
    const limit = urlLimitParam ? parseInt(urlLimitParam, 10) : 100;
    const boundedLimit = isNaN(limit) ? 100 : Math.min(Math.max(limit, 1), 100);

    let remaining = boundedLimit;
    let processedCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let retriedCount = 0;
    let partial = false;

    while (remaining > 0) {
      if (Date.now() - startedAt >= CRON_BUDGET_MS) {
        partial = true;
        break;
      }

      const chunkLimit = Math.min(remaining, SUB_BATCH_LIMIT);
      const batchResult = await processBroadcastDeliveries({
        limit: chunkLimit,
        startedAt,
        budgetMs: CRON_BUDGET_MS,
      });

      processedCount += batchResult.processedCount;
      sentCount += batchResult.sentCount;
      failedCount += batchResult.failedCount;
      retriedCount += batchResult.retriedCount;
      remaining -= batchResult.processedCount;

      if (batchResult.partial) {
        partial = true;
        break;
      }

      if (batchResult.processedCount < chunkLimit) {
        break;
      }
    }

    if (partial) {
      logger.warn(
        `[Cron Broadcasts] Cooperative time budget reached; exiting cleanly with partial progress: processed=${processedCount}, sent=${sentCount}, failed=${failedCount}, retried=${retriedCount}`,
      );
    } else {
      logger.info(
        `[Cron Broadcasts] Recovery cycle completed: processed=${processedCount}, sent=${sentCount}, failed=${failedCount}, retried=${retriedCount}`,
      );
    }

    return NextResponse.json({
      success: true,
      processedCount,
      sentCount,
      failedCount,
      retriedCount,
      partial,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Cron Broadcasts] Unhandled exception in broadcast recovery cron:', error);
    return NextResponse.json(
      { error: 'Internal server error during broadcast recovery' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/broadcasts
 * Fallback for webhooks or platforms triggering scheduled jobs via POST.
 */
export async function POST(req: NextRequest) {
  return GET(req);
}
