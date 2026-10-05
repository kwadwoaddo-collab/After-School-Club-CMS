/**
 * Booking email outbox: circuit-breaker / pacing table access (E3, E5).
 * CMS-OPS-REMEDIATION-1C V15. Dependency direction: types -> classifier -> breaker -> claim -> dispatch.
 *
 * Breaker LOCK SECTION (a): the stamp transaction. Lock order everywhere: breaker row FIRST, outbox row SECOND.
 * Other sections (b)-(e) (finalisation, probe promotion, bulk release cooldown, conditional changes) are
 * added to this file by later work; only what the first vertical slice needs lives here today.
 *
 * Accident prevention: functions take a RootDb that a transaction handle cannot satisfy, and no transaction
 * is ever open across a provider request: the stamp transaction commits (or rolls back) before it returns.
 */
import { sql } from 'drizzle-orm';
import type { db as rootDbInstance } from '@/db';
import {
  PROVIDER_STATE_ID,
  STAMP_LOCK_TIMEOUT_MS,
  STAMP_STATEMENT_TIMEOUT_MS,
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
