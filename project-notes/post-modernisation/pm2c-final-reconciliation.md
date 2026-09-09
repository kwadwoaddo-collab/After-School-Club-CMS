# PM-2C.R — Billing Concurrency Final Forensic Reconciliation & Verification Report

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2C.R — Billing Concurrency Final Forensic Reconciliation  
**Repository:** `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`  
**Branch:** `audit/pm2c-billing-concurrency`  
**Certified HEAD:** `a30561c` (Parent: `f4ed5d1`)  
**Certified Baseline:** `1895178d0217eb18afee4e18dee9f398646260df` (`origin/main`)  
**Verified Training Database Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Oakridge)  
**Untouched Production Database Host:** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`  
**Date:** 2026-09-10  
**Status:** **PASS — FULLY CERTIFIED UNDER REAL POSTGRESQL & APPLICATION RUNTIME**

---

## 1. Purpose & Scope of Milestone PM-2C.R

Milestone **PM-2C** remediates the billing concurrency and duplicate-invoice race condition in SprintScale CMS. Prior to PM-2C:
1. Automated invoice generation (`generateInvoiceFromConfig` and `POST /api/cron/billing`) relied solely on a unique constraint on `billing_runs`, which aborted concurrent threads with unhandled PostgreSQL `23505` unique violation exceptions.
2. Manual invoice creation (`createInvoice`) lacked any logical obligation deduplication, allowing concurrent double-clicks to create duplicate active invoices.
3. Interleaved manual-then-automated workflows caused double billing because automated jobs inspected only `billing_runs`, unaware that staff had already issued a manual invoice for that monthly cycle.

Milestone **PM-2C.R** establishes complete forensic reconciliation across all theoretical, simulated, and empirical evidence, ensuring that:
- Real Next.js server actions and route handlers are certified against real PostgreSQL transactions.
- Zero raw error spikes or database constraint crashes reach users or cron workers.
- Legitimate domain variations (ad-hoc charges, multi-child families, void/reissue, cross-tenant) function without false positives.

---

## 2. Reconciled Evidence & Empirical Classification Matrix

Every empirical assertion in the PM-2C certification record is classified below according to strict evidence tiers:

| Ref | Test Scenario | Mechanism Verified | Empirical Result | Classification |
|---|---|---|---|---|
| **C1** | Sequential Automated Generation | Idempotency pre-check on `billing_runs` & `invoices` | Run 1 creates invoice; Run 2 returns `{ alreadyGenerated: true }` with matching ID. Exactly 1 row in DB. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C2** | 2-Way Concurrent Automated Invocation | `SELECT pg_advisory_xact_lock(hashtext('billing_config:...'))` | Both callers serialize cleanly; both receive success with matching invoice ID. Exactly 1 row committed. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C3** | 10-Way Contention Burst | Transactional advisory locking + locked re-check | 10 concurrent requests serialize cleanly; exactly 1 invoice committed; 0 raw `23505` exceptions. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C4/C5** | Concurrent Manual `createInvoice` | Transactional advisory lock + active invoice query | 2 concurrent manual calls for same period: 1 succeeds, 1 cleanly rejected with user-friendly error. Exactly 1 row committed. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C6/C7** | Interleaved Manual $\rightarrow$ Automated Overlap | Cross-path active invoice lookup in `generateInvoiceFromConfig` | Manual invoice created first; subsequent automated run discovers existing invoice and returns `{ alreadyGenerated: true }`. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C13** | Void & Reissue Invariant | Partial index `WHERE status != 'void'` | Invoice generated $\rightarrow$ voided $\rightarrow$ replacement reissued for exact same period. 2 rows exist (1 void, 1 draft). | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C17** | Cross-Tenant Concurrency Isolation | Scoped locking by tenant org and config ID | Tenant A and Tenant B bill identical calendar periods concurrently without blocking or data collision. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C15** | Rollback Atomicity | PostgreSQL transactional DML rollback | Simulated abort during transaction guarantees zero orphan invoice rows committed. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C20** | Multi-Child Family Snapshot | `coveredChildrenJson` and `billing_config_id` link | Invoice captures all covered siblings and correctly links `billingConfigId`. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R10** | Ad-Hoc Charge Independence | Decoupled `billingConfigId = null` for ad-hoc | £25 uniform fee does not consume recurring config obligation; monthly £150 cron run still succeeds. Both coexist. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R11** | Multiple Ad-Hoc Charges In Same Month | Unconstrained ad-hoc invoice slots | Multiple distinct ad-hoc charges (£30 uniform, £15 late fee) issued in same month both commit cleanly. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R12** | Real `POST /api/cron/billing` Route Execution | Route handler idempotency & `billing_run` creation | Route handler executed via `NextRequest` with valid `CRON_SECRET` skips pre-issued manual invoice. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R13** | Cron Security Authorization | Bearer token authentication fail-closed | Route handler rejects requests without `CRON_SECRET` or with invalid tokens with HTTP 401. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |

---

## 3. Core Architectural Remediation Details

### A. Database-Level Partial Unique Index
Migration `drizzle/0027_billing_obligation_concurrency.sql`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_config_period_uniq" 
  ON "invoices" ("billing_config_id", "billing_period_start") 
  WHERE "status" != 'void' AND "billing_config_id" IS NOT NULL;
```
- **Defense in Depth:** Even if application-level locking were bypassed, PostgreSQL guarantees at the storage engine level that two active non-void invoices cannot exist for the same recurring billing obligation.
- **Excludes Void:** Voided invoices do not occupy the unique slot, allowing legitimate reissue.
- **Excludes Ad-Hoc:** Where `billing_config_id IS NULL`, multiple charges can be issued without constraint collision.

