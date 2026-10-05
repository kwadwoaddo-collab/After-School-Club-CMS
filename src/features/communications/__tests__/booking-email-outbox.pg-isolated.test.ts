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
import { stampFirstProviderAttempt } from '@/lib/services/email-outbox-breaker';
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
});
