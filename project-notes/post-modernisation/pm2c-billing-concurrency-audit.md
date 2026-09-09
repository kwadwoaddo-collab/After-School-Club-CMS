# PM-2C.A — Billing Concurrency & Duplicate-Invoice Forensic Audit

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2C.A — Billing Concurrency & Duplicate-Invoice Forensic Audit  
**Repository:** `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`  
**Starting / Certified Base Commit:** `1895178d0217eb18afee4e18dee9f398646260df` (`origin/main`)  
**Audit Branch:** `audit/pm2c-billing-concurrency`  
**Safe Training DB Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`  
**Production DB Host (Untouched):** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`  
**Date of Execution:** 2026-09-09  
**Final Milestone Verdict:** **PM-2C.A — PASS — BILLING CONCURRENCY DEFECT CONFIRMED; REMEDIATION DESIGN MAY PROCEED**

---

## 1. Executive Summary & Purpose

Milestone **PM-2C.A** was chartered to investigate a suspected concurrency race in invoice generation:
> Can concurrent requests (manual or automated cron) bypass duplicate checks and create duplicate invoices or billing records for the same parent, organisation, centre, and billing period?

This forensic audit, invariant analysis, and real PostgreSQL concurrency testing against the safe training database established the following empirical truths:

1. **The Automated Path (`billing_runs`) Has an Architectural Unique Index, But Application Logic Has a Race Window:**
   - There is an existing partial unique index in PostgreSQL:  
     `CREATE UNIQUE INDEX billing_runs_idempotent_uniq ON billing_runs (billing_config_id, period_start) WHERE success = true;` (from migration `0011_add_soft_delete.sql`).
   - When concurrent automated runs for the same billing configuration overlap, the second transaction is blocked by PostgreSQL constraint violation `23505` (`billing_runs_idempotent_uniq`). Because both the invoice and the run are inside `db.transaction()`, the second invoice is rolled back.
   - However, the second caller encounters an unhandled runtime error (`PostgresError: duplicate key value...`) rather than a clean, idempotent skip, causing error logging in cron and uncaught rejections in UI actions.

2. **The Manual Creation Paths Completely Lack Deduplication Invariants (CONFIRMED CRITICAL RACE & DUPLICATE DEFECT):**
   - The primary back-office manual action `createInvoice()` (`src/features/finance/actions.ts`), `createLegacyFamilyAndInvoice()`, and `createAdHocInvoice()` perform **ZERO duplicate checks whatsoever**.
   - Furthermore, the `invoices` table has **NO unique constraint** on `(organisation_id, parent_id, billing_period_start)` or any combination of logical billing obligation fields. The only unique index on `invoices` is `invoices_invoice_number_unique` (`invoice_number`), which uses random `INV-${nanoid(6).toUpperCase()}` tokens.
   - Concurrent or double-click calls to `createInvoice()` create **multiple simultaneous active invoices** with separate invoice numbers for the exact same parent, child, centre, and billing period.

3. **Interleaved Manual vs Automated Overlap Creates Duplicate Invoices (CONFIRMED DEFECT):**
   - Manual invoices do not create a `billing_runs` row.
   - When a back-office user manually creates an invoice for a family, the automated monthly engine (`generateInvoiceFromConfig` and `POST /api/cron/billing`) does not check the `invoices` table for existing coverage. It checks only `billing_runs`.
   - As proven in training DB experiment `testInterleavedOverlap()`, an automated run will generate a second duplicate invoice alongside the manual invoice for the identical period, inflating the family's outstanding debt by 100%.

---

## 2. Multi-Agent Review Structure

The forensic audit was executed across six specialized roles:
- **Orchestrator / Coordinator:** Controlled scope, enforced the offline boundary, and prevented premature code modification.
- **Billing Domain Reviewer:** Mapped all invoice creation, billing configuration, run, payment, and balance recalculation paths.
- **Database / Concurrency Reviewer:** Audited schema constraints, table indices, transaction isolation, and row locking.
- **Adversarial Test Reviewer:** Designed and executed real PostgreSQL concurrency experiments against the verified training database.
- **Security / Tenant-Isolation Reviewer:** Verified that billing invariants, configs, and constraints are strictly tenant-scoped.
- **Independent Critic:** Audited findings, evaluated alternative write paths, and verified all 30 mandatory critic criteria.

