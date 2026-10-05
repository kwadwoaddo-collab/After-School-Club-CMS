/**
 * Booking email outbox: dispatch (E5). CMS-OPS-REMEDIATION-1C V15.
 * Dependency direction: types -> classifier -> breaker -> claim -> dispatch -> maintenance -> email-outbox.
 *
 * First vertical slice: invocation budget, recompute-then-act stamp helper (points B and D) and the KNOWN
 * POST-STAMP NO-CALL fenced finalisation of E5 item 3c. E5 item 3c GOVERNS: when the stamp has committed and
 * candidateTimeoutMs < POST_STAMP_MIN_TIMEOUT_MS the invocation KNOWS no request left it and finalises the
 * row immediately with ONE fenced UPDATE (claim_token + status PROCESSING, no breaker lock) to
 * RETRY_SCHEDULED. The superseded V14 behaviour ("leave the row in PROCESSING for stale-lease recovery")
 * is NOT implemented; stale-lease recovery is only the fallback when that single UPDATE fails.
 *
 * Logs are PII-free: reason + origin (+ attempt index for the no-call) only.
 */
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { stampFirstProviderAttempt, type RootDb } from './email-outbox-breaker';
import {
  ACTION_BUDGET_MARGIN_MS,
  ACTION_BUDGET_MS,
  ACTION_STAMP_MIN_REMAINING_MS,
  KNOWN_NO_CALL_RETRY_DELAY_MS,
  POST_STAMP_MIN_TIMEOUT_MS,
  PROVIDER_MAX_TIMEOUT_MS,
  ROUTE_BUDGET_MS,
  ROUTE_ORIGIN_MARGIN_MS,
  ROUTE_STAMP_MIN_REMAINING_MS,
  type ClaimedOutboxRow,
  type DispatchOrigin,
  type LinkMode,
  type NoCallFinalisation,
  type PostStampDecision,
  type ReleaseLogEvent,
  type StampRefusal,
  type StampResult,
} from './email-outbox-types';

// ==================== INVOCATION BUDGET (E5 item 3 / 3a) ====================
export interface InvocationBudget {
  origin: DispatchOrigin;
  budgetMs: number;
  /** Milliseconds elapsed since the original request/action entry (monotonic clock in production). */
  elapsedMs: () => number;
}

/** Capture an entry timestamp now; remaining = budget - elapsed (performance.now() based). */
export function startInvocationBudget(
  origin: DispatchOrigin,
  opts: { budgetMs?: number; elapsedMs?: () => number } = {},
): InvocationBudget {
  const budgetMs = opts.budgetMs ?? (origin === 'action' ? ACTION_BUDGET_MS : ROUTE_BUDGET_MS);
  if (opts.elapsedMs) return { origin, budgetMs, elapsedMs: opts.elapsedMs };
  const start = performance.now();
  return { origin, budgetMs, elapsedMs: () => performance.now() - start };
}

export function remainingMs(budget: InvocationBudget): number {
  return budget.budgetMs - budget.elapsedMs();
}

export function originMarginMs(origin: DispatchOrigin): number {
  return origin === 'action' ? ACTION_BUDGET_MARGIN_MS : ROUTE_ORIGIN_MARGIN_MS;
}

export function originStampMinRemainingMs(origin: DispatchOrigin): number {
  return origin === 'action' ? ACTION_STAMP_MIN_REMAINING_MS : ROUTE_STAMP_MIN_REMAINING_MS;
}

/**
 * Point D (pure): candidateTimeoutMs = min(30000, remainingPostStamp - originMargin).
 * >= POST_STAMP_MIN_TIMEOUT_MS (1000, boundary inclusive) => CALL with candidateTimeoutMs;
 * below it => NO_CALL (known post-stamp no-call).
 */
export function decidePostStamp(remainingPostStampMs: number, origin: DispatchOrigin): PostStampDecision {
  const candidateTimeoutMs = Math.min(PROVIDER_MAX_TIMEOUT_MS, remainingPostStampMs - originMarginMs(origin));
  if (candidateTimeoutMs >= POST_STAMP_MIN_TIMEOUT_MS) return { kind: 'CALL', timeoutMs: candidateTimeoutMs };
  return { kind: 'NO_CALL', candidateTimeoutMs };
}

