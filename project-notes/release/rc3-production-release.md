# SprintScale CMS — RC3 Production Release Ledger

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** RC3 & RC3.R1 — Mainline Integration, Release Tag & Production Evidence Reconciliation
**Certified Code Release SHA:** `de8b4e2`
**Mainline Integration Target:** `main`
**Release Tag:** `cms-modernisation-v1.1.0` (Anchored to `de8b4e2`)
**RC3 Documentation Commit SHA:** `4c51711`
**Active Production Deployment ID:** `dpl_duKCKtjTBJyD2Pdmmf1aVNu9Kk9N`
**Active Production Deployment Commit:** `4c51711` (Byte-identical application & dependency code to `de8b4e2`)
**Production Target URL:** `https://app.sprintscaleit.co.uk`
**Production Database:** Neon PostgreSQL (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`)
**Date of Verification:** 2026-09-02
**Classification:** **PASS — RC3 EVIDENCE CERTIFIED WITH ACCEPTED DEBT — READY FOR RC4**

---

## 1. Executive Summary & Release Identity

Milestone RC3 (reconciled in RC3.R1) records the formal mainline integration, tagging, and live production deployment verification of the modernised SprintScale CMS.

### Release Identity Breakdown
- **Certified Code Release Commit:** `de8b4e2` (`docs(release): reconcile RC2 browser smoke evidence`).
- **Release Tag:** `cms-modernisation-v1.1.0` (Annotated git tag anchored directly to `de8b4e2`).
- **Mainline Branch HEAD:** `4c51711` (Post-release documentation recording).
- **Active Vercel Deployment:** Deployment `dpl_duKCKtjTBJyD2Pdmmf1aVNu9Kk9N` serving `https://app.sprintscaleit.co.uk` at commit `4c51711` (application source and dependencies are 100% byte-identical to `de8b4e2`).

---

## 2. Git Topology & Release Ancestry

| Topology Metric | Measurement / Record | Status |
|---|---|---|
| **Certified Code Release SHA** | `de8b4e2` | Target code release candidate |
| **Pre-Release Mainline SHA (`origin/main`)** | `a9f00c7` | Up to date; zero divergence |
| **Merge Base** | `a9f00c7` | Exact match with `origin/main` |
| **Main-Only Commits** | **0** | No independent commits on main |
| **Rebuild-Only Commits** | **217** | Linear modernisation progression |
| **Fast-Forward Integration** | `git merge --ff-only rebuild/cms-modernisation` | **SUCCESS** |
| **Final Local Main SHA** | `4c51711` | Clean working tree |
| **Final Remote Main SHA (`origin/main`)** | `4c51711` | Successfully pushed |
| **Release Tag** | `cms-modernisation-v1.1.0` | Annotated tag created & pushed |
| **Release Tag Target SHA** | `de8b4e2` | Verified exact commit target |

---

## 3. Dependency Security Baseline & Vulnerability Forensics

- **`next-auth` Version:** `5.0.0-beta.32`
- **`@auth/core` Version:** `0.41.3` (Deduped across `next-auth` and `@auth/drizzle-adapter`)
- **`npm audit` Total:** **14 vulnerabilities** (6 moderate, 8 high, **0 critical**)
- **Critical Vulnerabilities:** **0**
- **Critical Auth.js Advisories:** Both `GHSA-7rqj-j65f-68wh` and `GHSA-8fpg-xm3f-6cx3` are **remediated and closed**.

### 3.1 Reconciliation of RC2 → RC3 High Vulnerability Increase
- **Package:** `browserslist` (installed: `4.28.6`)
- **Advisories:** `1153171` (Unbounded memory growth via query results, Severity: High) & `1153172` (Uncaught crash via custom stats, Severity: High).
- **Nature:** Transitive build-time toolchain dependency of PostCSS / Next.js CSS processing. Not evaluated against runtime user input in production.
- **Cause of Increase:** Newly published upstream advisory in the npm registry; 0 packages or lockfile versions were modified in the repository.
- **Release Impact:** **Accepted non-blocking debt** scheduled for the upcoming Next 16.3+ maintenance framework release.

---

## 4. Pre-Release & Post-Merge Quality Gates

All quality gates were verified on `main` post-fast-forward:

| Quality Gate | Execution Command | Result |
|---|---|---|
| **TypeScript Type Check** | `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` | **PASS (0 errors)** |
| **ESLint Static Analysis** | `npm run lint` | **PASS (0 errors, 0 warnings)** |
| **Vitest Test Suite** | `npm test -- --run` | **PASS (67/67 files, 624/624 tests passed)** |
| **Next.js Production Build** | `NODE_OPTIONS="--max-old-space-size=4096" npm run build` | **PASS (93/93 pages compiled)** |
| **D6 Freeze Verification** | SHA-256 manifest verification (`130/130 assets`) | **PASS (130 matched, 0 failures)** |

---

## 5. Production Environment & Deployment Target

- **Hosting Platform:** Vercel (Project: `after-school-club-live`, Team: `kwadwo-addos-projects`)
- **Active Deployment ID:** `dpl_duKCKtjTBJyD2Pdmmf1aVNu9Kk9N`
- **Canonical Production URL:** `https://app.sprintscaleit.co.uk`
- **Production Database Host:** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (Neon PostgreSQL production connection pooler)
- **Training Guard Isolation:** Verified fail-closed; production host is denylisted and rejected from all seed/reset operations.
- **Production Configuration:** Required variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `PARENT_SESSION_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`) verified active.
- **Backup & PITR Readiness:** Neon PostgreSQL continuous WAL streaming and point-in-time restore capability active. Data rollback classification: `BACKUP-DEPENDENT`.

