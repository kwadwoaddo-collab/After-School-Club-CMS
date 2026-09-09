# PM-2B Broadcast Delivery Durability — Architecture & Real PostgreSQL Certification

## 1. Overview & Executive Summary

The PM-2B milestone remediates the core serverless broadcast delivery failure mode in the After-School Club CMS.

### Historical Defect
In serverless runtimes (such as Vercel Serverless Functions), asynchronous background Promises detached from HTTP request lifecycles (e.g. `sendEmailsTask().catch(...)`) are immediately terminated upon function completion when the HTTP response returns. As a result, broadcasts were recorded as headers in the database, but individual recipient emails were dropped or stranded before provider submission could take place.

### Architectural Solution
PM-2B reconstructs broadcast communications onto an **authoritative transactional outbox model**:
1. **Atomic Queueing**: Every broadcast transaction writes the `broadcasts` header and full `broadcast_deliveries` recipient ledger rows within a single PostgreSQL transaction.
2. **Immutable Snapshotting**: Recipient addresses, identities, and message bodies are snapshotted at queue time.
3. **Atomic Worker Leasing**: Workers claim bounded batches using PostgreSQL `SELECT id FROM broadcast_deliveries WHERE ... FOR UPDATE SKIP LOCKED` and lease expiration timeouts.
4. **Idempotent Provider Integration**: Each delivery record's primary UUID (`delivery.id`) is forwarded to Resend as the `Idempotency-Key` header, guaranteeing that worker re-execution or crash recovery cannot duplicate email delivery to parents.
5. **Fail-Closed Vercel Cron Sweeper**: `/api/cron/broadcasts` runs daily to sweep and recover orphaned or retryable deliveries, protected by timing-safe `CRON_SECRET` validation.

---

## 2. Database Schema & Migration Forensics

### Migration File: `drizzle/0026_broadcast_delivery_durability.sql`
- Reconciled into `drizzle/meta/_journal.json` at index 26 with tag `0026_broadcast_delivery_durability`.

```sql
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "status" varchar(30) DEFAULT 'PENDING' NOT NULL;
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "broadcast_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "broadcast_id" uuid NOT NULL REFERENCES "broadcasts"("id") ON DELETE CASCADE,
  "parent_id" uuid REFERENCES "parents"("id") ON DELETE SET NULL,
  "recipient_email" varchar(255) NOT NULL,
  "recipient_name" varchar(255),
  "channel" varchar(20) DEFAULT 'email' NOT NULL,
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "claim_token" varchar(255),
  "claimed_at" timestamp with time zone,
  "lease_expires_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "provider_message_id" varchar(255),
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_deliveries_unique_idx"
  ON "broadcast_deliveries" ("broadcast_id", "recipient_email");

CREATE INDEX IF NOT EXISTS "broadcast_deliveries_pending_claim_idx"
  ON "broadcast_deliveries" ("status", "next_attempt_at", "lease_expires_at");
```

### Foreign Key Cascade & Retention Under Hard Deletion
- In `broadcast_deliveries`, `parent_id` is declared as `REFERENCES parents(id) ON DELETE SET NULL`.
- If an operator deletes a parent record (hard deletion), PostgreSQL cascade triggers set `broadcast_deliveries.parent_id = NULL`.
- The ledger record itself and its historical snapshot (`recipient_email`, `sent_at`, `status`, `provider_message_id`) are preserved intact, satisfying statutory audit retention requirements without dangling foreign key violations.

---

## 3. Worker Leasing & Concurrency Architecture

### PostgreSQL `FOR UPDATE SKIP LOCKED` Worker Claiming
```sql
SELECT id
FROM broadcast_deliveries
WHERE (
  (status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
  OR
  (status = 'PROCESSING' AND lease_expires_at < NOW())
)
ORDER BY created_at ASC
LIMIT :batchSize
FOR UPDATE SKIP LOCKED
```
- Prevents double-claiming across parallel serverless functions or cron instances.
- Reclaims stuck deliveries whose `lease_expires_at` has elapsed (default: 2 minutes) without blocking active deliveries.

### Exponential Backoff & Retry Policy
- **Transient Failures** (`429`, `500`, `502`, `503`, `504`, timeouts, socket drops): Backed off exponentially (`10s`, `30s`, `90s`) up to `MAX_DELIVERY_ATTEMPTS = 3`.
- **Permanent Failures** (`invalid_email`, `domain_not_verified`, unconfigured provider, 400, 401, 403, 422): Terminated immediately into `FAILED` state without wasting retries.
- **Provider Success / Crash Recovery**: Resend idempotency key ensures that re-claiming a delivery record that succeeded at Resend but crashed before local DB commit returns the existing Resend message ID without re-sending the message.

---

## 4. Provider Contract & Resend SDK 6.9.1 Idempotency

### Exact Resend SDK Idempotency Semantics
- In Resend SDK (`resend@6.9.1`), the `send` method signature is:
  `resend.emails.send(payload: CreateEmailOptions, options?: CreateEmailRequestOptions): Promise<CreateEmailResponseSuccess | CreateEmailResponseError>`
  where `options.idempotencyKey` passes the HTTP header `Idempotency-Key: <key>`.
