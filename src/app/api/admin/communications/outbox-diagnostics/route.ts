import { NextRequest, NextResponse } from 'next/server';
import { getTypedSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { db } from '@/db';
import {
  getPlatformDiagnostics,
  getTenantDiagnostics,
  resolveDiagnosticsScope,
} from '@/lib/services/email-outbox';

export const maxDuration = 60;

/**
 * GET /api/admin/communications/outbox-diagnostics
 *
 * Implements Action 19 and human decision H-23:
 * (1) TENANT scope (default): session ORG_OWNER (org-wide) or MANAGER (assigned centres);
 *     Every query carries server-side organisation_id filter;
 *     Returns PII-free counts (no breaker, no provider reason/error name/probe time).
 *     ORG_OWNER additionally receives up to 100 non-PII identifiers for own org.
 * (2) PLATFORM scope (?scope=platform):
 *     Returned only when session email passes isPlatformAdmin (fail-closed).
 *     Non-admin requesting platform scope receives a 404 Not Found response
 *     indistinguishable from an unknown route.
 */
export async function GET(request: NextRequest) {
  const session = await getTypedSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedScope = searchParams.get('scope');

  const scope = resolveDiagnosticsScope({
    requestedScope,
    email: session.user.email,
  });

  // If platform scope was explicitly requested but user is not a platform admin, return 404
  if (scope === 'NOT_FOUND') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (scope === 'PLATFORM') {
    const data = await getPlatformDiagnostics(db);
    return NextResponse.json(data);
  }

  // TENANT scope
  const role = session.user.role;
  if (role !== 'ORG_OWNER' && role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const organisationId = session.user.organisationId;
  if (!organisationId) {
    // A platform admin without a tenant organisation in tenant scope gets an empty result (never all orgs)
    return NextResponse.json({
      scope: 'TENANT',
      counts: {
        backlog: 0,
        retryScheduled: 0,
        retryScheduledStamped: 0,
        processing: 0,
        held: 0,
        heldParentBinned: 0,
        heldBookingPending: 0,
        failedPermanent: 0,
        skippedPastSession: 0,
        accepted: 0,
      },
      attentionByReason: {},
    });
  }

  let centreIds: string[] | null = null;
  if (role === 'MANAGER') {
    centreIds = await getUserAccessibleCentreIds(session.user.id);
  }

  const includeIdentifiers = role === 'ORG_OWNER';

  const data = await getTenantDiagnostics(db, {
    organisationId,
    centreIds,
    includeIdentifiers,
  });

  return NextResponse.json(data);
}
