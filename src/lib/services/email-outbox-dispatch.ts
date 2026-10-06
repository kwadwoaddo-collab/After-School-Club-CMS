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
import { sql, type SQL } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { hashToken } from '@/lib/magic-link';
import {
  finaliseConfigPrecheck,
  finaliseUnderBreakerLock,
  hasAcceptedSameTypeWithin60m,
  readBreakerSnapshot,
  stampFirstProviderAttempt,
  type RootDb,
} from './email-outbox-breaker';
import {
  LOCAL_INVALID_RECIPIENT,
  classifyProviderResponse,
  classifyThrown,
  outcomeNeedsBreakerLock,
  planOutcome,
  validateRecipientSyntax,
  type Classification,
  type OutcomePlan,
  type SdkResponseLike,
} from './email-outbox-classifier';
import {
  ACTION_BUDGET_MARGIN_MS,
  ACTION_BUDGET_MS,
  ACTION_STAMP_MIN_REMAINING_MS,
  BACKSTOP_HOURS,
  BINNED_HOLD_HOURS,
  DELIVERY_CEILING_HOURS,
  FINALISATION_RETRY_DELAY_MS,
  KNOWN_NO_CALL_RETRY_DELAY_MS,
  LATEST_START_HOURS,
  LOCK_RELEASE_DELAY_SECONDS,
  OUTBOX_PAYLOAD_VERSION,
  PACING_RELEASE_DELAY_SECONDS,
  PACING_WAIT_MAX_MS,
  POST_STAMP_MIN_TIMEOUT_MS,
  PROVIDER_MAX_TIMEOUT_MS,
  ROUTE_BUDGET_MS,
  ROUTE_ORIGIN_MARGIN_MS,
  ROUTE_STAMP_MIN_REMAINING_MS,
  STAMP_LINK_GUARD_MINUTES,
  type AttentionReason,
  type ClaimedOutboxRow,
  type CommunicationType,
  type DispatchOrigin,
  type LinkMode,
  type NoCallFinalisation,
  type OutboxPayload,
  type OutboxStatus,
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

// ============================================================================
// PHASE 3: COMPLETE DISPATCHER (E5 steps 1-6), pre-send ladder (E4), outcome rendering
// ============================================================================

/** Anything that can run a SQL statement: the ROOT client or a transaction handle. */
export type SqlExecutor = Pick<RootDb, 'execute'> | { execute: (query: SQL) => PromiseLike<ArrayLike<unknown> & { length: number }> };
async function run(ex: SqlExecutor, query: SQL): Promise<Record<string, unknown>[]> {
  return (await (ex as Pick<RootDb, 'execute'>).execute(query)) as unknown as Record<string, unknown>[];
}

/** FEATURE_OUTBOX_WORKER_ENABLED: unset = enabled; ONLY the exact string 'false' pauses dispatch and lease recovery. */
export function isWorkerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.FEATURE_OUTBOX_WORKER_ENABLED !== 'false';
}

// ==================== PROVIDER PORT (injectable seam; the real send path lives in email.ts) ====================
export interface ProviderSendRequest {
  communicationType: CommunicationType;
  recipientEmail: string;
  payload: OutboxPayload;
  /** Frozen link variant (null for rows that have no link variant). */
  linkMode: LinkMode | null;
  idempotencyKey: string;
  /** AbortSignal.timeout(candidateTimeoutMs): passed through the SDK send options (typed widening in email.ts). */
  signal: AbortSignal;
}
/** The SDK RETURNS { data, error, headers }; a thrown value is the rare path. */
export type ProviderSendResult = { response: SdkResponseLike } | { thrown: unknown };
export interface ProviderPort {
  isConfigured(): boolean;
  /** Inputs of the config fingerprint (optional; the real port supplies them from email.ts). */
  configParts?(): { apiKey?: string | null; fromEmail?: string | null; fromName?: string | null; gitCommitSha?: string | null };
  send(req: ProviderSendRequest): Promise<ProviderSendResult>;
}

// ==================== RUNG FACTS (database-clock facts for the E4 ladder) ====================
export interface RungFacts {
  id: string;
  status: OutboxStatus;
  claimToken: string | null;
  communicationType: CommunicationType;
  transitionVersion: number;
  recipient: string;
  bookingFound: boolean;
  parentFound: boolean;
  bookingStatus: string | null;
  communicationVersion: number | null;
  startAtPassed: boolean;
  parentBinned: boolean;
  /** now() >= created_at + 72 h */
  ceilingReached: boolean;
  firstHeldSet: boolean;
  /** first_held_at + 24 h has passed (database clock). */
  binnedHoldExpired: boolean;
  payload: Record<string, unknown> | null;
  payloadSupported: boolean;
  hasRawLinkKey: boolean;
  linkMode: LinkMode | null;
  stamped: boolean;
  /** now() >= t0 + 22 h (latest-start rule). */
  afterLatestStart: boolean;
  /** now() >= t0 + 23 h (maintenance backstop). */
  afterBackstop: boolean;
  tokenMatches: boolean;
  tokenExpired: boolean;
  /** parents.magicLinkExpiresAt >= now() + 23 h 05 min (stamp-time link guard). */
  tokenOutlivesGuard: boolean;
  dbNow: Date;
}

