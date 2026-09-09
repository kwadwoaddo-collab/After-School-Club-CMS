# PM-2C — Billing Concurrency Remediation & Adversarial Certification Report

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2C — Billing Concurrency & Duplicate-Invoice Remediation  
**Repository:** `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`  
**Certified Baseline:** `1895178d0217eb18afee4e18dee9f398646260df` (`origin/main`)  
**Working Branch:** `audit/pm2c-billing-concurrency`  
**Safe Training DB Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`  
**Production DB Host (Untouched):** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`  
**Date:** 2026-09-09 / 2026-09-10  
**Final Milestone Verdict:** **PM-2C — PASS — CERTIFIED FOR CONTROLLED RELEASE**

---

## 1. Executive Summary

Milestone **PM-2C** remediated a confirmed concurrency vulnerability in the billing and invoice creation system where:
1. Automated recurring invoice generation (`generateInvoiceFromConfig` and `POST /api/cron/billing`) relied on unique constraint `billing_runs_idempotent_uniq` which prevented duplicate database rows but caused unhandled PostgreSQL `23505` constraint errors to crash callers and inflate cron failure counters.
2. Manual invoice creation (`createInvoice`) had **zero** deduplication checks and the `invoices` table lacked any unique index on logical billing obligations. Concurrent or sequential double-clicks generated multiple simultaneously active invoices for the exact same family and period.
3. Interleaved manual-then-automated invoice creation resulted in double billing because automated jobs inspected only `billing_runs` rather than existing active `invoices`.

Through **PM-2C.B** (Remediation Implementation) and **PM-2C.C** (Adversarial Concurrency Certification against real training PostgreSQL), this vulnerability has been completely resolved.

---

## 2. Remediation Architecture (PM-2C.B)

### A. Database-Level Partial Unique Index
- Created migration `drizzle/0027_billing_obligation_concurrency.sql` and registered it as entry 26 in `drizzle/meta/_journal.json`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "invoices_config_period_uniq" 
    ON "invoices" ("billing_config_id", "billing_period_start") 
    WHERE "status" != 'void' AND "billing_config_id" IS NOT NULL;
  ```
- **Key Invariants:**
  - Enforces at the database engine level that no two non-void invoices can exist for the same recurring `billing_config_id` and `billing_period_start`.
  - Excludes `status = 'void'`, strictly preserving legitimate administrative void/reissue workflows.
  - Leaves ad-hoc charges (where `billing_config_id IS NULL`) unconstrained so that legitimate supplementary fees (uniforms, late fees, holiday camps) are not blocked.

### B. Transactional Advisory Locking
- Implemented `SELECT pg_advisory_xact_lock(hashtext('billing_config:' || configId || ':' || periodStartStr))` inside `db.transaction()` across:
  - `generateInvoiceFromConfig` (`src/features/billing/actions.ts`)
  - `POST /api/cron/billing` (`src/app/api/cron/billing/route.ts`)
  - `createInvoice` (`src/features/finance/actions.ts`)
- Advisory locks serialize concurrent threads attempting to generate an invoice for the exact same billing configuration and billing period before attempting an insert, eliminating lock contention exceptions and raw `23505` error spikes.

### C. Clean Idempotent Returns
- Both before entering the transaction and inside the locked transaction, `generateInvoiceFromConfig` checks for existing `billing_runs` and existing active `invoices`.
- When an invoice has already been generated (either by an interleaved manual action or a competing thread), it cleanly returns `{ success: true, invoiceId: existing.id, alreadyGenerated: true }` rather than throwing a runtime error.

### D. Cross-Path Unification
- In `createInvoice`, if the family has an active `billing_config`, the new invoice is linked via `billingConfigId`. If `billingPeriodStart` is passed, it acquires the scoped advisory lock and verifies that no active invoice exists for that parent, centre, and period.
- In `POST /api/cron/billing`, before generating an invoice, the job checks both `billing_runs` and `invoices`. If an active invoice already exists (e.g. manually issued by an administrator), it registers a successful `billing_runs` entry linking to the existing invoice and cleanly increments `skipped_already_exists`.

---

## 3. Real PostgreSQL Adversarial Certification (PM-2C.C)

A dedicated integration test suite (`src/features/billing/pm2c-concurrency.integration.test.ts`) was executed directly against the approved training PostgreSQL database (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`).

All 13 adversarial concurrency scenarios passed:
1. **C1 (Sequential Automated Generation):**
   - Run 1 generates invoice `INV-...`.
   - Run 2 returns `{ success: true, alreadyGenerated: true, invoiceId: same }`. Exactly 1 invoice in DB.