// ==================== PII-FREE RELEASE LOGGING (E5 item 3d) ====================
export function logReleaseReason(event: Omit<ReleaseLogEvent, 'event'>): void {
  const payload: ReleaseLogEvent = { event: 'email_outbox_release', ...event };
  logger.info('email_outbox_release', payload);
}

// ==================== KNOWN POST-STAMP NO-CALL FINALISATION (E5 item 3c) ====================
/**
 * ONE fenced UPDATE (WHERE id AND claim_token AND status = 'PROCESSING'; no transaction, no breaker lock,
 * no breaker statement) from PROCESSING to RETRY_SCHEDULED: same idempotency key and frozen body (payload and
 * key untouched), no new epoch, claim cleared, next_attempt_at = now() + 5 minutes, unknown_outcome_seen = true,
 * last_unknown_at / last_error_* / attempt_count / first_provider_attempt_at UNCHANGED. When
 * bookings.communication_version differs from transition_version the same statement yields SUPERSEDED with
 * payload NULL (step 6 convention). Attempted exactly once: NO 100 ms retry and NO unfenced repair; on zero
 * rows or error the stamped PROCESSING row is left to stale-lease recovery (same key and body, uncounted).
 */
export async function finaliseKnownPostStampNoCall(
  rootDb: RootDb,
  row: Pick<ClaimedOutboxRow, 'id' | 'claimToken'>,
): Promise<NoCallFinalisation> {
  const delaySeconds = KNOWN_NO_CALL_RETRY_DELAY_MS / 1000;
  try {
    const rows = await rootDb.execute(sql`
      UPDATE booking_email_outbox o
      SET status = CASE WHEN COALESCE((SELECT b.communication_version <> o.transition_version FROM bookings b WHERE b.id = o.booking_id), false)
                        THEN 'SUPERSEDED'::booking_email_outbox_status
                        ELSE 'RETRY_SCHEDULED'::booking_email_outbox_status END,
          payload = CASE WHEN COALESCE((SELECT b.communication_version <> o.transition_version FROM bookings b WHERE b.id = o.booking_id), false)
                         THEN NULL ELSE o.payload END,
          next_attempt_at = now() + make_interval(secs => ${delaySeconds}),
          unknown_outcome_seen = CASE WHEN COALESCE((SELECT b.communication_version <> o.transition_version FROM bookings b WHERE b.id = o.booking_id), false)
                                      THEN o.unknown_outcome_seen ELSE true END,
          claim_token = NULL,
          claim_expires_at = NULL,
          updated_at = now()
      WHERE o.id = ${row.id}::uuid
        AND o.claim_token = ${row.claimToken}::uuid
        AND o.status = 'PROCESSING'
      RETURNING o.status
    `);
    if (rows.length === 0) return { kind: 'FENCE_LOST' };
    const status = (rows[0] as { status: string }).status;
    return { kind: 'FINALISED', status: status === 'SUPERSEDED' ? 'SUPERSEDED' : 'RETRY_SCHEDULED' };
  } catch (err) {
    // No unfenced repair, no retry: stale-lease recovery handles the row. Error NAME only is logged.
    const errorName = err instanceof Error ? err.name : 'UnknownError';
    logger.warn('email_outbox_no_call_finalisation_failed', { event: 'email_outbox_no_call_finalisation_failed', errorName });
    return { kind: 'ERROR', errorName };
  }
}

/** Provider key: stored base key when idempotency_epoch = 0, else base key + ':e' + epoch (E5 item 5). */
export async function readIdempotencyKey(rootDb: RootDb, rowId: string, epoch: number): Promise<string> {
  const rows = await rootDb.execute(sql`SELECT idempotency_key FROM booking_email_outbox WHERE id = ${rowId}::uuid`);
  const base = (rows[0] as { idempotency_key: string }).idempotency_key;
  return epoch === 0 ? base : base + ':e' + epoch;
}

