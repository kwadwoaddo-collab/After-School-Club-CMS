/**
 * Booking email outbox: bounded provider-free maintenance (E3 OPPORTUNISTIC MAINTENANCE, E4 ladder, E5 PAUSE SEMANTICS).
 * CMS-OPS-REMEDIATION-1C V15. Dependency direction: types -> classifier -> breaker -> claim -> dispatch -> maintenance -> email-outbox.
 *
 * Provider-free: nothing here ever calls the provider. The disposal pass uses the SAME ladder function the pre-send
 * validation uses (dispatch.decideMaintenance -> evaluateRungs1to5 / holds 6-7), fenced on the status the row was
 * evaluated in. While FEATURE_OUTBOX_WORKER_ENABLED is exactly 'false' ONLY the provider-free disposal, the raw-token scrub,
 * the 24 h / 72 h / 23 h anchors and the 72 h stale-PROCESSING disposal run; breaker promotion, probe selection, HALF_OPEN
 * recovery, fingerprint observation, stale-lease recovery to a send state, row-hold release and bulk release are skipped.
 *
 * ACTION-ORIGIN MAINTENANCE SCOPE (E3): at most ACTION_MAINTENANCE_MAX_ROWS (10) rows of provider-free disposal / token scrub
 * plus at most ONE breaker promotion or HALF_OPEN recovery attempt; never the 25-row bulk release; nothing breaker-locking
 * after ACTION_BUDGET_MS - 500 ms.
 */
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import {
  claimBulkReleaseCooldown,
  disposeExpiredProviderHolds,
  observeConfigFingerprint,
  promoteProbe,
  readBreakerSnapshot,
  recoverHalfOpenTimeout,
  releaseHeldRows,
  type FingerprintObservation,
  type PromoteProbeOutcome,
  type RootDb,
} from './email-outbox-breaker';
import { recoverStaleLeases } from './email-outbox-claim';
import {
  applyRungTarget,
  applyTokenScrub,
  decideMaintenance,
  isWorkerEnabled,
  maintenanceFence,
  readRungFacts,
  type InvocationBudget,
} from './email-outbox-dispatch';
import {
  ACTION_BUDGET_MS,
  ACTION_MAINTENANCE_MAX_ROWS,
  BACKSTOP_HOURS,
  BINNED_HOLD_HOURS,
  BULK_RELEASE_MAX_ROWS,
  DELIVERY_CEILING_HOURS,
  MAINTENANCE_MAX_ROWS,
  type DispatchOrigin,
  type OutboxStatus,
} from './email-outbox-types';

export interface MaintenanceOptions {
  origin: DispatchOrigin;
  /** Default: the worker flag (paused when FEATURE_OUTBOX_WORKER_ENABLED is exactly 'false'). */
  paused?: boolean;
  /** config_fingerprint of the running provider configuration (computed by the caller from email.ts parts). */
  fingerprint?: string | null;
  /** Invocation budget (action origin: the absolute breaker-statement deadline is ACTION_BUDGET_MS - 500 ms). */
  budget?: InvocationBudget;
  /** Override the disposal row bound (never above the origin bound). */
  disposalLimit?: number;
}

export interface MaintenanceReport {
  paused: boolean;
  origin: DispatchOrigin;
  candidatesEvaluated: number;
  disposed: number;
  moved: number;
  scrubbed: number;
  staleProcessingDisposed: number;
  staleLeasesRecovered: number;
  expiredHoldsDisposed: number;
  fingerprint: FingerprintObservation | null;
  halfOpenRecovered: boolean;
  probe: PromoteProbeOutcome | null;
  /** Set when a probe row was released to PENDING in this pass: the caller claims it in the same run. */
  probeOutboxId: string | null;
  bulkReleaseWinner: boolean;
  releasedHeldRows: number;
  /** The action-origin breaker statement was skipped because ACTION_BUDGET_MS - 500 ms had passed. */
  breakerSkippedForDeadline: boolean;
}

/** Disposal row bound by origin: 50 on route/cron, ACTION_MAINTENANCE_MAX_ROWS (10) on the Server-Action origin. */
export function disposalBound(origin: DispatchOrigin, override?: number): number {
  const base = origin === 'action' ? ACTION_MAINTENANCE_MAX_ROWS : MAINTENANCE_MAX_ROWS;
  return Math.min(Math.max(1, Math.floor(override ?? base)), base);
}

/**
 * Rows that MAY need a provider-free decision (bounded, oldest first). A pre-filter only: the authoritative decision is
 * decideMaintenance on database-clock facts, applied under a status fence.
 */
