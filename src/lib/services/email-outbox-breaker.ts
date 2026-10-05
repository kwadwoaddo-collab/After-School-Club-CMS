/**
 * Booking email outbox: circuit-breaker / pacing table access (E3, E5).
 * CMS-OPS-REMEDIATION-1C V15. Dependency direction: types -> classifier -> breaker -> claim -> dispatch.
 *
 * Breaker LOCK SECTION (a): the stamp transaction. Lock order everywhere: breaker row FIRST, outbox row SECOND.
 * Other sections (b)-(e) (finalisation incl. the CONFIG precheck, probe promotion, bulk release cooldown, conditional
 * changes) now live below in this same file so the lock-section inventory is reviewable in one place (plan 323).
 *
 * Accident prevention: functions take a RootDb that a transaction handle cannot satisfy, and no transaction
 * is ever open across a provider request: the stamp transaction commits (or rolls back) before it returns.
 */
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { db as rootDbInstance } from '@/db';
import {
  breakerReasonOutranks,
  classifyMissingApiKey,
  nextProbeAt,
  type Classification,
} from './email-outbox-classifier';
import {
  BACKSTOP_HOURS,
  BULK_RELEASE_COOLDOWN_SECONDS,
  BULK_RELEASE_MAX_ROWS,
  CODE_CONTRACT_ESCALATION_MIN_RECIPIENTS,
  CODE_CONTRACT_ESCALATION_WINDOW_MS,
  DELIVERY_CEILING_HOURS,
  HALF_OPEN_TIMEOUT_MS,
  MAINTENANCE_MAX_ROWS,
  PROVIDER_STATE_ID,
  PROVIDER_UNAVAILABLE_MIN_RECIPIENTS,
  PROVIDER_UNAVAILABLE_MIN_ROWS,
  PROVIDER_UNAVAILABLE_WINDOW_MS,
  RAMP_AFTER_CLOSE_MS,
  RATE_LIMIT_ESCALATION_HOLD_HITS,
  RATE_LIMIT_ESCALATION_WINDOW_MS,
  STAMP_LOCK_TIMEOUT_MS,
  STAMP_STATEMENT_TIMEOUT_MS,
  type BreakerReason,
  type BreakerState,
  type CommunicationType,
  type LinkMode,
  type StampRefusal,
  type StampResult,
} from './email-outbox-types';

/** The ROOT drizzle client (carries $client, which a Tx handle does not). */
export type RootDb = typeof rootDbInstance;

export type StampOutcome =
  | { kind: 'STAMPED'; stamp: StampResult }
  | { kind: 'REFUSED'; refusal: StampRefusal };

/** Sentinel thrown inside the stamp transaction to force ROLLBACK on a zero-row stamp. */
class StampZeroRows extends Error {
  constructor() {
    super('STAMP_ZERO_ROWS');
    this.name = 'StampZeroRows';
  }
}

/** drizzle-orm wraps driver errors in DrizzleQueryError with the SQLSTATE on cause. */
export function readSqlState(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null | undefined;
  const direct = e?.code;
  if (typeof direct === 'string') return direct;
  const nested = e?.cause?.code;
  return typeof nested === 'string' ? nested : undefined;
}

function assertSafeTimeout(ms: number): string {
  if (!Number.isInteger(ms) || ms <= 0) throw new Error('invalid timeout constant');
  return String(ms);
}

/**
 * First-provider-attempt stamp transaction (E5 item 4, breaker lock section (a)).
 * BEGIN; transaction-local lock/statement timeouts (set_config, never bind-parameterised SET);
 * breaker row FOR UPDATE first; bucket CTE + fenced outbox stamp UPDATE; COMMIT.
 * Zero rows => ROLLBACK (no bucket token consumed) and REFUSED/ZERO_ROWS; the caller distinguishes the
 * cause with lock-free reads OUTSIDE any transaction and performs any pacing wait AFTER this returns.
 * 55P03 / 57014 are releases, not retries: REFUSED with the matching refusal. Other errors are rethrown.
 */
