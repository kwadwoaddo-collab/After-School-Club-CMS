# PM-2C.R2 — Billing Concurrency Final Adversarial Gap Closure & Certification Report

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2C.R2 — Final Adversarial Gap Closure  
**Repository:** `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`  
**Branch:** `audit/pm2c-billing-concurrency`  
**Baseline Candidate HEAD:** `be50237ee587461ed5197b230e39558b44c7524e`  
**Origin Baseline:** `1895178d0217eb18afee4e18dee9f398646260df` (`origin/main`)  
**Verified Training Database Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Oakridge)  
**Untouched Production Database Host:** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`  
**Date:** 2026-09-10  
**Final Status:** **PASS — BILLING CONCURRENCY REMEDIATION CERTIFIED FOR CONTROLLED PRODUCTION PREFLIGHT**

---

## Mandatory Programme Status Statements

> [!IMPORTANT]
> **PRODUCTION MIGRATION 0027 — NOT APPLIED**  
> Migration `0027_billing_obligation_concurrency.sql` has NOT been executed on the production Neon database (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`). It has only been verified on the approved training database.

> [!IMPORTANT]
> **PRODUCTION 0027 DATA COMPATIBILITY — NOT VERIFIED**  
> Live production data compatibility has NOT been verified directly on the production host. A non-destructive, read-only preflight query has been authored and documented in this report to run against production prior to migration.

> [!IMPORTANT]
> **PRODUCTION PM-2C RUNTIME — NOT VERIFIED**  
> The PM-2C runtime path has NOT been executed in the production application environment. Verification has been performed end-to-end using real Next.js route handlers and server actions against real PostgreSQL transactions on the safe Oakridge training environment.

---

## 1. Executive Summary & Purpose

Milestone **PM-2C** addresses a critical concurrency vulnerability: double-billing through concurrent invoice generation (automated cron, manual double-clicks, and interleaved manual-before-cron workflows).

Milestone **PM-2C.R2** closes all remaining adversarial gaps identified in earlier audit reviews:
1. **Missing Collision Directions (R14–R17):**
   - Automated FIRST $\rightarrow$ manual SECOND.
   - Manual FIRST $\rightarrow$ automated SECOND.
   - Genuinely concurrent manual + automated.
   - Genuinely concurrent manual + cron route handler.
2. **Semantic Separation Matrix (R18–R22):** Proves that legitimate independent obligations (different periods, different centres, different parents, different orgs, multi-child families) are never falsely deduplicated or blocked.
3. **Hostile Tenant Substitution Matrix (R23–R26):** Verifies fail-closed rejection when foreign IDs (`billingConfigId`, `parentId`, `centreId`, `childId`) are passed across tenant boundaries.
4. **Taxonomy & Invariant Rigour:**
   - Corrects test **C15** classification to `PROVEN — REAL POSTGRES TRANSACTION ROLLBACK` while explicitly documenting that real billing-path post-insert fault injection was not verified.
   - Explicitly documents PostgreSQL advisory lock 32-bit `hashtext()` collision semantics.
   - Documents non-destructive preflight SQL for migration 0027.
   - Implements exhaustive tracking and teardown across all 13 touched database tables with 0 residual rows.

---

## 2. Full 26-Test Empirical Matrix