export async function selectMaintenanceCandidates(rootDb: RootDb, limit: number): Promise<{ id: string; status: OutboxStatus }[]> {
  const rows = await rootDb.execute(sql`
    SELECT o.id, o.status::text AS status
    FROM booking_email_outbox o
    LEFT JOIN bookings b ON b.id = o.booking_id
    LEFT JOIN parents p ON p.id = b.parent_id
    WHERE o.status IN ('PENDING','RETRY_SCHEDULED','HELD_PARENT_BINNED','HELD_BOOKING_PENDING','HELD_PROVIDER_OPERATIONAL')
      AND (
        b.id IS NULL OR p.id IS NULL
        OR b.communication_version <> o.transition_version
        OR (o.communication_type <> 'BOOKING_CANCELLED' AND b.status::text NOT IN ('confirmed','signed_up','pending'))
        OR (o.communication_type = 'BOOKING_CANCELLED' AND b.status::text <> 'cancelled')
        OR (o.communication_type <> 'BOOKING_CANCELLED' AND b.start_at <= now())
        OR o.created_at <= now() - make_interval(hours => ${DELIVERY_CEILING_HOURS})
        OR (o.first_provider_attempt_at IS NOT NULL AND o.first_provider_attempt_at <= now() - make_interval(hours => ${BACKSTOP_HOURS}))
        OR (o.status = 'HELD_PARENT_BINNED' AND (p.deleted_at IS NULL OR o.first_held_at + make_interval(hours => ${BINNED_HOLD_HOURS}) <= now()))
        OR (o.status = 'HELD_BOOKING_PENDING' AND (b.status::text <> 'pending' OR p.deleted_at IS NOT NULL))
        OR (o.status = 'PENDING' AND (p.deleted_at IS NOT NULL OR b.status::text = 'pending'))
        OR (o.payload IS NOT NULL AND jsonb_exists(o.payload, 'magicLink') AND o.communication_type = 'BOOKING_CONFIRMATION'
            AND o.link_mode IS DISTINCT FROM 'PORTAL_URL'
            AND (o.link_mode = 'LINK_FREE'
                 OR (o.first_provider_attempt_at IS NULL AND (p.magic_link_expires_at IS NULL OR p.magic_link_expires_at <= now()))))
        OR (o.link_mode = 'WITH_LINK' AND o.first_provider_attempt_at IS NOT NULL
            AND (p.magic_link_expires_at IS NULL OR p.magic_link_expires_at <= now()))
      )
    ORDER BY o.created_at ASC
    LIMIT ${limit}
  `);
  return (rows as unknown as { id: string; status: OutboxStatus }[]).map((r) => ({ id: r.id, status: r.status }));
}

/** Provider-free disposal / hold / release / token-scrub pass over at most `limit` rows. */
export async function disposalPass(
  rootDb: RootDb,
  limit: number,
): Promise<{ evaluated: number; disposed: number; moved: number; scrubbed: number }> {
  const candidates = await selectMaintenanceCandidates(rootDb, limit);
  let disposed = 0;
  let moved = 0;
  let scrubbed = 0;
  for (const c of candidates) {
    const facts = await readRungFacts(rootDb, c.id);
    if (!facts || facts.status !== c.status || facts.status === 'PROCESSING') continue;
    const decision = decideMaintenance(facts);
    if (decision.scrub && (await applyTokenScrub(rootDb, c.id))) scrubbed += 1;
    if (decision.action === 'DISPOSE') {
      if (await applyRungTarget(rootDb, decision.target, maintenanceFence(c.id, facts.status))) disposed += 1;
    } else if (decision.action === 'MOVE') {
      if (await applyRungTarget(rootDb, decision.target, maintenanceFence(c.id, facts.status))) moved += 1;
    }
  }
  return { evaluated: candidates.length, disposed, moved, scrubbed };
}

/**
 * Provider-free 72 h disposal of PROCESSING rows whose lease has expired (also while paused): ATTENTION(DELIVERY_WINDOW_72H),
 * payload NULL, claim cleared, fenced on the expired lease. No provider call and no lease recovery to a send state.
 */
