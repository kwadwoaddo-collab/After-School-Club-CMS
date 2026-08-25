# Milestone 6A — Production Preflight, Infrastructure & Release-Boundary Audit

**Branch:** `rebuild/cms-modernisation`  
**Starting / Working Tip SHA:** `0c61321`  
**Approved Release-Candidate Baseline SHA:** `6c205ed`  
**Proposed Release Candidate Tag:** `cms-modernisation-rc1`  
**Vercel Project:** `after-school-club-live` (`kwadwo-addos-projects`)  
**Audit Type:** Strictly Read-Only Production Preflight

---

## 1. Executive Verdict

**PASS WITH REQUIRED CONFIGURATION — READY FOR 6B**

The production environment, database target, existing live data, environment variables, release candidate SHA, and rollback paths have been audited in read-only mode. The release candidate build (`6c205ed` / `0c61321`) is ready to proceed to Milestone 6B (Configuration & Provider Bring-Up) following the documented prerequisites.

---

## 2. Git State & Release Candidate Ancestry

- **Branch:** `rebuild/cms-modernisation`
- **Tip SHA:** `0c61321978a4fbe9f350bd13675d2df6d13512db` (`0c61321`)
- **Approved Application RC SHA:** `6c205ed`
- **Ancestor Verification:** `git merge-base --is-ancestor 6c205ed 0c61321` returned **0** (`6c205ed` is confirmed direct ancestor).
- **Code Diff (`6c205ed..0c61321`):** Exactly 1 documentation file (`project-notes/milestone-5c-final-staging-acceptance.md`). ZERO lines of application, test, or schema code modified.
- **Working Tree:** Clean (`git status --porcelain` empty).

---

## 3. Current Production Deployment

- **Deployment ID:** `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci`
- **Deployment Status:** `● Ready`
- **Creation Date:** `Wed Jul 29 2026 07:04:28 GMT` (27 days ago)
- **Deployment URL:** `https://after-school-club-live-88e3njl0c-kwadwo-addos-projects.vercel.app`
- **Canonical Domains / Aliases:**
  - `https://app.sprintscaleit.co.uk` (Primary App Domain)
  - `https://www.sprintscaleit.co.uk`
  - `https://after-school-club-live.vercel.app`
  - Subdomains: `peckham`, `dagenham`, `lewisham`, `sydenham` (`.sprintscaleit.co.uk`)
- **Classification:** **PRODUCTION CURRENTLY RUNNING OLD BASELINE** (`rebuild/cms-modernisation` is not yet deployed to Production).

---

## 4. Production Database Identification & Staging Isolation

- **Statement:** **`PRODUCTION DATABASE TARGET IDENTIFIED`**
- **Statement:** **`PRODUCTION/STAGING DATABASE ISOLATION CONFIRMED`**

### Database Comparison Matrix

| Property | Staging Target | Production Target | Isolation Status |
|---|---|---|---|
| **Provider** | Neon (AWS eu-west-2) | Neon (AWS eu-west-2) | Dedicated Cloud Instance |
| **Endpoint Host** | `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` | **CONFIRMED DISTINCT** |
| **Branch** | `staging` (Schema snapshot) | `main` / `production` | **CONFIRMED DISTINCT** |
| **Database Name** | `neondb` | `neondb` | Isolated instances |
| **SSL Mode** | `require` | `require` (`channel_binding=require`) | Enforced |

---

## 5. Existing Production Data & Migration State

### A. Aggregate Live Data Census (Read-Only)
- **Organisations:** 15
- **Centres:** 20
- **Users / Staff:** 26
- **Parents:** 327
- **Children:** 356
- **Bookings:** 220
- **Invoices:** 7
- **Registrations:** 61
- **Classification:** **LIVE DATA — HIGH MIGRATION CARE REQUIRED**

### B. Migration Journal Status
- **Total Repository Journal Entries:** 23 (`0000_absurd_fallen_one` through `0022_wild_agent_zero`)
- **Production Applied Migrations:** 22 (`0000` through `0021_add_portal_notifications`)
- **Pending Migrations against Production:** **1 pending** (`0022_wild_agent_zero`)
- **Pending Migration Nature:** ADDITIVE ONLY (`CREATE TABLE org_memberships`, `ADD COLUMN subdomain` on `organisations` & `centres`).
- **Schema Reconciliation Finding:** In the live Production DB, `org_memberships` table and `subdomain` columns already exist in Postgres (with 23 populated memberships), but the migration journal record for `0022_wild_agent_zero` is not yet registered in `drizzle.__drizzle_migrations`.
- **Milestone 6C Requirement:** Safe idempotency reconciliation required in 6C migration runbook to ensure `drizzle.__drizzle_migrations` registers entry 23 cleanly without re-executing non-idempotent DDL.

