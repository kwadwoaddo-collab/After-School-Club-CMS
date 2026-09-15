import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Shallow health check endpoint for frequent external uptime monitoring.
 *
 * Checks:
 *   - Application runtime is alive and responding to HTTP requests.
 *
 * Invariants:
 *   - ZERO database queries or connection initialization.
 *   - ZERO external network or API calls.
 *   - ZERO authentication, session, or cookie processing.
 *   - ZERO secret or configuration exposure.
 *
 * Responses:
 *   200 {"ok": true} — application runtime is operational
 *
 * Suitable for high-frequency (e.g. 1-minute to 5-minute) uptime probes
 * without preventing serverless database compute (Neon) from autosuspending.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

/**
 * HEAD /api/health
 *
 * Explicit HEAD handler for uptime monitors that probe using HEAD requests.
 *
 * Responses:
 *   200 (empty body) — application runtime is operational
 *
 * Invariants:
 *   - ZERO database operations.
 *   - ZERO body payload.
 */
export async function HEAD() {
  return new Response(null, { status: 200 });
}