export async function stampFirstProviderAttempt(
  rootDb: RootDb,
  params: { id: string; claimToken: string; chosenLinkMode: LinkMode },
): Promise<StampOutcome> {
  const lockMs = assertSafeTimeout(STAMP_LOCK_TIMEOUT_MS);
  const stmtMs = assertSafeTimeout(STAMP_STATEMENT_TIMEOUT_MS);
  try {
    const stamp = await rootDb.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('lock_timeout', ${lockMs}, true)`);
      await tx.execute(sql`SELECT set_config('statement_timeout', ${stmtMs}, true)`);
      await tx.execute(
        sql`SELECT 1 FROM booking_email_provider_state WHERE id = ${PROVIDER_STATE_ID} FOR UPDATE`,
      );
      const rows = await tx.execute(sql`
        WITH b AS (
          UPDATE booking_email_provider_state
          SET dispatch_window_start = CASE WHEN dispatch_window_start IS NULL OR dispatch_window_start <= now() - interval '1 second' THEN now() ELSE dispatch_window_start END,
              dispatch_window_count = CASE WHEN dispatch_window_start IS NULL OR dispatch_window_start <= now() - interval '1 second' THEN 1 ELSE dispatch_window_count + 1 END
          WHERE id = ${PROVIDER_STATE_ID}
            AND (state = 'CLOSED' OR (state = 'HALF_OPEN' AND probe_outbox_id = ${params.id}::uuid))
            AND (dispatch_window_start IS NULL
                 OR dispatch_window_start <= now() - interval '1 second'
                 OR dispatch_window_count < CASE WHEN ramp_until > now() THEN 1 ELSE 2 END)
          RETURNING 1
        )
        UPDATE booking_email_outbox
        SET first_provider_attempt_at = COALESCE(first_provider_attempt_at, now()),
            link_mode = COALESCE(link_mode, ${params.chosenLinkMode}::text),
            attempt_count = attempt_count + 1,
            payload = CASE WHEN COALESCE(link_mode, ${params.chosenLinkMode}::text) = 'LINK_FREE' THEN payload - 'magicLink' ELSE payload END
        WHERE id = ${params.id}::uuid
          AND claim_token = ${params.claimToken}::uuid
          AND status = 'PROCESSING'
          AND claim_expires_at > now()
          AND (first_provider_attempt_at IS NULL OR first_provider_attempt_at > now() - interval '22 hours')
          AND EXISTS (SELECT 1 FROM b)
        RETURNING id, idempotency_epoch, first_provider_attempt_at, attempt_count,
          (SELECT probe_outbox_id = ${params.id}::uuid FROM booking_email_provider_state WHERE id = ${PROVIDER_STATE_ID}) AS is_probe
      `);
      if (rows.length === 0) throw new StampZeroRows(); // ROLLBACK: no bucket token consumed
      const r = rows[0] as {
        id: string;
        idempotency_epoch: number;
        first_provider_attempt_at: Date | string;
        attempt_count: number;
        is_probe: boolean | null;
      };
      return {
        id: r.id,
        idempotencyEpoch: r.idempotency_epoch,
        firstProviderAttemptAt: new Date(r.first_provider_attempt_at),
        attemptCount: r.attempt_count,
        isProbe: r.is_probe === true,
      } satisfies StampResult;
    });
    return { kind: 'STAMPED', stamp };
  } catch (err) {
    if (err instanceof StampZeroRows) return { kind: 'REFUSED', refusal: 'ZERO_ROWS' };
    const code = readSqlState(err);
    if (code === '55P03') return { kind: 'REFUSED', refusal: 'LOCK_TIMEOUT_55P03' };
    if (code === '57014') return { kind: 'REFUSED', refusal: 'STATEMENT_TIMEOUT_57014' };
    throw err;
  }
}

// ============================================================================
// Sections (b)-(e) (E3 BREAKER LOCK SECTIONS). Lock order: breaker row FIRST, outbox row SECOND, everywhere.
// INVARIANT: no transaction that holds an outbox row lock ever requests the breaker row lock.
// ============================================================================

/** The transaction handle drizzle passes to RootDb.transaction callbacks. */
export type Tx = Parameters<Parameters<RootDb['transaction']>[0]>[0];

/** Sentinel thrown inside a breaker-locked transaction to force ROLLBACK when the fenced outbox UPDATE hit zero rows. */
class FenceLost extends Error {
  constructor() {
    super('FENCE_LOST');
    this.name = 'FenceLost';
  }
}

const DELETED_RECIPIENT = '[REDACTED_DELETED]';

export interface BreakerSnapshot {
  state: BreakerState;
  reason: BreakerReason | null;
  errorName: string | null;
  nextProbeAt: Date | null;
  probeOutboxId: string | null;
  probeStartedAt: Date | null;
  consecutiveFailures: number;
  rampUntil: Date | null;
  /** Database clock (transaction start) used for every schedule computed in the same transaction. */
  dbNow: Date;
}

interface BreakerRowRaw {
  state: BreakerState;
  reason: BreakerReason | null;
  error_name: string | null;
  next_probe_at: Date | string | null;
  probe_outbox_id: string | null;
  probe_started_at: Date | string | null;
  consecutive_failures: number;
  ramp_until: Date | string | null;
  db_now: Date | string;
}

function toSnapshot(r: BreakerRowRaw): BreakerSnapshot {
  return {
    state: r.state,
    reason: r.reason,
    errorName: r.error_name,
    nextProbeAt: r.next_probe_at ? new Date(r.next_probe_at) : null,
    probeOutboxId: r.probe_outbox_id,
    probeStartedAt: r.probe_started_at ? new Date(r.probe_started_at) : null,
    consecutiveFailures: r.consecutive_failures,
    rampUntil: r.ramp_until ? new Date(r.ramp_until) : null,
    dbNow: new Date(r.db_now),
  };
}

const BREAKER_COLUMNS = sql`state, reason, error_name, next_probe_at, probe_outbox_id, probe_started_at, consecutive_failures, ramp_until, now() AS db_now`;

/** Breaker row lock (FOR UPDATE) as the FIRST statement of a breaker section. */
async function lockBreaker(tx: Tx): Promise<BreakerSnapshot> {
  const rows = await tx.execute(
    sql`SELECT ${BREAKER_COLUMNS} FROM booking_email_provider_state WHERE id = ${PROVIDER_STATE_ID} FOR UPDATE`,
  );
  return toSnapshot(rows[0] as unknown as BreakerRowRaw);
}

/** Non-locking read of the breaker singleton (diagnostics, predicate re-checks, tests). */
export async function readBreakerSnapshot(rootDb: RootDb): Promise<BreakerSnapshot> {
  const rows = await rootDb.execute(
    sql`SELECT ${BREAKER_COLUMNS} FROM booking_email_provider_state WHERE id = ${PROVIDER_STATE_ID}`,
  );
  return toSnapshot(rows[0] as unknown as BreakerRowRaw);
}

function iso(d: Date): string {
  return d.toISOString();
}
function seconds(ms: number): number {
  return Math.round(ms / 1000);
}

async function setLockTimeout(tx: Tx, ms: number): Promise<void> {
  await tx.execute(sql`SELECT set_config('lock_timeout', ${assertSafeTimeout(ms)}, true)`);
}

// ---------------------------------------------------------------------------
// Breaker state writers (called only while the breaker row lock is held)
// ---------------------------------------------------------------------------
async function writeOpen(
  tx: Tx,
  b: BreakerSnapshot,
  reason: BreakerReason,
  errorName: string | null,
  retryAfterSeconds: number | null,
): Promise<Date> {
  const probeAt = nextProbeAt(reason, b.consecutiveFailures, b.dbNow, retryAfterSeconds);
  await tx.execute(sql`
    UPDATE booking_email_provider_state
    SET state = 'OPEN',
        reason = ${reason},
        error_name = ${errorName},
        opened_at = CASE WHEN state = 'CLOSED' THEN now() ELSE opened_at END,
        next_probe_at = ${iso(probeAt)}::timestamptz,
        probe_started_at = NULL,
        probe_outbox_id = NULL,
        consecutive_failures = consecutive_failures + 1,
        updated_at = now()
    WHERE id = ${PROVIDER_STATE_ID}
  `);
  return probeAt;
}

async function writeClose(tx: Tx, resetFailures: boolean): Promise<void> {
  const rampSeconds = seconds(RAMP_AFTER_CLOSE_MS);
  await tx.execute(sql`
    UPDATE booking_email_provider_state
    SET state = 'CLOSED',
        reason = NULL,
        error_name = NULL,
        next_probe_at = NULL,
        probe_started_at = NULL,
        probe_outbox_id = NULL,
        consecutive_failures = CASE WHEN ${resetFailures} THEN 0 ELSE consecutive_failures END,
        ramp_until = now() + make_interval(secs => ${rampSeconds}),
        updated_at = now()
    WHERE id = ${PROVIDER_STATE_ID}
  `);
}

/** Late failure while not CLOSED: reason may only ESCALATE by precedence; consecutive_failures untouched; next_probe_at never shortened. */
async function writeEscalation(
  tx: Tx,
  b: BreakerSnapshot,
  reason: BreakerReason,
  errorName: string | null,
  retryAfterSeconds: number | null,
): Promise<boolean> {
  if (!breakerReasonOutranks(reason, b.reason)) return false;
  const probeAt = nextProbeAt(reason, b.consecutiveFailures, b.dbNow, retryAfterSeconds);
  await tx.execute(sql`
    UPDATE booking_email_provider_state
    SET reason = ${reason},
        error_name = ${errorName},
        next_probe_at = GREATEST(next_probe_at, ${iso(probeAt)}::timestamptz),
        updated_at = now()
    WHERE id = ${PROVIDER_STATE_ID}
  `);
  return true;
}

// ---------------------------------------------------------------------------
// Evidence queries (run under the breaker lock, after the fenced outbox UPDATE, in the same transaction)
// ---------------------------------------------------------------------------
/**
 * PROVIDER_UNAVAILABLE rule. Reads ONLY last_unknown_at and accepted_at: >= 2 DISTINCT rows AND >= 2 DISTINCT
 * recipients with last_unknown_at inside the window AND no accepted_at anywhere inside the window.
 * A known post-stamp no-call never writes last_unknown_at, so it can never contribute.
 */
async function providerUnavailableEvidence(tx: Tx): Promise<boolean> {
  const windowS = seconds(PROVIDER_UNAVAILABLE_WINDOW_MS);
  const rows = await tx.execute(sql`
    SELECT COUNT(DISTINCT id)::int AS n_rows,
           COUNT(DISTINCT recipient_email)::int AS n_recipients,
           EXISTS (SELECT 1 FROM booking_email_outbox a WHERE a.accepted_at > now() - make_interval(secs => ${windowS})) AS has_accept
    FROM booking_email_outbox
    WHERE last_unknown_at > now() - make_interval(secs => ${windowS})
      AND recipient_email <> ${DELETED_RECIPIENT}
  `);
  const r = rows[0] as unknown as { n_rows: number; n_recipients: number; has_accept: boolean };
  return r.n_rows >= PROVIDER_UNAVAILABLE_MIN_ROWS && r.n_recipients >= PROVIDER_UNAVAILABLE_MIN_RECIPIENTS && !r.has_accept;
}

/** 429 escalation (i): >= 2 distinct rows rate-limited within 5 min and no accepted send after the earlier of the two latest. */
async function rateLimitPairEvidence(tx: Tx): Promise<boolean> {
  const windowS = seconds(RATE_LIMIT_ESCALATION_WINDOW_MS);
  const rows = await tx.execute(sql`
    WITH r AS (
      SELECT id, last_rate_limited_at AS t
      FROM booking_email_outbox
      WHERE last_rate_limited_at > now() - make_interval(secs => ${windowS})
      ORDER BY last_rate_limited_at DESC
      LIMIT 2
    )
    SELECT COUNT(*)::int AS n,
           EXISTS (SELECT 1 FROM booking_email_outbox a WHERE a.accepted_at > (SELECT MIN(t) FROM r)) AS accepted_after
    FROM r
  `);
  const r = rows[0] as unknown as { n: number; accepted_after: boolean };
  return r.n >= 2 && !r.accepted_after;
}

async function rowHoldHits(tx: Tx, outboxId: string): Promise<number> {
  const rows = await tx.execute(sql`SELECT hold_hits FROM booking_email_outbox WHERE id = ${outboxId}::uuid`);
  return rows.length === 0 ? 0 : (rows[0] as unknown as { hold_hits: number }).hold_hits;
}

/**
 * CODE_CONTRACT global escalation: >= 3 DISTINCT recipients whose latest row with last_error_name = name has
 * last_error_at inside 15 min AND no ACCEPTED send of ANY type after the earliest qualifying failure
 * (an accepted send BEFORE the earliest failure is not counter-evidence).
 */
async function codeContractEvidence(tx: Tx, errorName: string): Promise<boolean> {
  const windowS = seconds(CODE_CONTRACT_ESCALATION_WINDOW_MS);
  const rows = await tx.execute(sql`
    WITH per AS (
      SELECT recipient_email, MAX(last_error_at) AS t
      FROM booking_email_outbox
      WHERE last_error_name = ${errorName}
        AND last_error_at > now() - make_interval(secs => ${windowS})
        AND recipient_email <> ${DELETED_RECIPIENT}
      GROUP BY recipient_email
    )
    SELECT COUNT(*)::int AS n,
           EXISTS (SELECT 1 FROM booking_email_outbox a WHERE a.accepted_at > (SELECT MIN(t) FROM per)) AS accepted_after
    FROM per
  `);
  const r = rows[0] as unknown as { n: number; accepted_after: boolean };
  return r.n >= CODE_CONTRACT_ESCALATION_MIN_RECIPIENTS && !r.accepted_after;
}

// ---------------------------------------------------------------------------
// Section (b): finalisation under the breaker lock (+ CONFIG precheck)
// ---------------------------------------------------------------------------
export type BreakerAction =
  | 'NONE'
  | 'OPENED'
  | 'REOPENED_FROM_PROBE'
  | 'CLOSED_BY_PROBE'
  | 'REASON_ESCALATED';

export interface BreakerDecision {
  action: BreakerAction;
  reason: BreakerReason | null;
  /** The finalised row was the HALF_OPEN probe (decided from the LOCKED state, not from the caller's flag). */
  wasProbe: boolean;
  nextProbeAt: Date | null;
}

export type BreakerFinalisation =
  | { kind: 'FENCE_LOST' }
  | { kind: 'FINALISED'; decision: BreakerDecision; rowHoldsConverted: number };

export interface FinaliseUnderBreakerLockParams {
  outboxId: string;
  classification: Classification;
  /**
   * The dispatch module's fenced outbox UPDATE plan (WHERE id AND claim_token AND status = 'PROCESSING'). Runs
   * AFTER the breaker row is locked. Return false on zero rows: the transaction ROLLS BACK and the breaker is untouched.
   */
  applyRowUpdate: (tx: Tx) => Promise<boolean>;
}

const NO_DECISION = (wasProbe: boolean): BreakerDecision => ({ action: 'NONE', reason: null, wasProbe, nextProbeAt: null });

/** Decide and write the breaker change for a finalised outcome. Called only while the breaker row lock is held. */
async function decideAndApplyBreaker(
  tx: Tx,
  b: BreakerSnapshot,
  outboxId: string,
  c: Classification,
): Promise<BreakerDecision> {
  const isProbe = b.state === 'HALF_OPEN' && b.probeOutboxId === outboxId;

  if (isProbe) {
    switch (c.category) {
      case 'ACCEPTED':
        await writeClose(tx, true); // consecutive_failures resets to 0 ONLY on an ACCEPTED probe
        return { action: 'CLOSED_BY_PROBE', reason: null, wasProbe: true, nextProbeAt: null };
      case 'CODE_CONTRACT':
      case 'IDEMPOTENCY':
        // A definitive non-operational response proves the credentials work: CLOSED; the row follows its own rule.
        await writeClose(tx, false);
        return { action: 'CLOSED_BY_PROBE', reason: null, wasProbe: true, nextProbeAt: null };
      case 'CONFIG':
      case 'QUOTA_DAILY':
      case 'QUOTA_MONTHLY':
      case 'RATE_LIMIT': {
        const at = await writeOpen(tx, b, c.breakerReason, c.errorName, c.category === 'RATE_LIMIT' ? c.retryAfterSeconds : null);
        return { action: 'REOPENED_FROM_PROBE', reason: c.breakerReason, wasProbe: true, nextProbeAt: at };
      }
      case 'UNKNOWN': {
        const at = await writeOpen(tx, b, 'PROVIDER_UNAVAILABLE', null, null);
        return { action: 'REOPENED_FROM_PROBE', reason: 'PROVIDER_UNAVAILABLE', wasProbe: true, nextProbeAt: at };
      }
    }
  }

  // Candidate breaker change for a non-probe outcome.
  let candidate: { reason: BreakerReason; errorName: string | null; retryAfter: number | null } | null = null;
  switch (c.category) {
    case 'CONFIG':
    case 'QUOTA_DAILY':
    case 'QUOTA_MONTHLY':
      candidate = { reason: c.breakerReason, errorName: c.errorName, retryAfter: null };
      break;
    case 'RATE_LIMIT':
      if (c.exceedsMaxRetryAfter) {
        candidate = { reason: 'RATE_LIMIT', errorName: c.errorName, retryAfter: c.retryAfterSeconds };
      } else if ((await rateLimitPairEvidence(tx)) || (await rowHoldHits(tx, outboxId)) >= RATE_LIMIT_ESCALATION_HOLD_HITS) {
        candidate = { reason: 'RATE_LIMIT', errorName: c.errorName, retryAfter: c.retryAfterSeconds };
      }
      break;
    case 'CODE_CONTRACT':
      if (await codeContractEvidence(tx, c.errorName)) {
        candidate = { reason: 'CONFIG', errorName: c.errorName, retryAfter: null };
      }
      break;
    case 'UNKNOWN':
      if (c.counted && (await providerUnavailableEvidence(tx))) {
        candidate = { reason: 'PROVIDER_UNAVAILABLE', errorName: null, retryAfter: null };
      }
      break;
    case 'ACCEPTED':
    case 'IDEMPOTENCY':
      break;
  }
  if (!candidate) return NO_DECISION(false);

  if (b.state === 'CLOSED') {
    const at = await writeOpen(tx, b, candidate.reason, candidate.errorName, candidate.retryAfter);
    return { action: 'OPENED', reason: candidate.reason, wasProbe: false, nextProbeAt: at };
  }
  // OPEN, or HALF_OPEN with a different probe: late failure => precedence escalation only.
  const escalated = await writeEscalation(tx, b, candidate.reason, candidate.errorName, candidate.retryAfter);
  return escalated
    ? { action: 'REASON_ESCALATED', reason: candidate.reason, wasProbe: false, nextProbeAt: null }
    : NO_DECISION(false);
}

/**
 * Section (b): ONE transaction. (0) breaker row FOR UPDATE FIRST (no unlocked pre-read); (1) the fenced outbox
 * UPDATE supplied by the dispatcher (zero rows => ROLLBACK, breaker untouched, lock released); (2) escalation
 * evidence + breaker UPDATE; COMMIT. No lock_timeout is applied (finalisation outlasting the platform kill is
 * recovered by the stale lease). After COMMIT a RATE_LIMIT opening converts HELD(RATE_LIMIT, ROW) rows to GLOBAL
 * OUTSIDE the lock (convertRowHoldsToGlobal).
 */
export async function finaliseUnderBreakerLock(
  rootDb: RootDb,
  params: FinaliseUnderBreakerLockParams,
): Promise<BreakerFinalisation> {
  let decision: BreakerDecision;
  try {
    decision = await rootDb.transaction(async (tx) => {
      const b = await lockBreaker(tx);
      const updated = await params.applyRowUpdate(tx);
      if (!updated) throw new FenceLost();
      return decideAndApplyBreaker(tx, b, params.outboxId, params.classification);
    });
  } catch (err) {
    if (err instanceof FenceLost) return { kind: 'FENCE_LOST' };
    throw err;
  }
  let converted = 0;
  const opened = decision.action === 'OPENED' || decision.action === 'REOPENED_FROM_PROBE' || decision.action === 'REASON_ESCALATED';
  if (opened && decision.reason === 'RATE_LIMIT') {
    try {
      converted = await convertRowHoldsToGlobal(rootDb);
    } catch {
      converted = 0; // cosmetic: an unconverted ROW hold still waits (the breaker gate blocks its claim)
    }
  }
  return { kind: 'FINALISED', decision, rowHoldsConverted: converted };
}

/**
 * CONFIG precheck (isProviderConfigured() === false): ONE section-(b) transaction in the order (1) breaker row
 * FOR UPDATE, (2) fenced release of the claimed outbox row to PENDING (stamp, key and attempt_count kept: no budget
 * use), (3) open or update the CONFIG breaker (missing_api_key), (4) HALF_OPEN -> OPEN with consecutive_failures + 1
 * when the row is the probe, (5) COMMIT. No provider call. There is no second implementation variant.
 */
export async function finaliseConfigPrecheck(
  rootDb: RootDb,
  params: { id: string; claimToken: string },
): Promise<BreakerFinalisation> {
  return finaliseUnderBreakerLock(rootDb, {
    outboxId: params.id,
    classification: classifyMissingApiKey(),
    applyRowUpdate: async (tx) => {
      const rows = await tx.execute(sql`
        UPDATE booking_email_outbox
        SET status = 'PENDING', claim_token = NULL, claim_expires_at = NULL, updated_at = now()
        WHERE id = ${params.id}::uuid AND claim_token = ${params.claimToken}::uuid AND status = 'PROCESSING'
        RETURNING id
      `);
      return rows.length > 0;
    },
  });
}

/** CODE_CONTRACT FAILED_PERMANENT corroboration read: any ACCEPTED row of this communication type in the last 60 min. */
export async function hasAcceptedSameTypeWithin60m(rootDb: RootDb, communicationType: CommunicationType): Promise<boolean> {
  const rows = await rootDb.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM booking_email_outbox
      WHERE status = 'ACCEPTED' AND communication_type = ${communicationType} AND accepted_at > now() - interval '60 minutes'
    ) AS ok
  `);
  return (rows[0] as unknown as { ok: boolean }).ok === true;
}