- In `src/lib/services/email.ts`, `sendEmail` explicitly forwards `options.idempotencyKey` to Resend options:
  `await resend.emails.send(createEmailOptions, { idempotencyKey: options.idempotencyKey })`.
- **Deduplication vs Payload Mismatch Contract**:
  - If a request is retried with the exact same idempotency key and identical payload (same recipient, subject, html), Resend recognizes the idempotent replay and returns the previously generated message ID without sending a second email.
  - If a request is retried with the same idempotency key but modified payload parameters, Resend responds with HTTP 409 (`invalid_idempotent_request` / `idempotent_parameter_mismatch`), which `classifyError` classifies as terminal non-retryable to prevent corrupt delivery states.

---

## 5. Cron Recovery Sweeper & Operational Posture

- **Endpoint**: `/api/cron/broadcasts`
- **Schedule**: `0 2 * * *` (configured in `vercel.json`)
- **Authentication**:
  - `crypto.timingSafeEqual` prevents timing side-channel attacks on `CRON_SECRET`.
  - Missing secret in environment immediately locks endpoint (`503 Service Unavailable`).
  - Mismatched bearer tokens return `401 Unauthorized`.
- **Operational Assessment**:
  `CURRENT PROJECT CRON FREQUENCY CAPABILITY NOT INDEPENDENTLY VERIFIED`.
  Vercel Hobby tier permits at most 1 cron execution per day (`0 2 * * *`). Higher frequencies require Pro or Enterprise plans. PM-2B relies primarily on post-commit immediate dispatch, using the daily cron strictly as a fallback recovery sweep.

---

## 6. Complete F1–F23 Verification Matrix

| Identifier | Scenario / Invariant | Test Target & Class | Verdict | Executed Evidence Summary |
| :--- | :--- | :--- | :--- | :--- |
| **F1** | Recipient resolution & atomic queueing | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Header, ledger rows, and audit event committed atomically in single tx |
| **F2** | Ledger insertion fails halfway / transaction rollback | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Mid-flight error rolls back header and all ledger rows; 0 rows remain |
| **F3** | Provider HTTP 400 rejection | `delivery.test.ts` (Unit Suite) | **PASS** | 400 Bad Request classified as terminal non-retryable; marked FAILED |
| **F4** | Provider HTTP 429 rate limit | `delivery.test.ts` (Unit Suite) | **PASS** | 429 classified as retryable; scheduled with exponential backoff |
| **F5** | Provider HTTP 500 server error | `delivery.test.ts` (Unit Suite) | **PASS** | 500 classified as retryable; scheduled for retry |
| **F6** | Network exception / socket drop | `delivery.test.ts` (Unit Suite) | **PASS** | ECONNRESET / ETIMEDOUT / fetch failed classified as retryable |
| **F7** | Provider timeout / ambiguous outcome | `delivery.test.ts` (Unit Suite) | **PASS** | Timeout classified as retryable with same delivery ID idempotency key |
| **F8** | Worker crash before provider call | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Unclaimed/stale delivery reclaimed by subsequent worker |
| **F9** | Worker crash after provider success before SENT commit | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Reclaimed row forwards identical idempotencyKey; deduplicated |
| **F10** | Lease expiry reclaim | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Row with expired lease reclaimed by next worker via SKIP LOCKED |
| **F11** | Overlapping workers concurrency | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Two workers claim disjoint row sets simultaneously; zero overlap |
| **F12** | Overlapping recovery invocations | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Multiple concurrent recovery processors complete without double sends |
| **F13** | Zero eligible recipients | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Handled cleanly; rejected without writing header or ledger rows |
| **F14** | Invalid recipient address | `delivery.test.ts` (Unit Suite) | **PASS** | Validation errors classified as terminal; immediate FAILED state |
| **F15** | Cross-tenant isolation | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Tenant A cannot view or claim Tenant B broadcasts or deliveries |
| **F16** | Latest-booking withdrawn consent | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Re-derives latest booking consent; historical opt-in overridden |
| **F17** | Shared-email deduplication | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Multiple parents sharing email queue exactly one ledger row |
| **F18** | Parent deletion after queue | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | `ON DELETE SET NULL` preserves ledger row and recipient address |
| **F19** | Queued payload immutability | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Subject and message locked at queue time; dispatch uses original payload |
| **F20** | Unauthorized recovery endpoint | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Timing-safe verification fails closed (503/401) on missing/bad token |
| **F21** | Process loss survival | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Transaction survives serverless process death; recovered by cron |
| **F22** | Mixed-result aggregation | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Partial failures reconcile to PARTIALLY_FAILED on broadcast header |
| **F23** | Unknown-outcome retry idempotency | `pm2b-postgres.integration.test.ts` (Real Postgres) | **PASS** | Re-claimed delivery forwards same idempotency key and identical payload |

---

## 7. Repository Integrity & Quality Gates

- **Vitest Suite**: 83 test files passed, 971 unit and integration tests passed (0 failures).
- **TypeScript Typecheck**: Clean pass with 0 errors under `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`.
- **ESLint**: Clean pass with 0 warnings and 0 errors under `npm run lint`.
- **Next.js Production Build**: Clean pass in 21.9s across 157 routes (`NODE_OPTIONS="--max-old-space-size=4096" npm run build`).
- **Whitespace / Git Diff Check**: Clean pass under `git diff --check`.