---

## 6. Production Backup & Recovery Readiness

- **Neon Point-in-Time Restore (PITR):** Supported on Neon compute.
- **Pre-Migration Safety Snapshot:** A copy-on-write branch snapshot of the production Neon database must be triggered immediately prior to migration execution in Milestone 6C.
- **Classification:** **RECOVERY REQUIRES 6C ACTION**

---

## 7. Production Environment Configuration Inventory

| Variable Name | Production Vercel Status | Phase 6 Classification | Action Required in 6B |
|---|---|---|---|
| `DATABASE_URL` | CONFIGURED (`Production, Development`) | Core Database | Verified pointing to `ep-super-dawn-abuicpc2-pooler` |
| `AUTH_SECRET` | CONFIGURED (`Production, Development`) | Core Auth | Retain existing high-entropy secret |
| `PARENT_SESSION_SECRET`| MISSING in Production | Core Auth | **GENERATE & ADD in 6B** (32-byte hex secret) |
| `NEXTAUTH_SECRET` | CONFIGURED (`Production, Preview`) | Core Auth | Retain |
| `AUTH_URL` | CONFIGURED (`Preview, Production`) | Core Auth | Verified pointing to production domain |
| `NEXT_PUBLIC_BASE_URL` | CONFIGURED (`Production, Preview`) | Core Routing | Verified pointing to production domain |
| `CRON_SECRET` | MISSING in Production | Core Background | **GENERATE & ADD in 6B** (32-byte hex secret) |
| `BLOB_STORE_ID` | CONFIGURED (`store_k0kTZtYggZRa...`) | Storage | Verified linked |
| `BLOB_WEBHOOK_PUBLIC_KEY`| CONFIGURED | Storage | Verified linked |
| `FROM_EMAIL` | CONFIGURED | Comms | Verified (`Production`) |
| `RESEND_API_KEY` | MISSING in Production | Comms | Needs human input if live email dispatch desired |
| `STRIPE_SECRET_KEY` | MISSING in Production | Payments | Intentionally deferred (card checkout disabled) |
| `STRIPE_WEBHOOK_SECRET`| MISSING in Production | Payments | Intentionally deferred |
| `UPSTASH_REDIS_*` | MISSING in Production | Rate Limiting | Non-blocking (in-memory limiter active) |
| `GOCARDLESS_*` | MISSING in Production | Direct Debit | Intentionally deferred (fail-closed) |
| `TWILIO_*` | MISSING in Production | SMS | Intentionally deferred |
| `GOOGLE_*` / `WONDE_*` | MISSING in Production | Integrations | Intentionally deferred |

---

## 8. Service & Provider Readiness Verdicts

1. **Authentication:** **READY (Needs 6B PARENT_SESSION_SECRET)** — Cookies configured Secure, SameSite Lax, HttpOnly.
2. **Canonical Domains:** **READY** — Primary domain `https://app.sprintscaleit.co.uk` and Vercel alias `https://after-school-club-live.vercel.app` mapped and active.
3. **Resend Email:** **HUMAN PROVIDER VERIFICATION REQUIRED** — If live email dispatch is required for go-live, `RESEND_API_KEY` must be added in 6B. If absent, `email.ts` operates safely in logged stub mode without 500 errors.
4. **Stripe Payments:** **OPTIONAL / DEFERRED** — Cash, voucher, Tax-Free Childcare, and invoice reconciliations are 100% operational without Stripe keys.
5. **GoCardless:** **INTENTIONALLY DEFERRED** — Fail-closed protection active.
6. **Twilio SMS:** **INTENTIONALLY DEFERRED**.
7. **Google Calendar / Wonde:** **INTENTIONALLY DEFERRED**.
8. **Vercel Blob:** **READY** — Store linked.
9. **Upstash Redis:** **NON-BLOCKING** — In-memory sliding window fallback active.
10. **Cron Schedules:** **REQUIRES 6B CRON_SECRET** — In `vercel.json` (`/api/cron/billing`, `/api/cron/reminders`, `/api/cron/school-year-roll`). Adding `CRON_SECRET` ensures cron routes are protected against unauthorized external invocation.