// ---------------------------------------------------------------------------
// Section (c): probe promotion / advancement
// ---------------------------------------------------------------------------
export type PromoteProbeOutcome =
  | { kind: 'NOT_DUE' }
  | { kind: 'LOCK_TIMEOUT' }
  | { kind: 'PROBE_SET'; probeOutboxId: string; fromState: 'OPEN' | 'HALF_OPEN' }
  | { kind: 'RETURNED_TO_OPEN'; nextProbeAt: Date }
  | { kind: 'CLOSED' };

const PROBE_MAX_CANDIDATES = 5;

/**
 * Section (c): lock, (OPEN and due) -> HALF_OPEN or (HALF_OPEN whose probe row is no longer PENDING / due
 * RETRY_SCHEDULED / PROCESSING) advance; select at most 5 dispatch candidates (unstamped first: GLOBAL holds then
 * PENDING; then due stamped RETRY_SCHEDULED; ROW holds and HELD_PARENT_BINNED/HELD_BOOKING_PENDING never; the
 * latest-start rule and the claim's lowest-unfinished-version / same-booking-PROCESSING predicates apply), release
 * ONE to PENDING with next_attempt_at = now() (stamp, key and unknown_outcome_seen kept), set probe_outbox_id,
 * COMMIT. No candidate: NO-CANDIDATE rule (stays/returns OPEN with LEAST(min next_attempt_at, now()+30m) and
 * consecutive_failures UNCHANGED, not a failure; otherwise CLOSED). 55P03 on the breaker lock => LOCK_TIMEOUT.
 */