// ==================== STAMP + RECOMPUTE-THEN-ACT SLICE ====================
export type SliceOutcome =
  | { kind: 'RELEASED_INSUFFICIENT_BUDGET'; remainingMs: number }
  | { kind: 'STAMP_REFUSED'; refusal: StampRefusal }
  | { kind: 'NO_CALL'; stamp: StampResult; candidateTimeoutMs: number; finalisation: NoCallFinalisation }
  | { kind: 'CALLED'; stamp: StampResult; timeoutMs: number; idempotencyKey: string; providerResult: unknown };

export interface ProviderCallRequest {
  rowId: string;
  idempotencyKey: string;
  timeoutMs: number;
}
/** Injected provider call. The first-slice dispatch never builds a real provider request. */
export type ProviderCaller = (req: ProviderCallRequest) => Promise<unknown>;

export interface DispatchSliceHooks {
  /** Test seam: runs immediately after the stamp transaction COMMITS and before point D is measured. */
  onPostStampCommit?: (stamp: StampResult) => void | Promise<void>;
}

/**
 * Recompute-then-act: (B) remaining is measured immediately before the stamp and a row is stamped only when
 * remaining >= the origin stamp minimum (else released unstamped by the caller, no budget use); stamp (breaker
 * lock first, outbox second, COMMIT); (D) remaining is re-measured after the commit and
 * candidateTimeoutMs = min(30000, remainingPostStamp - originMargin). Below POST_STAMP_MIN_TIMEOUT_MS: ZERO
 * provider calls and the fenced known no-call finalisation. Otherwise `callProvider` is invoked once with
 * candidateTimeoutMs (finalisation of a provider outcome is added by later work).
 * Zero-row / 55P03 / 57014 stamp refusals are returned without any provider call; the caller performs
 * release and any pacing wait AFTER this has returned (no lock is held).
 */
export async function dispatchClaimedRowSlice(
  rootDb: RootDb,
  row: ClaimedOutboxRow,
  opts: {
    budget: InvocationBudget;
    chosenLinkMode: LinkMode;
    callProvider: ProviderCaller;
    hooks?: DispatchSliceHooks;
  },
): Promise<SliceOutcome> {
  const { budget } = opts;
  const preStamp = remainingMs(budget);
  if (preStamp < originStampMinRemainingMs(budget.origin)) {
    logReleaseReason({ reason: 'INSUFFICIENT_PRE_STAMP_BUDGET', origin: budget.origin });
    return { kind: 'RELEASED_INSUFFICIENT_BUDGET', remainingMs: preStamp };
  }

  const stamped = await stampFirstProviderAttempt(rootDb, {
    id: row.id,
    claimToken: row.claimToken,
    chosenLinkMode: opts.chosenLinkMode,
  });
  if (stamped.kind === 'REFUSED') {
    if (stamped.refusal === 'LOCK_TIMEOUT_55P03') logReleaseReason({ reason: 'LOCK_TIMEOUT_55P03', origin: budget.origin });
    if (stamped.refusal === 'STATEMENT_TIMEOUT_57014') logReleaseReason({ reason: 'STATEMENT_TIMEOUT_57014', origin: budget.origin });
    return { kind: 'STAMP_REFUSED', refusal: stamped.refusal };
  }
  const stamp = stamped.stamp;
  if (opts.hooks?.onPostStampCommit) await opts.hooks.onPostStampCommit(stamp);

  const decision = decidePostStamp(remainingMs(budget), budget.origin); // point D
  if (decision.kind === 'NO_CALL') {
    logReleaseReason({ reason: 'KNOWN_POST_STAMP_NO_CALL', origin: budget.origin, attemptIndex: stamp.attemptCount });
    const finalisation = await finaliseKnownPostStampNoCall(rootDb, row); // exactly once
    return { kind: 'NO_CALL', stamp, candidateTimeoutMs: decision.candidateTimeoutMs, finalisation };
  }

  const idempotencyKey = await readIdempotencyKey(rootDb, row.id, stamp.idempotencyEpoch);
  const providerResult = await opts.callProvider({ rowId: row.id, idempotencyKey, timeoutMs: decision.timeoutMs });
  return { kind: 'CALLED', stamp, timeoutMs: decision.timeoutMs, idempotencyKey, providerResult };
}
