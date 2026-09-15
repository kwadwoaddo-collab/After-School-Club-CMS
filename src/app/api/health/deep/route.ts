import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * GET /api/health/deep
 *
 * Explicit dependency health check endpoint.
 *
 * Checks:
 *   - Application runtime is operational
 *   - Database connectivity (executes a minimal SELECT 1 probe against Neon)
 *
 * Invariants:
 *   - NEVER exposes DATABASE_URL, database hostname, port, credentials,
 *     stack traces, or error messages.
 *   - NEVER exposes tenant or business data.
 *   - Public unauthenticated endpoint exposing only minimal binary status.
 *
 * Recommended usage:
 *   - Low-frequency dependency monitoring (e.g. 30-60 minute intervals).
 *   - Do NOT use for high-frequency (<= 5 minute) uptime pinging.
 *
 * Responses:
 *   200 {"ok": true, "database": "healthy"}    — Database is reachable
 *   503 {"ok": false, "database": "unreachable"} — Database unreachable
 */
export async function GET() {
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
 *   503 (empty body) — Database unreachable
 */
export async function HEAD() {
  try {
    await db.execute(sql`SELECT 1`);
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
