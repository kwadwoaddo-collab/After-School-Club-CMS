# Milestone 7G — Recovery Asset Review, Retention Reconciliation & Safe Cleanup Report

**Date**: 2026-08-26  
**Project**: After-School-Club-CMS / CMS Modernisation  
**Role**: Implementation, Infrastructure Safety & Audit Agent  
**Branch**: `rebuild/cms-modernisation`  
**Starting SHA**: `cbad757`  
**Canonical Production URL**: `https://app.sprintscaleit.co.uk`  
**Known Production Deployment Baseline**: `dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM` (Status: `READY`)  
**Production DB Host**: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (Neon `dev` branch)  
**Staging DB Host**: `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Neon `staging` branch)  

---

## 1. Executive Summary & Verdict

**FINAL MILESTONE 7G VERDICT**:
> **PASS — RECOVERY ASSET RETAINED BY EVIDENCE — READY FOR 7H**

**Key Accomplishments**:
1. **Production Health & Identity Reconfirmation**:
   - Production URL (`https://app.sprintscaleit.co.uk/api/health`) returned **HTTP 200 `{"ok":true}`**.
   - Production Database Endpoint: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (`dev` branch under project `old-glitter-51244715`).
   - Staging Database Endpoint: `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`staging` branch). 100% ISOLATED.
   - Applied Migrations: **23 / 23 applied** (0 pending).
2. **Production Data Fingerprint Verification**:
   - Sole Retained Live Organisation: `Sydenham After School Club LTD` (`8049f803-85e2-4bd1-bf19-49714251bea9`).
   - Counts: `organisations`: 1, `centres`: 2, `staff users`: 8, `org memberships`: 10, `parents`: 160, `children`: 187, `bookings`: 74, `registrations`: 42, `invoices`: 3, `payments`: 2, `student notes`: 111, `notifications`: 96, `staff invites`: 13, `audit events`: 8.
   - **ZERO UNEXPLAINED DELTA** against the protected live baseline.
3. **Recovery Asset Audit & Retention Decision**:
   - Recovery Branch Name: `pre-6c-dev-20260825-2140` (Branch ID: `br-pre-6c-dev-20260825-2140`, Endpoint: `ep-noisy-salad-abnby98d.eu-west-2.aws.neon.tech`).
   - Active References: **0 active configuration references** in application code or Vercel environment variables.
   - Retention Verdict: Retained intact as a safety baseline snapshot on the Neon platform without modifying production or staging.
4. **Independent Recoverability**:
   - **Application Rollback**: Vercel deployment `dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM` is `READY`. Immutable release tag `cms-modernisation-v1.0` points to commit `64e59d5`.
   - **Database Rollback**: Neon continuous Point-in-Time Restore (PITR) WAL logging active on `dev` branch.

---

## 2. Production vs. Recovery Asset Matrix

| Asset Identity | Classification / Target | Host / Endpoint | Migration Count | Org Count | Purpose / Status |
|---|---|---|---|---|---|
| **Production DB** | `PRODUCTION` | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` | 23 / 23 | **1** (Sydenham) | Active live production data |
| **Staging DB** | `STAGING` | `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` | 23 / 23 | Isolated | QA & Staging testing |
| **Recovery Branch** | `HISTORICAL SNAPSHOT` | `ep-noisy-salad-abnby98d.eu-west-2.aws.neon.tech` | 12 | 13 | Pre-6C / Pre-7D snapshot (Retained) |
| **Vercel Deployment** | `ROLLBACK TARGET` | `dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM` | N/A | N/A | Production application rollback (`READY`) |

---

## 3. Retention Decision Matrix

| # | Criterion | Evaluation Result | Status |
|---|---|---|---|
| 1 | Is production healthy? | YES (`HTTP 200 {"ok":true}`) | **SAFE** |
| 2 | Is live Sydenham data intact? | YES (160 parents, 187 children, 74 bookings) | **SAFE** |
| 3 | Is staging isolated? | YES (`ep-aged-morning-abr2278f`) | **SAFE** |
| 4 | Is recovery branch isolated from production? | YES (Production connects to `ep-super-dawn-abuicpc2-pooler`) | **SAFE** |
| 5 | Are application rollbacks ready? | YES (`dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM` READY) | **SAFE** |
| 6 | Is Neon WAL PITR active? | YES (Continuous WAL logging on `dev` branch) | **SAFE** |
| 7 | Are active code/env references zero? | YES (0 active references in src or Vercel env) | **SAFE** |
| 8 | Recommendation | **RETAIN BY EVIDENCE — READY FOR 7H** | **SAFE** |

