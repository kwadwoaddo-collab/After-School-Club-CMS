import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { checkRateLimit, deepHealthRateLimit, getClientIP } from '@/lib/rate-limit';

const DEEP_HEALTH_LOCAL_LIMIT = 30;
const DEEP_HEALTH_WINDOW_MS = 60_000;

/**
 * GET /api/health/deep
 *
 * Explicit dependency health check endpoint.
 *
 * Checks:
 *   - Per-IP rate limit (30 req / 60s) to block abusive Neon DB wakeup floods
 *   - Application runtime is operational
 *   - Database connectivity (executes a minimal SELECT 1 probe against Neon)
 *
 * Invariants:
 *   - NEVER exposes DATABASE_URL, database hostname, port, credentials,
 *     stack traces, or error messages.
 *   - NEVER exposes tenant or business data.
 *   - Public unauthenticated endpoint exposing only minimal binary status.
 *
 * Responses:
 *   200 {"ok": true, "database": "healthy"}       — Database is reachable
 *   429 {"ok": false, "database": "rate_limited"} — Rate limit exceeded (includes Retry-After)
 *   503 {"ok": false, "database": "unreachable"}  — Database unreachable
 */
export async function GET(request?: NextRequest) {
  const ip = request ? getClientIP(request) : '127.0.0.1';
  const rateLimitResult = await checkRateLimit(deepHealthRateLimit, `health-deep:${ip}`, {
    localLimit: DEEP_HEALTH_LOCAL_LIMIT,
    localWindowMs: DEEP_HEALTH_WINDOW_MS,
  });

  if (!rateLimitResult.success) {
    const retryAfter = String(rateLimitResult.retryAfter ?? 60);
    return NextResponse.json(
      { ok: false, database: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': retryAfter } }
    );
  }

  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true, database: 'healthy' });
  } catch {
    // Do not expose error details, hostnames, or credentials
    return NextResponse.json(
      { ok: false, database: 'unreachable' },
      { status: 503 }
    );
  }
}

/**
 * HEAD /api/health/deep
 *
 * Explicit HEAD handler for deep dependency check.
 *
 * Responses:
 *   200 (empty body) — Database is reachable
 *   429 (empty body, Retry-After) — Rate limit exceeded
 *   503 (empty body) — Database unreachable
 */
export async function HEAD(request?: NextRequest) {
  const ip = request ? getClientIP(request) : '127.0.0.1';
  const rateLimitResult = await checkRateLimit(deepHealthRateLimit, `health-deep:${ip}`, {
    localLimit: DEEP_HEALTH_LOCAL_LIMIT,
    localWindowMs: DEEP_HEALTH_WINDOW_MS,
  });

  if (!rateLimitResult.success) {
    const retryAfter = String(rateLimitResult.retryAfter ?? 60);
    return new Response(null, { status: 429, headers: { 'Retry-After': retryAfter } });
  }

  try {
    await db.execute(sql`SELECT 1`);
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
