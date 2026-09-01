# SprintScale CMS — RC2 Release Candidate Verification Ledger

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** RC2 & RC2.R1 — Release Candidate & Browser Smoke Verification
**Branch:** `rebuild/cms-modernisation`  
**Candidate Release HEAD:** `4f853e0`  
**Mainline HEAD (`origin/main`):** `a9f00c7`  
**Merge Base:** `a9f00c7`  
**Date of Verification:** 2026-09-01  
**Classification:** **PASS — READY FOR RC3 WITH ACCEPTED DEBT**

---

## 1. Executive Summary & Verification Scope

Milestone RC2 (reconciled in RC2.R1) is the definitive pre-mainline release candidate verification of branch `rebuild/cms-modernisation` at commit `4f853e0`. This verification establishes that the codebase, reproducible clean install, full quality gates, authentication remediation, headless browser route smoke testing, and frozen documentation/training assets are fully validated for mainline fast-forward integration and production release (RC3).

### Release Candidate Readiness Verdict: **PASS — READY FOR RC3 WITH ACCEPTED DEBT**

- **Candidate Identity:** Commit `4f853e0` (`fix(security): patch critical Auth.js advisories`).
- **Clean Install Reproducibility:** Verified via `npm ci` on Node `v20.20.0` / npm `10.8.2` with zero lockfile drift or untracked changes.
- **Quality Gates:** 100% Passing (0 TypeScript errors, 0 ESLint errors, 624/624 Vitest tests passing across 67 test files, Next.js production build cleanly generating 93 static/dynamic routes).
- **Critical Dependency Remediation:** Verified 0 critical vulnerabilities in `npm audit` (`next-auth@5.0.0-beta.32` and `@auth/core@0.41.3` clean; `GHSA-7rqj-j65f-68wh` and `GHSA-8fpg-xm3f-6cx3` closed).
- **Headless Browser Smoke Suite (RC2.R1):** 15/15 routes genuinely navigated and rendered via Playwright Chromium on a live Next.js server against the approved synthetic Oakridge environment (`http://localhost:3000`).
- **Training & Side-Effect Safety:** Strict training allowlist (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`) enforced fail-closed; zero production mutations, zero external emails/SMS sent, zero financial charges.
- **Visual Corpus Freeze:** 130/130 certified assets (78 screenshots, 52 videos) verified byte-identical against SHA-256 manifest with 0 failures.
- **Git Topology:** Mainline has 0 independent commits; `main` can be fast-forwarded (`git merge --ff-only`) directly to `4f853e0`.

---

## 2. Git Topology & Candidate Identity

| Topology Metric | Value / Detail | Status |
|---|---|---|
| **Release Candidate SHA** | `4f853e0` | Target candidate for RC3 |
| **Mainline SHA (`origin/main`)** | `a9f00c7` | Up to date; zero mainline divergence |
| **Merge Base** | `a9f00c7` | Exact match with `origin/main` |
| **Mainline Unique Commits** | **0** | No independent commits on main |
| **Rebuild Unique Commits** | **215** | Direct linear progression |
| **Fast-Forward Main Possible** | **YES** | Clean `git merge --ff-only` |
| **Proposed Release Tag** | `cms-modernisation-v1.1.0` | Does not exist; ready to create in RC3 |

---

## 3. Dependency Security & Clean Install Verification

### 3.1 Clean Install (`npm ci`)
- **Node Version:** `v20.20.0`
- **npm Version:** `10.8.2`
- **Command:** `npm ci`
- **Result:** `added 892 packages, and audited 893 packages in 39s` (0 unexpected tracked changes).
- **Resolved Auth Versions:** `next-auth@5.0.0-beta.32`, `@auth/core@0.41.3` (deduped).

### 3.2 npm Audit State
- **Total Vulnerabilities:** **13**
- **Moderate:** **6**
- **High:** **7**
- **Critical:** **0** (Both critical Auth.js advisories `GHSA-7rqj-j65f-68wh` and `GHSA-8fpg-xm3f-6cx3` remediated and absent).
- **Release-Blocking Dependency Findings:** **0**.

---

## 4. Full Quality Gates from Clean Install

| Quality Gate | Target | Execution Command | Result |
|---|---|---|---|
| **TypeScript Type Check** | 0 errors | `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` | **PASS (0 errors)** |
| **ESLint Static Analysis** | 0 errors | `npm run lint` | **PASS (0 errors)** |
| **Vitest Test Suite** | 100% pass | `npm test -- --run` | **PASS (67/67 files, 624/624 tests)** |
| **Next.js Production Build** | 100% compile | `NODE_OPTIONS="--max-old-space-size=4096" npm run build` | **PASS (93/93 pages generated)** |
| **Training Guard Tests** | 100% pass | `npm test -- src/lib/training-guard.test.ts` | **PASS (8/8 tests passed)** |
| **Checksum Manifest Audit** | 0 failures | SHA-256 verification of 130 certified assets | **PASS (130/130 matched)** |

---

## 5. Staging Model, Environment Safety & Side-Effect Protection

- **RC Environment Model:** Local development / synthetic training environment (`http://localhost:3000`) targeting approved Neon PostgreSQL training host.
- **Database Classification:** **`TRAINING`** (`APPROVED_TRAINING_DB_HOST = ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`).
- **Production Isolation:** Production database (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`) is denylisted and rejected fail-closed via [`src/lib/training-guard.ts`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/src/lib/training-guard.ts).
- **External Side-Effect Safety:**
  - Real Emails Sent: **0** (Production uses Resend HTTP API; development uses mock transport)
  - Real SMS Sent: **0** (Twilio stub mode)
  - Real Stripe Charges: **0** (Test mode / disabled)
  - Real GoCardless Mandates/Payments: **0** (Stub mode)
  - Production DB Mutations: **0**
  - Wonde MIS Writes: **0** (Read-only status card)
  - Google Calendar Writes: **0** (Unconfigured fail-closed)

---

## 6. Reconciled Browser-Level Smoke Evidence Matrix (RC2.R1)

### 6.1 Evidence Reconciliation Note
In the initial RC2 execution, 7 direct database entity queries were run programmatically. In RC2.R1, this evidence gap was fully reconciled by executing real Playwright Chromium browser navigations against the running application server across all 15 product routes:

| # | Area | Route Navigated | HTTP Status | Visible UI Evidence | Console / Network Result | Verdict |
|---|---|---|---|---|---|---|
| **1** | **Authentication** | `/login -> /dashboard` | `200` | Unauth redirect to `/login`; invalid password error alert; valid staff login opens `/dashboard`. | 0 uncaught errors, 0 failed network requests | **PASS** |
| **2** | **Dashboard** | `/dashboard` | `200` | Metric cards, active centre selector (`Oakridge Central`), navigation shell. | 0 console errors, 0 hydration errors | **PASS** |
| **3** | **Centres** | `/dashboard/centres` | `200` | Multi-venue centre directory, `Oakridge Central` card, `Add Centre` CTA. | Clean render, 0 failed requests | **PASS** |
| **4** | **Parents** | `/dashboard/parents` | `200` | Family directory, search input, `Add Parent` action button. | Clean render, 0 console errors | **PASS** |
| **5** | **Students** | `/dashboard/students` | `200` | Student directory, year groups, ages, medical/allergy flags, `Add Student`. | Clean render, 0 console errors | **PASS** |
| **6** | **Registrations** | `/dashboard/registrations` | `200` | Registration intake queue, status filter badges, triage review controls. | Clean render, 0 console errors | **PASS** |
| **7** | **Bookings** | `/dashboard/bookings` | `200` | Session calendar & list view, timetable slots, `New Booking` modal CTA. | Clean render, 0 console errors | **PASS** |
| **8** | **Attendance** | `/dashboard/attendance` | `200` | Daily classroom attendance register, roll call status badges, `Export CSV`. | Clean render, 0 console errors | **PASS** |
| **9** | **Staff** | `/dashboard/staff` | `200` | Team directory, `Eleanor Vance` (Org Owner), role gates, `Invite Staff`. | Clean render, 0 console errors | **PASS** |
| **10** | **Finance** | `/dashboard/finance` | `200` | Monthly agreed-fee invoice ledger, amount totals, draft/paid status badges. | Clean render, 0 console errors | **PASS** |
| **11** | **Payments** | `/dashboard/finance/reconciliation` | `200` | Childcare voucher & Tax-Free Childcare reconciliation form. | Clean render, 0 console errors | **PASS** |
| **12** | **Communications** | `/dashboard/communications` | `200` | Centre-wide parent email broadcast compose interface & consent filters. | Clean render, 0 console errors | **PASS** |
| **13** | **Reports** | `/dashboard/reports` | `200` | Analytics overview, attendance/revenue/booking summary graphs. | Clean render, 0 console errors | **PASS** |
| **14** | **Settings** | `/dashboard/settings` | `200` | Organisation branding, registration terms, Wonde MIS integration card. | Clean render, 0 console errors | **PASS** |
| **15** | **Parent Portal** | `/portal/login` | `200` | Parent Portal passwordless magic-link sign-in input form. | Clean render, 0 console errors | **PASS** |

### 6.2 Browser Health Summary
- **Routes Navigated:** **15 / 15**
- **Browser PASS:** **15**
- **Browser FAIL:** **0**
- **Browser SKIPPED:** **0**
- **Unexpected HTTP 5xx:** **0**
- **Hydration / Browser Runtime Errors:** **0**
- **Failed Critical Network Requests:** **0**

---

## 7. Observability & Monitoring Readiness

- **Sentry Monitoring:** SDK configured across client, server, and edge runtimes (`@sentry/nextjs`). Telemetry delivery verified. Live production runtime exception capture remains pending live user traffic post-deployment.
- **UptimeRobot:** Status: **`LIVE AND EXTERNALLY VERIFIED`** (Pings `/api/health` continuously).

---

## 8. Database & Release Operations Checklist for RC3

### 8.1 Database Migration Readiness
- Schema is declarative in `src/db/schema.ts` and synchronized with migrations `drizzle/0000` through `0023`.
- All post-merge-base migrations (`0022_wild_agent_zero.sql`, `0023_add_subdomains.sql`) are strictly additive and non-destructive.

### 8.2 Deployment Prerequisite Checklist (for RC3)
1. Set production `DATABASE_URL` (Neon PostgreSQL).
2. Set `NEXTAUTH_SECRET` / `AUTH_SECRET` (Session authentication).
3. Set `NEXTAUTH_URL` / `AUTH_URL` (Canonical production URL).
4. Set `PARENT_SESSION_SECRET` (Parent portal HS256 JWT signing).
5. Set `RESEND_API_KEY` & `EMAIL_FROM` (Transactional email).
6. Set `CRON_SECRET` (Secures `/api/cron/*` endpoints).
7. Set `NEXT_PUBLIC_SENTRY_DSN` (Monitoring telemetry).

### 8.3 Rollback Reconfirmation
- **Source Rollback:** **`READY`** (Direct git revert/checkout to `a9f00c7`).
- **Schema Compatibility:** **`READY`** (Additive schema allows older application code to query tables without error).
- **Production Data Rollback:** **`BACKUP-DEPENDENT`** (Point-in-time database snapshot restore required for new transactional records).
- **External Configuration Rollback:** **`MANUAL`** (Hosting dashboard environment variable management).
- **Prior Production Tag:** `cms-modernisation-v1.0` -> `64e59d5`.

### 8.4 Recommended Release Strategy
- **Release Tag:** `cms-modernisation-v1.1.0`
- **Mainline Strategy:** `FAST-FORWARD MAIN` (`git checkout main && git pull --ff-only origin main && git merge --ff-only rebuild/cms-modernisation`).

---

## 9. Defect, Debt & Deferral Classifications

- **Blockers:** **0**
- **Non-Blocking Product Defects:** **0**
- **Accepted Operational & Dependency Debt:** **4**
  1. `DEBT-01`: Broadcast email dispatch uses detached in-process Promise execution rather than durable background queue worker.
  2. `DEBT-02`: Billing run duplicate protection has application-level pre-check with theoretical concurrent database race.
  3. `DEBT-03`: Sentry SDK delivery is verified; empirical live production runtime exception capture remains pending live traffic.
  4. `DEBT-04`: 13 inherited non-critical npm vulnerabilities (6 moderate, 7 high, 0 critical) scheduled for Next 16.3+ maintenance release.
- **Deferred Features:** **3** (Stripe Connect direct debit, persistent background queue worker, live bi-directional Wonde sync).

---

## 10. Final RC2 / RC2.R1 Classification & Recommendation

**CLASSIFICATION: PASS — READY FOR RC3 WITH ACCEPTED DEBT**

The release candidate at commit `4f853e0` has satisfied all reproducible clean-install requirements, quality gates, security certifications, live headless browser smoke suite verifications (15/15 PASS), and freeze protections. Branch `rebuild/cms-modernisation` is fully certified and approved to proceed to Milestone RC3 for mainline integration, release tagging, and production deployment.
