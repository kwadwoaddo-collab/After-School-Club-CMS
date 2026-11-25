import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { runSweeper, startInvocationBudget } from '@/lib/services/email-outbox';

export const maxDuration = 60;

/**
 * GET and POST handlers for email outbox cron sweeper.
 * Authenticated via CRON_SECRET (Bearer token).
 * Fails closed (503 if CRON_SECRET is unset; 401 if invalid).
 */
export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const auth = verifyCronAuthorization(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorised' },
      { status: auth.status ?? 401 },
    );
  }

  const budget = startInvocationBudget('cron', { budgetMs: 50_000 });
  const report = await runSweeper({ budget });

  const body = {
    ok: report.error === null,
    paused: report.paused,
    claimed: report.claimed,
    resultsCount: report.results.length,
    error: report.error,
  };

  if (report.error !== null) {
    logger.error('[cron/email-outbox] Sweeper reported error', {
      error: report.error,
      claimed: report.claimed,
      paused: report.paused,
    });
    return NextResponse.json(body, { status: 500 });
  }

  return NextResponse.json(body);
}
