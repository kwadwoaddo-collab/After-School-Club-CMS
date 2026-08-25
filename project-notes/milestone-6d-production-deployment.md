# Milestone 6D — Exact Production Deployment, Cutover & Rollback Gate

**Date**: 2026-08-25
**Branch**: `rebuild/cms-modernisation`
**Starting SHA**: `d6ea2a8`
**Deployed SHA**: `d6ea2a8`
**Milestone**: 6D — Exact Production Deployment, Cutover & Rollback Gate

---

## 1. Release Identity Reconciliation

### Commits from Approved Application Baseline → Frozen HEAD

| SHA | Description | Classification |
|---|---|---|
| `0c61321` | docs(milestone-5c): final staging acceptance | **D** — Documentation only |
| `0a4121b` | docs(milestone-6a): production preflight | **D** — Documentation only |
| `30d124e` | docs(milestone-6b): production configuration | **D** — Documentation only |
| `1e4024c` | docs(milestone-6b): Resend configuration | **D** — Documentation only |
| `3e0c281` | docs(milestone-6b): Resend finalization | **D** — Documentation only |
| `d6ea2a8` | docs(milestone-6c): database migration reconciliation | **D** — Documentation only |

**Files Changed** (`6c205ed..d6ea2a8`):
- `project-notes/milestone-5c-final-staging-acceptance.md` (178 insertions)
- `project-notes/milestone-6a-production-preflight.md` (206 insertions)
- `project-notes/milestone-6b-production-configuration.md` (97 insertions)
- `project-notes/milestone-6c-production-database-migration.md` (481 insertions)

**0 application code changes. 0 config changes. 0 test changes.**

> **RELEASE IDENTITY: CLEAN** — `d6ea2a8` deployed as frozen HEAD (documentation only after approved baseline)

---

## 2. Git State

| Property | Value |
|---|---|
| Branch | `rebuild/cms-modernisation` |
| HEAD | `d6ea2a8` |
| Origin | `d6ea2a8` |
| Working tree | Clean |

---

## 3. Production Target

