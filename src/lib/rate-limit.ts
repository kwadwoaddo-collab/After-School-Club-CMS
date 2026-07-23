import { logger } from '@/lib/logger';
/**
 * Rate Limiting
 * 
 * Provides rate limiting for sensitive endpoints (auth, registration, booking).
 * Uses Upstash Redis when configured, falls back to in-memory for development.
 * 
 * Setup:
 *   1. Create free account at https://upstash.com
 *   2. Create a Redis database
 *   3. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel env vars
 * 
 * If env vars are missing, rate limiting is silently disabled (permissive fallback).
 */

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

/**
 * Check rate limit for a request.
 * Returns { success: true } if allowed, { success: false, reset: Date } if blocked.
 * If rate limiting is not configured, always returns { success: true }.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; reset?: number; remaining?: number }> {
  if (!limiter) {
    // Rate limiting not configured — permissive fallback
    return { success: true };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      reset: result.reset,
      remaining: result.remaining,
    };
  } catch (error) {
    // If Redis is down, fail open (allow the request)
    logger.error('[RateLimit] Redis error, failing open:', error);
    return { success: true };
  }
}

/**
 * Extract IP address from request headers.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