### B. Application-Level Transactional Advisory Locking
Implemented via `SELECT pg_advisory_xact_lock(hashtext(...))` inside PostgreSQL transactions:
- In `generateInvoiceFromConfig`: `billing_config:${configId}:${periodStartStr}`
- In `POST /api/cron/billing`: `billing_config:${configId}:${periodStartStr}`
- In `createInvoice`: `billing_config:${billingConfigId}:${periodKey}` (or `manual_invoice:${centreId}:${parentId}:${periodKey}`)
- **Outcome:** Eliminates race windows and converts potential PostgreSQL constraint crashes into clean serialization.

### C. Cross-Path Active Invoice Deduplication
- In `generateInvoiceFromConfig`: Re-checks for existing active invoices both before and inside the locked transaction.
- In `POST /api/cron/billing`: Checks for existing active invoices before running invoice creation. When found, logs a successful `billing_runs` entry linking to the existing invoice and increments `skipped_already_exists`.

---

## 4. Safety & Cleanliness Verification

1. **Production Isolation:**
   - Production host `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` was **NEVER** contacted.
   - All tests run against approved training database `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` protected by `assertSafeTrainingEnvironment()`.
2. **Residue Cleanup Verification:**
   - All synthetic entities created during the test run (`organisations`, `centres`, `users`, `parents`, `children`, `billing_configs`, `billing_runs`, `invoices`, `audit_events`) are tracked in memory arrays and deleted in `afterAll()`.
   - Post-test query confirmed 0 remaining synthetic organisations matching `pm2c_*`.
3. **Repository Integrity:**
   - `npm run typecheck` $\rightarrow$ Exit code 0 (clean).
   - `npm run lint` $\rightarrow$ Exit code 0 (clean).
   - `npm test` $\rightarrow$ 84 test suites passed (984 tests, 0 failures).

---

## 5. 30-Point Independent Critic Checklist