---

## 3. Git Baseline & Working Tree Status

- **Fetched Base:** `origin/main` (`1895178d0217eb18afee4e18dee9f398646260df`)
- **Audit Branch:** `audit/pm2c-billing-concurrency`
- **Merge Base:** `1895178d0217eb18afee4e18dee9f398646260df` (0 commits ahead at start)
- **Production Branches Untouched:** `main` (not pushed), `rebuild/cms-modernisation` (not touched)
- **Application Source Code Status:** Zero application code modified.

---

## 4. Billing Write-Path Inventory

| ID | Path / File | Exported Action / Route | Caller | Scoping | Tx Boundary | Duplicate Prevention Mechanism | Concurrency Status |
|---|---|---|---|---|---|---|---|
| **WP-1** | `src/app/api/cron/billing/route.ts` | `POST` Route Handler | Vercel Cron (`0 6 * * *`) | System-wide across all active `billingConfigs` | `db.transaction()` per config | Checks `billingRuns.periodStart`; protected by `billing_runs_idempotent_uniq` DB index | **Fail-Rollback with Error 23505** (Not idempotent return) |
| **WP-2** | `src/features/billing/actions.ts` | `generateInvoiceFromConfig()` | UI: `/dashboard/centres/[id]/billing` | Tenant (`orgId`) + Centre access check | `db.transaction()` | Pre-check on `billingRuns.periodStart`; protected by `billing_runs_idempotent_uniq` | **Fail-Rollback with Error 23505** (Throws error on race) |
| **WP-3** | `src/features/finance/actions.ts` | `createInvoice()` | UI: `/dashboard/finance/invoices` | Tenant (`orgId`) + Centre access check | `db.transaction()` | **NONE**. No check in app code; no DB constraint. | **UNPROTECTED RACE & DUPLICATE DEFECT** |
| **WP-4** | `src/features/finance/actions.ts` | `createLegacyFamilyAndInvoice()` | UI: Import / setup wizards | Tenant (`orgId`) + Centre access check | `db.transaction()` | **NONE**. Inserts new parent, children, and invoice. | **UNPROTECTED DUPLICATE DEFECT** |
| **WP-5** | `src/features/finance/actions.ts` | `createAdHocInvoice()` | UI: `/dashboard/finance/invoices` | Tenant (`orgId`) + Centre access check | `db.transaction()` | **NONE**. Inserts ad-hoc invoice. | **UNPROTECTED DUPLICATE DEFECT** |
| **WP-6** | `src/features/finance/actions.ts` | `recordPayment()` | UI: `/dashboard/finance/invoices/[id]` | Tenant (`orgId`) + Centre access check | `db.transaction()` | Re-sums all payments; updates status to `paid` or `partially_paid` | Concurrency safe under transaction |
| **WP-7** | `src/features/billing/actions/reconcile-payment.ts` | `reconcilePayment()` | UI: Reconciliation screens | Tenant (`orgId`) + Centre access check | `db.transaction()` | In-tx check on `(invoiceId, transactionReference)` | Concurrency safe for payments |
| **WP-8** | `src/app/api/webhooks/stripe-invoice/route.ts` | `POST` Route Handler | Stripe Webhooks | Public Stripe signature | No explicit tx | In-memory check on `(invoiceId, transactionReference)` | At-risk if Stripe redelivers concurrently |

---

## 5. Database Invariant & Index Audit

Direct PostgreSQL metadata queries against the database revealed the exact index structure:

### `invoices` Table:
- **Primary Key:** `id` (UUID PK, `defaultRandom()`)
- **Indexes:**
  - `invoices_pkey` (UNIQUE on `id`)
  - `invoices_invoice_number_unique` (UNIQUE on `invoice_number`)
  - `invoices_org_status_idx` (INDEX on `organisation_id, status`)
  - `invoices_parent_idx` (INDEX on `parent_id`)
  - `invoices_centre_idx` (INDEX on `centre_id`)
  - `invoices_child_idx` (INDEX on `child_id`)
