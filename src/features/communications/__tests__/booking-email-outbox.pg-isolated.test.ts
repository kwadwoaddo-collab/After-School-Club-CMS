/**
 * CMS-OPS-REMEDIATION-1C V15 — FIRST GATE (pg-isolated, REAL PostgreSQL, no real email/SMS).
 * Plan items D-05, D-07 and the C-05 999/1000 boundary for the KNOWN POST-STAMP NO-CALL (E5 item 3c).
 * These tests FAIL against the superseded V14 behaviour (row left in PROCESSING for stale-lease recovery):
 * every D-05 assertion requires an in-process fenced PROCESSING -> RETRY_SCHEDULED finalisation.
 *
 * Coexistence rules: never TRUNCATE/DROP/reset sequences; outbox fixture ids differ from the finance suite's;
 * scoped DELETEs only; the two outbox pg files are serialised with a session advisory lock.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import * as schema from '@/db/schema';
import { assertTestDatabaseUrl } from '../../finance/__tests__/helpers/test-db-guard';
import type { RootDb } from '@/lib/services/email-outbox-breaker';
import { sql } from 'drizzle-orm';
import {
  claimBulkReleaseCooldown,
  computeConfigFingerprint,
  convertRowHoldsToGlobal,
  disposeExpiredProviderHolds,
  finaliseConfigPrecheck,
  finaliseUnderBreakerLock,
  observeConfigFingerprint,
  promoteProbe,
  readSqlState,
  recoverHalfOpenTimeout,
  releaseHeldRows,
  stampFirstProviderAttempt,
} from '@/lib/services/email-outbox-breaker';
import { classifyProviderResponse, type Classification, type ProviderCallContext } from '@/lib/services/email-outbox-classifier';
import { claimOutboxBatch, recoverStaleLeases } from '@/lib/services/email-outbox-claim';
import {
  decidePostStamp,
  dispatchClaimedRowSlice,
  startInvocationBudget,
} from '@/lib/services/email-outbox-dispatch';
import {
  ACTION_BUDGET_MS,
  OUTBOX_STATUSES,
  POST_STAMP_MIN_TIMEOUT_MS,
  ROUTE_BUDGET_MS,
  type ClaimedOutboxRow,
  type DispatchOrigin,
} from '@/lib/services/email-outbox-types';

const testDbUrl = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const ORG_ID = 'a0a0a0a0-0000-4000-8000-0000000000a1';
const CENTRE_ID = 'a0a0a0a0-0000-4000-8000-0000000000a2';
const PARENT_ID = 'a0a0a0a0-0000-4000-8000-0000000000a3';
const ADVISORY_LOCK_KEY = 7310031; // serialises the two outbox pg-isolated files
const FAIL_RECIPIENT = 'fail-injection@outbox-gate.test';

const directSql = postgres(testDbUrl, { max: 4, ssl: false, onnotice: () => {} });
// Statement-order recorder: a dedicated client whose every statement is appended to `recorded`.
const recorded: string[] = [];
const recordingClient = postgres(testDbUrl, {
  max: 3,
  ssl: false,
  debug: (_conn, query) => {
    recorded.push(String(query));
  },
});
const rootDb = drizzle(recordingClient, { schema }) as unknown as RootDb;

let lockConn: postgres.ReservedSql;
const createdBookingIds: string[] = [];
let sequence = 0;

async function ensureBaselineAndMigration() {
  const [{ has_bookings }] = await directSql<{ has_bookings: boolean }[]>`SELECT to_regclass('public.bookings') IS NOT NULL AS has_bookings`;
  if (!has_bookings) {
    // The disposable DB has no baseline schema (the repo's drizzle chain does not apply from empty).
    // Create ONLY the minimal tables the outbox FKs reference, and only when absent.
    await directSql.unsafe(`
      CREATE TABLE IF NOT EXISTS organisations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(255) NOT NULL UNIQUE, slug varchar(100) NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS centres (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, name varchar(255) NOT NULL, slug varchar(100) NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS parents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id uuid NOT NULL REFERENCES organisations(id), email varchar(255));
      CREATE TABLE IF NOT EXISTS bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), centre_id uuid REFERENCES centres(id), parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE, start_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'confirmed', confirmation_code varchar(50) NOT NULL UNIQUE, magic_link_token varchar(255) NOT NULL UNIQUE);
    `);
  }
  const [{ has_outbox }] = await directSql<{ has_outbox: boolean }[]>`SELECT to_regclass('public.booking_email_outbox') IS NOT NULL AS has_outbox`;
  if (!has_outbox) {
    const ddl = fs.readFileSync(path.resolve(process.cwd(), 'drizzle/0031_booking_email_outbox.sql'), 'utf8');
    for (const statement of ddl.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)) {
      await directSql.unsafe(statement);
    }
  }
  // Stub detection is persistent across runs: a real baseline bookings table has the modality column.
  const [{ is_real }] = await directSql<{ is_real: boolean }[]>`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'modality') AS is_real`;
  return { stub: !is_real };
}

let stubBaseline = false;

async function seedTenant() {
  await directSql`INSERT INTO organisations (id, name, slug) VALUES (${ORG_ID}, 'Outbox Gate Org', 'outbox-gate-org') ON CONFLICT (id) DO NOTHING`;
  await directSql`INSERT INTO centres (id, organisation_id, name, slug) VALUES (${CENTRE_ID}, ${ORG_ID}, 'Outbox Gate Centre', 'outbox-gate-centre') ON CONFLICT (id) DO NOTHING`;
  if (stubBaseline) {
    await directSql`INSERT INTO parents (id, organisation_id, email) VALUES (${PARENT_ID}, ${ORG_ID}, 'gate-parent@outbox-gate.test') ON CONFLICT (id) DO NOTHING`;
  } else {
    await directSql`INSERT INTO parents (id, first_name, last_name, email, organisation_id, preferred_contact) VALUES (${PARENT_ID}, 'Gate', 'Parent', 'gate-parent@outbox-gate.test', ${ORG_ID}, 'email') ON CONFLICT (id) DO NOTHING`;
  }
}

interface SeededRow {
  outboxId: string;
  bookingId: string;
  claim: ClaimedOutboxRow;
}

/** Insert a booking + a PENDING outbox row and claim it through the REAL claim primitive. */
async function seedClaimedRow(opts: { recipient?: string; lastUnknownAt?: string | null; transitionVersion?: number } = {}): Promise<SeededRow> {
  sequence += 1;
  const bookingId = randomUUID();
  const outboxId = randomUUID();
  const suffix = `${Date.now()}-${sequence}`;
  const version = opts.transitionVersion ?? 1;
  await directSql`
    INSERT INTO bookings (id, parent_id, start_at, status, confirmation_code, magic_link_token${stubBaseline ? directSql`` : directSql`, centre_id, modality`})
    VALUES (${bookingId}, ${PARENT_ID}, now() + interval '30 days', 'confirmed', ${'GATE' + suffix.slice(-12)}, ${'gate-token-' + suffix}${stubBaseline ? directSql`` : directSql`, ${CENTRE_ID}, 'online'`})`;
  createdBookingIds.push(bookingId);
  const payload = { payloadVersion: 1, parentFirstName: 'Gate', parentEmail: opts.recipient ?? 'gate-recipient@outbox-gate.test', confirmationCode: 'GATE', childrenNames: ['A'], startAt: '2099-01-01T10:00:00Z', magicLink: 'https://example.invalid/t' };
  await directSql`
    INSERT INTO booking_email_outbox (id, organisation_id, centre_id, booking_id, transition_version, communication_type, recipient_email, idempotency_key, payload, status, next_attempt_at, last_unknown_at)
    VALUES (${outboxId}, ${ORG_ID}, ${CENTRE_ID}, ${bookingId}, ${version}, 'BOOKING_CONFIRMATION', ${opts.recipient ?? 'gate-recipient@outbox-gate.test'},
            ${`booking_confirmation:${bookingId}:v${version}:parent`}, ${directSql.json(payload)}, 'PENDING', now() - interval '1 minute', ${opts.lastUnknownAt ?? null})`;
  const claimed = await claimOutboxBatch(rootDb, { limit: 1, specificId: outboxId });
  expect(claimed).toHaveLength(1);
  return { outboxId, bookingId, claim: claimed[0] };
}

async function getRow(id: string) {
  const [r] = await directSql`SELECT *, (next_attempt_at - now()) AS next_in FROM booking_email_outbox WHERE id = ${id}`;
  return r;
}
async function getBreaker() {
  const [r] = await directSql`SELECT to_jsonb(s) AS j FROM booking_email_provider_state s WHERE id = 1`;
  return r.j as Record<string, unknown>;
}
function intervalSeconds(v: unknown): number {
  // postgres-js returns intervals as PostgresInterval objects or strings; normalise through seconds.
  const iv = v as { hours?: number; minutes?: number; seconds?: number; milliseconds?: number } | string;
  if (typeof iv === 'string') {
    const m = iv.match(/(-)?(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) return NaN;
    const s = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]);
    return m[1] ? -s : s;
  }
  return (iv.hours ?? 0) * 3600 + (iv.minutes ?? 0) * 60 + (iv.seconds ?? 0) + (iv.milliseconds ?? 0) / 1000;
}

function makeBudget(origin: DispatchOrigin, state: { elapsed: number }) {
  return startInvocationBudget(origin, {
    budgetMs: origin === 'action' ? ACTION_BUDGET_MS : ROUTE_BUDGET_MS,
    elapsedMs: () => state.elapsed,
  });
}