/** The raw token is the `token` query parameter of the stored magic link (hashToken(raw) = parents.magicLinkToken). */
export function extractRawToken(magicLink: unknown): string | null {
  if (typeof magicLink !== 'string' || magicLink.length === 0) return null;
  try {
    const t = new URL(magicLink).searchParams.get('token');
    return t && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export async function readRungFacts(ex: SqlExecutor, id: string): Promise<RungFacts | null> {
  const rows = await run(ex, sql`
    SELECT o.id, o.status::text AS status, o.claim_token, o.communication_type, o.transition_version, o.payload, o.link_mode,
           (o.first_provider_attempt_at IS NOT NULL) AS stamped, (o.first_held_at IS NOT NULL) AS first_held_set, o.recipient_email,
           b.id AS booking_found_id, b.status::text AS b_status, b.communication_version AS b_version, (b.start_at <= now()) AS b_past,
           p.id AS parent_found_id, (p.deleted_at IS NOT NULL) AS p_binned, p.magic_link_token AS p_token,
           (p.magic_link_expires_at IS NULL OR p.magic_link_expires_at <= now()) AS token_expired,
           COALESCE(p.magic_link_expires_at >= now() + make_interval(mins => ${STAMP_LINK_GUARD_MINUTES}), false) AS token_outlives_guard,
           (o.created_at + make_interval(hours => ${DELIVERY_CEILING_HOURS}) <= now()) AS ceiling_reached,
           COALESCE(o.first_held_at + make_interval(hours => ${BINNED_HOLD_HOURS}) <= now(), false) AS binned_expired,
           COALESCE(o.first_provider_attempt_at + make_interval(hours => ${LATEST_START_HOURS}) <= now(), false) AS after_latest,
           COALESCE(o.first_provider_attempt_at + make_interval(hours => ${BACKSTOP_HOURS}) <= now(), false) AS after_backstop,
           now() AS db_now
    FROM booking_email_outbox o
    LEFT JOIN bookings b ON b.id = o.booking_id
    LEFT JOIN parents p ON p.id = b.parent_id
    WHERE o.id = ${id}::uuid
  `);
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  const payload = r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload) ? (r.payload as Record<string, unknown>) : null;
  const rawToken = payload ? extractRawToken(payload.magicLink) : null;
  return {
    id: r.id as string,
    status: r.status as OutboxStatus,
    claimToken: (r.claim_token as string | null) ?? null,
    communicationType: r.communication_type as CommunicationType,
    transitionVersion: r.transition_version as number,
    recipient: r.recipient_email as string,
    bookingFound: r.booking_found_id != null,
    parentFound: r.parent_found_id != null,
    bookingStatus: (r.b_status as string | null) ?? null,
    communicationVersion: (r.b_version as number | null) ?? null,
    startAtPassed: r.b_past === true,
    parentBinned: r.p_binned === true,
    ceilingReached: r.ceiling_reached === true,
    firstHeldSet: r.first_held_set === true,
    binnedHoldExpired: r.binned_expired === true,
    payload,
    payloadSupported: payload !== null && payload.payloadVersion === OUTBOX_PAYLOAD_VERSION,
    hasRawLinkKey: payload !== null && typeof payload.magicLink === 'string',
    linkMode: (r.link_mode as LinkMode | null) ?? null,
    stamped: r.stamped === true,
    afterLatestStart: r.after_latest === true,
    afterBackstop: r.after_backstop === true,
    tokenMatches: rawToken !== null && typeof r.p_token === 'string' && r.p_token === hashToken(rawToken),
    tokenExpired: r.token_expired !== false,
    tokenOutlivesGuard: r.token_outlives_guard === true,
    dbNow: new Date(r.db_now as string | Date),
  };
}

// ==================== THE E4 LADDER (pure; shared by pre-send validation AND maintenance) ====================
export type DisposeStatus =
  | 'SUPERSEDED' | 'SKIPPED_ORPHANED' | 'SKIPPED_CANCELLED' | 'SKIPPED_PAST_SESSION' | 'SKIPPED_PENDING_EXPIRED'
  | 'SKIPPED_BINNED_EXPIRED' | 'ATTENTION' | 'FAILED_PERMANENT';
export type RungTarget =
  | { kind: 'DISPOSE'; status: DisposeStatus; attentionReason?: AttentionReason; lastErrorName?: string; rung: string }
  | { kind: 'HOLD'; status: 'HELD_PARENT_BINNED' | 'HELD_BOOKING_PENDING'; rung: string };

export interface Rungs1to5Result {
  /** A terminal disposal decided by rungs 1, 3, 4 or 5; null = continue. */
  dispose: Extract<RungTarget, { kind: 'DISPOSE' }> | null;
  /** Rung 5a: the raw token must be removed from the payload (status unchanged). Applied by maintenance only. */
  scrub: boolean;
}

const dispose = (status: DisposeStatus, rung: string, attentionReason?: AttentionReason, lastErrorName?: string): Extract<RungTarget, { kind: 'DISPOSE' }> => ({
  kind: 'DISPOSE', status, rung, ...(attentionReason ? { attentionReason } : {}), ...(lastErrorName ? { lastErrorName } : {}),
});

/** Rungs 1, 3, 4, 5 and 5a (rung 2, the claim fence, is the WHERE clause of every write). First match wins. */
export function evaluateRungs1to5(f: RungFacts): Rungs1to5Result {
  const isCancelledComm = f.communicationType === 'BOOKING_CANCELLED';
  const scrub =
    f.communicationType === 'BOOKING_CONFIRMATION' && f.hasRawLinkKey && f.linkMode !== 'PORTAL_URL' &&
    ((!f.stamped && f.tokenExpired) || f.linkMode === 'LINK_FREE');

  // 1 orphan or deletion safety
  if (!f.bookingFound || !f.parentFound) return { dispose: dispose('SKIPPED_ORPHANED', '1'), scrub: false };
  // 3 superseded / version mismatch
  if (f.communicationVersion !== f.transitionVersion) return { dispose: dispose('SUPERSEDED', '3'), scrub: false };
  // 4 terminal booking-status incompatibility
  const bs = f.bookingStatus;
  if (isCancelledComm) {
    if (bs === 'completed') return { dispose: dispose('SKIPPED_PAST_SESSION', '4'), scrub: false };
    if (bs !== 'cancelled') return { dispose: dispose('SUPERSEDED', '4'), scrub: false };
  } else {
    if (bs === 'cancelled') return { dispose: dispose('SKIPPED_CANCELLED', '4'), scrub: false };
    if (bs === 'rescheduled') return { dispose: dispose('SUPERSEDED', '4'), scrub: false };
    if (bs === 'completed') return { dispose: dispose('SKIPPED_PAST_SESSION', '4'), scrub: false };
  }
  // 5 past session (BOOKING_CANCELLED exempt), then the 72 h delivery ceiling
  if (!isCancelledComm && f.startAtPassed) return { dispose: dispose('SKIPPED_PAST_SESSION', '5'), scrub: false };
  if (f.ceilingReached) {
    if (f.status === 'HELD_BOOKING_PENDING') return { dispose: dispose('SKIPPED_PENDING_EXPIRED', '5'), scrub: false };
    if (f.status === 'HELD_PROVIDER_OPERATIONAL') return { dispose: dispose('ATTENTION', '5', 'PROVIDER_HOLD_EXPIRED'), scrub: false };
    if (f.status === 'HELD_PARENT_BINNED') return { dispose: dispose('SKIPPED_BINNED_EXPIRED', '5'), scrub: false };
    return { dispose: dispose('ATTENTION', '5', 'DELIVERY_WINDOW_72H'), scrub: false };
  }
  return { dispose: null, scrub };
}

/** Rungs 6 and 7: the hold ladder. Null = send-compatible. */
export function evaluateHolds6to7(f: RungFacts): RungTarget | null {
  // 6 parent binned (expiry = min(first_held_at + 24 h, created_at + 72 h); a re-bin after expiry expires at once)
  if (f.status === 'HELD_PARENT_BINNED' && f.binnedHoldExpired) return dispose('SKIPPED_BINNED_EXPIRED', '6');
  if (f.parentBinned) {
    if (f.binnedHoldExpired) return dispose('SKIPPED_BINNED_EXPIRED', '6');
    return { kind: 'HOLD', status: 'HELD_PARENT_BINNED', rung: '6' };
  }
  // 7 booking pending with CONFIRMATION / RESCHEDULE
  if (f.bookingStatus === 'pending' && f.communicationType !== 'BOOKING_CANCELLED') {
    return { kind: 'HOLD', status: 'HELD_BOOKING_PENDING', rung: '7' };
  }
  return null;
}

export type Rung8Result =
  | { kind: 'SEND'; linkMode: LinkMode }
  | { kind: 'REJECT'; target: Extract<RungTarget, { kind: 'DISPOSE' }> };

/** Rung 8: payload presence, local recipient check, frozen/unfrozen link validity, latest-start rule. */
export function evaluateRung8(f: RungFacts): Rung8Result {
  if (f.payload === null || !f.payloadSupported) return { kind: 'REJECT', target: dispose('ATTENTION', '8', 'MISSING_PAYLOAD') };
  if (!validateRecipientSyntax(f.recipient).ok) {
    return { kind: 'REJECT', target: dispose('FAILED_PERMANENT', '8', undefined, LOCAL_INVALID_RECIPIENT) };
  }
  const isConfirmation = f.communicationType === 'BOOKING_CONFIRMATION';
  if (f.stamped) {
    // link_mode frozen at the first provider attempt: never re-chosen
    if (f.linkMode === 'WITH_LINK' && (!f.tokenMatches || f.tokenExpired)) {
      return { kind: 'REJECT', target: dispose('ATTENTION', '8', 'LINK_INVALID_AFTER_FREEZE') };
    }
    if (f.afterLatestStart) return { kind: 'REJECT', target: dispose('ATTENTION', '8', 'WINDOW_23H') };
    return { kind: 'SEND', linkMode: f.linkMode ?? 'LINK_FREE' };
  }
  if (!isConfirmation) return { kind: 'SEND', linkMode: 'LINK_FREE' }; // no link variant; the stamp records LINK_FREE harmlessly
  if (f.linkMode === 'PORTAL_URL') return { kind: 'SEND', linkMode: 'PORTAL_URL' };
  if (f.linkMode === 'LINK_FREE') return { kind: 'SEND', linkMode: 'LINK_FREE' };
  // never attempted (or reset by an epoch bump): WITH_LINK only when the token is live, matches and outlives the 23 h 05 min guard
  const withLink = f.hasRawLinkKey && f.tokenMatches && !f.tokenExpired && f.tokenOutlivesGuard;
  return { kind: 'SEND', linkMode: withLink ? 'WITH_LINK' : 'LINK_FREE' };
}

export type PreSendDecision = { kind: 'SEND'; linkMode: LinkMode } | { kind: 'TARGET'; target: RungTarget };

/** The complete pre-send ladder: rungs 1-5, 6-7, 8 (rung 9, the dispatch itself, is the caller's). */
export function decidePreSend(f: RungFacts): PreSendDecision {
  const r15 = evaluateRungs1to5(f);
  if (r15.dispose) return { kind: 'TARGET', target: r15.dispose };
  const hold = evaluateHolds6to7(f);
  if (hold) return { kind: 'TARGET', target: hold };
  const r8 = evaluateRung8(f);
  if (r8.kind === 'REJECT') return { kind: 'TARGET', target: r8.target };
  return { kind: 'SEND', linkMode: r8.linkMode };
}

export type MaintenanceDecision =
  | { action: 'NONE'; scrub: boolean }
  | { action: 'DISPOSE'; target: Extract<RungTarget, { kind: 'DISPOSE' }>; scrub: false }
  | { action: 'MOVE'; target: RungTarget | { kind: 'RELEASE'; rung: string }; scrub: boolean };

/**
 * The maintenance view of the SAME ladder (provider-free; stops before rung 9): rungs 1-5/5a, the 23 h backstop and
 * dead-link disposal of stamped rows, then the hold ladder for PENDING and the two bin/pending holds (RETRY_SCHEDULED and
 * HELD_PROVIDER_OPERATIONAL have no edge into HELD_PARENT_BINNED / HELD_BOOKING_PENDING in the E2 table).
 */
export function decideMaintenance(f: RungFacts): MaintenanceDecision {
  const r15 = evaluateRungs1to5(f);
  if (r15.dispose) return { action: 'DISPOSE', target: r15.dispose, scrub: false };
  if (f.stamped && f.afterBackstop) return { action: 'DISPOSE', target: dispose('ATTENTION', 'anchor', 'WINDOW_23H'), scrub: false };
  if (f.stamped && f.linkMode === 'WITH_LINK' && f.hasRawLinkKey && (!f.tokenMatches || f.tokenExpired)) {
    return { action: 'DISPOSE', target: dispose('ATTENTION', 'link', 'LINK_INVALID_AFTER_FREEZE'), scrub: false };
  }
  const holdable = f.status === 'PENDING' || f.status === 'HELD_PARENT_BINNED' || f.status === 'HELD_BOOKING_PENDING';
  if (!holdable) return { action: 'NONE', scrub: r15.scrub };
  const hold = evaluateHolds6to7(f);
  if (hold) {
    if (hold.kind === 'DISPOSE') return { action: 'DISPOSE', target: hold, scrub: false };
    return hold.status === f.status ? { action: 'NONE', scrub: r15.scrub } : { action: 'MOVE', target: hold, scrub: r15.scrub };
  }
  if (f.status === 'HELD_PARENT_BINNED' || f.status === 'HELD_BOOKING_PENDING') {
    if (f.payload === null || !f.payloadSupported) return { action: 'DISPOSE', target: dispose('ATTENTION', '8', 'MISSING_PAYLOAD'), scrub: false };
    return { action: 'MOVE', target: { kind: 'RELEASE', rung: 'release' }, scrub: r15.scrub };
  }
  return { action: 'NONE', scrub: r15.scrub };
}

// ==================== FENCED WRITES ====================
/** Pre-send fence: WHERE id AND claim_token AND status = 'PROCESSING' (E4 rung 2). */
export function claimFence(row: Pick<ClaimedOutboxRow, 'id' | 'claimToken'>): SQL {
  return sql`o.id = ${row.id}::uuid AND o.claim_token = ${row.claimToken}::uuid AND o.status = 'PROCESSING'`;
}
/** Maintenance fence: the row is still in the status it was evaluated in and is not leased. */
export function maintenanceFence(id: string, observed: OutboxStatus): SQL {
  return sql`o.id = ${id}::uuid AND o.status = ${observed}::booking_email_outbox_status AND o.claim_token IS NULL`;
}

/** One fenced UPDATE for a terminal disposal, a hold or a release. Returns false on zero rows (fence lost). */
export async function applyRungTarget(
  ex: SqlExecutor,
  target: RungTarget | { kind: 'RELEASE'; rung: string },
  fence: SQL,
): Promise<boolean> {
  let rows: Record<string, unknown>[];
  if (target.kind === 'DISPOSE') {
    rows = await run(ex, sql`
      UPDATE booking_email_outbox o
      SET status = ${target.status}::booking_email_outbox_status,
          payload = NULL,
          attention_reason = COALESCE(${target.attentionReason ?? null}::text, o.attention_reason),
          last_error_name = COALESCE(${target.lastErrorName ?? null}::text, o.last_error_name),
          last_error_at = CASE WHEN ${target.lastErrorName ?? null}::text IS NULL THEN o.last_error_at ELSE now() END,
          claim_token = NULL, claim_expires_at = NULL, updated_at = now()
      WHERE ${fence}
      RETURNING o.id`);
  } else if (target.kind === 'HOLD') {
    rows = await run(ex, sql`
      UPDATE booking_email_outbox o
      SET status = ${target.status}::booking_email_outbox_status,
          first_held_at = CASE WHEN ${target.status === 'HELD_PARENT_BINNED'} THEN COALESCE(o.first_held_at, now()) ELSE o.first_held_at END,
          held_at = now(), claim_token = NULL, claim_expires_at = NULL, updated_at = now()
      WHERE ${fence}
      RETURNING o.id`);
  } else {
    rows = await run(ex, sql`
      UPDATE booking_email_outbox o
      SET status = 'PENDING', next_attempt_at = now(), claim_token = NULL, claim_expires_at = NULL, updated_at = now()
      WHERE ${fence}
      RETURNING o.id`);
  }
  return rows.length > 0;
}

/** Rung 5a: remove the raw token (link_mode LINK_FREE for unstamped rows). Status unchanged; stamped WITH_LINK never scrubbed. */
export async function applyTokenScrub(ex: SqlExecutor, id: string): Promise<boolean> {
  const rows = await run(ex, sql`
    UPDATE booking_email_outbox o
    SET payload = o.payload - 'magicLink',
        link_mode = CASE WHEN o.first_provider_attempt_at IS NULL THEN 'LINK_FREE' ELSE o.link_mode END,
        updated_at = now()
    WHERE o.id = ${id}::uuid AND o.payload IS NOT NULL AND jsonb_exists(o.payload, 'magicLink')
      AND o.communication_type = 'BOOKING_CONFIRMATION' AND o.link_mode IS DISTINCT FROM 'PORTAL_URL'
      AND o.status IN ('PENDING','RETRY_SCHEDULED','HELD_PARENT_BINNED','HELD_BOOKING_PENDING','HELD_PROVIDER_OPERATIONAL')
      AND ((o.first_provider_attempt_at IS NULL) OR o.link_mode = 'LINK_FREE')
    RETURNING o.id`);
  return rows.length > 0;
}

/** Fenced release to PENDING (no budget use, any existing stamp and key kept). `delaySeconds` null keeps next_attempt_at. */
export async function releaseClaimToPending(
  rootDb: RootDb,
  row: Pick<ClaimedOutboxRow, 'id' | 'claimToken'>,
  delaySeconds: number | null,
): Promise<boolean> {
  try {
    const rows = await rootDb.execute(sql`
      UPDATE booking_email_outbox o
      SET status = 'PENDING', claim_token = NULL, claim_expires_at = NULL,
          next_attempt_at = CASE WHEN ${delaySeconds}::int IS NULL THEN o.next_attempt_at ELSE now() + make_interval(secs => ${delaySeconds}::int) END,
          updated_at = now()
      WHERE ${claimFence(row)}
      RETURNING o.id`);
    return rows.length > 0;
  } catch (err) {
    // No unfenced repair: stale-lease recovery returns the unstamped row to PENDING. Error NAME only.
    logger.warn('email_outbox_release_failed', { event: 'email_outbox_release_failed', errorName: err instanceof Error ? err.name : 'UnknownError' });
    return false;
  }
}

// ==================== OUTCOME PLAN -> SQL (E3 FINALISATION mapping) ====================
/**
 * Render a classifier OutcomePlan into the ONE fenced UPDATE (WHERE id AND claim_token AND status = 'PROCESSING').
 * A retry-eligible outcome (RETRY_SCHEDULED / HELD_PROVIDER_OPERATIONAL) becomes SUPERSEDED with payload NULL through a CASE
 * when bookings.communication_version differs from transition_version; terminal outcomes are never converted.
 */
export async function applyOutcomePlan(
  ex: SqlExecutor,
  row: Pick<ClaimedOutboxRow, 'id' | 'claimToken'>,
  plan: OutcomePlan,
): Promise<boolean> {
  const retryEligible = plan.nextStatus === 'RETRY_SCHEDULED' || plan.nextStatus === 'HELD_PROVIDER_OPERATIONAL';
  const planned = sql`${plan.nextStatus}::booking_email_outbox_status`;
  const statusExpr = retryEligible ? sql`CASE WHEN v.stale THEN 'SUPERSEDED'::booking_email_outbox_status ELSE ${planned} END` : planned;
  const payloadExpr = plan.payloadNull ? sql`NULL::jsonb` : retryEligible ? sql`CASE WHEN v.stale THEN NULL::jsonb ELSE o.payload END` : sql`o.payload`;
  const nextAt = plan.nextAttemptAt ? sql`${plan.nextAttemptAt.toISOString()}::timestamptz` : sql`o.next_attempt_at`;
  const isHold = plan.nextStatus === 'HELD_PROVIDER_OPERATIONAL';
  const bump = plan.bumpEpoch;
  const rows = await run(ex, sql`
    WITH v AS (
      SELECT COALESCE((SELECT b.communication_version <> o2.transition_version FROM bookings b WHERE b.id = o2.booking_id), false) AS stale
      FROM booking_email_outbox o2 WHERE o2.id = ${row.id}::uuid
    )
    UPDATE booking_email_outbox o
    SET status = ${statusExpr},
        payload = ${payloadExpr},
        attention_reason = COALESCE(${plan.attentionReason}::text, o.attention_reason),
        provider_hold_reason = COALESCE(${plan.holdReason}::text, o.provider_hold_reason),
        provider_hold_scope = COALESCE(${plan.holdScope}::text, o.provider_hold_scope),
        provider_hold_error_name = CASE WHEN ${isHold} THEN ${plan.lastErrorName}::text ELSE o.provider_hold_error_name END,
        held_at = CASE WHEN ${isHold} THEN now() ELSE o.held_at END,
        next_attempt_at = ${nextAt},
        attempt_count = CASE WHEN ${plan.refundAttempt} THEN GREATEST(o.attempt_count - 1, 0) ELSE o.attempt_count END,
        first_provider_attempt_at = CASE WHEN ${bump} THEN NULL ELSE o.first_provider_attempt_at END,
        link_mode = CASE WHEN ${bump} THEN (CASE WHEN o.link_mode = 'PORTAL_URL' THEN o.link_mode ELSE NULL END) ELSE o.link_mode END,
        idempotency_epoch = o.idempotency_epoch + CASE WHEN ${bump} THEN 1 ELSE 0 END,
        unknown_outcome_seen = o.unknown_outcome_seen OR ${plan.setUnknownOutcomeSeen},
        last_unknown_at = CASE WHEN ${plan.setLastUnknownAt} THEN now() ELSE o.last_unknown_at END,
        last_rate_limited_at = CASE WHEN ${plan.setLastRateLimitedAt} THEN now() ELSE o.last_rate_limited_at END,
        hold_hits = ${plan.holdHits},
        last_error_name = COALESCE(${plan.lastErrorName}::text, o.last_error_name),
        last_error_status = CASE WHEN ${plan.lastErrorName}::text IS NULL THEN o.last_error_status ELSE ${plan.lastErrorStatus}::smallint END,
        last_error_at = CASE WHEN ${plan.lastErrorName}::text IS NULL THEN o.last_error_at ELSE now() END,
        accepted_at = CASE WHEN ${plan.setAcceptedAt} THEN now() ELSE o.accepted_at END,
        provider_message_id = COALESCE(${plan.providerMessageId}::text, o.provider_message_id),
        claim_token = NULL, claim_expires_at = NULL, updated_at = now()
    FROM v
    WHERE ${claimFence(row)}
    RETURNING o.id`);
  return rows.length > 0;
}

// ==================== THE DISPATCH FLOW ====================
export interface DispatchFlowHooks {
  /** Test seam: runs after the stamp transaction commits (before point D). */
  onPostStampCommit?: (stamp: StampResult) => void | Promise<void>;
  /** Test seam: runs immediately before the stamp transaction is attempted (after any pacing wait). */
  onBeforeStamp?: (attempt: 1 | 2) => void | Promise<void>;
  /** Test seam: runs immediately after the provider returns and before finalisation. */
  onProviderReturned?: (classification: Classification) => void | Promise<void>;
}

export interface DispatchDeps {
  port: ProviderPort;
  budget: InvocationBudget;
  /** Pacing wait / finalisation retry delay (injectable; default setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  /** Monotonic clock for the call duration (injectable; default performance.now). */
  clock?: () => number;
  hooks?: DispatchFlowHooks;
}

export type ReleaseCause =
  | 'CONFIG_UNCONFIGURED' | 'BREAKER_NOT_CLOSED' | 'INSUFFICIENT_BUDGET' | 'PACING' | 'LOCK_TIMEOUT_55P03' | 'STATEMENT_TIMEOUT_57014';

export type DispatchResult =
  | { kind: 'FENCE_LOST' }
  | { kind: 'REJECTED_BY_LADDER'; target: RungTarget; applied: boolean }
  | { kind: 'RELEASED'; cause: ReleaseCause; applied: boolean }
  | { kind: 'WINDOW_EXPIRED'; applied: boolean }
  | { kind: 'NO_CALL'; stamp: StampResult; candidateTimeoutMs: number; finalisation: NoCallFinalisation }
  | {
      kind: 'PROVIDER_CALLED';
      stamp: StampResult;
      timeoutMs: number;
      classification: Classification;
      finalisation: 'FINALISED' | 'FENCE_LOST' | 'DEFERRED_TO_RECOVERY';
    };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ZeroRowDiagnosis {
  kind: 'FENCE_LOST' | 'WINDOW' | 'BREAKER' | 'PACING';
}

/**
 * Zero-row stamp diagnosis: plain reads OUTSIDE any transaction holding no lock, in the fixed E5 order:
 * (1) claim fence lost, (2) first_provider_attempt_at <= now() - 22 h, (3) breaker not CLOSED (and not the probe), (4) pacing full.
 */
async function diagnoseZeroRowStamp(rootDb: RootDb, row: Pick<ClaimedOutboxRow, 'id' | 'claimToken'>): Promise<ZeroRowDiagnosis> {
  const rows = await rootDb.execute(sql`
    SELECT o.status::text AS status, (o.claim_token = ${row.claimToken}::uuid) AS token_ok,
           COALESCE(o.claim_expires_at > now(), false) AS lease_ok,
           COALESCE(o.first_provider_attempt_at <= now() - make_interval(hours => ${LATEST_START_HOURS}), false) AS window_closed,
           s.state, s.probe_outbox_id
    FROM booking_email_outbox o, booking_email_provider_state s
    WHERE o.id = ${row.id}::uuid AND s.id = 1`);
  if (rows.length === 0) return { kind: 'FENCE_LOST' };
  const r = rows[0] as unknown as { status: string; token_ok: boolean | null; lease_ok: boolean; window_closed: boolean; state: string; probe_outbox_id: string | null };
  if (r.status !== 'PROCESSING' || r.token_ok !== true || !r.lease_ok) return { kind: 'FENCE_LOST' };
  if (r.window_closed) return { kind: 'WINDOW' };
  if (r.state !== 'CLOSED' && !(r.state === 'HALF_OPEN' && r.probe_outbox_id === row.id)) return { kind: 'BREAKER' };
  return { kind: 'PACING' };
}

interface SendFacts {
  idempotencyKey: string;
  linkMode: LinkMode | null;
  payload: OutboxPayload | null;
  recipient: string;
  communicationType: CommunicationType;
  unknownOutcomeSeen: boolean;
  holdHits: number;
  providerHoldReason: string | null;
  priorName: string | null;
  priorStatus: number | null;
  priorAt: Date | null;
  dbNow: Date;
}
async function readSendFacts(rootDb: RootDb, id: string, epoch: number): Promise<SendFacts | null> {
  const rows = await rootDb.execute(sql`
    SELECT idempotency_key, link_mode, payload, recipient_email, communication_type, unknown_outcome_seen, hold_hits,
           provider_hold_reason, last_error_name, last_error_status, last_error_at, now() AS db_now
    FROM booking_email_outbox WHERE id = ${id}::uuid`);
  if (rows.length === 0) return null;
  const r = rows[0] as unknown as Record<string, unknown>;
  const base = r.idempotency_key as string;
  return {
    idempotencyKey: epoch === 0 ? base : base + ':e' + epoch,
    linkMode: (r.link_mode as LinkMode | null) ?? null,
    payload: (r.payload as OutboxPayload | null) ?? null,
    recipient: r.recipient_email as string,
    communicationType: r.communication_type as CommunicationType,
    unknownOutcomeSeen: r.unknown_outcome_seen === true,
    holdHits: r.hold_hits as number,
    providerHoldReason: (r.provider_hold_reason as string | null) ?? null,
    priorName: (r.last_error_name as string | null) ?? null,
    priorStatus: (r.last_error_status as number | null) ?? null,
    priorAt: r.last_error_at ? new Date(r.last_error_at as string | Date) : null,
    dbNow: new Date(r.db_now as string | Date),
  };
}

/** Error NAME only (never message text) for PII-free finalisation-failure logs. */
function errName(err: unknown): string {
  return err instanceof Error ? err.name : 'UnknownError';
}

/**
 * Per-row dispatch: E5 steps 2-6 for a row claimed by the shared claim primitive (step 1).
 *  2  pre-send ladder rungs 1-8 (read statements on the ROOT client); a rejection is ONE fenced update with ZERO provider calls
 *  3  isProviderConfigured() false -> finaliseConfigPrecheck (breaker row locked first, fenced release second), no stamp
 *  4  recompute-then-act stamp; zero-row stamps are ROLLED BACK by the breaker module and diagnosed with lock-free reads; the
 *     1.1 s pacing wait happens only after that rollback, with NO lock held, at most once, then ONE retry in a NEW transaction
 *  4a 55P03 / 57014 release the row to PENDING at +5 s without touching the breaker
 *  5  provider call (only when candidateTimeoutMs >= 1000, else the phase-1 known no-call finalisation) with
 *     AbortSignal.timeout and the idempotency key
 *  6  fenced finalisation (breaker row first when the outcome needs it); retried once after 100 ms for a genuine
 *     provider outcome ONLY. E5 item 3c / Action 4(m) superseded remnant is NOT implemented.
 * Never called with a transaction handle (RootDb parameter).
 */
export async function dispatchOutboxRow(rootDb: RootDb, row: ClaimedOutboxRow, deps: DispatchDeps): Promise<DispatchResult> {
  const { budget, port } = deps;
  const sleep = deps.sleep ?? defaultSleep;
  const clock = deps.clock ?? (() => performance.now());
  const origin = budget.origin;
  const minRemaining = originStampMinRemainingMs(origin);

  // ---- step 2: pre-send ladder
  const facts = await readRungFacts(rootDb, row.id);
  if (!facts || facts.status !== 'PROCESSING' || facts.claimToken !== row.claimToken) return { kind: 'FENCE_LOST' };
  const decision = decidePreSend(facts);
  if (decision.kind === 'TARGET') {
    const applied = await applyRungTarget(rootDb, decision.target, claimFence(row));
    return applied ? { kind: 'REJECTED_BY_LADDER', target: decision.target, applied } : { kind: 'FENCE_LOST' };
  }
  const chosenLinkMode = decision.linkMode;

  // ---- step 3: provider configuration pre-check (ONE section-(b) transaction, breaker row first)
  if (!port.isConfigured()) {
    const r = await finaliseConfigPrecheck(rootDb, { id: row.id, claimToken: row.claimToken });
    return r.kind === 'FENCE_LOST' ? { kind: 'FENCE_LOST' } : { kind: 'RELEASED', cause: 'CONFIG_UNCONFIGURED', applied: true };
  }

  // ---- pre-stamp gate: breaker (cheap non-locking read; the stamp statement re-checks it authoritatively)
  const snapshot = await readBreakerSnapshot(rootDb);
  if (snapshot.state !== 'CLOSED' && !(snapshot.state === 'HALF_OPEN' && snapshot.probeOutboxId === row.id)) {
    const applied = await releaseClaimToPending(rootDb, row, null);
    return { kind: 'RELEASED', cause: 'BREAKER_NOT_CLOSED', applied };
  }

  // ---- step 4: recompute-then-act stamp (point B), at most ONE pacing retry (point C)
  let stamp: StampResult | null = null;
  let attempt: 1 | 2 = 1;
  for (;;) {
    const remaining = remainingMs(budget);
    if (remaining < minRemaining) {
      logReleaseReason({ reason: 'INSUFFICIENT_PRE_STAMP_BUDGET', origin });
      const applied = await releaseClaimToPending(rootDb, row, null);
      return { kind: 'RELEASED', cause: 'INSUFFICIENT_BUDGET', applied };
    }
    if (deps.hooks?.onBeforeStamp) await deps.hooks.onBeforeStamp(attempt);
    const stamped = await stampFirstProviderAttempt(rootDb, { id: row.id, claimToken: row.claimToken, chosenLinkMode });
    if (stamped.kind === 'STAMPED') {
      stamp = stamped.stamp;
      break;
    }
    if (stamped.refusal === 'LOCK_TIMEOUT_55P03' || stamped.refusal === 'STATEMENT_TIMEOUT_57014') {
      logReleaseReason({ reason: stamped.refusal, origin });
      const applied = await releaseClaimToPending(rootDb, row, LOCK_RELEASE_DELAY_SECONDS);
      return { kind: 'RELEASED', cause: stamped.refusal, applied };
    }
    // ZERO_ROWS: the stamp transaction has ALREADY been rolled back (no lock held, no bucket token consumed)
    const diag = await diagnoseZeroRowStamp(rootDb, row);
    if (diag.kind === 'FENCE_LOST') return { kind: 'FENCE_LOST' };
    if (diag.kind === 'WINDOW') {
      const applied = await applyRungTarget(rootDb, dispose('ATTENTION', 'stamp', 'WINDOW_23H'), claimFence(row));
      return { kind: 'WINDOW_EXPIRED', applied };
    }
    if (diag.kind === 'BREAKER') {
      const applied = await releaseClaimToPending(rootDb, row, null);
      return { kind: 'RELEASED', cause: 'BREAKER_NOT_CLOSED', applied };
    }
    // pacing bucket full
    if (attempt === 2) {
      logReleaseReason({ reason: 'PACING_RELEASE', origin });
      const applied = await releaseClaimToPending(rootDb, row, PACING_RELEASE_DELAY_SECONDS);
      return { kind: 'RELEASED', cause: 'PACING', applied };
    }
    logReleaseReason({ reason: 'PACING_WAIT', origin });
    await sleep(PACING_WAIT_MAX_MS); // outside any transaction, no lock held
    attempt = 2; // point C is the recompute at the top of the loop; ONE retry in a NEW transaction
    if (remainingMs(budget) < minRemaining) {
      logReleaseReason({ reason: 'PACING_RELEASE', origin });
      logReleaseReason({ reason: 'INSUFFICIENT_PRE_STAMP_BUDGET', origin });
      const applied = await releaseClaimToPending(rootDb, row, PACING_RELEASE_DELAY_SECONDS);
      return { kind: 'RELEASED', cause: 'INSUFFICIENT_BUDGET', applied };
    }
  }
  if (deps.hooks?.onPostStampCommit) await deps.hooks.onPostStampCommit(stamp);

  // ---- point D: remaining re-measured after the stamp commit
  const post = decidePostStamp(remainingMs(budget), origin);
  if (post.kind === 'NO_CALL') {
    logReleaseReason({ reason: 'KNOWN_POST_STAMP_NO_CALL', origin, attemptIndex: stamp.attemptCount });
    const finalisation = await finaliseKnownPostStampNoCall(rootDb, row); // exactly once, never retried
    return { kind: 'NO_CALL', stamp, candidateTimeoutMs: post.candidateTimeoutMs, finalisation };
  }

  // ---- step 5: provider call
  const send = await readSendFacts(rootDb, row.id, stamp.idempotencyEpoch);
  if (!send || send.payload === null) {
    // Cannot render (should be unreachable after rung 8): treat as a known no-call; no request was made.
    logReleaseReason({ reason: 'KNOWN_POST_STAMP_NO_CALL', origin, attemptIndex: stamp.attemptCount });
    const finalisation = await finaliseKnownPostStampNoCall(rootDb, row);
    return { kind: 'NO_CALL', stamp, candidateTimeoutMs: post.timeoutMs, finalisation };
  }
  const timeoutMs = post.timeoutMs;
  const signal = AbortSignal.timeout(timeoutMs);
  const startedAt = clock();
  let result: ProviderSendResult;
  try {
    result = await port.send({
      communicationType: send.communicationType,
      recipientEmail: send.recipient,
      payload: send.payload,
      linkMode: send.linkMode,
      idempotencyKey: send.idempotencyKey,
      signal,
    });
  } catch (thrown) {
    result = { thrown };
  }
  const ctx = { timeoutMs, elapsedMs: clock() - startedAt };
  const classification = 'thrown' in result ? classifyThrown(result.thrown, ctx) : classifyProviderResponse(result.response, ctx);
  if (deps.hooks?.onProviderReturned) await deps.hooks.onProviderReturned(classification);
  if (classification.category !== 'ACCEPTED') {
    // PII-free: category and error NAME only, never message text.
    logger.warn('email_outbox_provider_outcome', {
      event: 'email_outbox_provider_outcome',
      category: classification.category,
      errorName: 'errorName' in classification ? classification.errorName : null,
      origin,
    });
  }

  // ---- step 6: finalisation (a SHORT transaction opened only AFTER the provider returned)
  const outcomeFacts = (await readSendFacts(rootDb, row.id, stamp.idempotencyEpoch)) ?? send;
  const acceptedSameTypeWithin60m = classification.category === 'CODE_CONTRACT'
    ? await hasAcceptedSameTypeWithin60m(rootDb, outcomeFacts.communicationType)
    : false;
  const plan = planOutcome(
    classification,
    {
      attemptCount: stamp.attemptCount,
      unknownOutcomeSeen: outcomeFacts.unknownOutcomeSeen,
      firstProviderAttemptAt: stamp.firstProviderAttemptAt,
      holdHits: outcomeFacts.holdHits,
      providerHoldReason: outcomeFacts.providerHoldReason as never,
      prior: { name: outcomeFacts.priorName, status: outcomeFacts.priorStatus, at: outcomeFacts.priorAt },
    },
    { now: outcomeFacts.dbNow, acceptedSameTypeWithin60m },
  );
  const finalisation = await finaliseProviderOutcome(rootDb, row, classification, stamp, plan, sleep);
  return { kind: 'PROVIDER_CALLED', stamp, timeoutMs, classification, finalisation };
}

/**
 * Provider-outcome finalisation. A failed finalisation transaction never re-calls the provider: it is retried ONCE after
 * 100 ms (genuine provider outcomes only: the known no-call never comes through here) and otherwise left to stale-lease
 * recovery (same key, frozen body). Zero rows = fence lost: nothing further is written and the breaker is untouched.
 */
async function finaliseProviderOutcome(
  rootDb: RootDb,
  row: ClaimedOutboxRow,
  classification: Classification,
  stamp: StampResult,
  plan: OutcomePlan,
  sleep: (ms: number) => Promise<void>,
): Promise<'FINALISED' | 'FENCE_LOST' | 'DEFERRED_TO_RECOVERY'> {
  const once = async (): Promise<boolean> => {
    if (outcomeNeedsBreakerLock(classification, stamp.isProbe)) {
      const r = await finaliseUnderBreakerLock(rootDb, {
        outboxId: row.id,
        classification,
        applyRowUpdate: (tx) => applyOutcomePlan(tx as unknown as SqlExecutor, row, plan),
      });
      return r.kind === 'FINALISED';
    }
    return applyOutcomePlan(rootDb, row, plan);
  };
  try {
    return (await once()) ? 'FINALISED' : 'FENCE_LOST';
  } catch (first) {
    logger.warn('email_outbox_finalisation_failed', { event: 'email_outbox_finalisation_failed', errorName: errName(first), attempt: 1 });
    await sleep(FINALISATION_RETRY_DELAY_MS);
    try {
      return (await once()) ? 'FINALISED' : 'FENCE_LOST';
    } catch (second) {
      logger.warn('email_outbox_finalisation_failed', { event: 'email_outbox_finalisation_failed', errorName: errName(second), attempt: 2 });
      return 'DEFERRED_TO_RECOVERY';
    }
  }
}

/** Sequential dispatch of already-claimed rows; never more than `maxProviderCalls` provider calls (default 4). */
export async function dispatchClaimedRows(
  rootDb: RootDb,
  rows: ClaimedOutboxRow[],
  deps: DispatchDeps,
  opts: { maxProviderCalls?: number } = {},
): Promise<DispatchResult[]> {
  const max = opts.maxProviderCalls ?? 4;
  const out: DispatchResult[] = [];
  let calls = 0;
  for (const row of rows) {
    if (calls >= max) {
      // claimed but not processed: release without budget use (keeps any stamp)
      const applied = await releaseClaimToPending(rootDb, row, null);
      out.push({ kind: 'RELEASED', cause: 'INSUFFICIENT_BUDGET', applied });
      continue;
    }
    try {
      const r = await dispatchOutboxRow(rootDb, row, deps);
      if (r.kind === 'PROVIDER_CALLED') calls += 1;
      out.push(r);
    } catch (err) {
      // Any unexpected error: the row is left to stale-lease recovery (same key, frozen body). Name only.
      logger.warn('email_outbox_dispatch_error', { event: 'email_outbox_dispatch_error', errorName: errName(err), origin: deps.budget.origin });
      out.push({ kind: 'FENCE_LOST' });
    }
  }
  return out;
}