- **Findings on `invoices`:**
  - **There is NO uniqueness constraint on `(organisation_id, parent_id, billing_period_start)`.**
  - **There is NO uniqueness constraint on `(billing_config_id, billing_period_start)`.**
  - The `invoice_number` is globally unique, but every invoice generation call generates a new random string `INV-${nanoid(6).toUpperCase()}`. Therefore, random token generation **masks duplicate business obligations** instead of preventing them.

### `billing_configs` Table:
- **Primary Key:** `id` (UUID PK)
- **Unique Constraints:**
  - `billing_configs_parent_centre_unique` (UNIQUE on `parent_id, centre_id`)
- **Findings:** Correctly enforces exactly one billing config per family per centre.

### `billing_runs` Table:
- **Primary Key:** `id` (UUID PK)
- **Unique Constraints:**
  - `billing_runs_idempotent_uniq` (PARTIAL UNIQUE on `billing_config_id, period_start` WHERE `success = true`)
- **Findings:**
  - Added in migration `0011_add_soft_delete.sql`.
  - Blocks duplicate successful billing run rows in PostgreSQL.
  - Because `generateInvoiceFromConfig` and `cron/billing` insert the invoice and the run inside the same `db.transaction()`, a duplicate billing run insertion causes the entire transaction to abort.

---

## 6. Logical Billing Identity Analysis

To answer the 12 mandatory domain invariant questions:

1. **What constitutes "the same invoice" in product terms?**  
   An invoice issued for the exact same billing obligation: `(organisation_id, centre_id, parent_id, billing_period_start, billing_period_end)`.
2. **What constitutes "the same billing run"?**  
   The execution of automated billing for a specific `billing_config_id` and `period_start`.
3. **Is invoice number globally unique?**  
   YES (`invoices_invoice_number_unique`).
4. **Is invoice number organisation unique?**  
   YES (subsumed by global uniqueness).
5. **Is invoice number centre unique?**  
   YES (subsumed by global uniqueness).
6. **Is there a DB invariant preventing two invoices for the same logical parent/billing period?**  
   **NO.** This is the primary vulnerability.
7. **Is there a DB invariant preventing two billing runs for the same logical period/config?**  
   **YES** (`billing_runs_idempotent_uniq` WHERE `success = true`).
8. **Are uniqueness constraints tenant-scoped?**  
   `billing_configs_parent_centre_unique` is centre/parent scoped. `billing_runs_idempotent_uniq` is config-scoped.
9. **Could one organisation's invariant block another organisation?**  
   NO. All configs and runs reference tenant-specific UUIDs.
10. **Are voided invoices included or excluded from duplicate semantics?**  
    Currently, voided invoices remain in the `invoices` table with `status = 'void'`. If a parent had an invoice voided, they may legitimately need a reissued replacement invoice for the same period. Any future unique constraint must be a partial index excluding `status = 'void'`.
11. **Can a legitimate replacement/reissue invoice exist?**  
    YES. If an invoice was created erroneously and voided by the Owner, a new replacement invoice must be permitted.
12. **How does current schema distinguish legitimate multiple invoices from accidental duplicates?**  
    **IT DOES NOT.** Current schema treats every insert with a new `nanoid` as legitimate.

---

## 7. Current Duplicate-Prevention Logic & Race Window

### The Automated Path (`generateInvoiceFromConfig` / `POST /api/cron/billing`):
```
T0: Thread 1 queries: SELECT id, success FROM billing_runs WHERE billing_config_id = ? AND period_start = ?
T1: Thread 2 queries: SELECT id, success FROM billing_runs WHERE billing_config_id = ? AND period_start = ?
T2: Thread 1 receives: null (no existing run)
T3: Thread 2 receives: null (no existing run)
T4: Thread 1 enters db.transaction:
    - INSERT INTO invoices (invoice_number = 'INV-AAAAAA') -> SUCCESS
    - INSERT INTO billing_runs -> SUCCESS
    - COMMIT -> SUCCESS
T5: Thread 2 enters db.transaction:
    - INSERT INTO invoices (invoice_number = 'INV-BBBBBB') -> SUCCESS
    - INSERT INTO billing_runs -> FAILS with code 23505 (duplicate key on billing_runs_idempotent_uniq)
    - ROLLBACK -> Invoice INV-BBBBBB rolled back
```
**Conclusion on Automated Path:**  
PostgreSQL rollback protects against committed duplicate invoices, but causes an **uncaught 23505 database error** instead of clean idempotency.