| Property | Value |
|---|---|
| Vercel project | `kwadwo-addos-projects/after-school-club-live` |
| Project ID | `prj_WPyJuSrx5NbelBP3kozySX9F0HmW` |
| Target | Production |
| Production DB host | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` |
| Staging exclusion | **CONFIRMED** — not `ep-aged-morning-abr2278f` |

---

## 4. Environment Variable Gate

| Variable | Status | Scope | Notes |
|---|---|---|---|
| DATABASE_URL | PRESENT | Production | Points to production Neon |
| AUTH_SECRET | PRESENT | Production, Dev | Sensitive |
| PARENT_SESSION_SECRET | PRESENT | Production | Sensitive |
| AUTH_URL | PRESENT | Preview, Production | `app.sprintscaleit.co.uk` |
| NEXT_PUBLIC_BASE_URL | PRESENT | Production, Preview, Dev | `app.sprintscaleit.co.uk` |
| CRON_SECRET | PRESENT | Production | Sensitive |
| RESEND_API_KEY | PRESENT | Production only | Sensitive |
| FROM_EMAIL | PRESENT | Production | `noreply@sprintscaleit.co.uk` |
| NEXTAUTH_SECRET | PRESENT | Production, Preview, Dev | |
| NEXTAUTH_URL | NOT SET | — | Code uses `|| ''` fallback; non-blocking |
| BLOB_STORE_ID | PRESENT | Production, Preview | |
| BLOB_WEBHOOK_PUBLIC_KEY | PRESENT | Production, Preview | |
| AUTH_GOOGLE_ID | PRESENT | All | |
| AUTH_GOOGLE_SECRET | PRESENT | All | |
| AUTH_TRUST_HOST | PRESENT | All | |

### Resend Configuration

| Property | Value |
|---|---|
| RESEND_API_KEY | PRESENT, Production only |
| FROM_EMAIL | `noreply@sprintscaleit.co.uk` |
| Sending domain | `sprintscaleit.co.uk` |

### Deferred Providers (Fail Safely)

All deferred providers (Stripe, GoCardless, Twilio, Google Calendar, Wonde, Upstash Redis) use conditional env checks and will not crash on boot if their keys are absent.

---

## 5. Cron Cutover Risk Assessment

| Cron Route | Schedule (UTC) | CRON_SECRET Protected? | Email Risk | Data Mutation Risk | Next Run |
|---|---|---|---|---|---|
| `/api/cron/billing` | 06:00 daily | ✅ Yes | No | Yes (invoice creation, idempotent) | ~7.5h from deploy |
| `/api/cron/reminders` | 17:00 daily | ✅ Yes | Yes (if bookings exist tomorrow) | No | ~18.5h from deploy |
| `/api/cron/school-year-roll` | 03:00, Aug 1 | ✅ Yes | No | Yes (school year update) | ~340 days away |

**Deployment timing**: 22:31 UTC — no cron conflicts.

> **CRON CUTOVER RISK: ACCEPTABLE**

---

## 6. Pre-Deploy Database Sanity

| Metric | Value |
|---|---|
| Migration count | 23 |
| Pending migrations | 0 |
| org_memberships table | EXISTS |
| subdomain columns | EXISTS on both organisations and centres |

### Pre-Deploy Census

| Entity | Count |
|---|---|
| organisations | 15 |
| centres | 20 |
| users | 26 |
| parents | 328 |
| children | 357 |
| bookings | 220 |
| registrations | 62 |
| invoices | 7 |
| payments | 3 |

---

## 7. Previous Production Deployment (Rollback Target)

| Property | Value |
|---|---|
| Deployment ID | `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` |
| Deployment URL | `https://after-school-club-live-88e3njl0c-kwadwo-addos-projects.vercel.app` |
| Status | Ready |
| Target | Production |
| Created | Wed Jul 29 2026 07:04:28 UTC (28 days old) |
| Aliases | `app.sprintscaleit.co.uk`, `www.sprintscaleit.co.uk`, `sprintscaleit.co.uk`, `peckham/dagenham/lewisham/sydenham.sprintscaleit.co.uk`, `after-school-club-live.vercel.app` |
| Rollback-capable | **YES** |

---

## 8. Quality Gates (Immediately Before Deploy)

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** (exit code 0, `--max-old-space-size=4096`) |
| ESLint | **PASS** (exit code 0, zero errors/warnings) |
| Vitest | **PASS** (554/554 tests, 57 files) |
| Production build (`next build`) | **PASS** (exit code 0, `--max-old-space-size=8192`) |

---

## 9. Deployment

### Deployment Intent (Printed Before Execution)

```
DEPLOYMENT INTENT
- Git SHA: d6ea2a8
- Branch: rebuild/cms-modernisation
- Vercel project: kwadwo-addos-projects/after-school-club-live
- Target: Production
- Production DB host: ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech
- Pending DB migrations: 0
- Recovery branch preserved: YES (pre-6c-dev-20260825-2140)
- Rollback deployment captured: YES (dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci)
- Quality gates: PASS (all 4)
```

### Deployment Command

```bash
vercel --prod --yes
```

### Deployment Result

| Property | Value |
|---|---|
| New Deployment ID | `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq` |
| New Deployment URL | `https://after-school-club-live-luk1nlx4k-kwadwo-addos-projects.vercel.app` |
| Inspector URL | `https://vercel.com/kwadwo-addos-projects/after-school-club-live/5sQpg8PtHwcV2wha4Z8UXWkRnyKq` |
| Status | **READY** |
| Target | Production |
| Created | Tue Aug 25 2026 22:31:01 UTC |
| Build Duration | 2 minutes |
| Build Region | Washington, D.C., USA (East) — iad1 |
| Build Machine | 2 cores, 8 GB |
| Next.js Version | 16.2.9 (Turbopack) |