export async function promoteProbe(rootDb: RootDb): Promise<PromoteProbeOutcome> {
  try {
    return await rootDb.transaction(async (tx): Promise<PromoteProbeOutcome> => {
      await setLockTimeout(tx, STAMP_LOCK_TIMEOUT_MS);
      const b = await lockBreaker(tx);
      let fromState: 'OPEN' | 'HALF_OPEN';
      if (b.state === 'OPEN') {
        if (!b.nextProbeAt || b.nextProbeAt.getTime() > b.dbNow.getTime()) return { kind: 'NOT_DUE' };
        fromState = 'OPEN';
      } else if (b.state === 'HALF_OPEN') {
        if (b.probeOutboxId) {
          const live = await tx.execute(sql`
            SELECT 1 FROM booking_email_outbox
            WHERE id = ${b.probeOutboxId}::uuid
              AND (status IN ('PENDING', 'PROCESSING') OR (status = 'RETRY_SCHEDULED' AND next_attempt_at <= now()))
          `);
          if (live.length > 0) return { kind: 'NOT_DUE' };
        }
        fromState = 'HALF_OPEN';
      } else {
        return { kind: 'NOT_DUE' };
      }

      const candidates = await tx.execute(sql`
        SELECT o.id
        FROM booking_email_outbox o
        JOIN bookings bk ON bk.id = o.booking_id
        WHERE (o.status = 'PENDING'
               OR (o.status = 'HELD_PROVIDER_OPERATIONAL' AND o.provider_hold_scope = 'GLOBAL')
               OR (o.status = 'RETRY_SCHEDULED' AND o.first_provider_attempt_at IS NOT NULL AND o.next_attempt_at <= now()))
          AND (o.first_provider_attempt_at IS NULL OR o.first_provider_attempt_at > now() - interval '22 hours')
          AND (${b.probeOutboxId}::uuid IS NULL OR o.id <> ${b.probeOutboxId}::uuid)
          AND NOT EXISTS (SELECT 1 FROM booking_email_outbox p WHERE p.booking_id = o.booking_id AND p.status = 'PROCESSING')
          AND (o.transition_version < bk.communication_version
               OR NOT EXISTS (
                 SELECT 1 FROM booking_email_outbox l
                 WHERE l.booking_id = o.booking_id AND l.status IN ('PENDING', 'RETRY_SCHEDULED')
                   AND l.transition_version >= bk.communication_version AND l.transition_version < o.transition_version))
        ORDER BY (o.first_provider_attempt_at IS NOT NULL) ASC,
                 CASE o.status WHEN 'HELD_PROVIDER_OPERATIONAL' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END ASC,
                 o.created_at ASC
        LIMIT ${PROBE_MAX_CANDIDATES}
        FOR UPDATE OF o SKIP LOCKED
      `);

      if (candidates.length > 0) {
        const chosen = (candidates[0] as unknown as { id: string }).id;
        await tx.execute(sql`
          UPDATE booking_email_outbox
          SET status = 'PENDING', next_attempt_at = now(), claim_token = NULL, claim_expires_at = NULL, updated_at = now()
          WHERE id = ${chosen}::uuid AND status IN ('PENDING', 'HELD_PROVIDER_OPERATIONAL', 'RETRY_SCHEDULED')
        `);
        await tx.execute(sql`
          UPDATE booking_email_provider_state
          SET state = 'HALF_OPEN',
              probe_outbox_id = ${chosen}::uuid,
              probe_started_at = now(),
              updated_at = now()
          WHERE id = ${PROVIDER_STATE_ID}
        `);
        return { kind: 'PROBE_SET', probeOutboxId: chosen, fromState };
      }

      // NO-CANDIDATE RULE: not a failure; consecutive_failures is never touched here.
      const waiting = await tx.execute(sql`
        SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE LEAST(MIN(next_attempt_at), now() + interval '30 minutes') END AS at
        FROM booking_email_outbox
        WHERE status = 'RETRY_SCHEDULED' AND first_provider_attempt_at IS NOT NULL
          AND next_attempt_at > now() AND next_attempt_at < first_provider_attempt_at + interval '22 hours'
      `);
      const at = (waiting[0] as unknown as { at: Date | string | null }).at;
      if (at) {
        await tx.execute(sql`
          UPDATE booking_email_provider_state
          SET state = 'OPEN', next_probe_at = ${iso(new Date(at))}::timestamptz,
              probe_outbox_id = NULL, probe_started_at = NULL, updated_at = now()
          WHERE id = ${PROVIDER_STATE_ID}
        `);
        return { kind: 'RETURNED_TO_OPEN', nextProbeAt: new Date(at) };
      }
      await writeClose(tx, false);
      return { kind: 'CLOSED' };
    });
  } catch (err) {
    if (readSqlState(err) === '55P03') return { kind: 'LOCK_TIMEOUT' };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Section (d): bulk-release cooldown (its own tiny transaction)
// ---------------------------------------------------------------------------
/**
 * Only the winner of ONE conditional UPDATE (CLOSED and last_bulk_release_at older than 60 s) may bulk-release.
 * The winner holds the breaker row lock only for this single statement; a lock timeout counts as a loss.
 */
export async function claimBulkReleaseCooldown(rootDb: RootDb): Promise<boolean> {
  try {
    return await rootDb.transaction(async (tx) => {
      await setLockTimeout(tx, STAMP_LOCK_TIMEOUT_MS);
      const rows = await tx.execute(sql`
        UPDATE booking_email_provider_state
        SET last_bulk_release_at = now()
        WHERE id = ${PROVIDER_STATE_ID}
          AND state = 'CLOSED'
          AND (last_bulk_release_at IS NULL OR last_bulk_release_at <= now() - make_interval(secs => ${BULK_RELEASE_COOLDOWN_SECONDS}))
        RETURNING 1
      `);
      return rows.length === 1;
    });
  } catch (err) {
    if (readSqlState(err) === '55P03') return false;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Post-lock work: runs OUTSIDE any breaker-locked transaction, state predicates re-checked in the statement
// ---------------------------------------------------------------------------
/**
 * Release up to `limit` (<= 25) held rows to PENDING, oldest first: status = HELD_PROVIDER_OPERATIONAL AND
 * (scope = GLOBAL OR next_attempt_at <= now()) AND a NON-LOCKING read of breaker state = CLOSED. Race-safe: every
 * consumer re-checks the breaker at the claim and the stamp, so a release against a just-reopened breaker leaves an
 * ordinary PENDING row that the gate blocks. Takes no breaker lock.
 */
export async function releaseHeldRows(rootDb: RootDb, opts: { limit?: number } = {}): Promise<string[]> {
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? BULK_RELEASE_MAX_ROWS)), BULK_RELEASE_MAX_ROWS);
  const rows = await rootDb.execute(sql`
    WITH pick AS (
      SELECT o.id
      FROM booking_email_outbox o
      WHERE o.status = 'HELD_PROVIDER_OPERATIONAL'
        AND (o.provider_hold_scope = 'GLOBAL' OR o.next_attempt_at <= now())
        AND EXISTS (SELECT 1 FROM booking_email_provider_state s WHERE s.id = ${PROVIDER_STATE_ID} AND s.state = 'CLOSED')
      ORDER BY o.created_at ASC
      LIMIT ${limit}
      FOR UPDATE OF o SKIP LOCKED
    )
    UPDATE booking_email_outbox o
    SET status = 'PENDING', next_attempt_at = now(), claim_token = NULL, claim_expires_at = NULL, updated_at = now()
    FROM pick
    WHERE o.id = pick.id AND o.status = 'HELD_PROVIDER_OPERATIONAL'
    RETURNING o.id
  `);
  return (rows as unknown as { id: string }[]).map((r) => r.id);
}

/**
 * ROW -> GLOBAL conversion of HELD(RATE_LIMIT, ROW) rows (bounded, LIMIT 500, cosmetic). Applies the row
 * status/scope predicate AND a non-locking read of breaker state <> CLOSED. Takes no breaker lock.
 */
export async function convertRowHoldsToGlobal(rootDb: RootDb, opts: { limit?: number } = {}): Promise<number> {
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? 500)), 500);
  const rows = await rootDb.execute(sql`
    WITH pick AS (
      SELECT o.id
      FROM booking_email_outbox o
      WHERE o.status = 'HELD_PROVIDER_OPERATIONAL' AND o.provider_hold_scope = 'ROW' AND o.provider_hold_reason = 'RATE_LIMIT'
        AND EXISTS (SELECT 1 FROM booking_email_provider_state s WHERE s.id = ${PROVIDER_STATE_ID} AND s.state <> 'CLOSED')
      ORDER BY o.created_at ASC
      LIMIT ${limit}
      FOR UPDATE OF o SKIP LOCKED
    )
    UPDATE booking_email_outbox o
    SET provider_hold_scope = 'GLOBAL', updated_at = now()
    FROM pick
    WHERE o.id = pick.id AND o.status = 'HELD_PROVIDER_OPERATIONAL' AND o.provider_hold_scope = 'ROW'
    RETURNING o.id
  `);
  return rows.length;
}