---

## 6. Database Migrations Forensics

- **Migration Count:** **24 migrations** (`drizzle/0000` through `0023`).
- **Post-Merge-Base Migrations:** `0022_wild_agent_zero.sql` and `0023_add_subdomains.sql`.
- **Migration Nature:** Strictly additive (adding nullable `subdomain` columns on `organisations`/`centres` and `org_memberships` table; zero dropped tables, columns, or incompatible conversions).
- **Destructive Migrations:** **0**.
- **Schema Synchronization Verdict:** **`SYNCHRONIZED (ADDITIVE SCHEMA ACTIVE)`**.

---

## 7. Reconciled Production Browser Smoke & Health Telemetry (RC3.R1)

Browser automation testing was performed directly against `https://app.sprintscaleit.co.uk` using Playwright Chromium:

| Production Route / Endpoint | Verified Behavior | Status Code | Telemetry / Errors | Verdict |
|---|---|---|---|---|
| **Public Staff Login (`/login`)** | Page renders with complete branding and NextAuth login forms. | `HTTP/2 200` | 0 page errors, 0 failed critical requests | **PASS** |
| **Public Parent Portal (`/portal/login`)** | Page renders with passwordless email intake form. | `HTTP/2 200` | 0 page errors, 0 failed critical requests | **PASS** |
| **Unauthenticated Dashboard (`/dashboard`)** | Unauthenticated navigation is strictly intercepted and redirected to `/login`. | `HTTP/2 307` | Redirected to `/login` | **AUTH BOUNDARY PASS** |
| **Protected API (`/api/students`)** | Unauthenticated request is rejected without querying the database. | `HTTP/2 405` / `401` | Handled fail-closed | **AUTH BOUNDARY PASS** |
| **Health API (`/api/health`)** | Returns valid application health JSON payload `{"ok":true}`. | `HTTP/2 200` | Clean JSON response | **AVAILABILITY PASS** |
| **Authenticated Internal Modules** | Internal staff modules on production database. | N/A | Production credentials not exercised to preserve production data | **NOT EXECUTED (SAFE AUTH NOT CONFIGURED)** |

### 7.1 Telemetry Counts on Live Production
- **Unexpected HTTP 5xx:** **0**
- **Page Errors (`pageerror`):** **0**
- **Critical Failed Network Requests:** **0** (Only benign client-side prefetch aborts on page redirect observed)
- **Static Asset Failures:** **0**
- **Hydration / Browser Runtime Errors:** **0**

---

## 8. Observability & Telemetry Verification

- **Sentry Monitoring:** Status: **`CONFIGURED AND SDK DELIVERY VERIFIED`** (Active on client, server, and edge runtimes; no claim of live production exception capture without a genuine production event).
- **UptimeRobot:** Status: **`LIVE AND EXTERNALLY VERIFIED (CURRENTLY HEALTHY)`** (Continuous monitoring of `https://app.sprintscaleit.co.uk/api/health`).

---

## 9. Release Side-Effect Safety Audit

- **Unintended Real Emails Sent:** **0**
- **Unintended Real SMS Sent:** **0**
- **Unintended Real Charges / Payments:** **0**
- **Unintended Wonde Writes:** **0**
- **Unintended Google Calendar Writes:** **0**
- **Training Seed / Reset Operations Against Production:** **0**
- **Production Database Mutations:** **0**

---

## 10. Rollback Readiness & Strategy

- **Source Rollback:** **`READY`** (Direct git checkout/revert to pre-release SHA `a9f00c7`).
- **Schema Compatibility:** **`READY`** (Additive migrations allow previous application versions to run without database schema conflicts).
- **Production Data Rollback:** **`BACKUP-DEPENDENT`** (Point-in-time database snapshot restore required for new transactional records).
- **External Config Rollback:** **`MANUAL`** (Vercel environment variable dashboard).
- **Prior Production Tag:** `cms-modernisation-v1.0` -> `64e59d5`.
- **Rollback Performed:** **NO** (Production deployment is healthy and stable).

---

## 11. Accepted Release Debt & Deferred Features

### 11.1 Accepted Operational & Dependency Debt (Non-Blocking)
1. `DEBT-01`: Broadcast email dispatch uses detached in-process Promise execution rather than durable background queue worker.
2. `DEBT-02`: Billing run duplicate protection has application-level pre-check with theoretical concurrent database race.
3. `DEBT-03`: Sentry SDK delivery is verified; empirical live production runtime exception capture remains pending live traffic.
4. `DEBT-04`: 14 inherited non-critical npm vulnerabilities (6 moderate, 8 high, 0 critical; including newly published `browserslist` advisory) scheduled for Next 16.3+ maintenance release.

### 11.2 Deferred Features
- Stripe Connect direct debit automated reconciliation.
- Persistent background queue worker (Redis/BullMQ).
- Live bi-directional Wonde MIS synchronization.

---

## 12. Final Release Decision & Classification

**CLASSIFICATION: PASS — RC3 EVIDENCE CERTIFIED WITH ACCEPTED DEBT — READY FOR RC4**

The SprintScale CMS modernisation programme release candidate at commit `de8b4e2` has been successfully integrated into `main`, tagged `cms-modernisation-v1.1.0`, and verified live on production. All evidence claims have been substantiated through live Playwright browser instrumentation, Vercel deployment inspection, and security audits. The release is certified and approved to advance to Milestone RC4 for final post-launch stabilisation and programme closure.