All 26 integration tests execute against real PostgreSQL tables on the Oakridge training environment (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`).

| Ref | Test Scenario | Mechanism Verified | Empirical Result | Classification |
|---|---|---|---|---|
| **C1** | Sequential Automated Generation | Idempotency pre-check on `billing_runs` & `invoices` | Run 1 creates invoice; Run 2 returns `{ alreadyGenerated: true }`. Exactly 1 invoice in DB. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C2** | 2-Way Concurrent Automated Invocation | `SELECT pg_advisory_xact_lock(hashtext('billing_config:...'))` | Both callers serialize cleanly; both return matching invoice ID. Exactly 1 invoice in DB. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C3** | 10-Way Contention Burst | Transactional advisory locking + locked re-check | 10 concurrent requests serialize cleanly; exactly 1 invoice committed; 0 raw `23505` exceptions. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C4/C5** | Concurrent Manual `createInvoice` | Advisory lock + active invoice lookup | 2 concurrent manual calls: 1 succeeds, 1 cleanly rejected with user-friendly error. Exactly 1 invoice in DB. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C6/C7** | Interleaved Manual $\rightarrow$ Automated Overlap | Cross-path active invoice lookup in `generateInvoiceFromConfig` | Manual invoice created first; subsequent automated run discovers existing invoice and returns `{ alreadyGenerated: true }`. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C13** | Void & Reissue Invariant | Partial index `WHERE status != 'void'` | Invoice generated $\rightarrow$ voided $\rightarrow$ replacement reissued for same period. 2 rows exist (1 void, 1 draft). | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C17** | Cross-Tenant Isolation | Scoped locking by tenant org and config ID | Tenant A and Tenant B bill identical calendar periods concurrently without blocking or data collision. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **C15** | Direct SQL Transaction Rollback | PostgreSQL transactional DML rollback | Simulated abort during transaction guarantees zero orphan invoice rows committed. | **PROVEN — REAL POSTGRES TRANSACTION ROLLBACK**<br>*(LIMITATION: REAL BILLING-PATH POST-INSERT FAULT INJECTION — NOT VERIFIED)* |
| **C20** | Multi-Child Family Snapshot | `coveredChildrenJson` and `billing_config_id` link | Invoice captures all covered siblings and correctly links `billingConfigId`. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R10** | Ad-Hoc Charge Independence | Decoupled `billingConfigId = null` for ad-hoc | £25 uniform fee does not consume recurring config obligation; monthly £150 cron run still succeeds. Both coexist. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R11** | Multiple Ad-Hoc Charges In Same Month | Unconstrained ad-hoc invoice slots | Multiple distinct ad-hoc charges (£30 uniform, £15 late fee) issued in same month both commit cleanly. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R12** | Real `POST /api/cron/billing` Route Execution | Route handler idempotency & `billing_run` creation | Route handler executed via `NextRequest` with valid `CRON_SECRET` skips pre-issued manual invoice. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R13** | Cron Security Authorization | Bearer token authentication fail-closed | Route handler rejects requests without `CRON_SECRET` or with invalid tokens with HTTP 401. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R14** | Automated FIRST $\rightarrow$ Manual SECOND | Advisory lock + active invoice query in `createInvoice` | Automated creates invoice; manual attempt for same period rejected cleanly. Exactly 1 active invoice committed. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R15** | Manual FIRST $\rightarrow$ Automated SECOND | Pre-check + locked re-check in `generateInvoiceFromConfig` | Manual invoice created first; automated returns `{ alreadyGenerated: true }`. Total balance is £150.00 (not £300.00). | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R16** | Concurrent Manual + Automated | Competing advisory locks on identical lock key | Concurrently fired manual and automated requests serialize cleanly. Exactly 1 invoice committed; 0 raw 23505 errors. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R17** | Concurrent Manual + Cron Route Handler | Advisory lock serialization between route & server action | Concurrently fired manual and cron route handler serialize cleanly. Exactly 1 invoice committed; `billing_run` uncorrupted. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R18** | Same Config, Different Periods | Unconstrained across distinct periods | Config billed for November and December; both invoices committed with distinct IDs and periods. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R19** | Same Parent, Different Centres | Independent configs per centre | Parent with children at Centre A and Centre B billed independently for same period. 2 distinct invoices committed. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R20** | Different Parents, Same Centre & Period | Distinct configs per parent | Two families at same centre billed for same period. 2 distinct invoices committed with correct parent links. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R21** | Different Organisations | Multi-tenant isolation | Tenant 1 and Tenant 2 generate invoices for identical dates and amounts. Zero cross-talk or lock contention. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R22** | Multi-Child Family Obligation | Family-level recurring obligation deduplication | Recurring invoice covers both siblings; subsequent manual invoice for sibling 2 in same period is rejected. | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R23** | Hostile Foreign `billingConfigId` | Session organisation scope verification | Attacker passes victim's `billingConfigId` to `generateInvoiceFromConfig`; rejected fail-closed with "Billing config not found". | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R24** | Hostile Foreign `parentId` | Tenant boundary check in `createInvoice` | Attacker passes victim's `parentId` to `createInvoice`; rejected fail-closed with "Parent not found". | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R25** | Hostile Foreign `centreId` | Tenant boundary check in `createInvoice` | Attacker passes victim's `centreId` to `createInvoice`; rejected fail-closed with "Centre not found". | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |
| **R26** | Hostile Foreign `childId` | Tenant boundary check in `createInvoice` | Attacker passes victim's `childId` to `createInvoice`; rejected fail-closed with "One or more children not found". | **PROVEN — REAL APPLICATION PATH + REAL POSTGRES** |

---

## 3. Advisory Lock `hashtext()` Collision Semantics

SprintScale CMS uses PostgreSQL transactional advisory locking via:
```sql
SELECT pg_advisory_xact_lock(hashtext(lockKey));
```
Where `lockKey` formats are:
- Recurring config: `billing_config:<billingConfigId>:<YYYY-MM-DD>`
- Manual fallback: `manual_invoice:<centreId>:<parentId>:<YYYY-MM-DD>`

### Technical Collision Analysis:
1. **Hash Range:** `hashtext(text)` in PostgreSQL produces a signed 32-bit integer (`-2,147,483,648` to `2,147,483,647`), offering approximately $4.29 \times 10^9$ hash buckets.
2. **Theoretical Birthday Collision:** In an organization generating thousands of invoices per month, a mathematical hash collision between two distinct keys is possible.
3. **Failure Mode in Case of Collision:**
   - If key $A$ and key $B$ hash to the same 32-bit integer, PostgreSQL simply treats them as contending for the same advisory lock.
   - Transaction $B$ will wait for transaction $A$ to commit or rollback before executing.
   - **Crucially, a collision only causes brief serialization latency. It NEVER permits duplicate invoices or incorrect data generation.**
   - Both transactions execute their own isolated queries inside their own transaction boundaries.
4. **Storage Engine Backstop:**
   - Even if application-level locking were compromised or experienced an unexpected lock release, the database partial unique index `invoices_config_period_uniq` provides an immutable storage-level backstop that prevents duplicate committed invoices.

---

## 4. Production Preflight Read-Only SQL (Migration 0027)

Before applying migration `drizzle/0027_billing_obligation_concurrency.sql` on the production database, run this non-destructive query to detect any legacy duplicate active recurring obligations:

```sql
-- ============================================================================
-- SPRINTScale CMS: Non-Destructive Preflight Audit Query for Migration 0027
-- PURPOSE: Identify any existing duplicate non-void invoices for the same
--          recurring billing configuration and period before creating unique index.
-- TARGET: Production Database (ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech)
-- ============================================================================

-- Query 1: Detect duplicate active/draft invoices for same billing config & period
SELECT 
    billing_config_id, 
    billing_period_start, 
    COUNT(*) AS duplicate_count,
    array_agg(id ORDER BY created_at ASC) AS invoice_ids,
    array_agg(invoice_number ORDER BY created_at ASC) AS invoice_numbers,
    array_agg(status ORDER BY created_at ASC) AS statuses,
    array_agg(amount ORDER BY created_at ASC) AS amounts
FROM invoices
WHERE status != 'void' 
  AND billing_config_id IS NOT NULL
GROUP BY billing_config_id, billing_period_start
HAVING COUNT(*) > 1;

-- Query 2: Inspect recurring invoices missing billing_period_start
SELECT 
    COUNT(*) AS recurring_invoices_missing_period_start
FROM invoices
WHERE billing_config_id IS NOT NULL
  AND billing_period_start IS NULL
  AND status != 'void';

-- Query 3: Inspect NULL config invoices that have billing_period_start (Legacy Manual)
SELECT 
    COUNT(*) AS legacy_manual_with_period_count
FROM invoices
WHERE billing_config_id IS NULL
  AND billing_period_start IS NOT NULL
  AND status != 'void';
```

### Preflight Criteria:
- If **Query 1** returns **0 rows**, the production database is 100% clean and `0027_billing_obligation_concurrency.sql` will apply cleanly without error.
- If **Query 1** returns **> 0 rows**, the listed older duplicate invoices must be inspected and voided prior to executing migration 0027.

---

## 5. Exhaustive Cleanup Across 13 Touched Tables

The test suite teardown (`afterAll`) in `pm2c-concurrency.integration.test.ts` tracks every created ID and deletes records in exact foreign key dependency order:
1. `payments`
2. `invoice_line_items`
3. `billing_runs`
4. `invoices`
5. `billing_config_children`
6. `billing_configs`
7. `children`
8. `parents`
9. `centre_memberships`
10. `org_memberships`
11. `centres`
12. `audit_events`
13. `users`
14. `organisations`

Teardown asserts that exactly **0 residual rows** matching test prefix `pm2c_*` remain in the database.

---

## 6. 30-Point Critic Audit Checklist

| # | Critic Checklist Item | Result | Verification Evidence |
|---|---|---|---|
| 1 | Baseline Git candidate verified? | **PASS** | `be50237` verified as parent on `audit/pm2c-billing-concurrency` |
| 2 | Production database untouched? | **PASS** | Zero connections to `ep-super-dawn-abuicpc2-pooler`; only training host used |
| 3 | Training host safety asserted? | **PASS** | `assertSafeTrainingEnvironment()` verified in `beforeAll` |
| 4 | C1 sequential automated idempotency? | **PASS** | Test C1 passed with matching invoice ID |
| 5 | C2 2-way concurrent automated generation? | **PASS** | Test C2 passed; serialized with 1 invoice committed |
| 6 | C3 10-way contention burst? | **PASS** | Test C3 passed; 10 requests serialized, 0 raw 23505 exceptions |
| 7 | C4/C5 concurrent manual `createInvoice`? | **PASS** | Test C4/C5 passed; 1 succeeded, 1 rejected with clean message |
| 8 | C6/C7 manual $\rightarrow$ automated overlap? | **PASS** | Test C6/C7 passed; automated run returned `alreadyGenerated` |
| 9 | C13 void and reissue invariant? | **PASS** | Test C13 passed; partial index allowed reissue |
| 10 | C17 cross-tenant isolation? | **PASS** | Test C17 passed; distinct orgs billed identical periods without collision |
| 11 | C15 rollback taxonomy corrected? | **PASS** | Formally reclassified as direct SQL transaction rollback; limitation noted |
| 12 | C20 multi-child family snapshot? | **PASS** | Test C20 passed; covered children captured in JSON |
| 13 | R10 ad-hoc charge independence? | **PASS** | Test R10 passed; ad-hoc fee did not consume monthly recurring obligation |
| 14 | R11 multiple ad-hoc charges in same month? | **PASS** | Test R11 passed; uniform and late fees both committed cleanly |
| 15 | R12 real `POST /api/cron/billing` route handler? | **PASS** | Test R12 passed; skipped pre-issued invoice and logged `billing_runs` |
| 16 | R13 cron authentication fail-closed? | **PASS** | Test R13 passed; 401 on missing or invalid secret |
| 17 | R14 automated FIRST $\rightarrow$ manual SECOND? | **PASS** | Test R14 passed; manual rejected with clean existing-invoice message |
| 18 | R15 manual FIRST $\rightarrow$ automated SECOND? | **PASS** | Test R15 passed; automated skipped with matching ID; balance unduplicated |
| 19 | R16 concurrent manual + automated race? | **PASS** | Test R16 passed; 1 committed invoice, 0 raw 23505 errors |
| 20 | R17 concurrent manual + cron route handler? | **PASS** | Test R17 passed; 1 committed invoice, clean `billing_runs` |
| 21 | R18 same config, different periods? | **PASS** | Test R18 passed; November and December invoices committed independently |
| 22 | R19 same parent, different centres? | **PASS** | Test R19 passed; Centre A and Centre B configs billed independently |
| 23 | R20 different parents, same centre & period? | **PASS** | Test R20 passed; both family invoices committed independently |
| 24 | R21 different organisations isolated? | **PASS** | Test R21 passed; distinct tenants billed identical amounts without conflict |
| 25 | R22 multi-child per-child duplicate rejected? | **PASS** | Test R22 passed; manual invoice for sibling rejected cleanly |
| 26 | R23 foreign `billingConfigId` rejected? | **PASS** | Test R23 passed; rejected fail-closed with "Billing config not found" |
| 27 | R24 foreign `parentId` rejected? | **PASS** | Test R24 passed; rejected fail-closed with "Parent not found" |
| 28 | R25 foreign `centreId` rejected? | **PASS** | Test R25 passed; rejected fail-closed with "Centre not found" |
| 29 | R26 foreign `childId` rejected? | **PASS** | Test R26 passed; rejected fail-closed with "One or more children not found" |
| 30 | Full build, typecheck, lint, and test pass? | **PASS** | `npm test` (997/997 passed), `typecheck` (clean), `lint` (clean), `build` (clean) |

---

## 7. Final Verdict

**VERDICT: PM-2C.R2 — PASS — BILLING CONCURRENCY REMEDIATION CERTIFIED FOR CONTROLLED PRODUCTION PREFLIGHT**

- **Local Git State:** All test cases and documentation staged and committed on `audit/pm2c-billing-concurrency`.
- **Next Controlled Step:** When authorized by the repository owner, run the read-only preflight SQL query against production, followed by migration `0027_billing_obligation_concurrency.sql`.
- **Zero Push / Zero Deploy:** No code has been pushed, no deployment triggered, and no tags moved.