/**
 * Provider-hold disposal (<= 50 rows, no breaker lock at all): HELD_PROVIDER_OPERATIONAL rows at created_at + 72 h ->
 * ATTENTION(PROVIDER_HOLD_EXPIRED), and held rows with a stamp at or after t0 + 23 h -> ATTENTION(WINDOW_23H); payload NULL.
 * Status predicate re-checked in the UPDATE. Returns the number of rows disposed.
 */
export async function disposeExpiredProviderHolds(rootDb: RootDb, opts: { limit?: number } = {}): Promise<number> {
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? MAINTENANCE_MAX_ROWS)), MAINTENANCE_MAX_ROWS);
  const rows = await rootDb.execute(sql`
    WITH pick AS (
      SELECT o.id
      FROM booking_email_outbox o
      WHERE o.status = 'HELD_PROVIDER_OPERATIONAL'
        AND (o.created_at <= now() - make_interval(hours => ${DELIVERY_CEILING_HOURS})
             OR (o.first_provider_attempt_at IS NOT NULL
                 AND o.first_provider_attempt_at <= now() - make_interval(hours => ${BACKSTOP_HOURS})))
      ORDER BY o.created_at ASC
      LIMIT ${limit}
      FOR UPDATE OF o SKIP LOCKED
    )
    UPDATE booking_email_outbox o
    SET status = 'ATTENTION',
        attention_reason = CASE WHEN o.created_at <= now() - make_interval(hours => ${DELIVERY_CEILING_HOURS})
                                THEN 'PROVIDER_HOLD_EXPIRED' ELSE 'WINDOW_23H' END,
        payload = NULL, claim_token = NULL, claim_expires_at = NULL, updated_at = now()
    FROM pick
    WHERE o.id = pick.id AND o.status = 'HELD_PROVIDER_OPERATIONAL'
    RETURNING o.id
  `);
  return rows.length;
}

