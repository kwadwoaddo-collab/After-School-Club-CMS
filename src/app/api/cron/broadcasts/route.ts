import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { processBroadcastDeliveries } from '@/features/communications/delivery';
import crypto from 'crypto';

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
import { verifyCronAuthorization } from '@/lib/cron-auth';
export { verifyCronAuthorization };

/**
 * GET /api/cron/broadcasts
 *
 * Background recovery processor for durable broadcast deliveries:
 * - Recovers any stalled/pending delivery records across all tenants
 * - Safely executes bounded batches with atomic work leasing
 * - Idempotent and concurrency-safe
 */
export async function GET(req: NextRequest) {
  const authCheck = verifyCronAuthorization(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status || 401 });
  }

  try {
    const urlLimitParam = req.nextUrl?.searchParams?.get('limit');
    const limit = urlLimitParam ? parseInt(urlLimitParam, 10) : 100;
    const boundedLimit = isNaN(limit) ? 100 : Math.min(Math.max(limit, 1), 100);

    const result = await processBroadcastDeliveries({ limit: boundedLimit });

    logger.info(`[Cron Broadcasts] Recovery cycle completed: processed=${result.processedCount}, sent=${result.sentCount}, failed=${result.failedCount}, retried=${result.retriedCount}`);

    return NextResponse.json({
      success: true,
      ...result,
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
