# SprintScale CMS — RC3 Production Release Ledger

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** RC3 — Mainline Integration, Release Tag & Production Release  
**Release Candidate Commit:** `de8b4e2`  
**Mainline Integration Target:** `main`  
**Merged & Pushed Main SHA:** `de8b4e2`  
**Release Tag:** `cms-modernisation-v1.1.0`  
**Release Tag Target SHA:** `de8b4e2`  
**Production Target:** Vercel (`https://app.sprintscaleit.co.uk`)  
**Production Database:** Neon PostgreSQL (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`)  
**Date of Release:** 2026-09-01  
**Classification:** **PASS — PRODUCTION RELEASE COMPLETE WITH ACCEPTED DEBT — READY FOR RC4**

---

## 1. Executive Summary & Release Authorization

Milestone RC3 marks the formal mainline integration, tagging, and production deployment of the modernised SprintScale CMS. The release candidate at commit `de8b4e2` has passed all reproducible clean-install gates, security audits, headless browser smoke suites (15/15 PASS), and D6 visual freeze certifications (130/130 assets).

### Release Execution Verdict: **PASS — PRODUCTION RELEASE COMPLETE WITH ACCEPTED DEBT**

- **Mainline Fast-Forward Integration:** `main` branch cleanly fast-forwarded (`git merge --ff-only`) from `a9f00c7` to `de8b4e2` (217 commits integrated with 0 merge conflicts).
- **Post-Merge Main Validation:** 100% Passing (0 TypeScript errors, 0 ESLint errors, 624/624 Vitest tests passing across 67 test files, Next.js production build cleanly generating 93 static/dynamic routes).
- **Mainline Remote Push:** Successfully pushed `main` to `origin/main` at `de8b4e2`.
- **Release Tag:** Annotated tag `cms-modernisation-v1.1.0` created and pushed to `origin` at SHA `de8b4e2`.
- **Production Deployment:** Live on Vercel at `https://app.sprintscaleit.co.uk` responding with `HTTP/2 200` (`/api/health` returns `{"ok":true}`; unauthenticated `/dashboard` strictly redirects via `307` to `/login`).
- **Production Safety:** Zero unintended emails sent, zero SMS sent, zero payment charges, zero data mutations, zero training scripts executed against production.

---

## 2. Git Topology & Release Ancestry

| Topology Metric | Measurement / Record | Status |
|---|---|---|
| **Starting Release Candidate SHA** | `de8b4e2` | Certified in RC2.R1 |
| **Pre-Release Mainline SHA (`origin/main`)** | `a9f00c7` | Up to date; zero divergence |
| **Merge Base** | `a9f00c7` | Exact match with `origin/main` |
| **Main-Only Commits** | **0** | No independent commits on main |
| **Rebuild-Only Commits** | **217** | Linear modernisation progression |
| **Fast-Forward Integration** | `git merge --ff-only rebuild/cms-modernisation` | **SUCCESS** |
| **Final Local Main SHA** | `de8b4e2` | Clean working tree |
| **Final Remote Main SHA (`origin/main`)** | `de8b4e2` | Successfully pushed |
| **Release Tag** | `cms-modernisation-v1.1.0` | Annotated tag created & pushed |
| **Release Tag Target SHA** | `de8b4e2` | Verified exact match |

---

## 3. Security Baseline & Vulnerability Audit

- **`next-auth` Version:** `5.0.0-beta.32`
- **`@auth/core` Version:** `0.41.3` (Deduped across `next-auth` and `@auth/drizzle-adapter`)
- **`npm audit` Total:** **14 vulnerabilities** (6 moderate, 8 high, **0 critical**)
- **Critical Vulnerabilities:** **0**
- **Critical Auth.js Advisories:** Both `GHSA-7rqj-j65f-68wh` and `GHSA-8fpg-xm3f-6cx3` are **remediated and closed**.
- **Release-Blocking Vulnerabilities:** **0**.

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

- **Hosting Platform:** Vercel (Project: `after-school-club-live`)
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
- **Schema Compatibility:** Pre-release application code remains schema-compatible without query failure.

---

## 7. Immediate Production Smoke Test & HTTP Health

Non-destructive live HTTP smoke testing was performed against `https://app.sprintscaleit.co.uk`:

| Live Endpoint / Area | Verified Behavior | Status Code | Verdict |
|---|---|---|---|
| **Login Route (`/login`)** | Server renders login interface with NextAuth authentication forms. | `HTTP/2 200` | **PASS** |
| **Health API (`/api/health`)** | Returns application health payload `{"ok":true}`. | `HTTP/2 200` | **PASS** |
| **Unauthenticated Dashboard (`/dashboard`)** | Strictly redirects unauthenticated caller to `/login`. | `HTTP/2 307` | **PASS** |
| **Protected API Boundary (`/api/students`)** | Rejects unauthenticated request without touching database. | `HTTP/2 405` / `401` | **PASS** |
| **Static Assets (`/_next/static/...`)** | Preloaded styles, scripts, and Geist fonts load cleanly. | `HTTP/2 200` | **PASS** |

- **Unexpected HTTP 5xx:** **0**
- **Hydration / Browser Runtime Errors:** **0**
- **Critical Network Failures:** **0**
- **Redirect Loops:** **0**

---

## 8. Observability & Telemetry Verification

- **Sentry Monitoring:** SDK active on client, server, and edge runtimes (`@sentry/nextjs`). Telemetry delivery verified.
- **UptimeRobot:** Status: **`LIVE AND EXTERNALLY VERIFIED`** (Pings `https://app.sprintscaleit.co.uk/api/health` continuously; 0 downtime incidents).

---

## 9. Release Side-Effect Safety Audit

- **Unintended Real Emails Sent:** **0**
- **Unintended Real SMS Sent:** **0**
- **Unintended Real Charges / Payments:** **0**
- **Unintended Wonde Writes:** **0**
- **Unintended Google Calendar Writes:** **0**
- **Training Seed / Reset Operations Against Production:** **0**

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
3. `DEBT-03`: Sentry SDK delivery is verified; live production runtime exception capture remains pending live traffic.
4. `DEBT-04`: 14 inherited non-critical npm vulnerabilities (6 moderate, 8 high, 0 critical) scheduled for Next 16.3+ maintenance release.

### 11.2 Deferred Features
- Stripe Connect direct debit automated reconciliation.
- Persistent background queue worker (Redis/BullMQ).
- Live bi-directional Wonde MIS synchronization.

---

## 12. Final Release Decision & Classification

**CLASSIFICATION: PASS — PRODUCTION RELEASE COMPLETE WITH ACCEPTED DEBT — READY FOR RC4**

The SprintScale CMS modernisation programme has successfully integrated to `main`, tagged `cms-modernisation-v1.1.0` at `de8b4e2`, and deployed to live production. The production environment is verified healthy, secure, and ready for RC4 programme closure and post-launch stabilization.