// ---------------------------------------------------------------------------
// Section (e): single-statement conditional breaker changes (no outbox row lock held, no FOR UPDATE)
// ---------------------------------------------------------------------------
/** First 8 hex chars of SHA-256 over key + sender + (git sha when present). Never the key itself. */
export function computeConfigFingerprint(parts: {
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  gitCommitSha?: string | null;
}): string {
  const material = (parts.apiKey ?? '') + (parts.fromEmail ?? '') + (parts.fromName ?? '') + (parts.gitCommitSha ?? '');
  return createHash('sha256').update(material).digest('hex').slice(0, 8);
}

export interface FingerprintObservation {
  changed: boolean;
  /** An OPEN CONFIG breaker had next_probe_at set to now() (immediate probe). */
  probeScheduled: boolean;
}

/**
 * One autocommit statement. Records the fingerprint; when it CHANGED (a previous non-null value differed) on an
 * OPEN CONFIG breaker, next_probe_at = now(). The first ever observation (previous NULL) is not a change.
 */
export async function observeConfigFingerprint(rootDb: RootDb, fingerprint: string): Promise<FingerprintObservation> {
  const rows = await rootDb.execute(sql`
    UPDATE booking_email_provider_state s
    SET config_fingerprint = ${fingerprint},
        next_probe_at = CASE WHEN o.config_fingerprint IS NOT NULL AND s.state = 'OPEN' AND s.reason = 'CONFIG' THEN now() ELSE s.next_probe_at END,
        updated_at = now()
    FROM (SELECT config_fingerprint FROM booking_email_provider_state WHERE id = ${PROVIDER_STATE_ID}) o
    WHERE s.id = ${PROVIDER_STATE_ID} AND s.config_fingerprint IS DISTINCT FROM ${fingerprint}
    RETURNING (o.config_fingerprint IS NOT NULL) AS changed,
              (o.config_fingerprint IS NOT NULL AND s.state = 'OPEN' AND s.reason = 'CONFIG') AS probe_scheduled
  `);
  if (rows.length === 0) return { changed: false, probeScheduled: false };
  const r = rows[0] as unknown as { changed: boolean; probe_scheduled: boolean };
  return { changed: r.changed === true, probeScheduled: r.probe_scheduled === true };
}

/**
 * HALF_OPEN without an outcome for 10 minutes: OPEN with next_probe_at = now(), backoff NOT increased
 * (consecutive_failures untouched). One conditional statement. Returns whether it recovered.
 */
export async function recoverHalfOpenTimeout(rootDb: RootDb): Promise<boolean> {
  const timeoutS = seconds(HALF_OPEN_TIMEOUT_MS);
  const rows = await rootDb.execute(sql`
    UPDATE booking_email_provider_state
    SET state = 'OPEN', next_probe_at = now(), probe_outbox_id = NULL, probe_started_at = NULL, updated_at = now()
    WHERE id = ${PROVIDER_STATE_ID} AND state = 'HALF_OPEN'
      AND probe_started_at IS NOT NULL AND probe_started_at <= now() - make_interval(secs => ${timeoutS})
    RETURNING 1
  `);
  return rows.length === 1;
}
