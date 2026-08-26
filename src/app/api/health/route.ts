import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * GET /api/health
 *
 * Public health check endpoint for external uptime monitors.
 *
 * Checks:
 *   - Application is running (implicit in any response)
 *   - Database connectivity (executes a minimal SELECT 1 query)
 *
 * Responses:
 *   200 {"ok": true}  — all critical dependencies healthy
 *   503 {"ok": false} — database unreachable
 *
 * Security:
 *   - Returns ONLY ok/false status. No hostnames, credentials, stack
 *     traces, tenant data, or implementation details are ever exposed.
 *   - Does not require authentication.
 *   - Suitable for external uptime monitors such as UptimeRobot,
 *     Better Stack, or Vercel monitoring.
 *
 * Note: Redis and email providers (Resend) are deliberately excluded
 * from this check. Those providers can enter a degraded-but-available
 * state independently. Failing the entire health endpoint because
 * Upstash or Resend is unreachable would cause false-positive outage
 * alerts for the core application.
 */
export async function GET() {
  try {
    // Minimal read-only probe — validates connectivity without touching
    // any business data. Uses drizzle's sql tag to bypass the ORM layer
    // and catch even pool/credential failures.
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch {
    // Do not expose error detail: no message, hostname, or stack trace.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
