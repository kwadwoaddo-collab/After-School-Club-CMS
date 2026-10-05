/**
 * Booking email outbox: PURE provider outcome classifier (E3). CMS-OPS-REMEDIATION-1C V15.
 * Dependency direction: types -> classifier -> breaker -> claim -> dispatch -> maintenance -> email-outbox.
 *
 * This module imports no database, network or Resend module (the types module is the only import and it
 * carries constants and types only). Classification keys on error.name FIRST and statusCode SECOND; the
 * provider's message text is NEVER captured, stored, returned or logged: the only error text that leaves this
 * module is a sanitised error NAME.
 *
 * Contents: (1) the classifier table, (2) Retry-After parsing, (3) the outcome-to-row-update PLAN used by the
 * dispatcher (hold / ladder / FAILED_PERMANENT arithmetic, all pure), (4) the UNKNOWN ladder and breaker probe
 * schedule helpers, (5) local recipient-syntax validation.
 */
import {
  BACKSTOP_HOURS,
  CODE_CONTRACT_RETRY_DELAYS_MS,
  LATEST_START_HOURS,
  MAX_LADDER_ATTEMPTS,
  MIN_RETRY_GAP_MS,
  PROBE_SCHEDULE_MS,
  PROVIDER_MAX_TIMEOUT_MS,
  RATE_LIMIT_DEFAULT_RETRY_AFTER_S,
  RATE_LIMIT_MAX_RETRY_AFTER_S,
  UNKNOWN_LADDER_OFFSETS_MS,
  type AttentionReason,
  type BreakerReason,
  type ProviderHoldReason,
  type ProviderHoldScope,
} from './email-outbox-types';

// ==================== NAMES ====================
/** Every name in the installed resend 6.14.0 RESEND_ERROR_CODE_KEY (the unit test asserts exhaustiveness against the SDK type). */
export const KNOWN_PROVIDER_ERROR_NAMES = [
  'invalid_idempotency_key', 'validation_error', 'missing_api_key', 'restricted_api_key', 'invalid_api_key',
  'not_found', 'method_not_allowed', 'invalid_idempotent_request', 'concurrent_idempotent_requests',
  'invalid_attachment', 'invalid_from_address', 'invalid_access', 'invalid_parameter', 'invalid_region',
  'missing_required_field', 'monthly_quota_exceeded', 'daily_quota_exceeded', 'rate_limit_exceeded',
  'security_error', 'application_error', 'internal_server_error',
] as const;
export type KnownProviderErrorName = (typeof KNOWN_PROVIDER_ERROR_NAMES)[number];

export const LOCAL_INVALID_RECIPIENT = 'LOCAL_INVALID_RECIPIENT';
/** Used when a thrown value or response carries no usable name. */
export const UNKNOWN_ERROR_NAME = 'UnknownError';

export type ClassifierRuleKind =
  | 'CONFIG' | 'CODE_DEFECT' | 'QUOTA_DAILY' | 'QUOTA_MONTHLY' | 'RATE_LIMIT'
  | 'AMBIGUOUS_CODE' | 'VALIDATION_ERROR' | 'IDEMPOTENCY_MISMATCH' | 'CONCURRENT_IDEMPOTENT' | 'SERVER_ERROR'
  | 'APPLICATION_ERROR';

/** The complete classifier table, one explicit entry per SDK name (E3 table). */
export const CLASSIFIER_TABLE: Readonly<Record<KnownProviderErrorName, ClassifierRuleKind>> = {
  missing_api_key: 'CONFIG',
  invalid_api_key: 'CONFIG',
  restricted_api_key: 'CONFIG',
  invalid_from_address: 'CONFIG',
  invalid_access: 'CONFIG',
  security_error: 'CONFIG',
  validation_error: 'VALIDATION_ERROR',
  invalid_idempotency_key: 'CODE_DEFECT',
  not_found: 'CODE_DEFECT',
  method_not_allowed: 'CODE_DEFECT',
  invalid_region: 'CODE_DEFECT',
  daily_quota_exceeded: 'QUOTA_DAILY',
  monthly_quota_exceeded: 'QUOTA_MONTHLY',
  rate_limit_exceeded: 'RATE_LIMIT',
  invalid_parameter: 'AMBIGUOUS_CODE',
  missing_required_field: 'AMBIGUOUS_CODE',
  invalid_attachment: 'AMBIGUOUS_CODE',
  invalid_idempotent_request: 'IDEMPOTENCY_MISMATCH',
  concurrent_idempotent_requests: 'CONCURRENT_IDEMPOTENT',
  internal_server_error: 'SERVER_ERROR',
  application_error: 'APPLICATION_ERROR',
};

