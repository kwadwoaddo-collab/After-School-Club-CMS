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
- **Permanent Failures** (`invalid_email`, `domain_not_verified`, unconfigured provider): Terminated immediately into `FAILED` state without wasting retries.
- **Provider Success / Crash Recovery**: Resend idempotency key ensures that re-claiming a delivery record that succeeded at Resend but crashed before local DB commit returns the existing Resend message ID without re-sending the message.

---

## 4. Cron Recovery Sweeper & Security

- **Endpoint**: `/api/cron/broadcasts`
- **Schedule**: `0 2 * * *` (configured in `vercel.json`)
- **Authentication**:
  - `crypto.timingSafeEqual` prevents timing side-channel attacks on `CRON_SECRET`.
  - Missing secret in environment immediately locks endpoint (`503 Service Unavailable`).
  - Mismatched bearer tokens return `401 Unauthorized`.

---

## 5. Verification Matrix (F1–F23)

| Requirement | Test Suite & Target | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **F1: Transactional Outbox** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Header, ledger rows, and audit event committed atomically |
| **F3: Recipient Deduplication** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Unique index rejects duplicate parent email per broadcast |
| **F4: Latest-Booking Consent** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Evaluates latest booking consent (`ORDER BY createdAt DESC, id DESC`) |
| **F5/F6: Worker Leasing** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Concurrent workers claim disjoint rows via `FOR UPDATE SKIP LOCKED` |
| **F8: Multi-Tenant Ledger Isolation** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | `getBroadcastDeliveryStats` strictly tenant-scoped |
| **F18: Parent Soft-Deletion Safety** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | `ON DELETE SET NULL` preserves ledger and recipient email |
| **F21: Serverless Process Loss Survival** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Queue succeeds and persists even when dispatcher throws mid-flight |
| **F22: Aggregate Status Reconciliation** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Mixed outcomes reconcile to `PARTIALLY_FAILED` on header |
| **F23: Ambiguous Provider Success Recovery** | Real PostgreSQL (`pm2b-postgres.integration.test.ts`) | **PASS** | Stale delivery reclaimed with exact same `idempotencyKey` |

---

## 6. Repository Integrity & Quality Gates

- **Vitest Suite**: 83 test files passed, 960 unit and integration tests passed (0 failures).
- **TypeScript Typecheck**: Clean pass with 0 errors under `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`.
- **ESLint**: Clean pass with 0 warnings and 0 errors under `npm run lint`.
- **Next.js Production Build**: Clean pass in 21.2s across 157 routes (`NODE_OPTIONS="--max-old-space-size=4096" npm run build`).
- **Whitespace / Git Diff Check**: Clean pass under `git diff --check`.