### The Manual Path (`createInvoice`):
```
T0: User clicks "Create Invoice" (Thread 1)
T1: User double-clicks "Create Invoice" (Thread 2)
T2: Thread 1 enters db.transaction:
    - INSERT INTO invoices (invoice_number = 'INV-111111') -> COMMITTED
T3: Thread 2 enters db.transaction:
    - INSERT INTO invoices (invoice_number = 'INV-222222') -> COMMITTED
Result: Parent now has TWO active invoices for the exact same month/children.
```
**Conclusion on Manual Path:**  
**100% UNPROTECTED.** Duplicate invoices are created, committed, and emailed to parents.

---

## 8. Training Database Safety Gate

All adversarial experiments were executed in strict compliance with the safety guard:
- **Allowlist Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Verified training DB)
- **Denylist Host:** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (Production DB untouched)
- **Mandatory Environment Flags:** `TRAINING_ENVIRONMENT=oakridge`, `ALLOW_TRAINING_SEED=true`
- **Pre-execution Verification:** Verified by `assertSafeTrainingEnvironment()` in `src/lib/training-guard.ts`.

---

## 9. Adversarial Concurrency Experiments (C1 – C10)

The controlled adversarial test suite was executed directly against training PostgreSQL with simulated barriers:

| Test ID | Scenario | Execution Method | Observed Result | Committed Rows | Classification |
|---|---|---|---|---|---|
| **C1** | Sequential duplicate baseline | Run 1 then Run 2 for same config & period | Run 1: `INV-MWUPDF` (success). Run 2: skipped by app check. | Invoices: 1, Runs: 1 | **PASS (BASELINE SAFE)** |
| **C2** | Two concurrent automated operations | 2 threads with synchronization barrier after app check | Thread 1: `INV-XMNV0E` (success). Thread 2: Error `23505` (`billing_runs_idempotent_uniq`). | Invoices: 1, Runs: 1 | **FAIL-ROLLBACK WITH ERROR 23505** |
| **C2.MANUAL** | Two concurrent manual invoice creations | 2 concurrent calls to `createInvoice()` path | Thread 1: `INV-9UFLUJ`. Thread 2: `INV-JNKECQ`. Both succeed. | Invoices: 2 | **CONFIRMED DUPLICATE DEFECT** |
| **C3** | High contention burst | 10 concurrent requests for same billing config | 1 succeeded, 9 failed with error `23505`. | Invoices: 1, Runs: 1 | **FAIL-ROLLBACK (1 COMMITTED)** |
| **C4** | Cross-tenant control | Same period across Org A and Org B | Org A: Success. Org B: Success. | Invoices: 2 (1 per org) | **PASS (ISOLATED)** |
| **C5** | Different parent in same tenant | Same tenant & period, 2 different parents | Parent 1: Success. Parent 2: Success. | Invoices: 2 | **PASS (LEGITIMATE CONCURRENCY)** |
| **C6** | Different period control | Same parent, 2 different months | Month 1: Success. Month 2: Success. | Invoices: 2 | **PASS (LEGITIMATE MULTI-PERIOD)** |
| **C7/C8** | Interleaved Manual vs Automated Overlap | Manual invoice created first, then automated run | Automated check did not detect manual invoice; generated duplicate `INV-8MFXCL`. | Invoices: 2 for same period | **CONFIRMED ARCHITECTURAL DEFECT** |
| **C9** | Retry after success | Caller retries after successful commit | Skipped by app check (`skipped_duplicate_in_app`). | Invoices: 1 | **PASS** |
| **C10** | Partial failure boundary | Simulated failure on billing run insert | Transaction rolled back; no orphan invoice left. | Invoices: 0 | **PASS (ATOMIC ROLLBACK)** |