---

## 9. Quality Gates & Security Evidence

- **TypeScript (`tsc --noEmit`):** PASS (0 errors)
- **ESLint (`eslint`):** PASS (0 errors, 0 warnings)
- **Vitest (`vitest run`):** 554 / 554 PASS across 57 test files
- **Production Build (`next build`):** PASS (93 routes generated)
- **NPM Audit:** 18 vulnerabilities (7 moderate, 8 high, 3 critical) deferred in development dependencies.
- **Classification:** **QUALITY EVIDENCE CURRENT**.

---

## 10. Rollback Paths & Resilience

1. **Application Rollback:** **READY** — Vercel Instant Rollback to `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` can be executed within seconds from the Vercel dashboard or CLI.
2. **Database Rollback:** **READY FOR 6C** — Neon copy-on-write snapshot branch created immediately prior to migration.
3. **Configuration Rollback:** **READY** — Additive variable configuration in 6B preserves previous baseline.

---

## 11. Go-Live Risk Matrix

| Risk Dimension | Severity | Current Evidence | Mitigation Strategy | Phase Responsible |
|---|---|---|---|---|
| **Live Database Migration** | HIGH | 327 parents, 356 children, 220 bookings present in DB | Neon pre-migration backup branch; additive DDL only | **6C** |
| **Parent Authentication Secret** | MEDIUM | `PARENT_SESSION_SECRET` missing in Production | Generate dedicated 64-char hex secret in Vercel | **6B** |
| **Cron Endpoint Protection** | MEDIUM | `CRON_SECRET` missing in Production | Generate dedicated 64-char hex secret in Vercel | **6B** |
| **Email Delivery** | LOW | `RESEND_API_KEY` missing; logs stub mode | User decision to provide key or accept logged stub | **6B** |
| **Card Payments** | LOW | Stripe unconfigured | Voucher/manual reconciliation active | **Deferred** |
| **Application Crash / Regression** | LOW | 554 tests passing; build verified | Vercel Instant Rollback to `dpl_7GgRdHsVtz...` | **6D / 6E** |

---

## 12. Phase 6 Action Plans

### Milestone 6B Action Plan (Configuration Bring-Up)
1. Add `PARENT_SESSION_SECRET` (Production scope) in Vercel.
2. Add `CRON_SECRET` (Production scope) in Vercel.
3. If user supplies `RESEND_API_KEY`, add to Production scope in Vercel.
4. Verify all production environment variables without exposing values.

### Milestone 6C Action Plan (Database Safety & Migration)
1. Take Neon point-in-time snapshot branch of production database.
2. Reconcile `0022_wild_agent_zero` into `drizzle.__drizzle_migrations` using idempotent verification.
3. Verify zero pending migrations against Production.
4. Strictly enforce: **PRODUCTION SEEDING IS PROHIBITED**.

### Milestone 6D Action Plan (Exact Release Deployment)
1. Deploy exact candidate commit `6c205ed` / `0c61321` to Production via Vercel.
2. Verify build status is `● Ready` on canonical domain `https://app.sprintscaleit.co.uk`.

### Milestone 6E Action Plan (Post-Deployment Live Smoke)
1. Execute non-destructive smoke suite (Public root, login page, health endpoint, staff auth gate, parent portal gate, 404 handler).
2. Verify zero production error logs.

---

## 13. Human Actions Checklist

1. **Email Service (Resend):** Confirm whether live transactional emails should be activated for launch by providing a production `RESEND_API_KEY` in 6B (or confirm stub logging is acceptable for initial deployment).
2. **Stripe Payments:** Confirm that online card checkout remains deferred for post-launch and that voucher/invoice reconciliation is the primary launch billing method.
3. **Release Approval:** Review and authorize proceeding to Milestone 6B.

---

## 14. Release Blockers

- **Critical / Blocker Count:** **0 blockers**.
- **Prerequisites for 6D:** Complete 6B configuration (`PARENT_SESSION_SECRET`, `CRON_SECRET`) and 6C database snapshot & migration.

---

## 15. Recommendation

**PASS WITH REQUIRED CONFIGURATION — READY FOR 6B**
