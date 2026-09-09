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
export function verifyCronAuthorization(req: NextRequest): { authorized: boolean; status?: number; error?: string } {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === '') {
    logger.error('[Cron Broadcasts] CRON_SECRET is not configured — endpoint locked.');
    return { authorized: false, status: 503, error: 'Service unavailable: cron secret unconfigured' };
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { authorized: false, status: 401, error: 'Missing authorization header' };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return { authorized: false, status: 401, error: 'Invalid authorization scheme' };
  }

  const token = parts[1];
  const secretBuf = Buffer.from(cronSecret, 'utf-8');
  const tokenBuf = Buffer.from(token, 'utf-8');

  if (secretBuf.length !== tokenBuf.length) {
    return { authorized: false, status: 401, error: 'Unauthorised' };
  }

  try {
    if (!crypto.timingSafeEqual(secretBuf, tokenBuf)) {
      return { authorized: false, status: 401, error: 'Unauthorised' };
    }
  } catch (err) {
    logger.warn('[Cron Broadcasts] Timing safe comparison error:', err);
    return { authorized: false, status: 401, error: 'Unauthorised' };
  }

  return { authorized: true };
}

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