export async function disposeStaleProcessingPast72h(rootDb: RootDb, limit: number): Promise<number> {
  const rows = await rootDb.execute(sql`
    WITH pick AS (
      SELECT id FROM booking_email_outbox
      WHERE status = 'PROCESSING' AND claim_expires_at IS NOT NULL AND claim_expires_at <= now()
        AND created_at <= now() - make_interval(hours => ${DELIVERY_CEILING_HOURS})
      ORDER BY created_at ASC LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE booking_email_outbox o
    SET status = 'ATTENTION', attention_reason = 'DELIVERY_WINDOW_72H', payload = NULL,
        claim_token = NULL, claim_expires_at = NULL, updated_at = now()
    FROM pick
    WHERE o.id = pick.id AND o.status = 'PROCESSING' AND o.claim_expires_at <= now()
    RETURNING o.id
  `);
  return rows.length;
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : 'UnknownError';
}

/**
 * The bounded maintenance function shared by the sweeper (cron), the route-origin fast path (before claiming) and the
 * action-origin leftover scope. Never throws: each step logs the error NAME only and the pass continues.
 */
export async function runMaintenance(rootDb: RootDb, opts: MaintenanceOptions): Promise<MaintenanceReport> {
  const paused = opts.paused ?? !isWorkerEnabled();
  const isAction = opts.origin === 'action';
  const limit = disposalBound(opts.origin, opts.disposalLimit);
  const report: MaintenanceReport = {
    paused, origin: opts.origin, candidatesEvaluated: 0, disposed: 0, moved: 0, scrubbed: 0,
    staleProcessingDisposed: 0, staleLeasesRecovered: 0, expiredHoldsDisposed: 0, fingerprint: null,
    halfOpenRecovered: false, probe: null, probeOutboxId: null, bulkReleaseWinner: false, releasedHeldRows: 0,
    breakerSkippedForDeadline: false,
  };
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (err) {
      logger.warn('email_outbox_maintenance_step_failed', { event: 'email_outbox_maintenance_step_failed', step: name, errorName: errName(err), origin: opts.origin });
      return undefined;
    }
  };

  // ---- provider-free disposal (runs even while paused)
  const pass = await step('disposal', () => disposalPass(rootDb, limit));
  if (pass) {
    report.candidatesEvaluated = pass.evaluated;
    report.disposed = pass.disposed;
    report.moved = pass.moved;
    report.scrubbed = pass.scrubbed;
  }
  if (!isAction) {
    report.staleProcessingDisposed = (await step('stale72h', () => disposeStaleProcessingPast72h(rootDb, limit))) ?? 0;
    report.expiredHoldsDisposed = (await step('holdAnchors', () => disposeExpiredProviderHolds(rootDb, { limit }))) ?? 0;
  }
  if (paused) return report; // breaker and held-row state are FROZEN while paused

  // ---- worker enabled
  if (isAction) {
    // at most ONE breaker promotion or HALF_OPEN recovery attempt, never after ACTION_BUDGET_MS - 500 ms
    if (opts.budget && opts.budget.elapsedMs() >= ACTION_BUDGET_MS - 500) {
      report.breakerSkippedForDeadline = true;
      return report;
    }
    await step('breakerOne', async () => {
      const snap = await readBreakerSnapshot(rootDb);
      if (snap.state === 'HALF_OPEN') report.halfOpenRecovered = await recoverHalfOpenTimeout(rootDb);
      else if (snap.state === 'OPEN' && snap.nextProbeAt && snap.nextProbeAt.getTime() <= snap.dbNow.getTime()) {
        report.probe = await promoteProbe(rootDb);
        if (report.probe.kind === 'PROBE_SET') report.probeOutboxId = report.probe.probeOutboxId;
      }
    });
    return report;
  }

  report.staleLeasesRecovered = (await step('staleLeases', () => recoverStaleLeases(rootDb, { limit }))) ?? 0;
  if (opts.fingerprint) report.fingerprint = (await step('fingerprint', () => observeConfigFingerprint(rootDb, opts.fingerprint as string))) ?? null;
  report.halfOpenRecovered = (await step('halfOpenTimeout', () => recoverHalfOpenTimeout(rootDb))) ?? false;
  report.probe = (await step('promoteProbe', () => promoteProbe(rootDb))) ?? null;
  if (report.probe?.kind === 'PROBE_SET') report.probeOutboxId = report.probe.probeOutboxId;
  // bulk release: only the winner of the one conditional UPDATE (CLOSED, cooldown 60 s) releases up to 25 rows, AFTER the lock is gone
  report.bulkReleaseWinner = (await step('bulkCooldown', () => claimBulkReleaseCooldown(rootDb))) ?? false;
  if (report.bulkReleaseWinner) {
    const released = await step('bulkRelease', () => releaseHeldRows(rootDb, { limit: BULK_RELEASE_MAX_ROWS }));
    report.releasedHeldRows = released ? released.length : 0;
  }
  return report;
}
