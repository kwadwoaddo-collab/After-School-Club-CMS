/**
 * Pure classifier / ladder / probe-schedule / recipient-validation unit tests (E3). No database, no network.
 * Covers plan items 41-49, 167-177 (classification part), 199-202, 205 (no message text), 217, 261, 266 (rule
 * constants), 270, 272-273, 275-276 (constants + promotion arithmetic), 280, 282, 284-285, 336-345 (constants and
 * validation parts), 355 (import closure), 382 (D-09 distinguishability, pure part).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ErrorResponse } from 'resend';
import {
  CLASSIFIER_TABLE,
  KNOWN_PROVIDER_ERROR_NAMES,
  LOCAL_INVALID_RECIPIENT,
  UNKNOWN_ERROR_NAME,
  breakerReasonOutranks,
  classifyMissingApiKey,
  classifyProviderResponse,
  classifyThrown,
  codeContractDelayMs,
  isAfterBackstop,
  isAfterLatestStart,
  isFullLengthTimeout,
  ladderOffsetMs,
  nextHoldHits,
  nextProbeAt,
  nextUtcMidnightPlus10m,
  outcomeNeedsBreakerLock,
  parseRetryAfter,
  planOutcome,
  sanitizeErrorName,
  shouldPromoteToFailedPermanent,
  unknownLadderSlot,
  validateRecipientSyntax,
  type Classification,
  type OutcomeRowFacts,
  type ProviderCallContext,
} from './email-outbox-classifier';
import {
  CODE_CONTRACT_ESCALATION_MIN_RECIPIENTS,
  CODE_CONTRACT_ESCALATION_WINDOW_MS,
  PROBE_SCHEDULE_MS,
  PROVIDER_MAX_TIMEOUT_MS,
  PROVIDER_UNAVAILABLE_MIN_RECIPIENTS,
  PROVIDER_UNAVAILABLE_MIN_ROWS,
  PROVIDER_UNAVAILABLE_WINDOW_MS,
  UNKNOWN_LADDER_OFFSETS_MS,
} from './email-outbox-types';

const FAST: ProviderCallContext = { timeoutMs: 30000, elapsedMs: 120 };
const FULL_TIMEOUT: ProviderCallContext = { timeoutMs: 30000, elapsedMs: 30000 };
const SHORT_TIMEOUT: ProviderCallContext = { timeoutMs: 3000, elapsedMs: 3000 };
const H = 3600_000;
const M = 60_000;
const T0 = new Date('2030-01-01T00:00:00Z');

function err(name: string, statusCode: number | null, headers: Record<string, string> | null = null, message = 'SECRET provider message with user@example.com') {
  return { data: null, error: { name, statusCode, message }, headers };
}
const ok = { data: { id: 'msg_123' }, error: null, headers: null };
const facts = (over: Partial<OutcomeRowFacts> = {}): OutcomeRowFacts => ({
  attemptCount: 1,
  unknownOutcomeSeen: false,
  firstProviderAttemptAt: T0,
  holdHits: 0,
  providerHoldReason: null,
  prior: { name: null, status: null, at: null },
  ...over,
});

describe('classifier table (plan 202, exhaustive against the installed SDK type)', () => {
  it('has an explicit mapping for every name in RESEND_ERROR_CODE_KEY (compile-time + runtime)', () => {
    // Compile-time: this Record<ErrorResponse["name"], true> fails to type-check if the SDK adds or removes a name.
    const sdkNames: Record<ErrorResponse['name'], true> = {
      invalid_idempotency_key: true, validation_error: true, missing_api_key: true, restricted_api_key: true,
      invalid_api_key: true, not_found: true, method_not_allowed: true, invalid_idempotent_request: true,
      concurrent_idempotent_requests: true, invalid_attachment: true, invalid_from_address: true, invalid_access: true,
      invalid_parameter: true, invalid_region: true, missing_required_field: true, monthly_quota_exceeded: true,
      daily_quota_exceeded: true, rate_limit_exceeded: true, security_error: true, application_error: true,
      internal_server_error: true,
    };
    expect([...KNOWN_PROVIDER_ERROR_NAMES].sort()).toEqual(Object.keys(sdkNames).sort());
    expect(Object.keys(CLASSIFIER_TABLE).sort()).toEqual([...KNOWN_PROVIDER_ERROR_NAMES].sort());
  });

  it('unrecognised name and thrown error -> UNKNOWN, never definitive (49, 202)', () => {
    const c = classifyProviderResponse(err('some_future_error', 418), FAST);
    expect(c.category).toBe('UNKNOWN');
    const t = classifyThrown(new TypeError('boom'), FAST);
    expect(t.category).toBe('UNKNOWN');
    expect(classifyThrown(undefined, FAST).category).toBe('UNKNOWN');
    expect(classifyThrown('string', FAST).category).toBe('UNKNOWN');
  });
});

describe('CONFIG class (167-173, 201)', () => {
  it.each([
    ['invalid_api_key', 401], ['invalid_api_key', 403], ['missing_api_key', 401], ['restricted_api_key', 401],
    ['invalid_from_address', 422], ['invalid_access', 403], ['security_error', 403],
  ])('%s %i -> CONFIG hold GLOBAL, breaker CONFIG', (name, status) => {
    const c = classifyProviderResponse(err(name, status), FAST);
    expect(c).toMatchObject({ category: 'CONFIG', holdReason: 'CONFIG', holdScope: 'GLOBAL', breakerReason: 'CONFIG', errorName: name });
  });

  it('validation_error 403 -> CONFIG-suspect; 400/422 -> CODE_CONTRACT ROW (173)', () => {
    expect(classifyProviderResponse(err('validation_error', 403), FAST)).toMatchObject({ category: 'CONFIG', suspect403: true });
    for (const s of [400, 422]) {
      expect(classifyProviderResponse(err('validation_error', s), FAST)).toMatchObject({ category: 'CODE_CONTRACT', holdScope: 'ROW', holdReason: 'CODE_CONTRACT' });
    }
  });

  it.each(['invalid_idempotency_key', 'not_found', 'method_not_allowed', 'invalid_region'])('%s (any status) -> CONFIG GLOBAL code defect (201)', (name) => {
    for (const s of [400, 404, 405, 422]) {
      expect(classifyProviderResponse(err(name, s), FAST)).toMatchObject({ category: 'CONFIG', holdScope: 'GLOBAL', breakerReason: 'CONFIG', errorName: name });
    }
  });

  it('thrown "Missing API key" is a CONFIG hold, not UNKNOWN (215)', () => {
    expect(classifyThrown(new Error('Missing API key. Pass it to the constructor'), FAST)).toMatchObject({ category: 'CONFIG', errorName: 'missing_api_key' });
    expect(classifyMissingApiKey()).toMatchObject({ category: 'CONFIG', errorName: 'missing_api_key', statusCode: null });
  });
});

describe('QUOTA (174, 175)', () => {
  it('daily and monthly quota are definitive GLOBAL holds with their own breaker reason', () => {
    expect(classifyProviderResponse(err('daily_quota_exceeded', 429), FAST)).toMatchObject({ category: 'QUOTA_DAILY', breakerReason: 'QUOTA_DAILY' });
    expect(classifyProviderResponse(err('monthly_quota_exceeded', 429), FAST)).toMatchObject({ category: 'QUOTA_MONTHLY', breakerReason: 'QUOTA_MONTHLY', holdScope: 'GLOBAL' });
  });
  it('quota names win over the generic 429 (name first, status second)', () => {
    // Table: daily/monthly quota are checked by name; a bare 429 with an unrelated name is a rate limit.
    expect(classifyProviderResponse(err('application_error', 429), FAST).category).toBe('RATE_LIMIT');
  });
});

describe('RATE_LIMIT and Retry-After (42, 176, 217, 284, 285)', () => {
  it.each([
    [{ 'retry-after': '30' }, 30, 30, false],
    [{ 'Retry-After': '45' }, 45, 45, false],
    [{ 'retry-after': '1' }, 1, 1, false],
    [{ 'retry-after': '300' }, 300, 300, false],
    [{ 'retry-after': '301' }, 301, 60, true],
    [{ 'retry-after': '99999' }, 99999, 60, true],
  ])('header %o -> retryAfter %s row delay %s exceeds=%s', (headers, ra, delay, exceeds) => {
    const c = classifyProviderResponse(err('rate_limit_exceeded', 429, headers), FAST);
    expect(c).toMatchObject({ category: 'RATE_LIMIT', holdScope: 'ROW', retryAfterSeconds: ra, rowDelaySeconds: delay, exceedsMaxRetryAfter: exceeds });
  });

  it.each([
    [undefined], [{}], [{ 'retry-after': '' }], [{ 'retry-after': '0' }], [{ 'retry-after': '-5' }],
    [{ 'retry-after': 'Wed, 21 Oct 2030 07:28:00 GMT' }], [{ 'retry-after': '12.5' }], [{ 'retry-after': ' 30' }],
    [{ 'retry-after': '100000' }], [{ 'retry-after': '1e2' }],
  ])('invalid Retry-After %o -> null and 60 s row default', (headers) => {
    expect(parseRetryAfter(headers as Record<string, string> | undefined)).toBeNull();
    const c = classifyProviderResponse(err('rate_limit_exceeded', 429, (headers as Record<string, string>) ?? null), FAST);
    expect(c).toMatchObject({ category: 'RATE_LIMIT', rowDelaySeconds: 60, retryAfterSeconds: null, exceedsMaxRetryAfter: false });
  });

  it('reads a Headers-like object and any header-name casing; 429 under any name is a rate limit', () => {
    expect(parseRetryAfter(new Headers({ 'Retry-After': '12' }))).toEqual({ seconds: 12, exceedsMax: false });
    expect(parseRetryAfter({ 'RETRY-AFTER': '7' })).toEqual({ seconds: 7, exceedsMax: false });
    expect(classifyProviderResponse(err('some_name', 429, { 'retry-after': '9' }), FAST)).toMatchObject({ category: 'RATE_LIMIT', rowDelaySeconds: 9 });
  });

  it('an isolated 429 plan is a ROW hold with refund, row delay and epoch bump (not RETRY_SCHEDULED, not FAILED_PERMANENT)', () => {
    const c = classifyProviderResponse(err('rate_limit_exceeded', 429, { 'retry-after': '30' }), FAST);
    const plan = planOutcome(c, facts(), { now: T0 });
    expect(plan).toMatchObject({
      nextStatus: 'HELD_PROVIDER_OPERATIONAL', holdReason: 'RATE_LIMIT', holdScope: 'ROW', refundAttempt: true,
      bumpEpoch: true, setLastRateLimitedAt: true, holdHits: 1, payloadNull: false,
    });
    expect(plan.nextAttemptAt!.getTime()).toBe(T0.getTime() + 30_000);
  });
});

describe('ambiguous-code names and CODE_CONTRACT holds (41, 272, 273)', () => {
  it.each(['invalid_parameter', 'missing_required_field', 'invalid_attachment'])('%s -> HELD(CODE_CONTRACT, ROW), never definitive-permanent', (name) => {
    for (const s of [400, 422]) {
      expect(classifyProviderResponse(err(name, s), FAST)).toMatchObject({ category: 'CODE_CONTRACT', holdScope: 'ROW', holdReason: 'CODE_CONTRACT' });
    }
  });

  it('hold delays are +15m, +1h, +4h then every 4h, indexed by hold_hits; refund; epoch bump only when unknown_outcome_seen=false', () => {
    const c = classifyProviderResponse(err('validation_error', 422), FAST);
    const expected = [15 * M, 1 * H, 4 * H, 4 * H, 4 * H];
    expected.forEach((delay, i) => {
      const plan = planOutcome(c, facts({ holdHits: i, providerHoldReason: i === 0 ? null : 'CODE_CONTRACT' }), { now: T0 });
      expect(plan.nextAttemptAt!.getTime() - T0.getTime()).toBe(delay);
      expect(plan).toMatchObject({ nextStatus: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', refundAttempt: true, payloadNull: false, bumpEpoch: true });
      expect(codeContractDelayMs(i)).toBe(delay);
    });
    expect(planOutcome(c, facts({ unknownOutcomeSeen: true }), { now: T0 }).bumpEpoch).toBe(false);
  });

  it('validation_error with an undocumented status is UNKNOWN (never definitive)', () => {
    expect(classifyProviderResponse(err('validation_error', 401), FAST)).toMatchObject({ category: 'UNKNOWN', counted: false });
    expect(classifyProviderResponse(err('validation_error', null), FAST)).toMatchObject({ category: 'UNKNOWN', counted: false });
    expect(classifyProviderResponse(err('validation_error', 503), FAST)).toMatchObject({ category: 'UNKNOWN', counted: true });
  });
});

describe('FAILED_PERMANENT promotion (275)', () => {
  const now = new Date(T0.getTime() + 20 * M);
  const prior = { name: 'validation_error', status: 422, at: T0 };
  const base = { prior, current: { name: 'validation_error', status: 422, at: now }, acceptedSameTypeWithin60m: true };
  it('promotes only with identical name+status >= 15 min apart AND an accepted same-type row in the preceding 60 min', () => {
    expect(shouldPromoteToFailedPermanent(base)).toBe(true);
    expect(shouldPromoteToFailedPermanent({ ...base, acceptedSameTypeWithin60m: false })).toBe(false);
    expect(shouldPromoteToFailedPermanent({ ...base, current: { ...base.current, at: new Date(T0.getTime() + 14 * M + 59_000) } })).toBe(false);
    expect(shouldPromoteToFailedPermanent({ ...base, current: { ...base.current, at: new Date(T0.getTime() + 15 * M) } })).toBe(true);
    expect(shouldPromoteToFailedPermanent({ ...base, current: { ...base.current, status: 400 } })).toBe(false);
    expect(shouldPromoteToFailedPermanent({ ...base, current: { ...base.current, name: 'invalid_parameter' } })).toBe(false);
    expect(shouldPromoteToFailedPermanent({ ...base, prior: { name: null, status: null, at: null } })).toBe(false);
  });
  it('planOutcome yields FAILED_PERMANENT with payload NULL only when promoted, otherwise stays held', () => {
    const c = classifyProviderResponse(err('validation_error', 422), FAST);
    const promoted = planOutcome(c, facts({ prior: { name: 'validation_error', status: 422, at: T0 }, holdHits: 1, providerHoldReason: 'CODE_CONTRACT' }), { now, acceptedSameTypeWithin60m: true });
    expect(promoted).toMatchObject({ nextStatus: 'FAILED_PERMANENT', payloadNull: true });
    const held = planOutcome(c, facts({ prior: { name: 'validation_error', status: 422, at: T0 }, holdHits: 1, providerHoldReason: 'CODE_CONTRACT' }), { now, acceptedSameTypeWithin60m: false });
    expect(held).toMatchObject({ nextStatus: 'HELD_PROVIDER_OPERATIONAL', payloadNull: false });
  });
  it('escalation constants are named exported constants (344)', () => {
    expect(CODE_CONTRACT_ESCALATION_MIN_RECIPIENTS).toBe(3);
    expect(CODE_CONTRACT_ESCALATION_WINDOW_MS).toBe(15 * M);
  });
});

describe('UNKNOWN: counted vs uncounted (43, 44, 45, 199, 200, 270, 280, 321, D-09)', () => {
  it('5xx, internal_server_error and application_error >= 500 are counted UNKNOWN', () => {
    expect(classifyProviderResponse(err('internal_server_error', 500), FAST)).toMatchObject({ category: 'UNKNOWN', counted: true, detail: 'SERVER_5XX' });
    expect(classifyProviderResponse(err('application_error', 502), FAST)).toMatchObject({ category: 'UNKNOWN', counted: true });
    expect(classifyProviderResponse(err('some_unknown_name', 503), FAST)).toMatchObject({ category: 'UNKNOWN', counted: true });
  });
  it('application_error with a numeric non-5xx status is UNKNOWN, not counted, never definitive (200)', () => {
    expect(classifyProviderResponse(err('application_error', 200), FAST)).toMatchObject({ category: 'UNKNOWN', counted: false });
  });
  it('application_error with null status: transport counted; full 30 s timeout counted; budget-shortened timeout NOT counted', () => {
    expect(classifyProviderResponse(err('application_error', null), FAST)).toMatchObject({ category: 'UNKNOWN', counted: true, detail: 'TRANSPORT' });
    expect(classifyProviderResponse(err('application_error', null), FULL_TIMEOUT)).toMatchObject({ counted: true, detail: 'TIMEOUT_FULL' });
    expect(classifyProviderResponse(err('application_error', null), SHORT_TIMEOUT)).toMatchObject({ category: 'UNKNOWN', counted: false, detail: 'TIMEOUT_SHORTENED' });
    expect(classifyProviderResponse(err('application_error', null), { timeoutMs: 18000, elapsedMs: 18010 })).toMatchObject({ counted: false });
    // a 3 s action timeout that is aborted is uncounted (321)
    expect(isFullLengthTimeout({ timeoutMs: 3000, elapsedMs: 3000 })).toBe(false);
    expect(isFullLengthTimeout({ timeoutMs: PROVIDER_MAX_TIMEOUT_MS, elapsedMs: PROVIDER_MAX_TIMEOUT_MS - 1 })).toBe(false);
    expect(isFullLengthTimeout(FULL_TIMEOUT)).toBe(true);
  });
  it('thrown abort: counted only for the full-length timer', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(classifyThrown(abort, FULL_TIMEOUT)).toMatchObject({ category: 'UNKNOWN', counted: true, detail: 'TIMEOUT_FULL' });
    expect(classifyThrown(abort, SHORT_TIMEOUT)).toMatchObject({ category: 'UNKNOWN', counted: false, detail: 'TIMEOUT_SHORTENED' });
    expect(classifyThrown(new TypeError('fetch failed'), FAST)).toMatchObject({ category: 'UNKNOWN', counted: false, detail: 'THROWN' });
  });
  it('concurrent_idempotent_requests (409) is UNKNOWN, NOT counted, and consumes a ladder step', () => {
    const c = classifyProviderResponse(err('concurrent_idempotent_requests', 409), FAST);
    expect(c).toMatchObject({ category: 'UNKNOWN', counted: false, detail: 'CONCURRENT_IDEMPOTENT' });
    const plan = planOutcome(c, facts({ attemptCount: 2 }), { now: T0 });
    expect(plan).toMatchObject({ nextStatus: 'RETRY_SCHEDULED', setUnknownOutcomeSeen: true, setLastUnknownAt: false, bumpEpoch: false, refundAttempt: false });
  });
  it('D-09: a counted UNKNOWN sets last_unknown_at, a budget-shortened one does not; both set unknown_outcome_seen (280)', () => {
    const counted = planOutcome(classifyProviderResponse(err('application_error', null), FULL_TIMEOUT), facts(), { now: T0 });
    const shortened = planOutcome(classifyProviderResponse(err('application_error', null), SHORT_TIMEOUT), facts(), { now: T0 });
    expect(counted).toMatchObject({ setLastUnknownAt: true, setUnknownOutcomeSeen: true });
    expect(shortened).toMatchObject({ setLastUnknownAt: false, setUnknownOutcomeSeen: true });
  });
  it('a response with neither error nor id, or no response, is UNKNOWN and uncounted', () => {
    expect(classifyProviderResponse({ data: null, error: null }, FAST)).toMatchObject({ category: 'UNKNOWN', counted: false });
    expect(classifyProviderResponse(null, FAST)).toMatchObject({ category: 'UNKNOWN', counted: false });
  });
});

describe('IDEMPOTENCY mismatch (44, 218, 255)', () => {
  it('invalid_idempotent_request 409 -> ATTENTION(IDEMPOTENCY_MISMATCH) for that row only, no new key, no breaker lock', () => {
    const c = classifyProviderResponse(err('invalid_idempotent_request', 409), FAST);
    expect(c.category).toBe('IDEMPOTENCY');
    expect(planOutcome(c, facts({ unknownOutcomeSeen: true }), { now: T0 })).toMatchObject({
      nextStatus: 'ATTENTION', attentionReason: 'IDEMPOTENCY_MISMATCH', payloadNull: true, bumpEpoch: false,
    });
    expect(outcomeNeedsBreakerLock(c, false)).toBe(false);
  });
});

describe('ACCEPTED (50, 288)', () => {
  it('success -> ACCEPTED with provider message id, payload NULL, accepted_at, hold_hits reset', () => {
    const c = classifyProviderResponse(ok, FAST);
    expect(c).toEqual({ category: 'ACCEPTED', providerMessageId: 'msg_123' });
    expect(planOutcome(c, facts({ holdHits: 2, providerHoldReason: 'RATE_LIMIT' }), { now: T0 })).toMatchObject({
      nextStatus: 'ACCEPTED', payloadNull: true, setAcceptedAt: true, providerMessageId: 'msg_123', holdHits: 0,
    });
    expect(outcomeNeedsBreakerLock(c, false)).toBe(false);
    expect(outcomeNeedsBreakerLock(c, true)).toBe(true);
  });
});

describe('operational holds (167-177, 192, 280)', () => {
  it.each(['invalid_api_key', 'daily_quota_exceeded', 'monthly_quota_exceeded'])('%s: GLOBAL hold, refund, payload retained', (name) => {
    const plan = planOutcome(classifyProviderResponse(err(name, 401), FAST), facts({ attemptCount: 3 }), { now: T0 });
    expect(plan).toMatchObject({ nextStatus: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', refundAttempt: true, payloadNull: false, bumpEpoch: true });
  });
  it('epoch bump is suppressed when unknown_outcome_seen = true (same key, stamp kept)', () => {
    const plan = planOutcome(classifyProviderResponse(err('invalid_api_key', 401), FAST), facts({ unknownOutcomeSeen: true }), { now: T0 });
    expect(plan.bumpEpoch).toBe(false);
    expect(plan.refundAttempt).toBe(true);
  });
  it('hold_hits counts consecutive same-reason holds and restarts on a different reason', () => {
    expect(nextHoldHits({ holdHits: 2, providerHoldReason: 'RATE_LIMIT' }, 'RATE_LIMIT')).toBe(3);
    expect(nextHoldHits({ holdHits: 2, providerHoldReason: 'CONFIG' }, 'RATE_LIMIT')).toBe(1);
    expect(nextHoldHits({ holdHits: 0, providerHoldReason: null }, 'RATE_LIMIT')).toBe(1);
  });
});

describe('error-name-only capture (205)', () => {
  it('never carries message text, in any category', () => {
    const responses = [
      err('invalid_api_key', 401), err('rate_limit_exceeded', 429, { 'retry-after': '5' }), err('validation_error', 422),
      err('internal_server_error', 500), err('application_error', null), err('invalid_idempotent_request', 409),
      err('daily_quota_exceeded', 429), err('weird name with spaces user@example.com', 400),
    ];
    for (const r of responses) {
      const c = classifyProviderResponse(r, FAST);
      const json = JSON.stringify(c) + JSON.stringify(planOutcome(c, facts(), { now: T0 }));
      expect(json).not.toContain('SECRET');
      expect(json).not.toContain('user@example.com');
    }
    const thrown = classifyThrown(Object.assign(new Error('leaks SECRET key re_abc123'), { name: 'Error' }), FAST);
    expect(JSON.stringify(thrown)).not.toContain('SECRET');
    expect(JSON.stringify(classifyThrown(new Error('Missing API key SECRET'), FAST))).not.toContain('SECRET');
  });
  it('sanitizeErrorName accepts identifiers only', () => {
    expect(sanitizeErrorName('validation_error')).toBe('validation_error');
    expect(sanitizeErrorName('has space')).toBe(UNKNOWN_ERROR_NAME);
    expect(sanitizeErrorName('a@b.c')).toBe(UNKNOWN_ERROR_NAME);
    expect(sanitizeErrorName(42)).toBe(UNKNOWN_ERROR_NAME);
    expect(sanitizeErrorName('x'.repeat(65))).toBe(UNKNOWN_ERROR_NAME);
  });
});

describe('outcomeNeedsBreakerLock (238)', () => {
  it('counted UNKNOWN and operational classes lock; uncounted UNKNOWN, ACCEPTED and IDEMPOTENCY do not (unless probe)', () => {
    const counted = classifyProviderResponse(err('internal_server_error', 500), FAST);
    const uncounted = classifyProviderResponse(err('concurrent_idempotent_requests', 409), FAST);
    expect(outcomeNeedsBreakerLock(counted, false)).toBe(true);
    expect(outcomeNeedsBreakerLock(uncounted, false)).toBe(false);
    expect(outcomeNeedsBreakerLock(uncounted, true)).toBe(true);
    for (const n of ['invalid_api_key', 'daily_quota_exceeded', 'rate_limit_exceeded', 'validation_error']) {
      expect(outcomeNeedsBreakerLock(classifyProviderResponse(err(n, n === 'rate_limit_exceeded' ? 429 : 422), FAST), false)).toBe(true);
    }
  });
});

describe('UNKNOWN ladder arithmetic (45-48, 261, 263, 265, 279)', () => {
  it('offsets are 5m, 30m, 2h, 6h, 12h, 20h from t0', () => {
    expect([...UNKNOWN_LADDER_OFFSETS_MS]).toEqual([5 * M, 30 * M, 2 * H, 6 * H, 12 * H, 20 * H]);
    expect(ladderOffsetMs(1)).toBe(5 * M);
    expect(ladderOffsetMs(6)).toBe(20 * H);
    expect(ladderOffsetMs(7)).toBeUndefined();
  });
  it('slot k = GREATEST(t0 + offset[k], now + 5 min), absent late clocks', () => {
    const offsets = [5 * M, 30 * M, 2 * H, 6 * H, 12 * H, 20 * H];
    offsets.forEach((o, i) => {
      const now = new Date(T0.getTime() + o - 10 * M > T0.getTime() ? T0.getTime() + o - 10 * M : T0.getTime());
      const slot = unknownLadderSlot(i + 1, T0, now);
      expect(slot).toEqual({ kind: 'RETRY_SCHEDULED', at: new Date(Math.max(T0.getTime() + o, now.getTime() + 5 * M)) });
    });
  });
  it('5 minute minimum gap: a slot that passed during an outage is pushed to now + 5 min (265)', () => {
    const now = new Date(T0.getTime() + 3 * H); // slot 2 (30m) long past
    expect(unknownLadderSlot(2, T0, now)).toEqual({ kind: 'RETRY_SCHEDULED', at: new Date(now.getTime() + 5 * M) });
  });
  it('a slot at or after t0 + 22 h -> ATTENTION(WINDOW_23H); 20h slot reachable only before 22h-5m', () => {
    const justOk = new Date(T0.getTime() + 21 * H + 54 * M);
    expect(unknownLadderSlot(6, T0, justOk).kind).toBe('RETRY_SCHEDULED');
    const boundary = new Date(T0.getTime() + 21 * H + 55 * M); // now + 5 min == t0 + 22 h
    expect(unknownLadderSlot(6, T0, boundary)).toEqual({ kind: 'ATTENTION', reason: 'WINDOW_23H' });
    expect(unknownLadderSlot(3, T0, new Date(T0.getTime() + 22 * H))).toEqual({ kind: 'ATTENTION', reason: 'WINDOW_23H' });
  });
  it('UNKNOWN number 7 -> ATTENTION(UNKNOWN_OUTCOME_EXHAUSTED), never after 3 attempts (46, 48)', () => {
    expect(unknownLadderSlot(7, T0, T0)).toEqual({ kind: 'ATTENTION', reason: 'UNKNOWN_OUTCOME_EXHAUSTED' });
    for (const k of [1, 2, 3, 4, 5, 6]) expect(unknownLadderSlot(k, T0, T0).kind).toBe('RETRY_SCHEDULED');
  });
  it('latest-start (22 h) and backstop (23 h) predicates', () => {
    expect(isAfterLatestStart(T0, new Date(T0.getTime() + 22 * H - 1))).toBe(false);
    expect(isAfterLatestStart(T0, new Date(T0.getTime() + 22 * H))).toBe(true);
    expect(isAfterBackstop(T0, new Date(T0.getTime() + 23 * H - 1))).toBe(false);
    expect(isAfterBackstop(T0, new Date(T0.getTime() + 23 * H))).toBe(true);
  });
  it('plan: UNKNOWN keeps payload, key (no bump), attempt_count (no refund) and uses the ladder', () => {
    const c = classifyProviderResponse(err('internal_server_error', 500), FAST);
    const plan = planOutcome(c, facts({ attemptCount: 3 }), { now: new Date(T0.getTime() + 2 * H + M) });
    expect(plan).toMatchObject({ nextStatus: 'RETRY_SCHEDULED', refundAttempt: false, bumpEpoch: false, payloadNull: false, setLastUnknownAt: true, setUnknownOutcomeSeen: true });
    expect(plan.nextAttemptAt!.getTime()).toBe(new Date(T0.getTime() + 2 * H + 6 * M).getTime());
    const exhausted = planOutcome(c, facts({ attemptCount: 7 }), { now: T0 });
    expect(exhausted).toMatchObject({ nextStatus: 'ATTENTION', attentionReason: 'UNKNOWN_OUTCOME_EXHAUSTED', payloadNull: true });
    const window = planOutcome(c, facts({ attemptCount: 6 }), { now: new Date(T0.getTime() + 21 * H + 56 * M) });
    expect(window).toMatchObject({ nextStatus: 'ATTENTION', attentionReason: 'WINDOW_23H', payloadNull: true });
  });
  it('mixed history: ladder anchored to the (new epoch) first_provider_attempt_at (47)', () => {
    const t0 = new Date(T0.getTime() + 5 * H);
    const slot = unknownLadderSlot(1, t0, t0);
    expect(slot).toEqual({ kind: 'RETRY_SCHEDULED', at: new Date(t0.getTime() + 5 * M) });
  });
});

describe('PROVIDER_UNAVAILABLE rule constants (266)', () => {
  it('2 rows, 2 recipients, 15 minute window', () => {
    expect(PROVIDER_UNAVAILABLE_MIN_ROWS).toBe(2);
    expect(PROVIDER_UNAVAILABLE_MIN_RECIPIENTS).toBe(2);
    expect(PROVIDER_UNAVAILABLE_WINDOW_MS).toBe(15 * M);
  });
});

describe('breaker probe schedule and precedence (174, 175, 185, 207, 268)', () => {
  const now = new Date('2030-03-10T13:00:00Z');
  it('PROVIDER_UNAVAILABLE 2m, 5m, 15m, 30m cap 30m', () => {
    expect([...PROBE_SCHEDULE_MS]).toEqual([2 * M, 5 * M, 15 * M, 30 * M]);
    [0, 1, 2, 3, 4, 9].forEach((i, n) => {
      const exp = [2, 5, 15, 30, 30, 30][n];
      expect(nextProbeAt('PROVIDER_UNAVAILABLE', i, now).getTime() - now.getTime()).toBe(exp * M);
    });
  });
  it('CONFIG 15m, 30m, then 60m cap', () => {
    [0, 1, 2, 3, 8].forEach((i, n) => expect(nextProbeAt('CONFIG', i, now).getTime() - now.getTime()).toBe([15, 30, 60, 60, 60][n] * M));
  });
  it('QUOTA_DAILY: next UTC midnight + 10m, then hourly; QUOTA_MONTHLY 6h', () => {
    expect(nextProbeAt('QUOTA_DAILY', 0, now).toISOString()).toBe('2030-03-11T00:10:00.000Z');
    expect(nextProbeAt('QUOTA_DAILY', 1, now).getTime() - now.getTime()).toBe(H);
    expect(nextUtcMidnightPlus10m(new Date('2030-12-31T23:59:59Z')).toISOString()).toBe('2031-01-01T00:10:00.000Z');
    expect(nextProbeAt('QUOTA_MONTHLY', 0, now).getTime() - now.getTime()).toBe(6 * H);
  });
  it('RATE_LIMIT probe = max(Retry-After, 2 min) capped 1 h; default 60 s -> 2 min (176)', () => {
    const d = (ra: number | null) => (nextProbeAt('RATE_LIMIT', 0, now, ra).getTime() - now.getTime()) / 1000;
    expect(d(null)).toBe(120);
    expect(d(30)).toBe(120);
    expect(d(300)).toBe(300);
    expect(d(900)).toBe(900);
    expect(d(99999)).toBe(3600);
  });
  it('reason precedence CONFIG > QUOTA_MONTHLY > QUOTA_DAILY > RATE_LIMIT > PROVIDER_UNAVAILABLE', () => {
    expect(breakerReasonOutranks('CONFIG', 'QUOTA_MONTHLY')).toBe(true);
    expect(breakerReasonOutranks('QUOTA_MONTHLY', 'QUOTA_DAILY')).toBe(true);
    expect(breakerReasonOutranks('QUOTA_DAILY', 'RATE_LIMIT')).toBe(true);
    expect(breakerReasonOutranks('RATE_LIMIT', 'PROVIDER_UNAVAILABLE')).toBe(true);
    expect(breakerReasonOutranks('PROVIDER_UNAVAILABLE', 'RATE_LIMIT')).toBe(false);
    expect(breakerReasonOutranks('CONFIG', 'CONFIG')).toBe(false);
    expect(breakerReasonOutranks('RATE_LIMIT', null)).toBe(true);
  });
});

describe('local recipient-syntax validation (282, 345)', () => {
  it('LOCAL_INVALID_RECIPIENT name constant', () => {
    expect(LOCAL_INVALID_RECIPIENT).toBe('LOCAL_INVALID_RECIPIENT');
  });
  it.each(['parent@example.com', 'a.b+tag@sub.example.co.uk', 'x@y.io', 'user@xn--bcher-kva.example'])('accepts %s', (a) => {
    expect(validateRecipientSyntax(a)).toEqual({ ok: true });
  });
  it.each([
    ['', 'EMPTY'], [undefined, 'EMPTY'], [null, 'EMPTY'], [42, 'EMPTY'],
    ['a@b@c.com', 'AT_SIGN_COUNT'], ['nobody.example.com', 'AT_SIGN_COUNT'],
    ['has space@example.com', 'WHITESPACE_OR_CONTROL'], ['tab\t@example.com', 'WHITESPACE_OR_CONTROL'],
    ['line\nbreak@example.com', 'WHITESPACE_OR_CONTROL'], ['nul\u0000@example.com', 'WHITESPACE_OR_CONTROL'],
    ['@example.com', 'EMPTY_LOCAL_PART'], ['user@', 'EMPTY_DOMAIN'], ['user@localhost', 'DOMAIN_NO_DOT'],
    ['user@.example.com', 'BAD_DOMAIN_LABEL'], ['user@example..com', 'BAD_DOMAIN_LABEL'], ['user@example.', 'BAD_DOMAIN_LABEL'],
    ['user@example.c', 'TLD_TOO_SHORT'], ['user@example.123', 'TLD_ALL_NUMERIC'], ['user@1.2.3.45', 'TLD_ALL_NUMERIC'], ['user@1.2.3.4', 'TLD_TOO_SHORT'],
    [`${'a'.repeat(250)}@b.com`, 'TOO_LONG'],
  ])('rejects %j -> %s', (a, reason) => {
    expect(validateRecipientSyntax(a)).toEqual({ ok: false, reason });
  });
  it('254 characters is the inclusive limit', () => {
    const local = 'a'.repeat(254 - '@b.co'.length);
    expect(validateRecipientSyntax(`${local}@b.co`).ok).toBe(true);
    expect(validateRecipientSyntax(`${local}a@b.co`)).toEqual({ ok: false, reason: 'TOO_LONG' });
  });
});

describe('import closure (355)', () => {
  it('the classifier imports only the types module (no database, network or Resend module)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'email-outbox-classifier.ts'), 'utf8');
    const imports = [...src.matchAll(/^\s*(?:import|export)[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./email-outbox-types']);
    const typesSrc = fs.readFileSync(path.resolve(__dirname, 'email-outbox-types.ts'), 'utf8');
    expect(typesSrc).not.toMatch(/from\s+'/);
    expect(src).not.toMatch(/require\(|import\(/);
  });
});