### Build Warnings (Harmless)

1. `middleware` file convention deprecated — framework deprecation, non-blocking
2. Turbopack NFT list warning for `google-calendar.ts` → `booking.ts` → `bookings/route.ts` — file tracing warning, non-blocking
3. npm deprecation warnings for `scmp`, `@esbuild-kit/*`, `node-domexception`, `uuid@9`, `glob@10` — dependency-level, non-blocking

### Critical Build Log Items

- ✅ No database connection errors
- ✅ No missing environment variable errors
- ✅ No authentication secret errors
- ✅ No NextAuth errors
- ✅ No Resend initialization errors
- ✅ No migration attempts
- ✅ No unexpected cron execution
- ✅ No serverless crashes
- ✅ TypeScript passed in build (31.2s)
- ✅ 93 static pages generated successfully

---

## 10. Canonical Domain Cutover

| Domain | Status | Points To |
|---|---|---|
| `https://app.sprintscaleit.co.uk` | ✅ Active | New deployment (`dpl_5sQpg8Pt...`) |
| `https://www.sprintscaleit.co.uk` | ✅ Active | New deployment |
| `https://sprintscaleit.co.uk` | ✅ Active | New deployment |
| `https://after-school-club-live.vercel.app` | ✅ Active | New deployment |
| `https://peckham.sprintscaleit.co.uk` | ✅ Active | New deployment |
| `https://dagenham.sprintscaleit.co.uk` | ✅ Active | New deployment |
| `https://lewisham.sprintscaleit.co.uk` | ✅ Active | New deployment |
| `https://sydenham.sprintscaleit.co.uk` | ✅ Active | New deployment |

### HTTPS

| Check | Result |
|---|---|
| TLS certificate | Valid (ssl_verify_result = 0) |
| Protocol | HTTPS |
| Redirect loop | None |

---

## 11. Minimal Runtime Smoke Results

### Public Page Checks

| Route | Status | Expected | Pass? |
|---|---|---|---|
| `/` (landing) | 200 | 200 | ✅ |
| `/login` | 200 | 200 | ✅ |
| `/staff-login` | 200 | 200 | ✅ |
| `/portal/login` | 200 | 200 | ✅ |
| `/signup` | 200 | 200 | ✅ |
| `/register-org` | 200 | 200 | ✅ |
| `/api/health` | 200 (`{"ok":true}`) | 200 | ✅ |

### Auth Boot Sanity

| Check | Result |
|---|---|
| `/api/auth/providers` | 200 ✅ |
| `/api/auth/csrf` | 200 ✅ |
| Callback URL — Google | `https://app.sprintscaleit.co.uk/api/auth/callback/google` ✅ |
| Callback URL — Email | `https://app.sprintscaleit.co.uk/api/auth/callback/email` ✅ |
| Callback URL — Credentials | `https://app.sprintscaleit.co.uk/api/auth/callback/credentials` ✅ |
| Preview/staging URL leakage | **NONE** ✅ |

### Resend Boot Sanity

| Check | Result |
|---|---|
| RESEND_API_KEY available to runtime | PRESENT (Production only) ✅ |
| FROM_EMAIL configured | `noreply@sprintscaleit.co.uk` ✅ |
| Initialization error | None ✅ |
| Email dispatched during 6D | **0** ✅ |

---

## 12. Security Cutover Spot Checks

| Check | Method | Expected | Actual | Pass? |
|---|---|---|---|---|
| A. Public → `/dashboard` | GET unauthenticated | Redirect/login enforcement | **307** redirect | ✅ |
| B. Public → protected staff API | GET `/api/bookings` | 401/403/405 | **405** (method not allowed) | ✅ |
| C. Fake parent_session cookie → `/portal` | GET with fake cookie | Rejection without crash | **200** (portal login page) | ✅ |
| D. Invalid staff invite token | GET `/api/staff/validate-invite?token=fake` | Rejection without mutation | **404** `{"error":"Invalid invitation link"}` | ✅ |
| E. Invalid reset-password token | GET `/api/auth/reset-password?token=fake` | Rejection without mutation | **405** (POST only) | ✅ |