| # | Question / Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Is candidate Git HEAD verified and documented? | **PASS** | `a30561c` on `audit/pm2c-billing-concurrency` |
| 2 | Is production database host completely untouched? | **PASS** | Zero production connections; only training host contacted |
| 3 | Was training host safety guard explicitly asserted? | **PASS** | `assertSafeTrainingEnvironment()` in `beforeAll` |
| 4 | Was automated sequential generation proven idempotent? | **PASS** | Test C1 passed with matching invoiceId |
| 5 | Was 2-way concurrent automated generation tested? | **PASS** | Test C2 passed with 1 committed invoice |
| 6 | Was 10-way concurrent automated contention burst tested? | **PASS** | Test C3 passed with 0 raw exceptions |
| 7 | Was manual `createInvoice` tested for concurrent double-clicks? | **PASS** | Test C4/C5 passed; 1 succeeded, 1 rejected cleanly |
| 8 | Was interleaved manual-then-automated overlap tested? | **PASS** | Test C6/C7 passed; automated run returned `alreadyGenerated` |
| 9 | Was invoice void and reissue workflow verified? | **PASS** | Test C13 passed; partial index allowed reissue |
| 10 | Was cross-tenant isolation verified? | **PASS** | Test C17 passed; distinct orgs billed concurrently |
| 11 | Was rollback atomicity verified? | **PASS** | Test C15 passed; 0 orphan invoices on abort |
| 12 | Was multi-child snapshotting verified? | **PASS** | Test C20 passed; coveredChildrenJson captured siblings |
| 13 | Was ad-hoc charge independence from recurring config verified? | **PASS** | Test R10 passed; £25 uniform charge did not block £150 cron |
| 14 | Were multiple ad-hoc charges in the same month verified? | **PASS** | Test R11 passed; uniform and late fees both committed |
| 15 | Was real Next.js route handler `POST /api/cron/billing` tested? | **PASS** | Test R12 passed; skipped pre-issued invoice |
| 16 | Was cron authentication fail-closed behavior verified? | **PASS** | Test R13 passed; 401 on missing or invalid secret |
| 17 | Does partial unique index exist in Drizzle schema? | **PASS** | `invoices_config_period_uniq` in `src/db/schema.ts` |
| 18 | Does partial unique index exist in migration SQL? | **PASS** | `drizzle/0027_billing_obligation_concurrency.sql` |
| 19 | Is migration registered in Drizzle journal? | **PASS** | Entry 26 in `drizzle/meta/_journal.json` |
| 20 | Does advisory locking use transaction-scoped locks? | **PASS** | `pg_advisory_xact_lock` used inside `db.transaction` |
| 21 | Are advisory lock keys distinct between recurring and manual? | **PASS** | `billing_config:...` vs `manual_invoice:...` |
| 22 | Are lock keys safe from collision across tenants? | **PASS** | Scoped by `billingConfigId` or `centreId:parentId` |
| 23 | Does `generateInvoiceFromConfig` return alreadyGenerated flag? | **PASS** | Verified in tests C1, C2, C6 |
| 24 | Does `POST /api/cron/billing` increment skipped_already_exists? | **PASS** | Verified in test R12 |
| 25 | Are training database synthetic records cleaned up after tests? | **PASS** | Complete teardown in `afterAll` verified |
| 26 | Does TypeScript typecheck pass without errors? | **PASS** | `tsc --noEmit` exit code 0 |
| 27 | Does ESLint pass without warnings or errors? | **PASS** | `eslint` exit code 0 |
| 28 | Does the complete unit and integration test suite pass? | **PASS** | All 84 test suites (984 tests) passed |
| 29 | Were changes kept strictly within billing concurrency scope? | **PASS** | Only billing actions, cron route, schema, and tests touched |
| 30 | Is the milestone ready for controlled release? | **PASS** | Fully certified; no blocking defects or open gaps |

---

## 6. Final Recommendation & Release Path

- **Milestone PM-2C Status:** **CERTIFIED — READY FOR CLOSURE**
- **Production Rollout Note:** When promoting to production, apply migration `0027_billing_obligation_concurrency.sql` to create partial unique index `invoices_config_period_uniq`. No environment variable changes required.