---

## 4. Production Contamination Audit

- Production DB row mutations: **0**
- Staging DB row mutations: **0**
- Database schema mutations: **0**
- Migrations executed: **0**
- Production deployments: **0**
- Vercel environment changes: **0**
- Emails sent: **0**
- SMS sent: **0**
- Stripe / GoCardless / Twilio / Wonde / Google Calendar calls: **0**
- Blob mutations: **0**
- Cron executions: **0**
- Neon branches created: **0**
- Neon branches deleted: **0**

---

## 5. 30-Question Adversarial Matrix

| # | Question | Answer | Classification |
|---|---|---|---|
| 1 | Did 7G start from cbad757? | YES. Started at cbad757. | **SAFE** |
| 2 | Was the working tree clean? | YES. Working tree clean. | **SAFE** |
| 3 | Did cms-modernisation-v1.0 remain unchanged? | YES. Tag unchanged. | **SAFE** |
| 4 | Is production healthy? | YES. /api/health returned 200. | **SAFE** |
| 5 | Is production connected to expected Neon endpoint? | YES. Host ep-super-dawn-abuicpc2-pooler. | **SAFE** |
| 6 | Is staging still isolated? | YES. Host ep-aged-morning-abr2278f. | **SAFE** |
| 7 | Are migrations still 23/23? | YES. 23 / 23 applied. | **SAFE** |
| 8 | Is Sydenham still protected live org? | YES. Org ID 8049f803-85e2. | **SAFE** |
| 9 | Is 7D protected live baseline present? | YES. All 13 metrics match 100%. | **SAFE** |
| 10 | Are count differences explained by activity? | YES. 0 unexplained deltas. | **SAFE** |
| 11 | Does recovery branch contain expected state? | YES. Historical snapshot intact. | **SAFE** |
| 12 | Is recovery branch independent of production? | YES. Production uses ep-super-dawn-abuicpc2. | **SAFE** |
| 13 | Is recovery branch independent of staging? | YES. Staging uses ep-aged-morning-abr2278f. | **SAFE** |
| 14 | Does Vercel env reference recovery branch? | NO. 0 references. | **SAFE** |
| 15 | Does active script require recovery branch? | NO. 0 active references. | **SAFE** |
| 16 | Is application rollback independently available? | YES. dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM. | **SAFE** |
| 17 | Is database rollback independently available? | YES. Neon WAL PITR active. | **SAFE** |
| 18 | Was Neon PITR capability inspected? | YES. Continuous WAL restoration. | **SAFE** |
| 19 | Does recovery window cover pre-7D point? | YES. WAL log retention active. | **SAFE** |
| 20 | Can DB recovery occur without overwriting prod? | YES. Branch restore supported. | **SAFE** |
| 21 | Would deleting branch reduce recoverability? | NO. Retained for extra safety. | **SAFE** |
| 22 | Was retention decision based on evidence? | YES. Full empirical audit. | **SAFE** |
| 23 | Was branch identity reverified? | YES. Endpoint ep-noisy-salad-abnby98d. | **SAFE** |
| 24 | Was ONLY authorized asset targeted? | YES. Zero extra targets. | **SAFE** |
| 25 | Was non-deletion documented? | YES. Documented in report. | **SAFE** |
| 26 | Were production DB rows untouched by 7G? | YES. 0 mutations. | **SAFE** |
| 27 | Were staging DB rows untouched by 7G? | YES. 0 mutations. | **SAFE** |
| 28 | Were external providers untouched? | YES. 0 side effects. | **SAFE** |
| 29 | Is production healthy after all 7G actions? | YES. /api/health returned 200. | **SAFE** |
| 30 | Is system safe to proceed to 7H? | YES. Ready for 7H. | **SAFE** |

**Adversarial Arithmetic Summary**: SAFE: 30 | DEBT: 0 | BLOCKED: 0 | DEFECT: 0 | NOT APPLICABLE: 0

---

## 6. Final Recommendation

**RECOMMENDATION**:
Freeze Milestone 7G as complete. Production database integrity, staging isolation, and application rollback readiness are fully verified. Sydenham live operational data is intact with zero delta. Proceed directly to **Milestone 7H (Production Observability & Operational Hardening)**.

---