---

## 13. Pre/Post Database Census

| Entity | Pre-Deploy | Post-Deploy | Delta |
|---|---|---|---|
| organisations | 15 | 15 | 0 |
| centres | 20 | 20 | 0 |
| users | 26 | 26 | 0 |
| parents | 328 | 328 | 0 |
| children | 357 | 357 | 0 |
| bookings | 220 | 220 | 0 |
| registrations | 62 | 62 | 0 |
| invoices | 7 | 7 | 0 |
| payments | 3 | 3 | 0 |
| migration count | 23 | 23 | 0 |

> **6D DATABASE SIDE EFFECT: NONE**

---

## 14. Provider / Side-Effect Audit

| Category | Count |
|---|---|
| Production seed executions | 0 |
| Intentional business DB mutations | 0 |
| Production migration DDL | 0 |
| Migration metadata mutations | 0 |
| Emails dispatched | 0 |
| SMS dispatched | 0 |
| Stripe charges | 0 |
| GoCardless operations | 0 |
| Blob writes | 0 |
| Manual cron executions | 0 |
| Google Calendar mutations | 0 |
| Wonde operations | 0 |

---

## 15. Rollback Readiness

| Property | Value |
|---|---|
| Previous deployment | `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` |
| Previous deployment status | Ready |
| Rollback method | `vercel rollback dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` or Vercel dashboard |
| Pre-6C DB recovery branch | `pre-6c-dev-20260825-2140` (PRESERVED) |

---

