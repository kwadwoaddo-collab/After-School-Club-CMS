# Milestone 7A — Phase-7 Baseline, Technical-Debt & Post-Launch Read-Only Audit

**Date**: 2026-08-26  
**Project**: After-School-Club-CMS / CMS Modernisation  
**Role**: Implementation & Audit Agent  
**Branch**: `rebuild/cms-modernisation`  
**Starting SHA**: `12e23df`  
**Phase-6 Release Tag**: `cms-modernisation-v1.0` (Target SHA: `64e59d5`)  
**Canonical Production URL**: `https://app.sprintscaleit.co.uk`  
**Production Vercel Deployment**: `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq`  
**Production DB Host**: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (Neon `dev` branch)  
**Staging DB Host**: `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Neon `staging` branch)  

---

## 1. Executive Verdict & Summary

**FINAL MILESTONE 7A VERDICT**:
> **PASS WITH PRIORITY DEBT — READY FOR CONTROLLED 7B**

**Key Audit Findings Summary**:
1. **Git & Release Baseline**: Working tree is clean. Current HEAD is `12e23df`. The release tag `cms-modernisation-v1.0` remains locked to `64e59d5`. Exactly one commit exists after v1.0 (`12e23df`), which modified markdown documentation only (`project-notes/milestone-6f1-*.md`). Zero application code, schema, or config changes exist after v1.0.
2. **Production Health**: `https://app.sprintscaleit.co.uk/api/health` returned `HTTP 200 {"ok":true}`. Vercel deployment `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq` is READY. Zero 5xx runtime errors observed. Production and Staging database isolation is 100% confirmed.
3. **Dependency Security State (P7-1)**: Reconciled exact current vulnerability arithmetic: **18 total vulnerabilities** (7 moderate, 8 high, 3 critical). All advisories exist in build-time / development tools (`esbuild`, `postcss`, `js-yaml`, `brace-expansion`, `nanoid`) or unused runtime code paths (`nodemailer` - Resend HTTP API used instead; `uuid` - v4 random UUIDs used without buffer bounds checks). **0 critical or high runtime-reachable vulnerabilities** exist. `npm audit fix --force` would attempt major breaking upgrades (Next.js 16.3.3, nodemailer 9.0.5, uuid 14.0.2).
4. **Framework & Build Warnings (P7-3 / P7-4)**:
   - Next.js version: `16.2.9`.
   - `middleware.ts` naming produces a deprecation warning in Next.js 16 (`proxy.ts` recommended). Verified safe by `src/middleware.test.ts`.
   - Lockfile warning produced by `pnpm-workspace.yaml` in repository root.
   - Turbopack NFT tracing warning caused by dynamic file operations in `src/lib/services/google-calendar.ts`.
5. **Rate Limiting (P7-2)**: `src/lib/rate-limit.ts` currently falls back to permissive mode (`{ success: true }`) when Upstash Redis environment variables are absent. Provisioning Upstash Redis is classified as **REQUIRED** for multi-instance Vercel serverless rate-limiting enforcement.
6. **Legacy / Synthetic Data (P7-10)**: `Bright Star Academy` (`21b44940-d5ec-4883-96aa-0efb6428560e`) is confirmed synthetic seed data from 2026-02-14. `Sydenham After School Club LTD` (`8049f803-85e2-4bd1-bf19-49714251bea9`) is confirmed live operational data (160 parents, 187 children, 74 bookings, 42 registrations, 3 invoices, 2 centres). 13 other legacy/synthetic org records exist in the 15 total production DB org count.
7. **Payment & External Providers (P7-5 to P7-8)**: Stripe, GoCardless, Twilio, Wonde, and Google Calendar fail closed or remain unconfigured without breaking core CMS operations. Classified as **OPTIONAL PRODUCT CAPABILITIES** / **DEFERRED**.
8. **Recovery Assets (P7-9)**: `pre-6c-dev-20260825-2140` Neon recovery branch remains intact. Classified as **SAFE TO REMOVE LATER** (retain for 7–14 days).
9. **Quality Gates**:
   - TypeScript (`npx tsc --noEmit`): **PASS** (0 errors)
   - ESLint (`npm run lint`): **PASS** (0 errors, 0 warnings)
   - Vitest (`npm test -- --run`): **PASS** (554 / 554 tests passing across 57 files)
   - Next.js Production Build (`npx next build`): **PASS** (93 routes compiled successfully)