// ==================== CLASSIFICATION RESULT ====================
export type UnknownDetail =
  | 'SERVER_5XX' | 'TRANSPORT' | 'TIMEOUT_FULL' | 'TIMEOUT_SHORTENED' | 'CONCURRENT_IDEMPOTENT'
  | 'THROWN' | 'UNRECOGNISED' | 'NO_RESPONSE';

interface ErrorIdentity {
  /** Sanitised error NAME only; never message text. */
  errorName: string;
  statusCode: number | null;
}

export type Classification =
  | { category: 'ACCEPTED'; providerMessageId: string | null }
  | (ErrorIdentity & {
      category: 'CONFIG';
      holdReason: 'CONFIG';
      holdScope: 'GLOBAL';
      breakerReason: 'CONFIG';
      /** validation_error 403 (historically an unverified sending domain; unverifiable offline). */
      suspect403: boolean;
    })
  | (ErrorIdentity & {
      category: 'QUOTA_DAILY' | 'QUOTA_MONTHLY';
      holdReason: 'QUOTA_DAILY' | 'QUOTA_MONTHLY';
      holdScope: 'GLOBAL';
      breakerReason: 'QUOTA_DAILY' | 'QUOTA_MONTHLY';
    })
  | (ErrorIdentity & {
      category: 'RATE_LIMIT';
      holdReason: 'RATE_LIMIT';
      /** Row scope by default; becomes GLOBAL only through the breaker escalation rule. */
      holdScope: 'ROW';
      breakerReason: 'RATE_LIMIT';
      /** Parsed Retry-After seconds (1..300 valid; > 300 kept for the global-breaker rule) or null. */
      retryAfterSeconds: number | null;
      /** Row delay: valid Retry-After (1..300) else 60 s. */
      rowDelaySeconds: number;
      /** A valid Retry-After > 300 opens the GLOBAL breaker immediately. */
      exceedsMaxRetryAfter: boolean;
    })
  | (ErrorIdentity & { category: 'CODE_CONTRACT'; holdReason: 'CODE_CONTRACT'; holdScope: 'ROW' })
  | (ErrorIdentity & { category: 'IDEMPOTENCY' })
  | (ErrorIdentity & { category: 'UNKNOWN'; counted: boolean; detail: UnknownDetail });

export type ClassificationCategory = Classification['category'];

/** How the provider call ended, measured by the dispatcher (never read from message text). */
export interface ProviderCallContext {
  /** The abort timeout actually passed to AbortSignal.timeout. */
  timeoutMs: number;
  /** Elapsed milliseconds between request start and the end of the call. */
  elapsedMs: number;
}

/** Minimal structural view of the SDK's { data, error, headers } return (the real SDK type satisfies it). */
export interface SdkResponseLike {
  data?: { id?: unknown } | null;
  error?: { name?: unknown; statusCode?: unknown; message?: unknown } | null;
  headers?: Record<string, string> | { get(name: string): string | null } | null;
}

// ==================== HELPERS ====================
const NAME_SAFE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Error NAME only: anything not shaped like an identifier collapses to UnknownError (never leaks text). */
export function sanitizeErrorName(raw: unknown): string {
  return typeof raw === 'string' && NAME_SAFE.test(raw) ? raw : UNKNOWN_ERROR_NAME;
}

function sanitizeStatus(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 100 && raw <= 599 ? raw : null;
}

function isKnownName(name: string): name is KnownProviderErrorName {
  return Object.prototype.hasOwnProperty.call(CLASSIFIER_TABLE, name);
}

/** A timeout is "full" only when the abort timer was the full 30 s and it actually elapsed. */
export function isFullLengthTimeout(ctx: ProviderCallContext): boolean {
  return ctx.timeoutMs >= PROVIDER_MAX_TIMEOUT_MS && ctx.elapsedMs >= ctx.timeoutMs;
}
function abortTimerElapsed(ctx: ProviderCallContext): boolean {
  return ctx.elapsedMs >= ctx.timeoutMs;
}

