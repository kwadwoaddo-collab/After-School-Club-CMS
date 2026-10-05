/**
 * Booking email outbox: claim primitive and stale-lease recovery (E4, E5 item 22).
 * CMS-OPS-REMEDIATION-1C V15. Dependency direction: types -> classifier -> breaker -> claim -> dispatch.
 * Minimal first-slice version: the E4 claim SQL (breaker gate, lowest-unfinished-version rule, SKIP LOCKED,
 * claim CTE and UPDATE in ONE statement) and the provider-free stale-lease recovery.
 */
import { sql } from 'drizzle-orm';
import type { RootDb } from './email-outbox-breaker';
import {
  CLAIM_LEASE_MS,
  MAX_LADDER_ATTEMPTS,
  UNKNOWN_LADDER_OFFSETS_MS,
  type ClaimedOutboxRow,
} from './email-outbox-types';

/**
 * Claim up to `limit` due rows (one statement; never two rows of one booking). Pass `specificId` for the
 * fast path's own row. Lease: CLAIM_LEASE_MS (5 minutes).
 */
export async function claimOutboxBatch(
  rootDb: RootDb,
  opts: { limit: number; specificId?: string | null },
): Promise<ClaimedOutboxRow[]> {
  const limit = Math.max(1, Math.floor(opts.limit));
  const innerLimit = limit * 3;
  const specificId = opts.specificId ?? null;
  const leaseSeconds = CLAIM_LEASE_MS / 1000;
  const rows = await rootDb.execute(sql`
    WITH lowest AS (
      SELECT o.booking_id, MIN(o.transition_version) AS min_version
      FROM booking_email_outbox o
      JOIN bookings b ON b.id = o.booking_id
      WHERE o.status IN ('PENDING','RETRY_SCHEDULED')
        AND o.transition_version >= b.communication_version
      GROUP BY o.booking_id
    ),
    cand AS (
      SELECT o.id, o.booking_id, o.transition_version, o.created_at
      FROM booking_email_outbox o
      JOIN bookings b ON b.id = o.booking_id
      JOIN booking_email_provider_state s ON s.id = 1
      LEFT JOIN lowest l ON l.booking_id = o.booking_id AND l.min_version = o.transition_version
      WHERE o.status IN ('PENDING','RETRY_SCHEDULED')
        AND ( s.state = 'CLOSED' OR (s.state = 'HALF_OPEN' AND o.id = s.probe_outbox_id) )
        AND ( (l.booking_id IS NOT NULL AND o.next_attempt_at <= now())
              OR o.transition_version < b.communication_version )
        AND NOT EXISTS (SELECT 1 FROM booking_email_outbox p WHERE p.booking_id = o.booking_id AND p.status = 'PROCESSING')
        AND (${specificId}::uuid IS NULL OR o.id = ${specificId}::uuid)
      ORDER BY o.created_at ASC
      LIMIT ${innerLimit}
      FOR UPDATE OF o SKIP LOCKED
    ),
    pick AS (
      SELECT DISTINCT ON (booking_id) id, created_at
      FROM cand
      ORDER BY booking_id, transition_version ASC
    ),
    final AS (
      SELECT id FROM pick ORDER BY created_at ASC LIMIT ${limit}
    )
    UPDATE booking_email_outbox o
    SET status = 'PROCESSING',
        claim_token = gen_random_uuid(),
        claim_expires_at = now() + make_interval(secs => ${leaseSeconds}),
        updated_at = now()
    FROM final
    WHERE o.id = final.id AND o.status IN ('PENDING','RETRY_SCHEDULED')
    RETURNING o.id, o.claim_token, o.booking_id
  `);
  return (rows as unknown as { id: string; claim_token: string; booking_id: string | null }[]).map((r) => ({
    id: r.id,
    claimToken: r.claim_token,
    bookingId: r.booking_id,
  }));
}

/**
 * Stale-lease recovery (provider-free, no breaker lock). Never writes last_unknown_at, last_error_*,
 * or any breaker column, so a fallback recovery is UNCOUNTED for PROVIDER_UNAVAILABLE by construction.
 * Stamped rows -> RETRY_SCHEDULED with the SAME key and frozen body and unknown_outcome_seen = true
 * (next_attempt_at = GREATEST(t0 + offset[attempt_count], now() + 5 minutes)); attempt_count >= 7 ->
 * ATTENTION(UNKNOWN_OUTCOME_EXHAUSTED); slot at or after t0 + 22 h -> ATTENTION(WINDOW_23H);
 * unstamped rows -> PENDING. Returns the number of rows recovered.
 */
export async function recoverStaleLeases(rootDb: RootDb, opts: { limit?: number } = {}): Promise<number> {
  const limit = Math.max(1, Math.floor(opts.limit ?? 50));
  const offsetsSeconds = UNKNOWN_LADDER_OFFSETS_MS.map((ms) => ms / 1000);
  const maxAttempts = MAX_LADDER_ATTEMPTS;
  const rows = await rootDb.execute(sql`
    WITH stale AS (
      SELECT id,
             first_provider_attempt_at,
             attempt_count,
             CASE WHEN first_provider_attempt_at IS NULL OR attempt_count >= ${maxAttempts} THEN NULL
                  ELSE GREATEST(
                    first_provider_attempt_at + make_interval(secs => (ARRAY[${sql.join(offsetsSeconds.map((s) => sql`${s}::int`), sql`, `)}])[GREATEST(attempt_count, 1)]),
                    now() + interval '5 minutes')
             END AS slot
      FROM booking_email_outbox
      WHERE status = 'PROCESSING' AND claim_expires_at IS NOT NULL AND claim_expires_at <= now()
      ORDER BY claim_expires_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE booking_email_outbox o
    SET status = CASE
          WHEN s.first_provider_attempt_at IS NULL THEN 'PENDING'::booking_email_outbox_status
          WHEN s.attempt_count >= ${maxAttempts} OR s.slot >= s.first_provider_attempt_at + interval '22 hours' THEN 'ATTENTION'::booking_email_outbox_status
          ELSE 'RETRY_SCHEDULED'::booking_email_outbox_status END,
        attention_reason = CASE
          WHEN s.first_provider_attempt_at IS NULL THEN o.attention_reason
          WHEN s.attempt_count >= ${maxAttempts} THEN 'UNKNOWN_OUTCOME_EXHAUSTED'
          WHEN s.slot >= s.first_provider_attempt_at + interval '22 hours' THEN 'WINDOW_23H'
          ELSE o.attention_reason END,
        payload = CASE
          WHEN s.first_provider_attempt_at IS NOT NULL
               AND (s.attempt_count >= ${maxAttempts} OR s.slot >= s.first_provider_attempt_at + interval '22 hours') THEN NULL
          ELSE o.payload END,
        next_attempt_at = CASE
          WHEN s.first_provider_attempt_at IS NOT NULL AND s.attempt_count < ${maxAttempts}
               AND s.slot < s.first_provider_attempt_at + interval '22 hours' THEN s.slot
          ELSE o.next_attempt_at END,
        unknown_outcome_seen = CASE WHEN s.first_provider_attempt_at IS NOT NULL THEN true ELSE o.unknown_outcome_seen END,
        claim_token = NULL,
        claim_expires_at = NULL,
        updated_at = now()
    FROM stale s
    WHERE o.id = s.id AND o.status = 'PROCESSING'
    RETURNING o.id
  `);
  return rows.length;
}