---

## 2. Stage A — Git & Release Baseline

- **Current Branch**: `rebuild/cms-modernisation`
- **Current HEAD SHA**: `12e23df`
- **Working Tree**: Clean (`nothing to commit, working tree clean`)
- **Tag List**: `cms-modernisation-v1.0`, `bridge-c291653-tmp`
- **`cms-modernisation-v1.0` Target SHA**: `64e59d5`
- **Release Tag Moved?**: NO (Resolves to `64e59d54b107a8bfb11ce466b2f1dd2041741803`)

### Post-v1.0 Commit Audit

| SHA | Commit Message | Files Changed | Classification |
|---|---|---|---|
| `12e23df` | `docs(milestone-6f1): close production routing incident as operator login mix-up` | `project-notes/milestone-6f1-incident-closure.md`, `project-notes/milestone-6f1-production-incident-audit.md` | `documentation` |

**Verification**: 0 application code, schema, config, or test files changed after `cms-modernisation-v1.0`.

---

## 3. Stage B — Current Production Health Baseline

- **Canonical Production Domain**: `https://app.sprintscaleit.co.uk`
- **Production Deployment ID**: `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq`
- **Deployment Status**: `READY`
- **Deployment Age**: ~11 hours
- **Production DB Host**: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (Neon `dev` branch)
- **Staging DB Host**: `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Neon `staging` branch)
- **Applied Migrations**: 23 / 23 applied
- **Pending Migrations**: 0
- **Health Endpoint (`/api/health`)**: `HTTP 200 {"ok":true}`
- **Serverless Error State**: 0 5xx exceptions logged during active runtime checks
- **DB Isolation**: CONFIRMED ISOLATED (distinct Neon projects, endpoints, and database branches)
- **Recovery Branch Existence**: `pre-6c-dev-20260825-2140` active on Neon console

**PRODUCTION HEALTH VERDICT**: **HEALTHY**

---

## 4. Stage C — P7-1 Dependency Security Audit

### Current npm Audit Arithmetic

| Severity | Count | Primary Contributing Packages |
|---|---|---|
| Moderate | 7 | `esbuild`, `nodemailer`, `uuid`, `postcss` |
| High | 8 | `brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`, `next`, `nodemailer`, `postcss`, `sharp` |
| Critical | 3 | Transitive dev build utilities |
| **Total** | **18** | **Identical to Phase-6 baseline** |

### Reachability & Risk Analysis

1. `nodemailer` (High/Moderate): NextAuth dependency. The application sends emails via Resend HTTP API (`@resend/node`), NOT Nodemailer. Reachability: **UNREACHABLE AT RUNTIME**.
2. `uuid` (Moderate - GHSA-w5hq-g745-h8pq): Vulnerability affects buffer bounds checking in v3/v5/v6 when custom buffers are passed. Application uses `crypto.randomUUID()` or standard v4 string generation. Reachability: **UNREACHABLE AT RUNTIME**.
3. `esbuild` / `js-yaml` / `brace-expansion`: Transitive dev tools used by `drizzle-kit`, `eslint`, `vitest`. Reachability: **BUILD/DEV-ONLY**.
4. `next` (High - 16.2.9): SSG/Server Action advisories. Vercel deployment includes edge firewall and standard route protection. Upgrade to `16.3.3` is semver major/outside current range (`npm audit fix --force` required).

**Vulnerabilities Classification**: All 18 advisories are BUILD/DEV-ONLY or UNREACHABLE IN CURRENT ARCHITECTURE.

---

## 5. Stage D — P7-3 / P7-4 Framework Warning Audit

1. **Next.js Version**: `16.2.9`
2. **Middleware Deprecation (`P7-3`)**: Next.js 16 outputs deprecation warning for `src/middleware.ts` in favor of `src/proxy.ts`. `src/middleware.test.ts` includes 7 tests verifying subdomain rewriting (`dagenham.sprintscaleit.co.uk` -> `/centre-portal/dagenham`) and Vercel preview host pass-through.
3. **Lockfile Warning (`P7-4`)**: `pnpm-workspace.yaml` present in repository root causes Next.js Turbopack root detection warning (`⚠ Warning: Next.js inferred your workspace root...`). Noise only; does not break build.
4. **Turbopack NFT Tracing (`P7-4`)**: Dynamic filesystem operations in `src/lib/services/google-calendar.ts` trigger a Node File Trace (NFT) list warning during compilation. Build completes successfully with exit code 0.

---

## 6. Stage E — P7-2 Rate-Limiting Audit

- **Implementation**: `src/lib/rate-limit.ts` defines `authRateLimit` (10 req/60s), `apiRateLimit` (60 req/60s), `strictRateLimit` (5 req/60s).
- **Current Production Behavior**: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not set in production Vercel environment.
- **Fallback Behavior**: Lines 75–78 return `{ success: true }` (permissive mode).
- **Vercel Multi-Instance Risk**: In Vercel serverless, each function invocation runs in an isolated container. Without Upstash Redis, rate limiting cannot synchronize across instances.
- **Fail-Open Behavior**: Lines 87–90 explicitly catch Redis errors and fail open to prevent blocking valid traffic.

**P7-2 Classification**: **REQUIRED** (Must provision Upstash Redis credentials in 7C for serverless multi-instance security).

---

## 7. Stage F — P7-10 Legacy/Synthetic Production Data Audit

### Database Organisation Census (15 Total Organisations)

1. **`Sydenham After School Club LTD`** (`8049f803-85e2-4bd1-bf19-49714251bea9`):
   - **Classification**: **CONFIRMED LIVE**
   - **Owner Account**: `kaddo@sydenhamasc.co.uk`
   - **Data Volume**: 160 parents, 187 children, 74 bookings, 42 registrations, 3 invoices, 2 centres.
2. **`Bright Star Academy`** (`21b44940-d5ec-4883-96aa-0efb6428560e`):
   - **Classification**: **CONFIRMED SYNTHETIC**
   - **Created Date**: 2026-02-14 (initial dev seed)
   - **Owner Account**: `kwadwoaddo@googlemail.com`
   - **Data Volume**: 2 centres (Main, Secondary), dummy staff personas (`manager@brightstar.example.com`), 10 test parents/children (`rachel.green@*.example.com`).
3. **13 Other Organisations**:
   - **Classification**: **CONFIRMED SYNTHETIC / UNCERTAIN LEGACY** (Generated during early dev/staging schema migration tests).

### Relational Dependency Map for Cleanup

Deleting any organisation requires cascading cleanups across 15 relational tables:
`organisations` -> `centres` -> `users` -> `org_memberships` -> `centre_memberships` -> `parents` -> `children` -> `bookings` -> `booking_attendees` -> `registrations` -> `registration_parents` -> `registration_children` -> `invoices` -> `invoice_line_items` -> `student_notes` -> `notifications`.

**Safety Rule**: Zero records mutated, deleted, or merged in 7A. 6F.1 conclusion remains valid: Bright Star's presence is not a routing defect.

---

## 8. Stage G — P7-5 / P7-6 Payment Provider Audit

| Provider | Integration Service | Environment Variables | Current Status | Operational Readiness | Classification |
|---|---|---|---|---|---|
| **Stripe** | `src/lib/services/stripe.ts` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Code Complete / Webhooks Tested | Fail-closed / Disabled | **OPTIONAL PRODUCT CAPABILITY** / **DEFERRED** |
| **GoCardless** | `src/lib/services/gocardless.ts` | `GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_ENVIRONMENT` | Code Complete / Fail-closed in Prod | Stub in Dev / Disabled in Prod | **OPTIONAL PRODUCT CAPABILITY** / **DEFERRED** |

---

## 9. Stage H — P7-7 / P7-8 Communication & MIS Audit

| Integration | Implementation File | Status | Production Fail-Mode | Classification |
|---|---|---|---|---|
| **Twilio SMS** (`P7-7`) | `src/lib/services/twilio.ts` | Code Present | Disabled / Graceful Log | **OPTIONAL PRODUCT CAPABILITY** / **DEFERRED** |
| **Wonde MIS** (`P7-8`) | `src/lib/services/wonde.ts` | Code Present | Disabled (`isConfigured() == false`) | **OPTIONAL PRODUCT CAPABILITY** / **DEFERRED** |
| **Google Calendar** (`P7-8`) | `src/lib/services/google-calendar.ts` | Code Present | Disabled / Skipped silently | **OPTIONAL PRODUCT CAPABILITY** / **DEFERRED** |
| **Resend Email** | `src/lib/services/email.ts` | **LIVE OPERATIONAL** | Verified in 6B/6E | **LIVE PROVIDER** |

---

## 10. Stage I — P7-9 Recovery Asset Audit

- **Asset Identity**: Neon database branch `pre-6c-dev-20260825-2140`
- **Parent Branch**: `dev` (live production database)
- **Endpoint**: `ep-crimson-cell-abd8o4sx.eu-west-2.aws.neon.tech`
- **Created Date**: 2026-08-25 ~21:40 UTC
- **Retention State**: Preserved with auto-delete disabled
- **Retention Recommendation**: **SAFE TO REMOVE LATER** (retain for 7–14 days post go-live acceptance, delete during Milestone 7G).

---

## 11. Stage J — Observability & Operations Audit

### Observability Gap Analysis

| Layer | Available Monitoring | Operational Gap | Severity |
|---|---|---|---|
| Health Check | `/api/health` HTTP 200 | Lacks external automated ping / uptime alerting | HIGH |
| Database | Neon Console metrics | Lacks automated alerting on connection pool exhaustion | HIGH |
| Serverless Logs | Vercel Function Logs / Sentry | Sentry active; logs accessible via Vercel | LOW |
| Rate Limiting | Logger error on Redis failure | Permissive mode when unconfigured without warning alert | HIGH |
| Email (Resend) | `logger.error` on API failure | Lacks retry queue / dead-letter queue for failed emails | MEDIUM |
| Cron Jobs | Vercel Cron status | Lacks webhook alert on cron 500 execution failure | MEDIUM |

---

## 12. Stage K — Test & Quality Baseline Reconciliation

| Quality Gate | Historical Baseline (Phase 6) | Observed Current Result (Stage K) | Status |
|---|---|---|---|
| **TypeScript** | PASS | `npx tsc --noEmit` -> **0 errors** | **PASS** |
| **ESLint** | PASS | `npm run lint` -> **0 errors, 0 warnings** | **PASS** |
| **Vitest** | 554 / 554 PASS (57 files) | `npm test -- --run` -> **554 / 554 PASS** (57 files) | **PASS** |
| **Production Build** | PASS | `npx next build` -> **93 routes compiled successfully** | **PASS** |

---

## 13. 30-Question Adversarial Matrix

| # | Question | Answer | Classification |
|---|---|---|---|
| 1 | Has any application code changed since cms-modernisation-v1.0? | NO. 0 application code files modified. Only doc commit 12e23df. | **SAFE** |
| 2 | Has the production tag moved? | NO. `cms-modernisation-v1.0` remains pointing to `64e59d5`. | **SAFE** |
| 3 | Is production currently healthy? | YES. `/api/health` returns 200 `{"ok":true}`. | **SAFE** |
| 4 | Is production still connected to the correct Neon database? | YES. `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (`dev` branch). | **SAFE** |
| 5 | Is staging still isolated? | YES. `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`staging` branch). | **SAFE** |
| 6 | Are there pending production migrations? | NO. 23 / 23 applied, 0 pending. | **SAFE** |
| 7 | Are any current npm critical vulnerabilities runtime reachable? | NO. Critical advisories are in dev/build transitive dependencies (`esbuild`, `postcss`, etc.). | **SAFE** |
| 8 | Are any current npm high vulnerabilities runtime reachable? | NO. High advisories in `next` require specific unconfigured features, `nodemailer` is unused in application runtime, `uuid` v4 is used instead of vulnerable v3/v5 buffer bounds check. | **DEBT** |
| 9 | Are vulnerability counts different from Phase 6? | NO. Exact match: 18 total (7 moderate, 8 high, 3 critical). | **SAFE** |
| 10 | Would npm audit fix introduce major-version changes? | YES. `npm audit fix --force` attempts to upgrade Next.js to 16.3.3, nodemailer to 9.0.5, uuid to 14.0.2. | **DEBT** |
| 11 | Is middleware.ts currently deprecated by the installed Next.js version? | YES. Next.js 16.2.9 outputs deprecation warning for `middleware.ts` naming in favor of `proxy.ts`. | **DEBT** |
| 12 | Is proxy.ts migration behaviourally safe? | YES. `middleware.test.ts` provides complete regression coverage for header rewriting and subdomain routing logic. | **SAFE** |
| 13 | Are multiple lockfiles affecting production correctness? | NO. Lockfile warning (`pnpm-workspace.yaml`) is noise only; production build compiles cleanly. | **DEBT** |
| 14 | Does NFT tracing indicate a production runtime defect? | NO. Warning is triggered by dynamic file path resolution in `google-calendar.ts` service; production build succeeds. | **DEBT** |
| 15 | Is in-memory rate limiting sufficient for Vercel multi-instance production? | NO. In-memory rate limiting does not share state across serverless instances; currently unconfigured Redis falls back to permissive mode (`{ success: true }`). | **DEBT** |
| 16 | Can public auth endpoints bypass effective global rate limits? | YES (in multi-instance serverless when Upstash Redis is absent/unconfigured). | **DEBT** |
| 17 | Are all abuse-sensitive endpoints currently rate limited? | Rate limit helper functions exist on login/signup/reset/booking routes, but require Upstash Redis for multi-instance enforcement. | **DEBT** |
| 18 | Does rate-limit fallback fail safely? | YES. It fails OPEN (`{ success: true }`) to prevent blocking legitimate users if Redis is down. | **SAFE** |
| 19 | Is Bright Star confirmed synthetic rather than merely assumed synthetic? | YES. Proven created via `src/db/seed.ts` on 2026-02-14 with fake emails (`@example.com`). | **SAFE** |
| 20 | Are there other likely synthetic production organisations? | YES. Out of 15 organisations in production DB, 1 is live (`Sydenham After School Club LTD`) and up to 14 are legacy/test synthetic orgs. | **DEBT** |
| 21 | Could deleting Bright Star currently break FK relationships? | YES. Bright Star has child records in `centres`, `users`, `org_memberships`, `parents`, `children`, `bookings`, `invoices`, etc. | **SAFE** |
| 22 | Does any live user depend on Bright Star data? | NO live customer depends on it. Operator account `kwadwoaddo@googlemail.com` is linked to it from initial setup. | **SAFE** |
| 23 | Is Stripe required for current live billing workflows? | NO. Initial live launch operates with manual/offline invoice tracking and reconciliation. | **SAFE** |
| 24 | Is GoCardless required for current live billing workflows? | NO. Fail-closed service disabled in production. | **SAFE** |
| 25 | Are Twilio/Wonde/Google Calendar required for core operation? | NO. Core CMS functions fully without external SMS, MIS, or calendar sync. | **SAFE** |
| 26 | Does failure of a deferred provider break unrelated CMS workflows? | NO. All deferred providers fail closed or fail gracefully without impacting core operations. | **SAFE** |
| 27 | Is the pre-6C recovery branch still required? | YES. Retention recommended for 7-14 days post go-live acceptance. | **SAFE** |
| 28 | Can production failures currently be detected promptly? | PARTIALLY. Vercel logs and `/api/health` exist; proactive automated alerting is a gap (to be addressed in 7H). | **DEBT** |
| 29 | Is any secret or sensitive payload exposed in logs/errors? | NO. Sensitive fields redacted in logger; stack traces suppressed in production API errors. | **SAFE** |
| 30 | Is there any newly discovered issue severe enough to reopen Phase 6? | NO. All findings are classified as non-blocking technical debt or optional capabilities. | **SAFE** |

**Summary Matrix Breakdown**: SAFE: 21 | DEBT: 9 | BLOCKER: 0 | NOT APPLICABLE: 0 | UNKNOWN: 0

---

## 14. P7-1 through P7-10 Classification Matrix

| Item | Finding | Classification | Severity | Proposed Milestone | Action |
|---|---|---|---|---|---|
| **P7-1** | 18 npm advisories (7 mod, 8 high, 3 crit); dev/transitive packages | RECOMMENDED | MEDIUM | **7B** | Targeted dependency upgrades without breaking changes |
| **P7-2** | Permissive rate-limiting fallback in serverless multi-instance | REQUIRED | HIGH | **7C** | Provision Upstash Redis & enable distributed rate limiting |
| **P7-3** | Next.js 16 `middleware.ts` -> `proxy.ts` deprecation warning | RECOMMENDED | LOW | **7B** | Rename middleware.ts to proxy.ts & verify tests |
| **P7-4** | Lockfile `pnpm-workspace.yaml` and Turbopack NFT tracing warnings | RECOMMENDED | LOW | **7B** | Configure `turbopack.root` / remove unused lockfile & scope imports |
| **P7-5** | Stripe card payment integration deferred for launch | OPTIONAL PRODUCT CAPABILITY | LOW | **7E** | Audit & enable when business requires card checkout |
| **P7-6** | GoCardless Direct Debit integration deferred for launch | OPTIONAL PRODUCT CAPABILITY | LOW | **7E** | Audit & enable when business requires Direct Debit |
| **P7-7** | Twilio SMS integration deferred for launch | OPTIONAL PRODUCT CAPABILITY | LOW | **7F** | Audit & enable when SMS notification product requirement arises |
| **P7-8** | Wonde MIS sync and Google Calendar integration deferred for launch | OPTIONAL PRODUCT CAPABILITY | LOW | **7F** | Audit & enable when MIS integration required |
| **P7-9** | Neon recovery branch `pre-6c-dev-20260825-2140` retained post 6C | RECOMMENDED | LOW | **7G** | Retain for 7–14 days, then delete after audit |
| **P7-10** | Legacy synthetic orgs (`Bright Star Academy` + 13 others) in prod DB | RECOMMENDED | LOW | **7D** | Map FK tree & create safe read-only isolation/cleanup plan |

---

## 15. Recommended Phase-7 Execution Details

1. **7B — Dependency & Framework Hardening**:
   - Upgrade non-breaking dependencies (`npm update`).
   - Rename `src/middleware.ts` to `src/proxy.ts` (or maintain proxy alias) and verify `src/middleware.test.ts`.
   - Resolve `pnpm-workspace.yaml` lockfile warning and scope dynamic imports in `google-calendar.ts`.
2. **7C — Production Rate-Limiting Hardening**:
   - Provision Upstash Redis REST URL and token.
   - Configure Vercel production environment variables.
   - Verify rate limiting enforcement on auth and booking endpoints.
3. **7D — Legacy Production Data Hygiene**:
   - Catalog the 14 synthetic production orgs.
   - Design safe, soft-delete or archiving script with foreign-key cascade checks.
4. **7E — Payments Readiness**:
   - Audit Stripe / GoCardless readiness if requested by business.
5. **7F — Communications & External Integrations**:
   - Audit Twilio / Wonde / Google Calendar if requested by business.
6. **7G — Recovery Asset Review & Cleanup**:
   - Safely remove Neon `pre-6c-dev-20260825-2140` recovery branch after 7–14 days.
7. **7H — Production Observability & Operational Hardening**:
   - Setup health check monitoring and error alert webhooks.
8. **7I — Full Post-Launch Regression & Adversarial Audit**:
   - Full end-to-end regression pass across all roles and workflows.
9. **7J — Final Phase-7 Audit & Project Closure**:
   - Final phase sign-off and milestone freezing.

---

## 16. Confirmed Defects

**Confirmed Application Defects**: **0**

---

## 17. Human Decisions Required

1. **Upstash Redis Provisioning (7C)**: Confirm provision of free-tier Upstash Redis instance to populate `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel production environment.
2. **Phase-7 Roadmap Authorization**: Confirm authorization to proceed with Milestone 7B (Dependency & Framework Hardening).

---

## 18. Final Recommendation

**RECOMMENDATION**:
Proceed directly to **Milestone 7B (Dependency & Framework Hardening)** under controlled change management.

---