export interface ParsedRetryAfter {
  seconds: number;
  /** Valid digits but > 300: opens the GLOBAL RATE_LIMIT breaker immediately. */
  exceedsMax: boolean;
}

/**
 * Retry-After: read ONLY from the lowercased header `retry-after`; accepted only when it matches
 * /^\d{1,5}$/ and is >= 1. 1..300 is a row delay, > 300 escalates; missing, HTTP-date, zero, negative, empty
 * or non-digit values return null (60 s row default applies).
 */
export function parseRetryAfter(headers: SdkResponseLike['headers']): ParsedRetryAfter | null {
  if (!headers) return null;
  let raw: string | null | undefined;
  if (typeof (headers as { get?: unknown }).get === 'function') {
    raw = (headers as { get(name: string): string | null }).get('retry-after');
  } else {
    for (const [k, v] of Object.entries(headers as Record<string, string>)) {
      if (k.toLowerCase() === 'retry-after') {
        raw = v;
        break;
      }
    }
  }
  if (typeof raw !== 'string' || !/^\d{1,5}$/.test(raw)) return null;
  const seconds = Number(raw);
  if (seconds < 1) return null;
  return { seconds, exceedsMax: seconds > RATE_LIMIT_MAX_RETRY_AFTER_S };
}

function unknown(id: ErrorIdentity, counted: boolean, detail: UnknownDetail): Classification {
  return { category: 'UNKNOWN', ...id, counted, detail };
}

function rateLimit(id: ErrorIdentity, headers: SdkResponseLike['headers']): Classification {
  const parsed = parseRetryAfter(headers);
  const valid = parsed !== null && !parsed.exceedsMax;
  return {
    category: 'RATE_LIMIT',
    ...id,
    holdReason: 'RATE_LIMIT',
    holdScope: 'ROW',
    breakerReason: 'RATE_LIMIT',
    retryAfterSeconds: parsed ? parsed.seconds : null,
    rowDelaySeconds: valid ? parsed.seconds : RATE_LIMIT_DEFAULT_RETRY_AFTER_S,
    exceedsMaxRetryAfter: parsed?.exceedsMax === true,
  };
}

function config(id: ErrorIdentity, suspect403 = false): Classification {
  return { category: 'CONFIG', ...id, holdReason: 'CONFIG', holdScope: 'GLOBAL', breakerReason: 'CONFIG', suspect403 };
}