describe('booking email outbox: first gate (known post-stamp no-call, D-05 / D-07 / C-05)', () => {
  beforeAll(async () => {
    const [db] = await directSql<{ n: string }[]>`SELECT current_database() AS n`;
    expect(db.n).toMatch(/_test$/);
    lockConn = await directSql.reserve();
    await lockConn`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`;
    const { stub } = await ensureBaselineAndMigration();
    stubBaseline = stub;
    await seedTenant();
    await directSql.unsafe(`
      CREATE OR REPLACE FUNCTION outbox_gate_fail_noop() RETURNS TRIGGER AS $fn$
      BEGIN RAISE EXCEPTION 'outbox_gate injected finalisation failure' USING ERRCODE = 'XX000'; END; $fn$ LANGUAGE plpgsql;
    `);
  });

  afterAll(async () => {
    await directSql`DROP TRIGGER IF EXISTS outbox_gate_fail_trg ON booking_email_outbox`;
    await directSql.unsafe('DROP FUNCTION IF EXISTS outbox_gate_fail_noop()');
    await directSql`DELETE FROM booking_email_outbox WHERE organisation_id = ${ORG_ID}`;
    if (createdBookingIds.length) await directSql`DELETE FROM bookings WHERE id IN ${directSql(createdBookingIds)}`;
    await directSql`UPDATE booking_email_provider_state SET state='CLOSED', reason=NULL, error_name=NULL, next_probe_at=NULL, probe_outbox_id=NULL, consecutive_failures=0, dispatch_window_start=NULL, dispatch_window_count=0, ramp_until=NULL WHERE id = 1`;
    await lockConn`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
    lockConn.release();
    await recordingClient.end();
    await directSql.end();
  });

  beforeEach(async () => {
    await directSql`DROP TRIGGER IF EXISTS outbox_gate_fail_trg ON booking_email_outbox`;
    // Reset ONLY the breaker singleton to its CLOSED defaults (never truncate / drop).
    await directSql`UPDATE booking_email_provider_state SET state='CLOSED', reason=NULL, error_name=NULL, opened_at=NULL, next_probe_at=NULL, probe_started_at=NULL, probe_outbox_id=NULL, consecutive_failures=0, dispatch_window_start=NULL, dispatch_window_count=0, ramp_until=NULL WHERE id = 1`;
    recorded.length = 0;
  });

  it('migration 0031 applied: 16-value enum, breaker singleton CLOSED, outbox table present', async () => {
    const labels = await directSql<{ enumlabel: string }[]>`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'booking_email_outbox_status' ORDER BY e.enumsortorder`;
    expect(labels.map((l) => l.enumlabel).sort()).toEqual([...OUTBOX_STATUSES].sort());
    expect(labels).toHaveLength(16);
    expect((await getBreaker()).state).toBe('CLOSED');
  });

  describe('decidePostStamp boundary (C-05, pure)', () => {
    it.each([
      ['route', 2000, 3000, 'CALL', 1000],
      ['route', 2000, 2999, 'NO_CALL', 999],
      ['action', 1500, 2500, 'CALL', 1000],
      ['action', 1500, 2499, 'NO_CALL', 999],
    ] as const)('%s margin %i remaining %i => %s (candidate %i)', (origin, _margin, remaining, kind, candidate) => {
      const d = decidePostStamp(remaining, origin);
      expect(d.kind).toBe(kind);
      if (d.kind === 'CALL') expect(d.timeoutMs).toBe(candidate);
      else expect(d.candidateTimeoutMs).toBe(candidate);
    });
    it('caps the provider timeout at 30000', () => {
      const d = decidePostStamp(54000, 'route');
      expect(d).toEqual({ kind: 'CALL', timeoutMs: 30000 });
    });
  });

  describe.each(['action', 'route'] as const)('C-05 boundary on a real stamped row (%s origin)', (origin) => {
    const margin = origin === 'action' ? 1500 : 2000;
    const budget = origin === 'action' ? ACTION_BUDGET_MS : ROUTE_BUDGET_MS;

    it('candidateTimeoutMs 999 => ZERO provider calls and in-process RETRY_SCHEDULED', async () => {
      const { outboxId, claim } = await seedClaimedRow();
      const provider = vi.fn(async () => ({ ok: true }));
      const clock = { elapsed: 0 };
      const outcome = await dispatchClaimedRowSlice(rootDb, claim, {
        budget: makeBudget(origin, clock),
        chosenLinkMode: 'WITH_LINK',
        callProvider: provider,
        hooks: { onPostStampCommit: () => { clock.elapsed = budget - (margin + POST_STAMP_MIN_TIMEOUT_MS - 1); } },
      });
      expect(provider).toHaveBeenCalledTimes(0);
      expect(outcome.kind).toBe('NO_CALL');
      if (outcome.kind === 'NO_CALL') expect(outcome.candidateTimeoutMs).toBe(999);
      const row = await getRow(outboxId);
      expect(row.status).toBe('RETRY_SCHEDULED');
      expect(row.status).not.toBe('PROCESSING'); // V14 would have left PROCESSING
    });

    it('candidateTimeoutMs exactly 1000 => exactly one provider call with timeout 1000', async () => {
      const { outboxId, claim } = await seedClaimedRow();
      const provider = vi.fn(async () => ({ ok: true }));
      const clock = { elapsed: 0 };
      const outcome = await dispatchClaimedRowSlice(rootDb, claim, {
        budget: makeBudget(origin, clock),
        chosenLinkMode: 'WITH_LINK',
        callProvider: provider,
        hooks: { onPostStampCommit: () => { clock.elapsed = budget - (margin + POST_STAMP_MIN_TIMEOUT_MS); } },
      });
      expect(provider).toHaveBeenCalledTimes(1);
      expect(provider.mock.calls[0]).toEqual([expect.objectContaining({ rowId: outboxId, timeoutMs: 1000, idempotencyKey: `booking_confirmation:${(await getRow(outboxId)).booking_id}:v1:parent` })]);
      expect(outcome.kind).toBe('CALLED');
      // No no-call finalisation on the call path: the slice leaves provider-outcome finalisation to later work.
      expect((await getRow(outboxId)).status).toBe('PROCESSING');
    });
  });

  describe('D-05: successful fenced known-no-call finalisation', () => {
    it.each([
      ['NULL last_unknown_at', null],
      ['pre-existing last_unknown_at (must stay UNCHANGED)', '2026-01-01T00:00:00.000Z'],
    ] as const)('%s', async (_label, lastUnknown) => {
      const { outboxId, claim } = await seedClaimedRow({ lastUnknownAt: lastUnknown });
      const before = await getRow(outboxId);
      const provider = vi.fn(async () => ({ ok: true }));
      const clock = { elapsed: 1000 }; // remaining 7000 >= 4500 action stamp minimum
      let breakerAfterStamp: Record<string, unknown> | undefined;
      let rowAfterStamp: Record<string, unknown> | undefined;
      const outcome = await dispatchClaimedRowSlice(rootDb, claim, {
        budget: makeBudget('action', clock),
        chosenLinkMode: 'WITH_LINK',
        callProvider: provider,
        hooks: {
          onPostStampCommit: async () => {
            clock.elapsed = 7000; // remaining 1000 - margin 1500 < 1000 => known no-call
            breakerAfterStamp = await getBreaker();
            rowAfterStamp = await getRow(outboxId);
            recorded.length = 0; // statement-order recorder: capture ONLY the finalisation
          },
        },
      });

      // zero provider calls
      expect(provider).toHaveBeenCalledTimes(0);
      expect(outcome.kind).toBe('NO_CALL');
      if (outcome.kind === 'NO_CALL') expect(outcome.finalisation).toEqual({ kind: 'FINALISED', status: 'RETRY_SCHEDULED' });

      // statement-order recorder: exactly ONE statement, an UPDATE on the outbox row; nothing touches the breaker
      const stmts = recorded.map((s) => s.replace(/\s+/g, ' ').trim());
      expect(stmts.filter((s) => /^UPDATE booking_email_outbox/i.test(s))).toHaveLength(1);
      expect(stmts).toHaveLength(1);
      expect(stmts.filter((s) => /booking_email_provider_state/i.test(s))).toHaveLength(0);
      expect(stmts.filter((s) => /^(BEGIN|COMMIT|ROLLBACK)/i.test(s))).toHaveLength(0);
      expect(stmts.filter((s) => /FOR UPDATE/i.test(s))).toHaveLength(0);

      const row = await getRow(outboxId);
      expect(row.status).toBe('RETRY_SCHEDULED');
      expect(row.claim_token).toBeNull();
      expect(row.claim_expires_at).toBeNull();
      expect(row.idempotency_key).toBe(before.idempotency_key); // same idempotency key
      expect(row.idempotency_epoch).toBe(0); // no new epoch
      expect(row.payload).toEqual({ ...before.payload, magicLink: before.payload.magicLink }); // frozen body unchanged (WITH_LINK keeps token)
      expect(row.attempt_count).toBe(1); // post-stamp value
      expect(row.attempt_count).toBe(rowAfterStamp!.attempt_count);
      expect(row.first_provider_attempt_at).not.toBeNull();
      expect(row.first_provider_attempt_at).toEqual(rowAfterStamp!.first_provider_attempt_at); // unchanged by finalisation
      expect(row.unknown_outcome_seen).toBe(true);
      expect(row.last_unknown_at === null ? null : new Date(row.last_unknown_at).toISOString()).toBe(lastUnknown); // UNCHANGED
      expect(row.last_error_name).toBeNull();
      expect(row.last_error_status).toBeNull();
      expect(row.last_error_at).toBeNull();
      const nextIn = intervalSeconds(row.next_in);
      expect(nextIn).toBeGreaterThan(295);
      expect(nextIn).toBeLessThanOrEqual(300);

      // no breaker row write and no breaker evidence: identical to the post-stamp snapshot (updated_at included)
      expect(await getBreaker()).toEqual(breakerAfterStamp);
      expect((await getBreaker()).state).toBe('CLOSED');
      expect((await getBreaker()).consecutive_failures).toBe(0);
    });

    it('communication_version <> transition_version: the same fenced UPDATE yields SUPERSEDED with payload NULL', async () => {
      const { outboxId, bookingId, claim } = await seedClaimedRow();
      await directSql`UPDATE bookings SET communication_version = 2 WHERE id = ${bookingId}`;
      const provider = vi.fn(async () => ({ ok: true }));
      const clock = { elapsed: 1000 };
      await dispatchClaimedRowSlice(rootDb, claim, {
        budget: makeBudget('action', clock),
        chosenLinkMode: 'LINK_FREE',
        callProvider: provider,
        hooks: { onPostStampCommit: () => { clock.elapsed = 7000; } },
      });
      expect(provider).toHaveBeenCalledTimes(0);
      const row = await getRow(outboxId);
      expect(row.status).toBe('SUPERSEDED');
      expect(row.payload).toBeNull();
      expect(row.claim_token).toBeNull();
    });
  });

  describe('D-07: fenced no-call finalisation failure => no unfenced repair, stale-lease fallback, uncounted', () => {
    async function runWithInjection(
      seed: SeededRow,
      inject: () => Promise<void>,
    ) {
      const provider = vi.fn(async () => ({ ok: true }));
      const clock = { elapsed: 1000 };
      let afterInjection: Awaited<ReturnType<typeof getRow>> | undefined;
      let stampedPayload: unknown;
      const outcome = await dispatchClaimedRowSlice(rootDb, seed.claim, {
        budget: makeBudget('action', clock),
        chosenLinkMode: 'WITH_LINK',
        callProvider: provider,
        hooks: {
          onPostStampCommit: async () => {
            clock.elapsed = 7000;
            stampedPayload = (await getRow(seed.outboxId)).payload;
            await inject();
            afterInjection = await getRow(seed.outboxId);
            recorded.length = 0;
          },
        },
      });
      return { provider, outcome, afterInjection: afterInjection!, stampedPayload };
    }

    async function expectStaleFallbackUncounted(seed: SeededRow, keyBefore: string, payloadBefore: unknown) {
      const breakerBefore = await getBreaker();
      await directSql`UPDATE booking_email_outbox SET claim_expires_at = now() - interval '1 minute' WHERE id = ${seed.outboxId}`;
      expect(await recoverStaleLeases(rootDb)).toBeGreaterThanOrEqual(1);
      const row = await getRow(seed.outboxId);
      expect(row.status).toBe('RETRY_SCHEDULED');
      expect(row.idempotency_key).toBe(keyBefore); // same key
      expect(row.payload).toEqual(payloadBefore); // same frozen body
      expect(row.idempotency_epoch).toBe(0);
      expect(row.attempt_count).toBe(1);
      expect(row.unknown_outcome_seen).toBe(true);
      expect(row.last_unknown_at).toBeNull(); // uncounted by construction
      expect(row.last_error_name).toBeNull();
      expect(row.claim_token).toBeNull();
      expect(await getBreaker()).toEqual(breakerBefore); // breaker untouched
      expect((await getBreaker()).state).toBe('CLOSED');
    }

    it('lost claim: no unfenced repair; row left stamped PROCESSING; stale-lease recovery keeps key/body, last_unknown_at NULL, breaker CLOSED', async () => {
      const seed = await seedClaimedRow();
      const keyBefore = (await getRow(seed.outboxId)).idempotency_key as string;
      const otherToken = randomUUID();
      const { provider, outcome, afterInjection, stampedPayload } = await runWithInjection(seed, async () => {
        await directSql`UPDATE booking_email_outbox SET claim_token = ${otherToken}::uuid WHERE id = ${seed.outboxId}`; // another worker re-claimed
      });
      expect(provider).toHaveBeenCalledTimes(0);
      expect(outcome.kind).toBe('NO_CALL');
      if (outcome.kind === 'NO_CALL') expect(outcome.finalisation).toEqual({ kind: 'FENCE_LOST' });
      const stmts = recorded.map((s) => s.replace(/\s+/g, ' ').trim());
      expect(stmts).toHaveLength(1); // attempted exactly once (no 100 ms retry)
      expect(stmts[0]).toMatch(/^UPDATE booking_email_outbox/i);
      expect(stmts.filter((s) => /booking_email_provider_state/i.test(s))).toHaveLength(0);
      const row = await getRow(seed.outboxId);
      expect(row.status).toBe('PROCESSING'); // no unfenced repair
      expect(row.claim_token).toBe(otherToken);
      expect(row.attempt_count).toBe(1);
      expect(row.updated_at).toEqual(afterInjection.updated_at); // untouched by the failed finalisation
      expect(row.last_unknown_at).toBeNull();
      await expectStaleFallbackUncounted(seed, keyBefore, stampedPayload);
    });

    it('fence mismatch (status no longer PROCESSING): nothing written', async () => {
      const seed = await seedClaimedRow();
      const { provider, outcome, afterInjection } = await runWithInjection(seed, async () => {
        await directSql`UPDATE booking_email_outbox SET status = 'PENDING', claim_token = NULL, claim_expires_at = NULL WHERE id = ${seed.outboxId}`;
      });
      expect(provider).toHaveBeenCalledTimes(0);
      if (outcome.kind === 'NO_CALL') expect(outcome.finalisation).toEqual({ kind: 'FENCE_LOST' });
      expect(recorded.filter((s) => /^\s*UPDATE booking_email_outbox/i.test(s))).toHaveLength(1);
      const row = await getRow(seed.outboxId);
      expect(row.status).toBe('PENDING');
      expect(row.updated_at).toEqual(afterInjection.updated_at);
      expect(row.last_unknown_at).toBeNull();
      expect(row.next_attempt_at).toEqual(afterInjection.next_attempt_at);
    });

    it('database error injected into the finalisation: ERROR, no repair, row left PROCESSING, stale-lease fallback uncounted', async () => {
      const seed = await seedClaimedRow({ recipient: FAIL_RECIPIENT });
      const keyBefore = (await getRow(seed.outboxId)).idempotency_key as string;
      const { provider, outcome, stampedPayload } = await runWithInjection(seed, async () => {
        await directSql.unsafe(`
          CREATE TRIGGER outbox_gate_fail_trg BEFORE UPDATE ON booking_email_outbox FOR EACH ROW
          WHEN (OLD.recipient_email = '${FAIL_RECIPIENT}' AND OLD.status = 'PROCESSING' AND NEW.status = 'RETRY_SCHEDULED')
          EXECUTE FUNCTION outbox_gate_fail_noop()`);
      });
      expect(provider).toHaveBeenCalledTimes(0);
      expect(outcome.kind).toBe('NO_CALL');
      if (outcome.kind === 'NO_CALL') expect(outcome.finalisation.kind).toBe('ERROR');
      const stmts = recorded.map((s) => s.replace(/\s+/g, ' ').trim());
      expect(stmts).toHaveLength(1); // exactly one attempt: no 100 ms retry, no unfenced repair statement
      const row = await getRow(seed.outboxId);
      expect(row.status).toBe('PROCESSING');
      expect(row.claim_token).toBe(seed.claim.claimToken);
      expect(row.last_unknown_at).toBeNull();
      await directSql`DROP TRIGGER IF EXISTS outbox_gate_fail_trg ON booking_email_outbox`;
      await expectStaleFallbackUncounted(seed, keyBefore, stampedPayload);
    });

    it('two rows, two distinct recipients, both fall to stale-lease recovery: last_unknown_at stays NULL and breaker stays CLOSED', async () => {
      const a = await seedClaimedRow({ recipient: 'gate-a@outbox-gate.test' });
      const b = await seedClaimedRow({ recipient: 'gate-b@outbox-gate.test' });
      for (const seed of [a, b]) {
        await runWithInjection(seed, async () => {
          await directSql`UPDATE booking_email_outbox SET claim_token = ${randomUUID()}::uuid WHERE id = ${seed.outboxId}`;
        });
      }
      await directSql`UPDATE booking_email_outbox SET claim_expires_at = now() - interval '1 minute' WHERE id IN (${a.outboxId}, ${b.outboxId})`;
      expect(await recoverStaleLeases(rootDb)).toBeGreaterThanOrEqual(2);
      for (const seed of [a, b]) {
        const row = await getRow(seed.outboxId);
        expect(row.status).toBe('RETRY_SCHEDULED');
        expect(row.last_unknown_at).toBeNull();
      }
      const breaker = await getBreaker();
      expect(breaker.state).toBe('CLOSED');
      expect(breaker.consecutive_failures).toBe(0);
      expect(breaker.reason).toBeNull();
    });
  });

  describe('stamp transaction (E5 item 4) supporting checks', () => {
    it('zero-row stamp (breaker OPEN) ROLLS BACK: attempt_count 0, no stamp, no bucket token consumed, no provider call path', async () => {
      const { outboxId, claim } = await seedClaimedRow();
      await directSql`UPDATE booking_email_provider_state SET state='OPEN', reason='CONFIG', next_probe_at = now() + interval '1 hour' WHERE id = 1`;
      const before = await getBreaker();
      const out = await stampFirstProviderAttempt(rootDb, { id: outboxId, claimToken: claim.claimToken, chosenLinkMode: 'WITH_LINK' });
      expect(out).toEqual({ kind: 'REFUSED', refusal: 'ZERO_ROWS' });
      const row = await getRow(outboxId);
      expect(row.attempt_count).toBe(0);
      expect(row.first_provider_attempt_at).toBeNull();
      expect(row.status).toBe('PROCESSING');
      expect(await getBreaker()).toEqual(before);
      const stmts = recorded.map((s) => s.replace(/\s+/g, ' ').trim());
      expect(stmts.some((s) => /^ROLLBACK/i.test(s))).toBe(true);
    });

    it('stamp statement order: timeouts set transaction-locally, breaker FOR UPDATE first, then the stamp UPDATE', async () => {
      const { outboxId, claim } = await seedClaimedRow();
      recorded.length = 0;
      const out = await stampFirstProviderAttempt(rootDb, { id: outboxId, claimToken: claim.claimToken, chosenLinkMode: 'LINK_FREE' });
      expect(out.kind).toBe('STAMPED');
      const stmts = recorded.map((s) => s.replace(/\s+/g, ' ').trim());
      const iLock = stmts.findIndex((s) => /lock_timeout/.test(s));
      const iStmt = stmts.findIndex((s) => /statement_timeout/.test(s));
      const iBreaker = stmts.findIndex((s) => /FROM booking_email_provider_state WHERE id = .* FOR UPDATE/i.test(s));
      const iStamp = stmts.findIndex((s) => /^WITH b AS/i.test(s));
      expect(stmts[0]).toMatch(/^begin/i);
      expect(iLock).toBeGreaterThan(0);
      expect(iStmt).toBeGreaterThan(iLock);
      expect(iBreaker).toBeGreaterThan(iStmt);
      expect(iStamp).toBeGreaterThan(iBreaker);
      expect(stmts[stmts.length - 1]).toMatch(/^commit/i);
      const row = await getRow(outboxId);
      expect(row.link_mode).toBe('LINK_FREE');
      expect(row.payload).not.toHaveProperty('magicLink'); // LINK_FREE strips the raw token at the stamp
      expect(row.attempt_count).toBe(1);
    });

    it('55P03: a held breaker lock releases the stamp after lock_timeout without incrementing attempt_count', async () => {
      const { outboxId, claim } = await seedClaimedRow();
      const holder = await directSql.reserve();
      try {
        await holder`BEGIN`;
        await holder`SELECT 1 FROM booking_email_provider_state WHERE id = 1 FOR UPDATE`;
        const started = Date.now();
        const out = await stampFirstProviderAttempt(rootDb, { id: outboxId, claimToken: claim.claimToken, chosenLinkMode: 'WITH_LINK' });
        expect(out).toEqual({ kind: 'REFUSED', refusal: 'LOCK_TIMEOUT_55P03' });
        expect(Date.now() - started).toBeLessThan(2500);
      } finally {
        await holder`ROLLBACK`;
        holder.release();
      }
      const row = await getRow(outboxId);
      expect(row.attempt_count).toBe(0);
      expect(row.first_provider_attempt_at).toBeNull();
    });

    it('insufficient PRE-stamp budget: released unstamped, zero statements, zero provider calls', async () => {
      const { outboxId, claim } = await seedClaimedRow();
      const provider = vi.fn(async () => ({ ok: true }));
      recorded.length = 0;
      const outcome = await dispatchClaimedRowSlice(rootDb, claim, {
        budget: makeBudget('action', { elapsed: 3600 }), // remaining 4400 < 4500
        chosenLinkMode: 'WITH_LINK',
        callProvider: provider,
      });
      expect(outcome.kind).toBe('RELEASED_INSUFFICIENT_BUDGET');
      expect(provider).toHaveBeenCalledTimes(0);
      expect(recorded).toHaveLength(0);
      expect((await getRow(outboxId)).attempt_count).toBe(0);
    });
  });

  // ==========================================================================================
  // PHASE 2: breaker lock sections (b)-(e), classifier-driven finalisation (plan 189-190, 204, 207, 219, 228,
  // 231, 238, 266-270, 276, 278, 281, 284-289, 323, 331, 335-341, 370, D-06). Real PostgreSQL, no provider calls.
  // ==========================================================================================
  describe('phase 2: breaker sections (b)-(e)', () => {
    const FAST: ProviderCallContext = { timeoutMs: 30000, elapsedMs: 100 };
    const cls = (name: string, status: number | null, headers: Record<string, string> | null = null) =>
      classifyProviderResponse({ data: null, error: { name, statusCode: status, message: 'ignored' }, headers }, FAST);
    const COUNTED_UNKNOWN = cls('internal_server_error', 500);
    const UNCOUNTED_UNKNOWN = cls('concurrent_idempotent_requests', 409);
    const ACCEPTED = classifyProviderResponse({ data: { id: 'msg_test' }, error: null, headers: null }, FAST);

    const SET_COUNTED_UNKNOWN = sql`status = 'RETRY_SCHEDULED', unknown_outcome_seen = true, last_unknown_at = now(), last_error_name = 'internal_server_error'`;
    const SET_UNCOUNTED_UNKNOWN = sql`status = 'RETRY_SCHEDULED', unknown_outcome_seen = true, last_error_name = 'concurrent_idempotent_requests'`;
    const SET_ACCEPTED = sql`status = 'ACCEPTED', accepted_at = now(), payload = NULL`;
    const SET_HELD_CONFIG = sql`status = 'HELD_PROVIDER_OPERATIONAL', provider_hold_reason = 'CONFIG', provider_hold_scope = 'GLOBAL'`;
    const SET_HELD_RATE = (hits: number) =>
      sql`status = 'HELD_PROVIDER_OPERATIONAL', provider_hold_reason = 'RATE_LIMIT', provider_hold_scope = 'ROW', last_rate_limited_at = now(), hold_hits = ${hits}`;
    const SET_HELD_CODE = (name: string) =>
      sql`status = 'HELD_PROVIDER_OPERATIONAL', provider_hold_reason = 'CODE_CONTRACT', provider_hold_scope = 'ROW', last_error_name = ${name}, last_error_at = now()`;

    function finalise(seed: SeededRow, classification: Classification, setClause: ReturnType<typeof sql>, claimToken = seed.claim.claimToken) {
      return finaliseUnderBreakerLock(rootDb, {
        outboxId: seed.outboxId,
        classification,
        applyRowUpdate: async (tx) => {
          const rows = await tx.execute(sql`
            UPDATE booking_email_outbox SET ${setClause}, claim_token = NULL, claim_expires_at = NULL, updated_at = now()
            WHERE id = ${seed.outboxId}::uuid AND claim_token = ${claimToken}::uuid AND status = 'PROCESSING'
            RETURNING id`);
          return rows.length > 0;
        },
      });
    }

    const ago = (secs: number | null) =>
      secs === null ? directSql`NULL::timestamptz` : directSql`now() - make_interval(secs => ${secs}::float8)`;

    interface RowOpts {
      status?: string;
      recipient?: string;
      type?: string;
      createdAgoS?: number;
      acceptedAgoS?: number | null;
      firstAttemptAgoS?: number | null;
      nextAttemptInS?: number;
      holdScope?: 'ROW' | 'GLOBAL' | null;
      holdReason?: string | null;
      lastErrorName?: string | null;
      lastErrorAgoS?: number | null;
      lastRateLimitedAgoS?: number | null;
      lastUnknownAgoS?: number | null;
      holdHits?: number;
      attemptCount?: number;
      unknownSeen?: boolean;
    }
    async function seedRow(o: RowOpts = {}): Promise<string> {
      sequence += 1;
      const bookingId = randomUUID();
      const outboxId = randomUUID();
      const suffix = `${Date.now()}-${sequence}`;
      await directSql`
        INSERT INTO bookings (id, parent_id, start_at, status, confirmation_code, magic_link_token${stubBaseline ? directSql`` : directSql`, centre_id, modality`})
        VALUES (${bookingId}, ${PARENT_ID}, now() + interval '30 days', 'confirmed', ${'P2' + suffix.slice(-12)}, ${'p2-token-' + suffix}${stubBaseline ? directSql`` : directSql`, ${CENTRE_ID}, 'online'`})`;
      createdBookingIds.push(bookingId);
      const recipient = o.recipient ?? `p2-${suffix}@outbox-gate.test`;
      await directSql`
        INSERT INTO booking_email_outbox (id, organisation_id, centre_id, booking_id, transition_version, communication_type, recipient_email, idempotency_key,
          payload, status, next_attempt_at, created_at, accepted_at, first_provider_attempt_at, provider_hold_scope, provider_hold_reason, last_error_name,
          last_error_at, last_rate_limited_at, last_unknown_at, hold_hits, attempt_count, unknown_outcome_seen)
        VALUES (${outboxId}, ${ORG_ID}, ${CENTRE_ID}, ${bookingId}, 1, ${o.type ?? 'BOOKING_CONFIRMATION'}, ${recipient}, ${`booking_confirmation:${bookingId}:v1:parent`},
          ${o.status === 'ACCEPTED' ? null : directSql.json({ payloadVersion: 1, parentEmail: recipient })}, ${o.status ?? 'PENDING'},
          now() + make_interval(secs => ${o.nextAttemptInS ?? -60}::float8), ${ago(o.createdAgoS ?? 0)}, ${ago(o.acceptedAgoS ?? null)}, ${ago(o.firstAttemptAgoS ?? null)},
          ${o.holdScope ?? null}, ${o.holdReason ?? null}, ${o.lastErrorName ?? null}, ${ago(o.lastErrorAgoS ?? null)}, ${ago(o.lastRateLimitedAgoS ?? null)},
          ${ago(o.lastUnknownAgoS ?? null)}, ${o.holdHits ?? 0}, ${o.attemptCount ?? 0}, ${o.unknownSeen ?? false})`;
      return outboxId;
    }
    const seedAccepted = (agoS: number, type = 'BOOKING_CONFIRMATION') => seedRow({ status: 'ACCEPTED', acceptedAgoS: agoS, type, recipient: `acc-${sequence}-${Date.now()}@outbox-gate.test` });
    const claimed = (recipient: string) => seedClaimedRow({ recipient });
    async function probeInSeconds(): Promise<number> {
      const [r] = await directSql<{ s: number }[]>`SELECT extract(epoch FROM (next_probe_at - now()))::float8 AS s FROM booking_email_provider_state WHERE id = 1`;
      return r.s;
    }
    async function setBreaker(fields: { state: string; reason?: string | null; errorName?: string | null; failures?: number; probeId?: string | null; probeStartedAgoS?: number | null; nextProbeInS?: number | null }) {
      await directSql`
        UPDATE booking_email_provider_state SET state = ${fields.state}, reason = ${fields.reason ?? null}, error_name = ${fields.errorName ?? null},
          consecutive_failures = ${fields.failures ?? 0}, probe_outbox_id = ${fields.probeId ?? null}, probe_started_at = ${ago(fields.probeStartedAgoS ?? null)},
          next_probe_at = CASE WHEN ${fields.nextProbeInS ?? null}::float8 IS NULL THEN NULL ELSE now() + make_interval(secs => ${fields.nextProbeInS ?? 0}::float8) END,
          opened_at = CASE WHEN ${fields.state} = 'CLOSED' THEN NULL ELSE now() END
        WHERE id = 1`;
    }

    beforeEach(async () => {
      await directSql`DELETE FROM booking_email_outbox WHERE organisation_id = ${ORG_ID}`;
      await directSql`UPDATE booking_email_provider_state SET last_bulk_release_at = NULL, config_fingerprint = NULL WHERE id = 1`;
    });

    // ---------------------------------------------------------------- PROVIDER_UNAVAILABLE (b)
    describe('PROVIDER_UNAVAILABLE opening rule (266, 267, 270, D-06)', () => {
      it('one counted UNKNOWN never opens; two rows but ONE recipient never opens; accepted send in window never opens', async () => {
        const a = await claimed('same@outbox-gate.test');
        const b = await claimed('same@outbox-gate.test');
        expect(await finalise(a, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN)).toMatchObject({ kind: 'FINALISED', decision: { action: 'NONE' } });
        expect(await finalise(b, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN)).toMatchObject({ kind: 'FINALISED', decision: { action: 'NONE' } });
        expect((await getBreaker()).state).toBe('CLOSED');

        await directSql`DELETE FROM booking_email_outbox WHERE organisation_id = ${ORG_ID}`;
        await seedAccepted(60);
        const c = await claimed('c@outbox-gate.test');
        const d = await claimed('d@outbox-gate.test');
        await finalise(c, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        const out = await finalise(d, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        expect(out).toMatchObject({ kind: 'FINALISED', decision: { action: 'NONE' } });
        expect((await getBreaker()).state).toBe('CLOSED');
      });

      it('2 distinct rows AND 2 distinct recipients within 15 min, no accepted_at in window -> OPEN PROVIDER_UNAVAILABLE (consecutive_failures 1, probe in ~2 min)', async () => {
        const a = await claimed('pu-a@outbox-gate.test');
        const b = await claimed('pu-b@outbox-gate.test');
        await seedAccepted(16 * 60); // accepted OUTSIDE the window is not counter-evidence
        await finalise(a, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        recorded.length = 0;
        const out = await finalise(b, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        expect(out).toMatchObject({ kind: 'FINALISED', decision: { action: 'OPENED', reason: 'PROVIDER_UNAVAILABLE' } });
        const br = await getBreaker();
        expect(br).toMatchObject({ state: 'OPEN', reason: 'PROVIDER_UNAVAILABLE', consecutive_failures: 1, error_name: null });
        const s = await probeInSeconds();
        expect(s).toBeGreaterThan(100);
        expect(s).toBeLessThanOrEqual(120);
        // lock order (238, 323): the breaker FOR UPDATE is the first statement touching either table.
        const touching = recorded.filter((q) => /booking_email_(provider_state|outbox)/.test(q));
        expect(touching[0]).toMatch(/booking_email_provider_state[\s\S]*FOR UPDATE/);
        expect(touching[1]).toMatch(/UPDATE booking_email_outbox/);
      });

      it('late counted UNKNOWN while OPEN does not increase consecutive_failures or shorten next_probe_at (207)', async () => {
        const a = await claimed('l-a@outbox-gate.test');
        const b = await claimed('l-b@outbox-gate.test');
        const c = await claimed('l-c@outbox-gate.test');
        await finalise(a, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        await finalise(b, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        const before = await getBreaker();
        const out = await finalise(c, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN);
        expect(out).toMatchObject({ kind: 'FINALISED', decision: { action: 'NONE' } });
        const after = await getBreaker();
        expect(after.consecutive_failures).toBe(before.consecutive_failures);
        expect(after.next_probe_at).toBe(before.next_probe_at);
      });

      it('KNOWN post-stamp no-call is invisible: no last_unknown_at, no breaker change, even for 2 recipients (D-06)', async () => {
        const st = { elapsed: 3000 };
        for (const r of ['nc-a@outbox-gate.test', 'nc-b@outbox-gate.test']) {
          const s1 = await claimed(r);
          st.elapsed = 3000; // remaining 5000 >= 4500: the stamp proceeds
          const o = await dispatchClaimedRowSlice(rootDb, s1.claim, {
            budget: makeBudget('action', st),
            chosenLinkMode: 'WITH_LINK',
            callProvider: async () => ({ ok: true }),
            hooks: { onPostStampCommit: () => void (st.elapsed = 7000) }, // remaining 1000 - margin 1500 < 1000 => known no-call
          });
          expect(o.kind).toBe('NO_CALL');
        }
        // (uncounted) concurrent_idempotent_requests also leaves no evidence
        const extra = await claimed('nc-c@outbox-gate.test');
        await finalise(extra, UNCOUNTED_UNKNOWN, SET_UNCOUNTED_UNKNOWN);
        const unknownRows = await directSql`SELECT count(*)::int AS n FROM booking_email_outbox WHERE organisation_id = ${ORG_ID} AND last_unknown_at IS NOT NULL`;
        expect(unknownRows[0].n).toBe(0);
        const br = await getBreaker();
        expect(br).toMatchObject({ state: 'CLOSED', consecutive_failures: 0 });
      });
    });

    // ---------------------------------------------------------------- fence (b)
    describe('fenced finalisation (204, 228)', () => {
      it('zero-row fenced update ROLLS BACK: breaker untouched and its lock released', async () => {
        const a = await claimed('f-a@outbox-gate.test');
        const before = await getBreaker();
        const out = await finalise(a, cls('invalid_api_key', 401), SET_HELD_CONFIG, randomUUID());
        expect(out).toEqual({ kind: 'FENCE_LOST' });
        expect(await getBreaker()).toEqual(before);
        expect((await getRow(a.outboxId)).status).toBe('PROCESSING');
        // the breaker lock is free right now
        await directSql.begin(async (t) => {
          await t`SET LOCAL lock_timeout = '300ms'`;
          await t`SELECT 1 FROM booking_email_provider_state WHERE id = 1 FOR UPDATE`;
        });
      });
    });

    // ---------------------------------------------------------------- operational (b)
    describe('operational outcomes and precedence (167, 174, 175, 185, 207)', () => {
      it('CLOSED + CONFIG -> OPEN CONFIG with error name, probe 15 min; late QUOTA_MONTHLY escalates the reason only', async () => {
        const a = await claimed('o-a@outbox-gate.test');
        const b = await claimed('o-b@outbox-gate.test');
        const quotaDaily = await claimed('o-c@outbox-gate.test');
        expect(await finalise(a, cls('invalid_api_key', 401), SET_HELD_CONFIG)).toMatchObject({ decision: { action: 'OPENED', reason: 'CONFIG' } });
        const br = await getBreaker();
        expect(br).toMatchObject({ state: 'OPEN', reason: 'CONFIG', error_name: 'invalid_api_key', consecutive_failures: 1 });
        expect(await probeInSeconds()).toBeGreaterThan(14 * 60);
        // lower precedence: no change
        expect(await finalise(quotaDaily, cls('daily_quota_exceeded', 429), SET_HELD_CONFIG)).toMatchObject({ decision: { action: 'NONE' } });
        expect((await getBreaker()).reason).toBe('CONFIG');
        // CONFIG is the highest precedence: a monthly quota cannot replace it
        expect(await finalise(b, cls('monthly_quota_exceeded', 429), SET_HELD_CONFIG)).toMatchObject({ decision: { action: 'NONE' } });
        const after = await getBreaker();
        expect(after).toMatchObject({ reason: 'CONFIG', consecutive_failures: 1 });
        expect(after.next_probe_at).toBe(br.next_probe_at);
      });

      it('RATE_LIMIT -> QUOTA_DAILY -> QUOTA_MONTHLY escalate by precedence without touching consecutive_failures', async () => {
        const d = await claimed('p-d@outbox-gate.test');
        const m = await claimed('p-m@outbox-gate.test');
        await setBreaker({ state: 'OPEN', reason: 'RATE_LIMIT', failures: 1, nextProbeInS: 120 });
        expect(await finalise(d, cls('daily_quota_exceeded', 429), SET_HELD_CONFIG)).toMatchObject({ decision: { action: 'REASON_ESCALATED', reason: 'QUOTA_DAILY' } });
        expect(await finalise(m, cls('monthly_quota_exceeded', 429), SET_HELD_CONFIG)).toMatchObject({ decision: { action: 'REASON_ESCALATED', reason: 'QUOTA_MONTHLY' } });
        const br = await getBreaker();
        expect(br).toMatchObject({ reason: 'QUOTA_MONTHLY', consecutive_failures: 1 });
        expect(await probeInSeconds()).toBeGreaterThan(5 * 3600); // never shortened; lengthened to the 6h monthly probe
      });
    });

    // ---------------------------------------------------------------- CONFIG precheck (b)
    describe('CONFIG precheck: one transaction, breaker then outbox (231, 370, C-12)', () => {
      it('releases the stamped row unchanged to PENDING and opens CONFIG missing_api_key; statement order breaker lock -> outbox UPDATE', async () => {
        const a = await claimed('cfg@outbox-gate.test');
        await directSql`UPDATE booking_email_outbox SET attempt_count = 2, first_provider_attempt_at = now() - interval '1 hour', unknown_outcome_seen = true WHERE id = ${a.outboxId}`;
        recorded.length = 0;
        const out = await finaliseConfigPrecheck(rootDb, { id: a.outboxId, claimToken: a.claim.claimToken });
        expect(out).toMatchObject({ kind: 'FINALISED', decision: { action: 'OPENED', reason: 'CONFIG' } });
        const row = await getRow(a.outboxId);
        expect(row).toMatchObject({ status: 'PENDING', claim_token: null, attempt_count: 2, unknown_outcome_seen: true });
        expect(row.first_provider_attempt_at).not.toBeNull();
        expect(await getBreaker()).toMatchObject({ state: 'OPEN', reason: 'CONFIG', error_name: 'missing_api_key', consecutive_failures: 1 });
        const touching = recorded.filter((q) => /booking_email_(provider_state|outbox)/.test(q));
        expect(touching).toHaveLength(3);
        expect(touching[0]).toMatch(/booking_email_provider_state[\s\S]*FOR UPDATE/);
        expect(touching[1]).toMatch(/UPDATE booking_email_outbox/);
        expect(touching[2]).toMatch(/UPDATE booking_email_provider_state/);
        // zero provider calls by construction: no provider function is reachable from the breaker module.
      });

      it('HALF_OPEN probe row: HALF_OPEN -> OPEN with consecutive_failures + 1', async () => {
        const a = await claimed('cfgp@outbox-gate.test');
        await setBreaker({ state: 'HALF_OPEN', reason: 'CONFIG', errorName: 'missing_api_key', failures: 1, probeId: a.outboxId, probeStartedAgoS: 5 });
        const out = await finaliseConfigPrecheck(rootDb, { id: a.outboxId, claimToken: a.claim.claimToken });
        expect(out).toMatchObject({ kind: 'FINALISED', decision: { action: 'REOPENED_FROM_PROBE', wasProbe: true } });
        const br = await getBreaker();
        expect(br).toMatchObject({ state: 'OPEN', consecutive_failures: 2, probe_outbox_id: null });
        expect(await probeInSeconds()).toBeGreaterThan(29 * 60); // index = consecutive_failures before the increment (1) -> 30 min
        expect(await probeInSeconds()).toBeLessThanOrEqual(1800);
      });

      it('lost fence: no release, breaker untouched', async () => {
        const a = await claimed('cfgl@outbox-gate.test');
        const before = await getBreaker();
        expect(await finaliseConfigPrecheck(rootDb, { id: a.outboxId, claimToken: randomUUID() })).toEqual({ kind: 'FENCE_LOST' });
        expect(await getBreaker()).toEqual(before);
      });
    });

    // ---------------------------------------------------------------- probe outcomes (b)
    describe('probe outcomes (189, 190, 269, 281)', () => {
      async function probeRow(failures: number, reason: string) {
        const a = await claimed(`probe-${sequence}-${Date.now()}@outbox-gate.test`);
        await setBreaker({ state: 'HALF_OPEN', reason, failures, probeId: a.outboxId, probeStartedAgoS: 10 });
        return a;
      }
      it('ACCEPTED probe -> CLOSED, consecutive_failures 0, ramp_until ~10 min', async () => {
        const a = await probeRow(3, 'PROVIDER_UNAVAILABLE');
        expect(await finalise(a, ACCEPTED, SET_ACCEPTED)).toMatchObject({ decision: { action: 'CLOSED_BY_PROBE', wasProbe: true } });
        const br = await getBreaker();
        expect(br).toMatchObject({ state: 'CLOSED', reason: null, consecutive_failures: 0, probe_outbox_id: null, next_probe_at: null });
        const [r] = await directSql<{ s: number }[]>`SELECT extract(epoch FROM (ramp_until - now()))::float8 AS s FROM booking_email_provider_state WHERE id = 1`;
        expect(r.s).toBeGreaterThan(590);
        expect(r.s).toBeLessThanOrEqual(600);
      });
      it('UNKNOWN probe -> OPEN PROVIDER_UNAVAILABLE with the NEXT interval (2m,5m,15m,30m by consecutive_failures)', async () => {
        const expected = [[0, 120], [1, 300], [2, 900], [3, 1800], [6, 1800]];
        for (const [failures, secs] of expected) {
          const a = await probeRow(failures, 'PROVIDER_UNAVAILABLE');
          expect(await finalise(a, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN)).toMatchObject({ decision: { action: 'REOPENED_FROM_PROBE', reason: 'PROVIDER_UNAVAILABLE' } });
          expect(await getBreaker()).toMatchObject({ state: 'OPEN', consecutive_failures: failures + 1 });
          const s = await probeInSeconds();
          expect(s).toBeGreaterThan(secs - 20);
          expect(s).toBeLessThanOrEqual(secs);
          await setBreaker({ state: 'CLOSED' });
        }
      });
      it('even an uncounted (budget-shortened) UNKNOWN probe re-opens the breaker', async () => {
        const a = await probeRow(0, 'PROVIDER_UNAVAILABLE');
        expect(await finalise(a, UNCOUNTED_UNKNOWN, SET_UNCOUNTED_UNKNOWN)).toMatchObject({ decision: { action: 'REOPENED_FROM_PROBE' } });
      });
      it('ambiguous-code probe CLOSES the breaker (credentials work), is not re-escalated, consecutive_failures kept', async () => {
        const a = await probeRow(2, 'CONFIG');
        expect(await finalise(a, cls('validation_error', 422), SET_HELD_CODE('validation_error'))).toMatchObject({ decision: { action: 'CLOSED_BY_PROBE' } });
        expect(await getBreaker()).toMatchObject({ state: 'CLOSED', consecutive_failures: 2 });
      });
      it('idempotency-mismatch probe closes; CONFIG probe failure backs off 15 -> 30 -> 60 min', async () => {
        const a = await probeRow(1, 'CONFIG');
        expect(await finalise(a, cls('invalid_idempotent_request', 409), sql`status = 'ATTENTION', attention_reason = 'IDEMPOTENCY_MISMATCH', payload = NULL`)).toMatchObject({ decision: { action: 'CLOSED_BY_PROBE' } });
        await setBreaker({ state: 'CLOSED' });
        for (const [failures, secs] of [[0, 900], [1, 1800], [2, 3600], [5, 3600]]) {
          const p = await probeRow(failures, 'CONFIG');
          expect(await finalise(p, cls('invalid_api_key', 401), SET_HELD_CONFIG)).toMatchObject({ decision: { action: 'REOPENED_FROM_PROBE', reason: 'CONFIG' } });
          const s = await probeInSeconds();
          expect(s).toBeGreaterThan(secs - 20);
          expect(s).toBeLessThanOrEqual(secs);
          await setBreaker({ state: 'CLOSED' });
        }
      });
    });

    // ---------------------------------------------------------------- RATE_LIMIT escalation (b)
    describe('RATE_LIMIT escalation (284-288)', () => {
      it('an isolated 429 holds the row and leaves the breaker CLOSED', async () => {
        const a = await claimed('r-a@outbox-gate.test');
        expect(await finalise(a, cls('rate_limit_exceeded', 429, { 'retry-after': '30' }), SET_HELD_RATE(1))).toMatchObject({ decision: { action: 'NONE' } });
        expect((await getBreaker()).state).toBe('CLOSED');
      });
      it('2 DISTINCT rows within 5 min -> OPEN RATE_LIMIT and every HELD(RATE_LIMIT, ROW) converts to GLOBAL outside the lock', async () => {
        const a = await claimed('r2-a@outbox-gate.test');
        const b = await claimed('r2-b@outbox-gate.test');
        await finalise(a, cls('rate_limit_exceeded', 429), SET_HELD_RATE(1));
        recorded.length = 0;
        const out = await finalise(b, cls('rate_limit_exceeded', 429), SET_HELD_RATE(1));
        expect(out).toMatchObject({ kind: 'FINALISED', decision: { action: 'OPENED', reason: 'RATE_LIMIT' }, rowHoldsConverted: 2 });
        const rows = await directSql`SELECT provider_hold_scope FROM booking_email_outbox WHERE id IN ${directSql([a.outboxId, b.outboxId])}`;
        expect(rows.map((r) => r.provider_hold_scope)).toEqual(['GLOBAL', 'GLOBAL']);
        expect(await getBreaker()).toMatchObject({ state: 'OPEN', reason: 'RATE_LIMIT' });
        expect(await probeInSeconds()).toBeGreaterThan(100); // max(60, 2 min) = 120 s
        // the conversion statement ran after the finalisation COMMIT (no breaker lock around it)
        const conv = recorded.findIndex((q) => /SET provider_hold_scope = 'GLOBAL'/.test(q));
        const lastBreakerWrite = recorded.map((q, i) => (/UPDATE booking_email_provider_state/.test(q) ? i : -1)).reduce((m, i) => Math.max(m, i), -1);
        expect(conv).toBeGreaterThan(lastBreakerWrite);
      });
      it('accepted sends between two isolated 429s (accepted_at later than the earlier one) do NOT open', async () => {
        const a = await claimed('r3-a@outbox-gate.test');
        const b = await claimed('r3-b@outbox-gate.test');
        await finalise(a, cls('rate_limit_exceeded', 429), SET_HELD_RATE(1));
        await directSql`UPDATE booking_email_outbox SET last_rate_limited_at = now() - interval '4 minutes' WHERE id = ${a.outboxId}`;
        await seedAccepted(120);
        const out = await finalise(b, cls('rate_limit_exceeded', 429), SET_HELD_RATE(1));
        expect(out).toMatchObject({ decision: { action: 'NONE' } });
        expect((await getBreaker()).state).toBe('CLOSED');
      });
      it('a row with 3 consecutive hits opens the breaker; Retry-After > 300 opens immediately', async () => {
        const a = await claimed('r4-a@outbox-gate.test');
        expect(await finalise(a, cls('rate_limit_exceeded', 429), SET_HELD_RATE(2))).toMatchObject({ decision: { action: 'NONE' } });
        await directSql`DELETE FROM booking_email_outbox WHERE organisation_id = ${ORG_ID}`; // isolate rule (ii) from the pair rule (i)
        const b = await claimed('r4-b@outbox-gate.test');
        expect(await finalise(b, cls('rate_limit_exceeded', 429), SET_HELD_RATE(3))).toMatchObject({ decision: { action: 'OPENED', reason: 'RATE_LIMIT' } });
        await setBreaker({ state: 'CLOSED' });
        await directSql`DELETE FROM booking_email_outbox WHERE organisation_id = ${ORG_ID}`;
        const c = await claimed('r4-c@outbox-gate.test');
        expect(await finalise(c, cls('rate_limit_exceeded', 429, { 'retry-after': '900' }), SET_HELD_RATE(1))).toMatchObject({ decision: { action: 'OPENED', reason: 'RATE_LIMIT' } });
        expect(await probeInSeconds()).toBeGreaterThan(880); // max(900, 120) capped 1 h
      });
    });

    // ---------------------------------------------------------------- CODE_CONTRACT escalation (b)
    describe('CODE_CONTRACT global escalation (276, 336-345, 283)', () => {
      const NAME = 'validation_error';
      const code = () => cls(NAME, 422);
      async function fail(recipient: string) {
        const s = await claimed(recipient);
        return finalise(s, code(), SET_HELD_CODE(NAME));
      }
      it('1 or 2 recipients, or one recipient repeating, never escalate; rows still held with payload retained', async () => {
        expect(await fail('cc1@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
        expect(await fail('cc1@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
        expect(await fail('cc1@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
        expect(await fail('cc2@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
        expect((await getBreaker()).state).toBe('CLOSED');
        const held = await directSql`SELECT status, payload IS NOT NULL AS has_payload, provider_hold_scope FROM booking_email_outbox WHERE organisation_id = ${ORG_ID} AND status = 'HELD_PROVIDER_OPERATIONAL'`;
        expect(held).toHaveLength(4);
        expect(held.every((r) => r.has_payload && r.provider_hold_scope === 'ROW')).toBe(true);
      });
      it('3 distinct recipients within 15 min and no counter-evidence -> OPEN CONFIG with the error name; the triggering row stays ROW scope', async () => {
        await fail('cc3a@outbox-gate.test');
        await fail('cc3b@outbox-gate.test');
        const out = await fail('cc3c@outbox-gate.test');
        expect(out).toMatchObject({ decision: { action: 'OPENED', reason: 'CONFIG' } });
        expect(await getBreaker()).toMatchObject({ state: 'OPEN', reason: 'CONFIG', error_name: NAME });
        const rows = await directSql`SELECT DISTINCT provider_hold_scope FROM booking_email_outbox WHERE organisation_id = ${ORG_ID} AND status = 'HELD_PROVIDER_OPERATIONAL'`;
        expect(rows.map((r) => r.provider_hold_scope)).toEqual(['ROW']);
      });
      it('different error names do not pool together', async () => {
        const mk = async (r: string, name: string) => {
          const s = await claimed(r);
          return finalise(s, cls(name, 422), SET_HELD_CODE(name));
        };
        await mk('cd1@outbox-gate.test', 'validation_error');
        await mk('cd2@outbox-gate.test', 'invalid_parameter');
        expect(await mk('cd3@outbox-gate.test', 'missing_required_field')).toMatchObject({ decision: { action: 'NONE' } });
      });
      it('an ACCEPTED send of ANY type AFTER the earliest qualifying failure prevents escalation; BEFORE it does not', async () => {
        await fail('ce1@outbox-gate.test');
        await fail('ce2@outbox-gate.test');
        await seedAccepted(0, 'BOOKING_CANCELLED'); // after earliest failure, different type
        expect(await fail('ce3@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
        expect((await getBreaker()).state).toBe('CLOSED');

        await directSql`DELETE FROM booking_email_outbox WHERE organisation_id = ${ORG_ID}`;
        await seedAccepted(120); // before the earliest failure: not counter-evidence
        await fail('cf1@outbox-gate.test');
        await fail('cf2@outbox-gate.test');
        expect(await fail('cf3@outbox-gate.test')).toMatchObject({ decision: { action: 'OPENED', reason: 'CONFIG' } });
      });
      it('failures older than the 15-minute window do not count (qualifying = latest per recipient inside the window)', async () => {
        await fail('cg1@outbox-gate.test');
        await fail('cg2@outbox-gate.test');
        await directSql`UPDATE booking_email_outbox SET last_error_at = now() - interval '16 minutes' WHERE organisation_id = ${ORG_ID} AND recipient_email = 'cg1@outbox-gate.test'`;
        expect(await fail('cg3@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
      });
      it('hostile-oldest probe: an ambiguous-code probe closes and the next legitimate acceptance prevents re-escalation (281)', async () => {
        const hostile = await claimed('ch@outbox-gate.test');
        await setBreaker({ state: 'HALF_OPEN', reason: 'CONFIG', errorName: NAME, failures: 1, probeId: hostile.outboxId, probeStartedAgoS: 5 });
        expect(await finalise(hostile, code(), SET_HELD_CODE(NAME))).toMatchObject({ decision: { action: 'CLOSED_BY_PROBE' } });
        await fail('ch3@outbox-gate.test');
        await seedAccepted(0);
        expect(await fail('ch4@outbox-gate.test')).toMatchObject({ decision: { action: 'NONE' } });
      });
    });

    // ---------------------------------------------------------------- promoteProbe (c)
    describe('promoteProbe, section (c) (188, 211, 232, 278, 186)', () => {
      it('not due / CLOSED -> NOT_DUE', async () => {
        expect(await promoteProbe(rootDb)).toEqual({ kind: 'NOT_DUE' });
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: 600 });
        expect(await promoteProbe(rootDb)).toEqual({ kind: 'NOT_DUE' });
        expect((await getBreaker()).state).toBe('OPEN');
      });
      it('due: unstamped rows first (GLOBAL hold, then PENDING oldest), ROW holds and binned/pending holds never; one probe set', async () => {
        const rowHold = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', holdReason: 'CODE_CONTRACT', createdAgoS: 5000 });
        const binned = await seedRow({ status: 'HELD_PARENT_BINNED', createdAgoS: 4000 });
        const stampedRetry = await seedRow({ status: 'RETRY_SCHEDULED', firstAttemptAgoS: 3600, createdAgoS: 4500, attemptCount: 1, unknownSeen: true });
        const pendingOld = await seedRow({ status: 'PENDING', createdAgoS: 3000 });
        const globalHold = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG', createdAgoS: 100 });
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: -1 });
        const out = await promoteProbe(rootDb);
        expect(out).toEqual({ kind: 'PROBE_SET', probeOutboxId: globalHold, fromState: 'OPEN' });
        expect(await getBreaker()).toMatchObject({ state: 'HALF_OPEN', probe_outbox_id: globalHold, consecutive_failures: 1 });
        expect((await getRow(globalHold)).status).toBe('PENDING');
        expect((await getRow(rowHold)).status).toBe('HELD_PROVIDER_OPERATIONAL');
        expect((await getRow(binned)).status).toBe('HELD_PARENT_BINNED');
        expect((await getRow(stampedRetry)).status).toBe('RETRY_SCHEDULED');
        expect((await getRow(pendingOld)).status).toBe('PENDING');
      });
      it('pending-only -> oldest PENDING; stamped due RETRY_SCHEDULED only when no unstamped row; stamp and key kept', async () => {
        const stamped = await seedRow({ status: 'RETRY_SCHEDULED', firstAttemptAgoS: 600, nextAttemptInS: -10, attemptCount: 1, unknownSeen: true, createdAgoS: 900 });
        await setBreaker({ state: 'OPEN', reason: 'PROVIDER_UNAVAILABLE', failures: 1, nextProbeInS: -1 });
        expect(await promoteProbe(rootDb)).toMatchObject({ kind: 'PROBE_SET', probeOutboxId: stamped });
        const r = await getRow(stamped);
        expect(r).toMatchObject({ status: 'PENDING', unknown_outcome_seen: true, attempt_count: 1 });
        expect(r.first_provider_attempt_at).not.toBeNull();
      });
      it('two concurrent promoters create exactly one probe', async () => {
        await seedRow({ status: 'PENDING', createdAgoS: 100 });
        await seedRow({ status: 'PENDING', createdAgoS: 90 });
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: -1 });
        const results = await Promise.all([promoteProbe(rootDb), promoteProbe(rootDb), promoteProbe(rootDb)]);
        expect(results.filter((r) => r.kind === 'PROBE_SET')).toHaveLength(1);
        expect(results.filter((r) => r.kind === 'NOT_DUE' || r.kind === 'LOCK_TIMEOUT')).toHaveLength(2);
        const [{ n }] = await directSql<{ n: number }[]>`SELECT count(*)::int AS n FROM booking_email_outbox WHERE id = (SELECT probe_outbox_id FROM booking_email_provider_state WHERE id = 1)`;
        expect(n).toBe(1);
      });
      it('a row blocked by a lower-version non-due row is skipped (211)', async () => {
        const blockedBookingId = randomUUID();
        sequence += 1;
        await directSql`
          INSERT INTO bookings (id, parent_id, start_at, status, confirmation_code, magic_link_token${stubBaseline ? directSql`` : directSql`, centre_id, modality`})
          VALUES (${blockedBookingId}, ${PARENT_ID}, now() + interval '30 days', 'confirmed', ${'P2B' + sequence + Date.now().toString().slice(-8)}, ${'p2b-' + sequence + Date.now()}${stubBaseline ? directSql`` : directSql`, ${CENTRE_ID}, 'online'`})`;
        createdBookingIds.push(blockedBookingId);
        const lower = randomUUID();
        const higher = randomUUID();
        await directSql`
          INSERT INTO booking_email_outbox (id, organisation_id, booking_id, transition_version, communication_type, recipient_email, idempotency_key, payload, status, next_attempt_at, created_at)
          VALUES (${lower}, ${ORG_ID}, ${blockedBookingId}, 1, 'BOOKING_CONFIRMATION', 'blk@outbox-gate.test', ${'k:' + lower}, '{"payloadVersion":1}'::jsonb, 'RETRY_SCHEDULED', now() + interval '1 hour', now() - interval '2 hours'),
                 (${higher}, ${ORG_ID}, ${blockedBookingId}, 2, 'BOOKING_RESCHEDULE', 'blk@outbox-gate.test', ${'k:' + higher}, '{"payloadVersion":1}'::jsonb, 'PENDING', now() - interval '1 minute', now() - interval '1 hour')`;
        await directSql`UPDATE bookings SET communication_version = 1 WHERE id = ${blockedBookingId}`;
        const free = await seedRow({ status: 'PENDING', createdAgoS: 10 });
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: -1 });
        expect(await promoteProbe(rootDb)).toMatchObject({ kind: 'PROBE_SET', probeOutboxId: free });
      });
      it('NO-CANDIDATE: stamped not-due RETRY_SCHEDULED waiting -> OPEN with LEAST(min next_attempt_at, now()+30m), consecutive_failures unchanged (278, 186)', async () => {
        await seedRow({ status: 'RETRY_SCHEDULED', firstAttemptAgoS: 600, nextAttemptInS: 600, attemptCount: 1, unknownSeen: true });
        await setBreaker({ state: 'OPEN', reason: 'PROVIDER_UNAVAILABLE', failures: 2, nextProbeInS: -1 });
        const out = await promoteProbe(rootDb);
        expect(out.kind).toBe('RETURNED_TO_OPEN');
        expect(await getBreaker()).toMatchObject({ state: 'OPEN', consecutive_failures: 2, probe_outbox_id: null });
        const s = await probeInSeconds();
        expect(s).toBeGreaterThan(560);
        expect(s).toBeLessThanOrEqual(600);
      });
      it('NO-CANDIDATE: waiting row far in the future is capped at now()+30m', async () => {
        await seedRow({ status: 'RETRY_SCHEDULED', firstAttemptAgoS: 600, nextAttemptInS: 4 * 3600, attemptCount: 1, unknownSeen: true });
        await setBreaker({ state: 'OPEN', reason: 'PROVIDER_UNAVAILABLE', failures: 1, nextProbeInS: -1 });
        expect((await promoteProbe(rootDb)).kind).toBe('RETURNED_TO_OPEN');
        expect(await probeInSeconds()).toBeLessThanOrEqual(1800);
        expect(await probeInSeconds()).toBeGreaterThan(1700);
      });
      it('NO-CANDIDATE with nothing waiting (only a ROW hold and a binned row) -> CLOSED with ramp, failures unchanged', async () => {
        await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', holdReason: 'CODE_CONTRACT' });
        await seedRow({ status: 'HELD_PARENT_BINNED' });
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 2, nextProbeInS: -1 });
        expect(await promoteProbe(rootDb)).toEqual({ kind: 'CLOSED' });
        const br = await getBreaker();
        expect(br).toMatchObject({ state: 'CLOSED', consecutive_failures: 2, reason: null });
        expect(br.ramp_until).not.toBeNull();
      });
      it('HALF_OPEN whose probe row was disposed advances to the next candidate in the same pass; a live probe is left alone', async () => {
        const dead = await seedRow({ status: 'SUPERSEDED', createdAgoS: 500 });
        const next = await seedRow({ status: 'PENDING', createdAgoS: 100 });
        await setBreaker({ state: 'HALF_OPEN', reason: 'CONFIG', failures: 1, probeId: dead, probeStartedAgoS: 30 });
        expect(await promoteProbe(rootDb)).toEqual({ kind: 'PROBE_SET', probeOutboxId: next, fromState: 'HALF_OPEN' });
        expect(await promoteProbe(rootDb)).toEqual({ kind: 'NOT_DUE' }); // probe row is PENDING and live
      });
      it('lock timeout (55P03) is reported, not thrown, and nothing changes', async () => {
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: -1 });
        const holder = await directSql.reserve();
        try {
          await holder`BEGIN`;
          await holder`SELECT 1 FROM booking_email_provider_state WHERE id = 1 FOR UPDATE`;
          expect(await promoteProbe(rootDb)).toEqual({ kind: 'LOCK_TIMEOUT' });
        } finally {
          await holder`ROLLBACK`;
          holder.release();
        }
        expect((await getBreaker()).state).toBe('OPEN');
      });
    });

    // ---------------------------------------------------------------- bulk release (d)
    describe('bulk-release cooldown and post-lock work (236, 289, 331, 335, 206)', () => {
      it('N concurrent invocations: exactly ONE cooldown winner per 60 s; not CLOSED -> no winner', async () => {
        const wins = await Promise.all(Array.from({ length: 8 }, () => claimBulkReleaseCooldown(rootDb)));
        expect(wins.filter(Boolean)).toHaveLength(1);
        expect(await claimBulkReleaseCooldown(rootDb)).toBe(false);
        await directSql`UPDATE booking_email_provider_state SET last_bulk_release_at = now() - interval '61 seconds' WHERE id = 1`;
        expect(await claimBulkReleaseCooldown(rootDb)).toBe(true);
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: 600 });
        await directSql`UPDATE booking_email_provider_state SET last_bulk_release_at = NULL WHERE id = 1`;
        expect(await claimBulkReleaseCooldown(rootDb)).toBe(false);
      });
      it('releaseHeldRows releases at most 25, oldest first, GLOBAL holds and DUE row holds only, to PENDING', async () => {
        const ids: string[] = [];
        for (let i = 0; i < 30; i += 1) ids.push(await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG', createdAgoS: 10_000 - i }));
        const dueRow = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', holdReason: 'RATE_LIMIT', nextAttemptInS: -5, createdAgoS: 20_000 });
        const futureRow = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', holdReason: 'RATE_LIMIT', nextAttemptInS: 600, createdAgoS: 30_000 });
        const released = await releaseHeldRows(rootDb);
        expect(released).toHaveLength(25);
        expect(released).toContain(dueRow); // oldest eligible row is included
        expect(released).not.toContain(futureRow);
        const pending = await directSql`SELECT count(*)::int AS n FROM booking_email_outbox WHERE id IN ${directSql(released)} AND status = 'PENDING'`;
        expect(pending[0].n).toBe(25);
        const left = await directSql`SELECT count(*)::int AS n FROM booking_email_outbox WHERE organisation_id = ${ORG_ID} AND status = 'HELD_PROVIDER_OPERATIONAL'`;
        expect(left[0].n).toBe(7);
        void ids;
        expect(await releaseHeldRows(rootDb, { limit: 1000 })).toHaveLength(6); // hard-capped at 25 per call, only 6 eligible left
      });
      it('breaker re-opened between the cooldown win and the release: nothing is released; released rows are gated (335)', async () => {
        await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG' });
        expect(await claimBulkReleaseCooldown(rootDb)).toBe(true);
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: 600 });
        expect(await releaseHeldRows(rootDb)).toEqual([]);
        // a row released just before the re-open is an ordinary PENDING row that the claim gate blocks
        const pending = await seedRow({ status: 'PENDING' });
        expect(await claimOutboxBatch(rootDb, { limit: 5, specificId: pending })).toEqual([]);
      });
      it('convertRowHoldsToGlobal only converts RATE_LIMIT ROW holds and only while the breaker is not CLOSED', async () => {
        const rate = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', holdReason: 'RATE_LIMIT' });
        const code = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'ROW', holdReason: 'CODE_CONTRACT' });
        expect(await convertRowHoldsToGlobal(rootDb)).toBe(0); // CLOSED
        await setBreaker({ state: 'OPEN', reason: 'RATE_LIMIT', failures: 1, nextProbeInS: 600 });
        expect(await convertRowHoldsToGlobal(rootDb)).toBe(1);
        expect((await getRow(rate)).provider_hold_scope).toBe('GLOBAL');
        expect((await getRow(code)).provider_hold_scope).toBe('ROW');
      });
      it('disposeExpiredProviderHolds: 72 h ceiling and 23 h stamped anchor, payload NULL, <= 50 per call, no breaker lock', async () => {
        const old = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG', createdAgoS: 73 * 3600 });
        const stamped = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG', firstAttemptAgoS: 24 * 3600, unknownSeen: true });
        const fresh = await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG' });
        recorded.length = 0;
        expect(await disposeExpiredProviderHolds(rootDb)).toBe(2);
        expect(recorded.some((q) => /booking_email_provider_state/.test(q))).toBe(false);
        expect(await getRow(old)).toMatchObject({ status: 'ATTENTION', attention_reason: 'PROVIDER_HOLD_EXPIRED', payload: null });
        expect(await getRow(stamped)).toMatchObject({ status: 'ATTENTION', attention_reason: 'WINDOW_23H', payload: null });
        expect((await getRow(fresh)).status).toBe('HELD_PROVIDER_OPERATIONAL');
      });
    });

    // ---------------------------------------------------------------- (e)
    describe('section (e): fingerprint observation and HALF_OPEN timeout recovery (183, 187, 274)', () => {
      it('computeConfigFingerprint is 8 hex chars, includes the git sha, and cannot reproduce the key (205)', () => {
        const fp = computeConfigFingerprint({ apiKey: 're_secret_key', fromEmail: 'a@b.co', fromName: 'N' });
        expect(fp).toMatch(/^[0-9a-f]{8}$/);
        expect(fp).not.toContain('secret');
        expect(computeConfigFingerprint({ apiKey: 're_secret_key', fromEmail: 'a@b.co', fromName: 'N', gitCommitSha: 'abc' })).not.toBe(fp);
      });
      it('first observation records only; change on an OPEN CONFIG breaker -> next_probe_at = now(); change on another reason does not', async () => {
        await setBreaker({ state: 'OPEN', reason: 'CONFIG', failures: 1, nextProbeInS: 900 });
        expect(await observeConfigFingerprint(rootDb, 'aaaaaaaa')).toEqual({ changed: false, probeScheduled: false });
        expect(await probeInSeconds()).toBeGreaterThan(800);
        expect(await observeConfigFingerprint(rootDb, 'aaaaaaaa')).toEqual({ changed: false, probeScheduled: false });
        expect(await observeConfigFingerprint(rootDb, 'bbbbbbbb')).toEqual({ changed: true, probeScheduled: true });
        expect(await probeInSeconds()).toBeLessThanOrEqual(0.5);
        expect((await getBreaker()).config_fingerprint).toBe('bbbbbbbb');
        await setBreaker({ state: 'OPEN', reason: 'QUOTA_DAILY', failures: 1, nextProbeInS: 900 });
        expect(await observeConfigFingerprint(rootDb, 'cccccccc')).toEqual({ changed: true, probeScheduled: false });
        expect(await probeInSeconds()).toBeGreaterThan(800);
      });
      it('HALF_OPEN with no outcome for 10 min -> OPEN, next_probe_at = now(), consecutive_failures unchanged; younger probe untouched', async () => {
        const p = await seedRow({ status: 'PENDING' });
        await setBreaker({ state: 'HALF_OPEN', reason: 'CONFIG', failures: 3, probeId: p, probeStartedAgoS: 9 * 60 });
        expect(await recoverHalfOpenTimeout(rootDb)).toBe(false);
        await setBreaker({ state: 'HALF_OPEN', reason: 'CONFIG', failures: 3, probeId: p, probeStartedAgoS: 10 * 60 + 5 });
        expect(await recoverHalfOpenTimeout(rootDb)).toBe(true);
        expect(await getBreaker()).toMatchObject({ state: 'OPEN', consecutive_failures: 3, probe_outbox_id: null, reason: 'CONFIG' });
        expect(await probeInSeconds()).toBeLessThanOrEqual(0.5);
        expect(await recoverHalfOpenTimeout(rootDb)).toBe(false);
      });
    });

    // ---------------------------------------------------------------- inventory and deadlock freedom
    describe('lock-section inventory and concurrent sections (219, 323, 328)', () => {
      it('only the breaker module writes or locks booking_email_provider_state (static inventory)', () => {
        const dir = path.resolve(process.cwd(), 'src/lib/services');
        for (const f of ['email-outbox-classifier.ts', 'email-outbox-claim.ts', 'email-outbox-dispatch.ts']) {
          const src = fs.readFileSync(path.join(dir, f), 'utf8');
          expect(src, f).not.toMatch(/UPDATE\s+booking_email_provider_state/);
          expect(src, f).not.toMatch(/INSERT\s+INTO\s+booking_email_provider_state/);
          expect(src, f).not.toMatch(/FROM\s+booking_email_provider_state\s+WHERE\s+id\s*=\s*\S+\s+FOR UPDATE/);
        }
        const breaker = fs.readFileSync(path.join(dir, 'email-outbox-breaker.ts'), 'utf8');
        // no module-level import from claim/dispatch (acyclic: claim imports breaker, never the reverse)
        expect(breaker).not.toMatch(/from '\.\/email-outbox-(claim|dispatch|maintenance)'/);
      });
      it('concurrent finalisations, probe promotion and bulk-release cooldown complete without deadlock (no 40P01)', async () => {
        const rows: SeededRow[] = [];
        for (let i = 0; i < 6; i += 1) rows.push(await claimed(`dl-${i}@outbox-gate.test`));
        await seedRow({ status: 'HELD_PROVIDER_OPERATIONAL', holdScope: 'GLOBAL', holdReason: 'CONFIG' });
        const results = await Promise.allSettled([
          ...rows.map((r) => finalise(r, COUNTED_UNKNOWN, SET_COUNTED_UNKNOWN)),
          promoteProbe(rootDb),
          claimBulkReleaseCooldown(rootDb),
          releaseHeldRows(rootDb),
          recoverHalfOpenTimeout(rootDb),
          observeConfigFingerprint(rootDb, 'dddddddd'),
        ]);
        const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
        expect(rejected.map((r) => readSqlState(r.reason))).toEqual([]);
        const br = await getBreaker();
        expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(br.state);
        // invariant: an OPEN breaker always has next_probe_at; HALF_OPEN has a probe row or none
        if (br.state === 'OPEN') expect(br.next_probe_at).not.toBeNull();
      });
    });
  });
});