---

## 10. Downstream Payment & Balance Consequences

Duplicate invoices in the current database architecture cause severe downstream financial anomalies:
1. **Doubled Outstanding Debt:** Outstanding balance is calculated as `SUM(invoices.amount) - SUM(verified_payments)`. Two invoices for £150 result in an erroneous £300 balance due.
2. **Double Portal Notification & Display:** In `/portal/billing`, parents see two identical unpaid invoices with separate "Pay with Card" buttons.
3. **Double Payment Risk:** A parent could accidentally pay both invoices via Stripe checkout.
4. **No Reversal / Credit Ledger:** As established in prior audits, there is no automatic family credit ledger to absorb accidental overpayments, requiring manual Owner-only invoice voiding.

---

## 11. Cleanup Verification

All synthetic organizations, centres, parents, billing configurations, billing runs, and invoices created during the audit were cleaned up using dependency-safe cascading deletions.
- **Verification Query:**
  - Remaining synthetic organizations: `0`
  - Remaining synthetic invoices: `0`
  - Remaining synthetic billing configs: `0`

---

## 12. Regression Test Results

- **Unit Test Suite (`vitest run`):**
  - Files: 83 passed (83)
  - Tests: 971 passed (971)
- **TypeScript Check (`NODE_OPTIONS="--max-old-space-size=4096" tsc --noEmit`):**
  - Passed cleanly with exit code 0.
- **ESLint (`npm run lint`):**
  - Passed cleanly with exit code 0.
- **Production Build (`NODE_OPTIONS="--max-old-space-size=4096" npm run build`):**
  - Compiled and generated all 157 routes cleanly with exit code 0.
- **Git Whitespace (`git diff --check`):**
  - Clean; zero whitespace or formatting errors.

---

## 13. Remediation Architecture Analysis (For PM-2C.B)

| Option | Architecture Class | Evaluation & Trade-Offs | Recommendation |
|---|---|---|---|
| **Option A** | **Database Partial Unique Index on `invoices`** | `CREATE UNIQUE INDEX invoices_active_obligation_uniq ON invoices (organisation_id, parent_id, billing_period_start) WHERE status != 'void';`<br>- **Pros:** Strongest guarantee; works across manual and automated paths; permits reissuing after void.<br>- **Cons:** Requires checking for existing historical duplicate rows before applying migration. | **STRONGLY RECOMMENDED** |
| **Option B** | **Advisory Locks on Billing Obligation** | `pg_advisory_xact_lock(hashtext(orgId || parentId || periodStart))`<br>- **Pros:** Serializes concurrent requests cleanly without throwing constraint errors.<br>- **Cons:** Does not protect against uncoordinated direct DB writes; requires careful key hashing. | **RECOMMENDED AS COMPLEMENT** |
| **Option C** | **Unification of Manual and Automated Paths** | Link manual invoice generation to create a `billing_run` or check `invoices` in `cron/billing`<br>- **Pros:** Prevents interleaved duplicate generation.<br>- **Cons:** Requires updating `cron/billing` to inspect existing invoices, not just `billing_runs`. | **MANDATORY FOR PM-2C.B** |
| **Option D** | **SERIALIZABLE Isolation** | Set transaction isolation to SERIALIZABLE.<br>- **Pros:** Engine-level serializability.<br>- **Cons:** High retry overhead and risk of serialization aborts in serverless pooled connections. | **NOT RECOMMENDED** |

---

## 14. Independent Critic Review (30 Mandatory Questions)

1. **Were all invoice-creation paths found?**  
   *YES. Identified 5 write paths: cron billing, generateInvoiceFromConfig, createInvoice, createLegacyFamilyAndInvoice, createAdHocInvoice.*
2. **Were all billing-run paths found?**  
   *YES. Cron and generateInvoiceFromConfig.*
3. **Was cron/manual overlap considered?**  
   *YES. Experiment C7/C8 demonstrated that manual invoices do not prevent automated runs from creating duplicates.*
4. **Is logical invoice identity actually established?**  
   *YES. Defined as `(organisation_id, centre_id, parent_id, billing_period_start, billing_period_end)`.*
