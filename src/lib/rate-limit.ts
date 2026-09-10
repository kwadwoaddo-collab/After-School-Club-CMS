import { logger } from '@/lib/logger';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Only create Redis client if env vars are present
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * Auth rate limiter — 10 requests per 60 seconds per IP
 * Protects: login, signup, password reset, magic link
 */
export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:auth',
      analytics: true,
    })
  : null;

/**
 * API rate limiter — 60 requests per 60 seconds per IP
 * Protects: booking creation, registration submission
 */
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'rl:api',
      analytics: true,
    })
  : null;

/**
 * Strict rate limiter — 5 requests per 60 seconds per IP
 * Protects: password reset, email send endpoints
 */
export const strictRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'rl:strict',
      analytics: true,
    })
  : null;

export type RateLimitStatus = 'allowed' | 'limited' | 'unavailable';

export interface RateLimitResult {
  success: boolean;
  status: RateLimitStatus;
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: number;
  reason?: string;
}

export interface CheckRateLimitOptions {
  /**
   * Behavior when Redis is unavailable or unconfigured:
   * - 'fail-safe-local': (default) Use conservative local in-memory sliding window fallback.
   * - 'fail-closed': Strict rejection with status: 'unavailable' (HTTP 503).
   */
  fallbackPolicy?: 'fail-safe-local' | 'fail-closed';
  /**
   * Fallback limit capacity in local window
   */
  localLimit?: number;
  /**
   * Window duration in ms for local fallback (default 60_000 ms)
   */
  localWindowMs?: number;
}

// ── Bounded Local In-Memory Fallback Cache ─────────────────────────────────────
// NOTE (Milestone PM-2E2.B2): This process-local store is a secondary best-effort
// safety fallback when Upstash Redis is unreachable. It operates per serverless
// instance and is NOT a substitute for distributed Redis-backed rate limiting.
interface LocalBucket {
  count: number;
  resetAt: number;
}

const localStore = new Map<string, LocalBucket>();
const MAX_LOCAL_STORE_ENTRIES = 5000;

function checkLocalFallback(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();

  // Bounded memory protection: purge expired keys if map grows large
  if (localStore.size > MAX_LOCAL_STORE_ENTRIES) {
    for (const [k, v] of localStore.entries()) {
      if (v.resetAt <= now) {
        localStore.delete(k);
      }
    }
  }

  const bucket = localStore.get(identifier);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    localStore.set(identifier, { count: 1, resetAt });
    return {
      success: true,
      status: 'allowed',
      limit,
      remaining: Math.max(0, limit - 1),
      reset: resetAt,
    };
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      success: false,
      status: 'limited',
      limit,
      remaining: 0,
      reset: bucket.resetAt,
      retryAfter,
      reason: 'Rate limit exceeded (local fallback)',
    };
  }

  bucket.count += 1;
  return {
    success: true,
    status: 'allowed',
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
  };
}

/**
 * Check rate limit for a request.
 * Prioritizes central Upstash Redis distributed sliding window.
 * When Redis is down or unconfigured, executes configured fallback policy (defaulting
 * to a conservative local in-memory sliding window).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
  options: CheckRateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    fallbackPolicy = 'fail-safe-local',
    localLimit = 5,
    localWindowMs = 60_000,
  } = options;

  if (!limiter) {
    if (fallbackPolicy === 'fail-closed') {
      logger.warn('[RateLimit] Central Redis limiter unconfigured; failing closed (status: unavailable)');
      return {
        success: false,
        status: 'unavailable',
        reason: 'Rate limiting service unconfigured',
      };
    }

    // Default: fail-safe conservative local fallback
    return checkLocalFallback(identifier, localLimit, localWindowMs);
  }

  try {
    const result = await limiter.limit(identifier);
    const now = Date.now();
    const retryAfter = result.reset ? Math.max(1, Math.ceil((result.reset - now) / 1000)) : undefined;

    return {
      success: result.success,
      status: result.success ? 'allowed' : 'limited',
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter,
      reason: result.success ? undefined : 'Rate limit exceeded',
    };
  } catch (error) {
    logger.error('[RateLimit] Redis connection error, engaging fallback policy:', error);

    if (fallbackPolicy === 'fail-closed') {
      return {
        success: false,
        status: 'unavailable',
        reason: 'Rate limiting backend error',
      };
    }

    // Fail-safe conservative local fallback
    return checkLocalFallback(identifier, localLimit, localWindowMs);
  }
}

// ── Trusted IP Resolution ───────────────────────────────────────────────────
// IPv4 and IPv6 format validators
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^[0-9a-fA-F:]+$/;

function isValidIP(ip: string): boolean {
  return IPV4_REGEX.test(ip) || (IPV6_REGEX.test(ip) && ip.includes(':'));
}

/**
 * Extract authoritative client IP address from request.
 *
 * Trust Hierarchy:
 * 1. `x-vercel-forwarded-for`: On Vercel Edge, this header is set directly by the
 *    edge proxy infrastructure and stripped/overwritten if supplied by clients.
 * 2. `cf-connecting-ip`: Cloudflare edge proxy connecting IP.
 * 3. `x-forwarded-for` (first entry) / `x-real-ip`: Standard reverse proxy headers
 *    used in non-Vercel environments (e.g. local development, testing, custom Docker).
 * 4. Fallback to '127.0.0.1'.
 */
export function getClientIP(request: Request): string {
  // 1. Vercel authoritative edge header
  const vercelIP = request.headers.get('x-vercel-forwarded-for')?.trim();
  if (vercelIP) {
    const candidate = vercelIP.split(',')[0]?.trim();
    if (candidate && isValidIP(candidate)) {
      return candidate.toLowerCase();
    }
  }

  // 2. Cloudflare edge header
  const cfIP = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIP && isValidIP(cfIP)) {
    return cfIP.toLowerCase();
  }

  // 3. Fallback for non-Vercel environments (local dev / test runners)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const candidate = forwardedFor.split(',')[0]?.trim();
    if (candidate && isValidIP(candidate)) {
      return candidate.toLowerCase();
    }
  }

  const realIP = request.headers.get('x-real-ip')?.trim();
  if (realIP && isValidIP(realIP)) {
    return realIP.toLowerCase();
  }

  return '127.0.0.1';
}

/**
 * Utility for tests: reset the local in-memory fallback store
 */
export function _resetLocalRateLimitStore(): void {
  localStore.clear();
}