// ==================== CLASSIFIER ====================
/** Classify the object the SDK RETURNS (it rarely throws). */
export function classifyProviderResponse(resp: SdkResponseLike | null | undefined, ctx: ProviderCallContext): Classification {
  if (!resp) return unknown({ errorName: UNKNOWN_ERROR_NAME, statusCode: null }, false, 'NO_RESPONSE');
  const err = resp.error;
  if (!err) {
    const id = resp.data?.id;
    if (typeof id === 'string' && id.length > 0) return { category: 'ACCEPTED', providerMessageId: id };
    // Neither an error nor a message id: acceptance cannot be ruled out, but there is no outage evidence either.
    return unknown({ errorName: UNKNOWN_ERROR_NAME, statusCode: null }, false, 'NO_RESPONSE');
  }

  const errorName = sanitizeErrorName(err.name);
  const statusCode = sanitizeStatus(err.statusCode);
  const id: ErrorIdentity = { errorName, statusCode };

  // Name first: daily/monthly quota are also HTTP 429 but keep their own class. A 429 under an unrecognised or
  // generic name (application_error, validation_error) is a rate limit; rate_limit_exceeded is one at any status.
  if (
    errorName === 'rate_limit_exceeded' ||
    (statusCode === 429 && (!isKnownName(errorName) || errorName === 'application_error' || errorName === 'validation_error'))
  ) {
    return rateLimit(id, resp.headers);
  }

  if (!isKnownName(errorName)) {
    // Unrecognised name: fail safe, never definitive.
    if (statusCode !== null && statusCode >= 500) return unknown(id, true, 'SERVER_5XX');
    return unknown(id, isFullLengthTimeout(ctx), 'UNRECOGNISED');
  }

  switch (CLASSIFIER_TABLE[errorName]) {
    case 'CONFIG':
    case 'CODE_DEFECT':
      return config(id);
    case 'QUOTA_DAILY':
      return { category: 'QUOTA_DAILY', ...id, holdReason: 'QUOTA_DAILY', holdScope: 'GLOBAL', breakerReason: 'QUOTA_DAILY' };
    case 'QUOTA_MONTHLY':
      return { category: 'QUOTA_MONTHLY', ...id, holdReason: 'QUOTA_MONTHLY', holdScope: 'GLOBAL', breakerReason: 'QUOTA_MONTHLY' };
    case 'RATE_LIMIT':
      return rateLimit(id, resp.headers);
    case 'AMBIGUOUS_CODE':
      return { category: 'CODE_CONTRACT', ...id, holdReason: 'CODE_CONTRACT', holdScope: 'ROW' };
    case 'VALIDATION_ERROR':
      if (statusCode === 403) return config(id, true);
      if (statusCode === 400 || statusCode === 422) return { category: 'CODE_CONTRACT', ...id, holdReason: 'CODE_CONTRACT', holdScope: 'ROW' };
      // validation_error with any other status is not a documented definitive form: UNKNOWN (never definitive).
      return unknown(id, statusCode !== null && statusCode >= 500, statusCode !== null && statusCode >= 500 ? 'SERVER_5XX' : 'UNRECOGNISED');
    case 'IDEMPOTENCY_MISMATCH':
      return { category: 'IDEMPOTENCY', ...id };
    case 'CONCURRENT_IDEMPOTENT':
      // uncertain; NOT counted toward PROVIDER_UNAVAILABLE.
      return unknown(id, false, 'CONCURRENT_IDEMPOTENT');
    case 'SERVER_ERROR':
      return unknown(id, true, 'SERVER_5XX');
    case 'APPLICATION_ERROR': {
      if (statusCode === null) {
        // Transport / connection reset / abort / DNS all surface as application_error with a null status.
        if (abortTimerElapsed(ctx) && ctx.timeoutMs < PROVIDER_MAX_TIMEOUT_MS) return unknown(id, false, 'TIMEOUT_SHORTENED');
        return unknown(id, true, abortTimerElapsed(ctx) ? 'TIMEOUT_FULL' : 'TRANSPORT');
      }
      return unknown(id, statusCode >= 500, 'SERVER_5XX');
    }
  }
}

/** Classify a thrown value (rare). Only the NAME of an Error is ever read; message text is only prefix-tested. */
export function classifyThrown(err: unknown, ctx: ProviderCallContext): Classification {
  const e = err as { name?: unknown; message?: unknown } | null | undefined;
  const errorName = sanitizeErrorName(e?.name);
  // The SDK constructor throws 'Missing API key...'; message text is tested here and never stored or returned.
  if (typeof e?.message === 'string' && e.message.startsWith('Missing API key')) {
    return config({ errorName: 'missing_api_key', statusCode: null });
  }
  const id: ErrorIdentity = { errorName, statusCode: null };
  if (abortTimerElapsed(ctx) || errorName === 'AbortError' || errorName === 'TimeoutError') {
    return unknown(id, isFullLengthTimeout(ctx), isFullLengthTimeout(ctx) ? 'TIMEOUT_FULL' : 'TIMEOUT_SHORTENED');
  }
  // Unrecognised thrown error: UNKNOWN (fail-safe); counted only for a full-length timeout (none here).
  return unknown(id, false, 'THROWN');
}

/** Does finalising this outcome need the breaker row lock FIRST (E3 FINALISATION step 0, plan 238)? */
export function outcomeNeedsBreakerLock(c: Classification, isProbe: boolean): boolean {
  if (isProbe) return true; // every probe-row outcome
  switch (c.category) {
    case 'CONFIG':
    case 'QUOTA_DAILY':
    case 'QUOTA_MONTHLY':
    case 'RATE_LIMIT':
    case 'CODE_CONTRACT': // corroboration / escalation
      return true;
    case 'UNKNOWN':
      return c.counted; // every counted UNKNOWN, always (no unlocked pre-read)
    case 'ACCEPTED':
    case 'IDEMPOTENCY':
      return false;
  }
}