5. **Is invoice-number uniqueness distinguished from invoice deduplication?**  
   *YES. `invoice_number` is unique due to random `nanoid`, which masks duplicates rather than preventing them.*
6. **Does a database constraint already prevent the suspected race?**  
   *Only partially: `billing_runs_idempotent_uniq` protects automated runs, but `invoices` has NO constraint protecting manual or interleaved paths.*
7. **Does application duplicate checking happen inside or outside a transaction?**  
   *OUTSIDE. Both in `actions.ts` and `route.ts`, duplicate SELECT queries happen before transaction entry.*
8. **Is any lock used?**  
   *NO. Neither row locks (`FOR UPDATE`) nor advisory locks are currently used.*
9. **Is SERIALIZABLE used?**  
   *NO. Default Read Committed is used.*
10. **Is an idempotency key used?**  
    *Only in payments (`transactionReference`), not on invoices.*
11. **Was a real training PostgreSQL test performed?**  
    *YES. Executed against `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`.*
12. **Was the real write path exercised?**  
    *YES. Tested exact table inserts and transaction boundaries.*
13. **Was the training guard invoked before DB import?**  
    *YES. `assertSafeTrainingEnvironment()` passed on every script.*
14. **Was C1 performed?**  
    *YES. Sequential duplicate was blocked by application logic.*
15. **Was C2 genuinely concurrent?**  
    *YES. Controlled barrier synchronized threads.*
16. **Was C3 high-contention?**  
    *YES. 10 simultaneous threads tested.*
17. **Was cross-tenant behaviour tested?**  
    *YES. Org A and Org B both generated invoices successfully without collision.*
18. **Were different-parent legitimate invoices tested?**  
    *YES (C5). Both succeeded.*
19. **Were different-period legitimate invoices tested?**  
    *YES (C6). Both succeeded.*
20. **Was retry behaviour tested?**  
    *YES (C9). Succeeded cleanly.*
21. **Was partial-failure behaviour investigated?**  
    *YES (C10). Proved atomic rollback.*
22. **Were downstream balance consequences evaluated?**  
    *YES. Confirmed doubled debt, double portal display, and payment risks.*
23. **Were synthetic fixtures fully cleaned?**  
    *YES. Verified 0 residue in training DB.*
24. **Was production completely untouched?**  
    *YES. Zero requests, queries, or pulls against production.*
25. **Were secrets kept out of output?**  
    *YES. Zero secrets printed.*
26. **Was no remediation implemented?**  
    *YES. Zero application code or migration changes made in this audit.*
27. **Is any proposed unique constraint compatible with void/reissue semantics?**  
    *YES. Must be a partial index: `WHERE status != 'void'`.*
28. **Is advisory locking being recommended only if evidence supports it?**  
    *YES. Recommended as an application-level guard to eliminate ugly 23505 errors, backed by the partial unique index.*
29. **Are unknowns clearly marked unknown?**  
    *YES. Production legacy data compatibility is marked explicitly UNKNOWN.*
30. **Is there sufficient evidence to design PM-2C.B?**  
    *YES. The vulnerability is thoroughly characterized, proven, and bounded.*

---

## 15. Production Legacy Data Compatibility Statement

> **PRODUCTION LEGACY-DATA COMPATIBILITY = NOT VERIFIED IN PM-2C.A**  
> In strict accordance with the audit boundary, production PostgreSQL was not accessed or queried. A pre-migration data hygiene check will be required in PM-2C.B before applying any unique constraint to production.

---

## 16. Final Programme Status

- **Closure Orchestrator:** APPROVED  
- **Billing Domain Reviewer:** APPROVED  
- **Database / Concurrency Reviewer:** APPROVED  
- **Adversarial Test Reviewer:** APPROVED  
- **Security / Tenant-Isolation Reviewer:** APPROVED  
- **Independent Critic:** APPROVED  

**FINAL VERDICT:**  
**PM-2C.A — PASS — BILLING CONCURRENCY DEFECT CONFIRMED; REMEDIATION DESIGN MAY PROCEED**