2. **C2 (2-Way Concurrent Automated Invocation):**
   - 2 concurrent threads execute `generateInvoiceFromConfig` simultaneously.
   - Advisory lock serializes execution; both threads succeed and return the identical invoice ID. Exactly 1 invoice committed.
3. **C3 (10-Way Contention Burst):**
   - 10 concurrent requests fire simultaneously for the same billing config and period.
   - Exactly 1 invoice committed in DB; all 10 return success with 0 raw exceptions.
4. **C4/C5 (Concurrent Manual `createInvoice`):**
   - 2 concurrent manual calls for the same parent, centre, and period.
   - 1 succeeds; 1 is rejected cleanly with "An active invoice already exists for this family and billing period". Exactly 1 invoice committed.
5. **C6/C7 (Interleaved Manual then Automated Overlap):**
   - Manual invoice created first for period.
   - Subsequent automated generation detects the existing invoice and returns `{ alreadyGenerated: true }`. Exactly 1 invoice committed.
6. **C13 (Void & Reissue Invariant):**
   - Invoice generated $\rightarrow$ voided $\rightarrow$ reissued for the exact same period.
   - Succeeded with 2 invoices in DB: 1 with `status = 'void'`, 1 with `status = 'draft'`.
7. **C17 (Cross-Tenant Isolation):**
   - Tenant A and Tenant B both bill the identical period simultaneously.
   - Both succeed independently with distinct invoices and tenant IDs.
8. **C15 (Rollback Atomicity):**
   - Simulated transaction abort after invoice insert.
   - PostgreSQL aborts atomically; exactly 0 orphan invoices remain in DB.
9. **C20 (Multi-Child Family Snapshot):**
   - Config with 2 siblings generates an invoice capturing both children in `coveredChildrenJson` and properly populates `billingConfigId`.
10. **R10 (Ad-Hoc Independence Invariant):**
    - Ad-hoc manual fee (£25 uniform charge) with `billingConfigId = null` does not consume the recurring billing config obligation, allowing automated generation for agreed £150 fee to succeed cleanly. Both invoices coexist.
11. **R11 (Multiple Ad-Hoc Invoices In Same Month):**
    - Two separate legitimate ad-hoc charges (£30 uniform, £15 late fee) issued for the same family in the same billing period both succeed without collision.
12. **R12 (Real `POST /api/cron/billing` Route Execution):**
    - Full Next.js Route Handler invocation with valid `Bearer CRON_SECRET` detects pre-existing manual invoice, skips duplicate generation, records `billing_run`, and increments `skipped_already_exists`.
13. **R13 (Cron Security Authorization Rejection):**
    - `POST /api/cron/billing` verifies authentication fail-closed behavior, rejecting unauthenticated and invalid-secret requests with HTTP 401.

---

## 4. Training Database Cleanup Verification

Post-test audit verified:
- `SELECT count(*) FROM organisations WHERE name LIKE 'Synthetic Org pm2c_%'` $\rightarrow$ `0`
- `SELECT count(*) FROM invoices WHERE invoice_number LIKE 'INV-ABORT-%'` $\rightarrow$ `0`
- Zero orphan records remain in the training database.

---

## 5. Security & Quality Assurance Verification (PM-2C.D)

- **TypeScript Compilation:** `tsc --noEmit` passed with exit code 0.
- **Unit Test Suite:** All 84 test suites (984 tests) passed cleanly with exit code 0.
- **Linter:** `npm run lint` passed cleanly with exit code 0.
- **Git Format:** `git diff --check` passed with 0 errors.

---

## 6. Files Changed in PM-2C

1. `drizzle/0027_billing_obligation_concurrency.sql` (NEW migration)
2. `drizzle/meta/_journal.json` (Registered migration 0027)
3. `src/db/schema.ts` (Added `invoices_config_period_uniq` unique index definition)
4. `src/features/billing/actions.ts` (Advisory lock + deduplication checks + idempotent return in `generateInvoiceFromConfig`)
5. `src/app/api/cron/billing/route.ts` (Advisory lock + cross-path existing invoice check in billing cron)
6. `src/features/finance/actions.ts` (Advisory lock + recurring period deduplication + billing config link in `createInvoice`)
7. `src/features/finance/actions.test.ts` (Added `billingConfigs` query mock)
8. `src/features/billing/pm2c-concurrency.integration.test.ts` (NEW real PostgreSQL integration test suite)
9. `project-notes/post-modernisation/pm2c-billing-concurrency-remediation.md` (This document)

---

## 7. Recommendation & Production Rollout Instructions

When deploying PM-2C to production:
1. Ensure `drizzle/0027_billing_obligation_concurrency.sql` is applied via database migration tooling or standard CI/CD deployment pipeline.
2. Verify production database host before running migration.
3. No environment variables need changing.