// ==================== UNKNOWN LADDER ARITHMETIC (E3) ====================
export type LadderSlot =
  | { kind: 'RETRY_SCHEDULED'; at: Date }
  | { kind: 'ATTENTION'; reason: Extract<AttentionReason, 'UNKNOWN_OUTCOME_EXHAUSTED' | 'WINDOW_23H'> };

/** Ladder offset for UNKNOWN number k (1..6); undefined for k >= 7. */
export function ladderOffsetMs(k: number): number | undefined {
  return k >= 1 ? UNKNOWN_LADDER_OFFSETS_MS[k - 1] : undefined;
}

/**
 * After UNKNOWN number k (k = attempt_count, the 1-based number of the attempt that just ended):
 * k >= 7 -> ATTENTION(UNKNOWN_OUTCOME_EXHAUSTED); else slot = GREATEST(t0 + offset[k], now + 5 min) and a slot
 * at or after t0 + 22 h -> ATTENTION(WINDOW_23H); else RETRY_SCHEDULED at the slot.
 */
export function unknownLadderSlot(attemptCount: number, t0: Date, now: Date): LadderSlot {
  const k = Math.max(1, Math.floor(attemptCount));
  if (k >= MAX_LADDER_ATTEMPTS) return { kind: 'ATTENTION', reason: 'UNKNOWN_OUTCOME_EXHAUSTED' };
  const offset = UNKNOWN_LADDER_OFFSETS_MS[k - 1];
  const slotMs = Math.max(t0.getTime() + offset, now.getTime() + MIN_RETRY_GAP_MS);
  if (slotMs >= t0.getTime() + LATEST_START_HOURS * 3600_000) return { kind: 'ATTENTION', reason: 'WINDOW_23H' };
  return { kind: 'RETRY_SCHEDULED', at: new Date(slotMs) };
}

/** Latest-start rule: no provider call may start at or after t0 + 22 h. */
export function isAfterLatestStart(t0: Date, now: Date): boolean {
  return now.getTime() >= t0.getTime() + LATEST_START_HOURS * 3600_000;
}
/** 23 h backstop (maintenance disposal anchor). */
export function isAfterBackstop(t0: Date, now: Date): boolean {
  return now.getTime() >= t0.getTime() + BACKSTOP_HOURS * 3600_000;
}

// ==================== BREAKER PROBE SCHEDULE (E3) ====================
export const CONFIG_PROBE_SCHEDULE_MS: readonly number[] = [15 * 60_000, 30 * 60_000, 60 * 60_000];
export const QUOTA_DAILY_HOURLY_MS = 60 * 60_000;
export const QUOTA_MONTHLY_PROBE_MS = 6 * 60 * 60_000;
export const RATE_LIMIT_MIN_PROBE_S = 120;
export const RATE_LIMIT_MAX_PROBE_S = 3600;

/** Next UTC midnight + 10 minutes strictly after `now` (heuristic, unverified). */
export function nextUtcMidnightPlus10m(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return new Date(midnight + 10 * 60_000);
}

/**
 * Probe time for a breaker opening. `failureIndex` is consecutive_failures BEFORE this open increments it:
 * CONFIG 15m, 30m, then 1h cap; QUOTA_DAILY next UTC midnight + 10m then hourly; QUOTA_MONTHLY 6h;
 * RATE_LIMIT max(Retry-After, 2 min) capped 1 h (Retry-After defaults to 60 s); PROVIDER_UNAVAILABLE 2m,5m,15m,30m cap 30m.
 */