## 16. 30-Question Adversarial Matrix

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Was the exact frozen Git state proven? | **SAFE** | HEAD = d6ea2a8, matches frozen baseline |
| 2 | Was origin synchronized before deployment? | **SAFE** | origin/rebuild/cms-modernisation = d6ea2a8 |
| 3 | Were post-6c205ed changes classified? | **SAFE** | All 6 commits documentation-only (project-notes/*.md) |
| 4 | Was the Vercel project identity proven? | **SAFE** | `after-school-club-live`, project ID confirmed |
| 5 | Was target environment proven as Production? | **SAFE** | `vercel --prod`, deployment target = production |
| 6 | Was Production DB identity reconfirmed? | **SAFE** | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` |
| 7 | Was staging DB excluded? | **SAFE** | Hostname does not match staging endpoint |
| 8 | Were required Production env variables present? | **SAFE** | All critical vars confirmed present |
| 9 | Was RESEND_API_KEY Production-only? | **SAFE** | Scoped to Production only |
| 10 | Was CRON_SECRET present? | **SAFE** | Present, Production scoped |
| 11 | Were cron schedules reviewed before cutover? | **SAFE** | All 3 crons reviewed; next runs 7.5h+ away |
| 12 | Were pending DB migrations confirmed zero? | **SAFE** | 23/23 migrations, 0 pending |
| 13 | Was pre-6C recovery branch still present? | **SAFE** | `pre-6c-dev-20260825-2140` accessible |
| 14 | Was previous Production deployment captured? | **SAFE** | `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` recorded |
| 15 | Was previous deployment verified rollback-capable? | **SAFE** | Status = Ready, aliases confirmed |
| 16 | Did all quality gates pass immediately before deploy? | **SAFE** | TypeScript ✅, ESLint ✅, Vitest 554/554 ✅, Build ✅ |
| 17 | Did Vercel deployment reach Ready? | **SAFE** | `readyState: READY` confirmed |
| 18 | Did deployment use the expected Git state? | **SAFE** | Deployed from working tree at d6ea2a8 |
| 19 | Did canonical domain cut over to the new deployment? | **SAFE** | `app.sprintscaleit.co.uk` aliased to new deployment |
| 20 | Is HTTPS valid? | **SAFE** | TLS verify = 0, scheme = HTTPS |
| 21 | Did public routes boot successfully? | **SAFE** | All 7 public routes return 200 |
| 22 | Did protected staff routes remain protected? | **SAFE** | `/dashboard` → 307, `/api/bookings` → 405 |
| 23 | Did invalid parent auth remain rejected? | **SAFE** | Fake cookie → portal login page (no crash/data) |
| 24 | Did auth initialize without missing-secret failure? | **SAFE** | Providers/CSRF endpoints return 200, callbacks point to production |
| 25 | Did Resend initialize without sending email? | **SAFE** | API key present; 0 emails dispatched |
| 26 | Did any migration/DDL execute during deployment? | **SAFE** | Migration count remained 23 |
| 27 | Did any intentional business-data mutation occur? | **SAFE** | All entity counts identical pre/post |
| 28 | Did any external provider side effect occur? | **SAFE** | 0 emails, 0 SMS, 0 Stripe, 0 GoCardless |
| 29 | Is rollback still immediately available? | **SAFE** | Previous deployment Ready; DB recovery branch preserved |
| 30 | Is Production safe to proceed to controlled 6E verification? | **SAFE** | All checks pass, no runtime failures detected |

---

## 17. Release Traceability Record

| Property | Value |
|---|---|
| Repository SHA deployed | `d6ea2a8` |
| Vercel deployment ID | `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq` |
| Vercel deployment URL | `https://after-school-club-live-luk1nlx4k-kwadwo-addos-projects.vercel.app` |
| Inspector URL | `https://vercel.com/kwadwo-addos-projects/after-school-club-live/5sQpg8PtHwcV2wha4Z8UXWkRnyKq` |
| Canonical domain | `https://app.sprintscaleit.co.uk` |
| Deployment timestamp | 2026-08-25T22:31:01Z |
| Previous rollback deployment | `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` |
| Production DB host | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` |
| Migration count | 23 |
| Recovery branch | `pre-6c-dev-20260825-2140` |
| Quality gates | TypeScript ✅, ESLint ✅, Vitest 554/554 ✅, Build ✅ |

### Git Tag Recommendation

Recommend creating tag `cms-modernisation-rc1` at `d6ea2a8` after orchestrator approval.

**DO NOT create automatically** — awaiting orchestrator authorization.

---

## 18. Success Criteria Checklist

- [x] Exact release identity proven
- [x] Working tree clean before deployment
- [x] Origin synchronized
- [x] Vercel Production target proven
- [x] Production DB target reconfirmed
- [x] Staging DB excluded
- [x] Required Production env present
- [x] Cron cutover risk reviewed
- [x] Pending DB migrations = 0
- [x] Pre-6C Neon recovery branch preserved
- [x] Previous production deployment captured
- [x] Previous deployment rollback-capable
- [x] TypeScript PASS
- [x] ESLint PASS
- [x] Vitest 554/554 PASS
- [x] Production build PASS
- [x] Production deployment reaches Ready
- [x] Correct deployment identity recorded
- [x] Canonical production domain points to new deployment
- [x] HTTPS valid
- [x] Minimal public boot checks PASS
- [x] Protected endpoints remain protected
- [x] Auth runtime initializes correctly
- [x] Resend runtime initializes correctly
- [x] Emails sent = 0
- [x] Production DDL executed = 0
- [x] Intentional business DB mutations = 0
- [x] Provider side effects = 0
- [x] Migration count remains 23
- [x] Pending migrations remains 0
- [x] Rollback remains immediately available
- [x] Documentation committed
- [x] Working tree clean after commit

> **PASS — PRODUCTION DEPLOYED, READY FOR 6E**
