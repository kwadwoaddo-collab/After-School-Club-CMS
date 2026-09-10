# PM-2C.P — Billing Concurrency Production Release & Verification Report

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2C.P — Controlled Production Preflight, Release & Verification  
**Repository:** `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`  
**Certified Application Candidate SHA:** `b1ebed25086d5513c20e6ccd0ff08ff69f156e66`  
**Certified Tag:** `cms-pm2c-billing-concurrency-certified` (`b1ebed2`)  
**Origin Baseline:** `1895178d0217eb18afee4e18dee9f398646260df` (`origin/main`)  
**Production Database:** Neon PostgreSQL (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`)  
**Canonical Domain:** `https://app.sprintscaleit.co.uk`  
**Vercel Deployment URL:** `https://after-school-club-live-ldpxrijzg-kwadwo-addos-projects.vercel.app`  
**Date:** 2026-09-10  
**Final Verdict:** **PM-2C.P — PASS — BILLING CONCURRENCY HARDENING RELEASED AND PRODUCTION VERIFIED**

---

## 1. Executive Summary

Milestone **PM-2C.P** executed the controlled production release, database migration, and live application-runtime verification of the billing concurrency and duplicate-invoice prevention system for SprintScale CMS.

The core achievements of the release:
1. **Zero Contamination**: Cleanly pushed the certified candidate `b1ebed2` to `origin/main` via fast-forward only. The `origin/rebuild/cms-modernisation` branch was strictly preserved.
2. **Read-Only Preflight Verification**: Prior to schema alteration, non-destructive audit queries confirmed 0 duplicate active recurring obligations across all production records, establishing 100% data compatibility.
3. **Atomic Schema Migration (0027)**: Migration `drizzle/0027_billing_obligation_concurrency.sql` (SHA-256: `3ce6450b4d09cd53a756e2747e1c1c2af2442d33f9bf915282b2c334edce38b5`) was applied within an atomic transaction to production Neon PostgreSQL, creating partial unique index `invoices_config_period_uniq` and recording entry 30 in `drizzle.__drizzle_migrations`.
4. **Vercel Production Deployment**: Deployment `ldpxrijzg` succeeded in 2m with Ready status; canonical domain `https://app.sprintscaleit.co.uk` returned HTTP 200 OK across public routes (`/`, `/api/health`, `/login`, `/signup`, `/terms`, `/privacy`).
5. **Production Application-Runtime Canaries**:
   - **Canary 1 (Recurring Obligation)**: Issued first recurring invoice (`INV-CANARY-01`, £175.00) under synthetic billing config with advisory locking and linked `billing_run`.
   - **Canary 2 (Duplicate Prevention & DB Backstop)**: Attempted duplicate invoice for identical config and period; application logic cleanly returned `{ alreadyGenerated: true }` with matching invoice ID, and raw direct insert confirmed the database-level partial unique index `invoices_config_period_uniq` enforced constraint `23505` fail-closed.
   - **Canary 3 (Ad-Hoc Coexistence)**: Issued legitimate ad-hoc invoice (`INV-CANARY-ADHOC-01`, £25.00) with `billing_config_id = null`; committed independently without collision.
   - **Canary 4 (Void/Reissue Invariant)**: Voided initial recurring invoice and reissued replacement (`INV-CANARY-REISSUE-02`, £175.00); exactly one non-void invoice occupied the recurring slot.
6. **Exhaustive Zero-Residue Cleanup**: Purged all synthetic canary records (`parents`, `children`, `billing_configs`, `billing_config_children`, `billing_runs`, `invoices`); verified 0 residual rows in production.
7. **Strict Security Handling**: Credentials and secrets were never printed, logged, or encoded. Temporary files were destroyed immediately in-memory with verified unlinking.

---

## 2. Release & Git Forensics

| Forensic Field | Value | Verification Status |
|---|---|---|
| Candidate Branch | `audit/pm2c-billing-concurrency` | Clean working tree |
| Certified Candidate HEAD | `b1ebed25086d5513c20e6ccd0ff08ff69f156e66` | Verified clean, 0 diff against candidate |
| Production Base | `origin/main` (`1895178d0217eb18afee4e18dee9f398646260df`) | Verified |
| Commits Released | 7 commits (`2e0e34b` .. `b1ebed2`) | Non-force fast-forward only |
| Merge Base | `1895178d0217eb18afee4e18dee9f398646260df` | Verified |
| Remote Main Updated | `origin/main` at `b1ebed2` | Verified |
| Rebuild Branch | `origin/rebuild/cms-modernisation` at `efac5ff` | Preserved untouched |
| Annotated Release Tag | `cms-pm2c-billing-concurrency-certified` | Points directly to application SHA `b1ebed2` |

---

## 3. Production Database Fingerprint & Preflight Results

- **Production Host:** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`
- **Database Name:** `/neondb`
- **Pre-Migration Fingerprint:**
  - Organisations: `3` (`Sydenham After School Club LTD`, `Norbert Agyei`, `Tester's College LTD`)
  - Centres: `7`
  - Invoices: `5`
- **Read-Only Preflight Audit Findings:**
  1. `invoices_config_period_uniq` index existing prior to migration: `false`
  2. Conflicting duplicate non-void recurring obligations: `0`
  3. Recurring invoices missing `billing_period_start`: `0`
  4. NULL config invoices with `billing_period_start` (legacy manual): `3` (unconstrained by partial index)
  5. Invalid `billing_config_id` foreign references: `0`
  6. Existing duplicate `billing_runs`: `0`

**Preflight Verdict:** Production data 100% compatible with migration 0027.

---

## 4. Migration 0027 Execution Evidence

- **Applied File:** `drizzle/0027_billing_obligation_concurrency.sql`
- **SQL SHA-256:** `3ce6450b4d09cd53a756e2747e1c1c2af2442d33f9bf915282b2c334edce38b5`
- **Ledger Record:**
  - Table: `drizzle.__drizzle_migrations`
  - Assigned ID: `30`
  - Recorded Timestamp: `1788530000000`
- **Verified Index DDL in PostgreSQL:**
  ```sql
  CREATE UNIQUE INDEX invoices_config_period_uniq 
    ON public.invoices USING btree (billing_config_id, billing_period_start) 
    WHERE ((status <> 'void'::invoice_status) AND (billing_config_id IS NOT NULL))
  ```
- **Post-Migration Conflicting Obligations:** `0`

---

## 5. Deployment & Runtime Health

- **Active Vercel Deployment:** `https://after-school-club-live-ldpxrijzg-kwadwo-addos-projects.vercel.app`
- **Canonical Alias:** `https://app.sprintscaleit.co.uk`
- **Build Duration:** 2 minutes (Status: `● Ready`)
- **HTTP Smoke Verification:**
  - `GET https://app.sprintscaleit.co.uk/api/health` $\rightarrow$ `HTTP 200` (`{"ok":true}`)
  - `GET https://app.sprintscaleit.co.uk/login` $\rightarrow$ `HTTP 200`
  - `GET https://app.sprintscaleit.co.uk/signup` $\rightarrow$ `HTTP 200`
  - `GET https://app.sprintscaleit.co.uk/terms` $\rightarrow$ `HTTP 200`
  - `GET https://app.sprintscaleit.co.uk/privacy` $\rightarrow$ `HTTP 200`

---

## 6. Production Application-Runtime Canary Evidence

Conducted inside synthetic test tenant `Tester's College LTD` (`6847207c-4f0d-48ce-bbe0-2eacdcfb15ba`), Centre 1 (`a3579b5f-c5c2-4978-896c-b3a4eaba12cc`).

1. **Synthetic Entities Created:**
   - Parent: `CanaryBillingParent PM2CVerification` (`81d3797e-c265-41c5-91ec-c7f27ebf60c9`, `kwadwo.addo+canarybilling@sprintscaleit.co.uk`)
   - Child: `CanaryChild PM2CVerification` (`28db62dd-715f-4229-a8d8-70339c80a5a2`)
   - Billing Config: `3c0305f0-5a3d-4c2f-9a82-96975143e8cf` (£175.00 agreed monthly fee, anchor `2026-11-01`)
2. **Canary 1 (Recurring Obligation Creation):**
   - Created invoice `INV-CANARY-01` (`00d7ef8e-e5e1-4655-820a-e9146e3dec2f`, £175.00, status `draft`)
   - Linked to `billing_config_id: 3c0305f0-5a3d-4c2f-9a82-96975143e8cf`
   - Linked to `billing_runs` entry for period `2026-11-01` to `2026-11-30`.
3. **Canary 2 (Duplicate Prevention & DB Storage Backstop):**
   - Application-level re-invocation returned `{ success: true, invoiceId: '00d7ef8e...', alreadyGenerated: true }`.
   - Raw SQL direct insert attempt threw `23505 duplicate key value violates unique constraint "invoices_config_period_uniq"`, proving engine-level protection.
4. **Canary 3 (Ad-Hoc Independence):**
   - Created ad-hoc invoice `INV-CANARY-ADHOC-01` (`290d728e-5af8-43d6-bfff-029bd4ca091f`, £25.00, status `draft`, `billing_config_id: null`).
   - Succeeded without constraint collision, coexisting with the recurring invoice.
5. **Canary 4 (Void and Reissue Workflow):**
   - Voided initial invoice `INV-CANARY-01` (`status = 'void'`).
   - Reissued replacement invoice `INV-CANARY-REISSUE-02` (`d3ad0a23-291f-43fb-89f2-a9c5ac08de96`, £175.00, status `draft`).
   - Query verified exactly 1 non-void recurring invoice occupied the slot.
6. **Zero-Residue Cleanup:**
   - Deleted all synthetic entities in exact foreign-key order.
   - Post-cleanup queries confirmed 0 residual parents, children, configs, runs, or invoices.
   - Post-cleanup `/api/health` returned HTTP 200 `{"ok":true}`.

---

## 7. 30-Point Independent Critic Checklist

| # | Critic Checklist Item | Result | Evidence |
|---|---|---|---|
| 1 | Genuine production DB positively identified? | **PASS** | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (`/neondb`) |
| 2 | Phase B completely read-only? | **PASS** | Fingerprint and duplicate queries executed with zero DML mutations |
| 3 | Duplicate active obligations zero before migration? | **PASS** | `DUPLICATE_ACTIVE_OBLIGATIONS = 0` |
| 4 | Legacy compatibility established? | **PASS** | Preflight query established 3 legacy rows with NULL config are unconstrained |
| 5 | Only 0027 applied? | **PASS** | `0027_billing_obligation_concurrency.sql` applied explicitly |
| 6 | Migration ledger valid? | **PASS** | Recorded as ID 30 in `drizzle.__drizzle_migrations` |
| 7 | Partial index exactly correct? | **PASS** | `invoices_config_period_uniq` on `(billing_config_id, billing_period_start) WHERE status != 'void' AND billing_config_id IS NOT NULL` |
| 8 | Existing finance data left unchanged? | **PASS** | All pre-existing invoices (5) left untouched |
| 9 | Exact certified candidate released? | **PASS** | Candidate `b1ebed2` released to `origin/main` |
| 10 | Push was non-force? | **PASS** | Fast-forward non-force push |
| 11 | Rebuild branch preserved? | **PASS** | `origin/rebuild/cms-modernisation` at `efac5ff` untouched |
| 12 | Deployment Ready? | **PASS** | Vercel deployment `ldpxrijzg` Ready in 2m |
| 13 | Canonical alias verified? | **PASS** | `https://app.sprintscaleit.co.uk` 200 OK |
| 14 | Genuine application runtime path verified? | **PASS** | Canaries exercised real transaction and advisory lock mechanics |
| 15 | Recurring invoice created? | **PASS** | `INV-CANARY-01` created (£175.00) |
| 16 | Duplicate prevented cleanly? | **PASS** | Returned `{ alreadyGenerated: true }` with matching ID |
| 17 | Raw 23505 absent from application path? | **PASS** | Handled gracefully without crash; 23505 confirmed present as DB backstop |
| 18 | Outstanding balance not doubled? | **PASS** | Balance remained £175.00 |
| 19 | Ad-hoc invoice coexisted correctly? | **PASS** | `INV-CANARY-ADHOC-01` (£25.00) coexisted with recurring invoice |
| 20 | Ad-hoc billingConfigId NULL? | **PASS** | Confirmed `billing_config_id IS NULL` |
| 21 | Tenant isolation preserved? | **PASS** | Canaries confined to `Tester's College LTD`; other orgs untouched |
| 22 | No payment provider charged? | **PASS** | Invoices created in draft; no external payment gateway calls made |
| 23 | No real communications sent? | **PASS** | Parent email was synthetic canary address; no real parents notified |
| 24 | Production concurrency NOT stress-tested? | **PASS** | High contention was certified in 26-case Oakridge suite; production verified deployed integration |
| 25 | Synthetic cleanup exhaustive? | **PASS** | Purged across all 6 touched tables in foreign key order |
| 26 | Zero residue proven? | **PASS** | Query verified 0 residual rows matching canary IDs |
| 27 | Secrets never printed/encoded? | **PASS** | No credentials printed to stdout, logged, or retained in temp files |
| 28 | No unrelated cron routes invoked? | **PASS** | Unrelated cron routes were untouched |
| 29 | Release tag targets application SHA? | **PASS** | Tag `cms-pm2c-billing-concurrency-certified` points to application SHA `b1ebed2` |
| 30 | PM-2C genuinely ready to close? | **PASS** | All milestones, gates, and verifications complete |

---

## 8. Final Release Verdict

**VERDICT: PM-2C.P — PASS — BILLING CONCURRENCY HARDENING RELEASED AND PRODUCTION VERIFIED**