export function nextProbeAt(reason: BreakerReason, failureIndex: number, now: Date, retryAfterSeconds?: number | null): Date {
  const idx = Math.max(0, Math.floor(failureIndex));
  switch (reason) {
    case 'CONFIG':
      return new Date(now.getTime() + CONFIG_PROBE_SCHEDULE_MS[Math.min(idx, CONFIG_PROBE_SCHEDULE_MS.length - 1)]);
    case 'QUOTA_DAILY':
      return idx === 0 ? nextUtcMidnightPlus10m(now) : new Date(now.getTime() + QUOTA_DAILY_HOURLY_MS);
    case 'QUOTA_MONTHLY':
      return new Date(now.getTime() + QUOTA_MONTHLY_PROBE_MS);
    case 'RATE_LIMIT': {
      const s = Math.min(Math.max(retryAfterSeconds ?? RATE_LIMIT_DEFAULT_RETRY_AFTER_S, RATE_LIMIT_MIN_PROBE_S), RATE_LIMIT_MAX_PROBE_S);
      return new Date(now.getTime() + s * 1000);
    }
    case 'PROVIDER_UNAVAILABLE':
      return new Date(now.getTime() + PROBE_SCHEDULE_MS[Math.min(idx, PROBE_SCHEDULE_MS.length - 1)]);
  }
}

/** Breaker reason precedence when already OPEN (a late response may escalate, never de-escalate). */
export const BREAKER_REASON_PRECEDENCE: Readonly<Record<BreakerReason, number>> = {
  CONFIG: 5,
  QUOTA_MONTHLY: 4,
  QUOTA_DAILY: 3,
  RATE_LIMIT: 2,
  PROVIDER_UNAVAILABLE: 1,
};
export function breakerReasonOutranks(candidate: BreakerReason, current: BreakerReason | null): boolean {
  return current === null || BREAKER_REASON_PRECEDENCE[candidate] > BREAKER_REASON_PRECEDENCE[current];
}

// ==================== FAILED_PERMANENT PROMOTION (E3 CODE/CONTRACT (B)) ====================
export interface PriorErrorFacts {
  name: string | null;
  status: number | null;
  at: Date | null;
}
export const FAILED_PERMANENT_MIN_GAP_MS = 15 * 60_000;
export const FAILED_PERMANENT_ACCEPTED_LOOKBACK_MS = 60 * 60_000;

/**
 * Row-level FAILED_PERMANENT ONLY when BOTH: the identical error name and statusCode occurred on two attempts at
 * least 15 minutes apart for this row AND at least one ACCEPTED row of the same communication type has
 * accepted_at within the 60 minutes preceding the second occurrence.
 */
export function shouldPromoteToFailedPermanent(args: {
  prior: PriorErrorFacts;
  current: { name: string; status: number | null; at: Date };
  acceptedSameTypeWithin60m: boolean;
}): boolean {
  const { prior, current } = args;
  if (!prior.name || prior.at === null) return false;
  if (prior.name !== current.name || prior.status !== current.status) return false;
  if (current.at.getTime() - prior.at.getTime() < FAILED_PERMANENT_MIN_GAP_MS) return false;
  return args.acceptedSameTypeWithin60m;
}

// ==================== OUTCOME -> ROW UPDATE PLAN ====================
export interface OutcomeRowFacts {
  /** Post-stamp attempt_count (the 1-based number of the attempt that just ended). */
  attemptCount: number;
  unknownOutcomeSeen: boolean;
  firstProviderAttemptAt: Date | null;
  holdHits: number;
  providerHoldReason: ProviderHoldReason | null;
  prior: PriorErrorFacts;
}
export interface OutcomeContext {
  now: Date;
  /** Read by the caller (finalisation) for CODE_CONTRACT corroboration only. */
  acceptedSameTypeWithin60m?: boolean;
}

export type PlannedStatus = 'ACCEPTED' | 'RETRY_SCHEDULED' | 'HELD_PROVIDER_OPERATIONAL' | 'ATTENTION' | 'FAILED_PERMANENT';

/**
 * What the fenced row UPDATE must do. The dispatch module renders this into SQL (and adds the SUPERSEDED CASE for a
 * version mismatch); this module never touches the database.
 */
