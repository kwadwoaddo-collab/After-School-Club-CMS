import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { runSweeper, startInvocationBudget } from '@/lib/services/email-outbox';

export const maxDuration = 60;

/**
 * GET and POST handlers for email outbox cron sweeper.
 * Authenticated via CRON_SECRET (Bearer token).
 * Fails closed if CRON_SECRET is missing or invalid.
 */
export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  // Plan item 221 & Action 18: fails closed (401 without valid CRON_SECRET)
  const auth = verifyCronAuthorization(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error ?? 'Unauthorised' }, { status: 401 });
  }

  const budget = startInvocationBudget('cron', { budgetMs: 55000 });
  const report = await runSweeper({ budget });

  return NextResponse.json({
    ok: report.error === null,
    paused: report.paused,
    claimed: report.claimed,
    resultsCount: report.results.length,
    error: report.error,
  });
}
