import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
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
    logger.error('[Cron Auth] CRON_SECRET is not configured — endpoint locked.');
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
    logger.warn('[Cron Auth] Timing safe comparison error:', err);
    return { authorized: false, status: 401, error: 'Unauthorised' };
  }

  return { authorized: true };
}