export interface OutcomePlan {
  nextStatus: PlannedStatus;
  attentionReason: AttentionReason | null;
  holdReason: ProviderHoldReason | null;
  holdScope: ProviderHoldScope | null;
  /** Absolute next_attempt_at (ladder slot or hold delay) or null when the status does not schedule. */
  nextAttemptAt: Date | null;
  /** attempt_count = GREATEST(attempt_count - 1, 0) (operational holds). */
  refundAttempt: boolean;
  /** unknown_outcome_seen = false: reset stamp + link_mode (not PORTAL_URL) and idempotency_epoch + 1. */
  bumpEpoch: boolean;
  /** unknown_outcome_seen = true on EVERY UNKNOWN outcome, counted or not. */
  setUnknownOutcomeSeen: boolean;
  /** last_unknown_at = now() ONLY for counted outcomes. */
  setLastUnknownAt: boolean;
  setLastRateLimitedAt: boolean;
  /** New hold_hits value (0 on ACCEPTED). */
  holdHits: number;
  payloadNull: boolean;
  lastErrorName: string | null;
  lastErrorStatus: number | null;
  setAcceptedAt: boolean;
  providerMessageId: string | null;
}

/** Hold-hit bookkeeping: consecutive holds of the SAME reason; a different reason restarts at 1. */
export function nextHoldHits(facts: Pick<OutcomeRowFacts, 'holdHits' | 'providerHoldReason'>, reason: ProviderHoldReason): number {
  return facts.providerHoldReason === reason ? facts.holdHits + 1 : 1;
}

/** CODE_CONTRACT delay: +15m, +1h, +4h then every 4 h; `priorHits` = hold_hits before this hold (0 for the first). */
export function codeContractDelayMs(priorHits: number): number {
  const i = Math.max(0, Math.floor(priorHits));
  return CODE_CONTRACT_RETRY_DELAYS_MS[Math.min(i, CODE_CONTRACT_RETRY_DELAYS_MS.length - 1)];
}

const BASE_PLAN: OutcomePlan = {
  nextStatus: 'RETRY_SCHEDULED',
  attentionReason: null,
  holdReason: null,
  holdScope: null,
  nextAttemptAt: null,
  refundAttempt: false,
  bumpEpoch: false,
  setUnknownOutcomeSeen: false,
  setLastUnknownAt: false,
  setLastRateLimitedAt: false,
  holdHits: 0,
  payloadNull: false,
  lastErrorName: null,
  lastErrorStatus: null,
  setAcceptedAt: false,
  providerMessageId: null,
};

/** Pure mapping of a classification onto the row update (E3 table + E5 FINALISATION MAPPING). */
export function planOutcome(c: Classification, facts: OutcomeRowFacts, ctx: OutcomeContext): OutcomePlan {
  const now = ctx.now;
  switch (c.category) {
    case 'ACCEPTED':
      return { ...BASE_PLAN, nextStatus: 'ACCEPTED', payloadNull: true, setAcceptedAt: true, providerMessageId: c.providerMessageId, holdHits: 0 };

    case 'IDEMPOTENCY':
      return {
        ...BASE_PLAN, nextStatus: 'ATTENTION', attentionReason: 'IDEMPOTENCY_MISMATCH', payloadNull: true,
        lastErrorName: c.errorName, lastErrorStatus: c.statusCode, holdHits: facts.holdHits,
      };

    case 'UNKNOWN': {
      const base = {
        ...BASE_PLAN,
        setUnknownOutcomeSeen: true,
        setLastUnknownAt: c.counted,
        lastErrorName: c.errorName,
        lastErrorStatus: c.statusCode,
        holdHits: facts.holdHits,
      };
      // t0 is always set for a stamped attempt; fall back to now() defensively (never later than the true anchor).
      const slot = unknownLadderSlot(facts.attemptCount, facts.firstProviderAttemptAt ?? now, now);
      if (slot.kind === 'ATTENTION') {
        return { ...base, nextStatus: 'ATTENTION', attentionReason: slot.reason, payloadNull: true };
      }
      return { ...base, nextStatus: 'RETRY_SCHEDULED', nextAttemptAt: slot.at };
    }

    case 'CONFIG':
    case 'QUOTA_DAILY':
    case 'QUOTA_MONTHLY': {
      return {
        ...BASE_PLAN,
        nextStatus: 'HELD_PROVIDER_OPERATIONAL',
        holdReason: c.holdReason,
        holdScope: 'GLOBAL',
        nextAttemptAt: now,
        refundAttempt: true,
        bumpEpoch: !facts.unknownOutcomeSeen,
        holdHits: nextHoldHits(facts, c.holdReason),
        lastErrorName: c.errorName,
        lastErrorStatus: c.statusCode,
      };
    }

    case 'RATE_LIMIT':
      return {
        ...BASE_PLAN,
        nextStatus: 'HELD_PROVIDER_OPERATIONAL',
        holdReason: 'RATE_LIMIT',
        holdScope: 'ROW',
        nextAttemptAt: new Date(now.getTime() + c.rowDelaySeconds * 1000),
        refundAttempt: true,
        bumpEpoch: !facts.unknownOutcomeSeen,
        setLastRateLimitedAt: true,
        holdHits: nextHoldHits(facts, 'RATE_LIMIT'),
        lastErrorName: c.errorName,
        lastErrorStatus: c.statusCode,
      };

    case 'CODE_CONTRACT': {
      const promote = shouldPromoteToFailedPermanent({
        prior: facts.prior,
        current: { name: c.errorName, status: c.statusCode, at: now },
        acceptedSameTypeWithin60m: ctx.acceptedSameTypeWithin60m === true,
      });
      if (promote) {
        return {
          ...BASE_PLAN, nextStatus: 'FAILED_PERMANENT', payloadNull: true,
          lastErrorName: c.errorName, lastErrorStatus: c.statusCode, holdHits: facts.holdHits,
        };
      }
      const hits = nextHoldHits(facts, 'CODE_CONTRACT');
      return {
        ...BASE_PLAN,
        nextStatus: 'HELD_PROVIDER_OPERATIONAL',
        holdReason: 'CODE_CONTRACT',
        holdScope: 'ROW',
        // hold_hits indexes the delay: the first hold uses the first delay.
        nextAttemptAt: new Date(now.getTime() + codeContractDelayMs(hits - 1)),
        refundAttempt: true,
        bumpEpoch: !facts.unknownOutcomeSeen,
        holdHits: hits,
        lastErrorName: c.errorName,
        lastErrorStatus: c.statusCode,
      };
    }
  }
}

// ==================== LOCAL RECIPIENT VALIDATION (E3 CODE/CONTRACT (C)) ====================
export type RecipientRejection =
  | 'EMPTY' | 'TOO_LONG' | 'WHITESPACE_OR_CONTROL' | 'AT_SIGN_COUNT' | 'EMPTY_LOCAL_PART' | 'EMPTY_DOMAIN'
  | 'DOMAIN_NO_DOT' | 'BAD_DOMAIN_LABEL' | 'TLD_TOO_SHORT' | 'TLD_ALL_NUMERIC';

export type RecipientValidation = { ok: true } | { ok: false; reason: RecipientRejection };

/**
 * Strict recipient check: single @, no whitespace or control characters, length <= 254, domain with a dot, no
 * empty domain label, TLD of at least 2 characters and not all-numeric. A failure is FAILED_PERMANENT with
 * last_error_name LOCAL_INVALID_RECIPIENT and ZERO provider calls.
 */
export function validateRecipientSyntax(address: unknown): RecipientValidation {
  if (typeof address !== 'string' || address.length === 0) return { ok: false, reason: 'EMPTY' };
  if (address.length > 254) return { ok: false, reason: 'TOO_LONG' };
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(address)) return { ok: false, reason: 'WHITESPACE_OR_CONTROL' };
  const parts = address.split('@');
  if (parts.length !== 2) return { ok: false, reason: 'AT_SIGN_COUNT' };
  const [local, domain] = parts;
  if (local.length === 0) return { ok: false, reason: 'EMPTY_LOCAL_PART' };
  if (domain.length === 0) return { ok: false, reason: 'EMPTY_DOMAIN' };
  if (!domain.includes('.')) return { ok: false, reason: 'DOMAIN_NO_DOT' };
  const labels = domain.split('.');
  if (labels.some((l) => l.length === 0)) return { ok: false, reason: 'BAD_DOMAIN_LABEL' };
  const tld = labels[labels.length - 1];
  if (tld.length < 2) return { ok: false, reason: 'TLD_TOO_SHORT' };
  if (/^\d+$/.test(tld)) return { ok: false, reason: 'TLD_ALL_NUMERIC' };
  return { ok: true };
}

/** The CONFIG classification for a client that is not configured (isProviderConfigured() === false; no call is made). */
export function classifyMissingApiKey(): Classification {
  return config({ errorName: 'missing_api_key', statusCode: null });
}
