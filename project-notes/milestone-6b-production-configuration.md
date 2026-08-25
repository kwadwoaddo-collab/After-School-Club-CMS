# Milestone 6B — Production Configuration & Provider Bring-Up Report

**Branch:** `rebuild/cms-modernisation`  
**Starting / Working Tip SHA:** `0a4121b`  
**Approved Application Baseline SHA:** `6c205ed`  
**Vercel Project:** `after-school-club-live` (`kwadwo-addos-projects`)  
**Canonical Domain:** `https://app.sprintscaleit.co.uk`

---

## 1. Executive Verdict

**PASS WITH NON-BLOCKING DEFERRED PROVIDERS — READY FOR 6C**

The Production environment has been securely configured for the approved release candidate. Cryptographically isolated `PARENT_SESSION_SECRET` and `CRON_SECRET` tokens have been added to the Vercel Production scope. Core authentication, routing, and background services are ready for Milestone 6C (Database Safety & Migration) and Milestone 6D (Release Deployment).

---

## 2. Git State & Baseline Verification

- **Branch:** `rebuild/cms-modernisation`
- **HEAD:** `0a4121b`
- **Working Tree:** Clean (`git status --porcelain` empty).
- **Code Changes:** 0 lines of application/test code modified.

---

## 3. Production Target & Isolation Reconfirmation

- **Statement:** **`PRODUCTION TARGET CONFIRMED`**
- **Vercel Project:** `after-school-club-live`
- **Production Database Target:** `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (`neondb`, AWS eu-west-2)
- **Staging Database Target:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`neondb`, AWS eu-west-2)
- **Isolation Status:** **CONFIRMED DISTINCT**.

---

## 4. Configuration Changes Executed in 6B

| Variable Name | Environment Scope | Previous Status | Action Taken in 6B | New Status |
|---|---|---|---|---|
| `PARENT_SESSION_SECRET`| Production | MISSING | Generated 32-byte cryptographically random hex secret | **CONFIGURED (Sensitive)** |
| `CRON_SECRET` | Production | MISSING | Generated 32-byte cryptographically random hex secret | **CONFIGURED (Sensitive)** |

---

## 5. Final Vercel Production Environment Matrix

| Variable Name | Production Status | Classification | Runtime Effect |
|---|---|---|---|
| `DATABASE_URL` | CONFIGURED | Core DB | Points to Production Neon cluster |
| `AUTH_SECRET` | CONFIGURED | Core Auth | NextAuth server session signing |
| `PARENT_SESSION_SECRET`| **CONFIGURED** | Core Auth | Dedicated HS256 JWT parent cookie signing |
| `NEXTAUTH_SECRET` | CONFIGURED | Core Auth | Backwards compatibility for NextAuth |
| `AUTH_URL` | CONFIGURED | Core Routing | Canonical production domain |
| `NEXT_PUBLIC_BASE_URL` | CONFIGURED | Core Routing | Canonical production domain |
| `CRON_SECRET` | **CONFIGURED** | Background | Bearer token authorization for cron routes |
| `BLOB_STORE_ID` | CONFIGURED | Storage | Linked Vercel Blob store |
| `BLOB_WEBHOOK_PUBLIC_KEY`| CONFIGURED | Storage | Linked Vercel Blob store |
| `FROM_EMAIL` | CONFIGURED | Comms | `noreply@sprintscaleit.co.uk` |
| `RESEND_API_KEY` | NOT CONFIGURED | Comms | Safe stub mode (user can supply key for live delivery) |
| `STRIPE_*` | DEFERRED | Payments | Card checkout disabled; voucher/invoice active |
| `GOCARDLESS_*` | DEFERRED | Direct Debit | Fail-closed in production mode |
| `TWILIO_*` | DEFERRED | SMS | Disabled |
| `GOOGLE_*` / `WONDE_*` | DEFERRED | Integrations | Disabled / Coming Soon |
| `UPSTASH_REDIS_*` | DEFERRED | Rate Limiting | In-memory sliding window fallback active |

---

## 6. Service & Provider Readiness

1. **Staff Authentication:** **READY** (`AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_SECRET`).
2. **Parent Authentication:** **READY** (`PARENT_SESSION_SECRET` configured; secure HttpOnly cookies).
3. **Cron Authentication:** **READY** (`CRON_SECRET` configured; `/api/cron/billing`, `/api/cron/reminders`, `/api/cron/school-year-roll` protected).
4. **Canonical Domains:** **READY** (`https://app.sprintscaleit.co.uk` verified).
5. **Transactional Email (Resend):** **READY (Stub fallback active / live key optional)**.
6. **Vercel Blob Storage:** **READY** (`store_k0kTZtYggZRa...` linked).
7. **Deferred Providers:** Stripe card checkout, GoCardless, Twilio, Google Calendar, Wonde, and Upstash remain safely disabled.

---

## 7. Configuration Rollback Plan

- **`PARENT_SESSION_SECRET`:** Remove variable via Vercel CLI if reverting to legacy single-secret fallback.
- **`CRON_SECRET`:** Remove variable via Vercel CLI if reverting to open cron routes.
- **`AUTH_SECRET` / `DATABASE_URL`:** Retained unchanged from initial baseline; zero rotation executed.

---

## 8. Production Contamination Audit (Zero Impact)

- **Production DB writes:** 0
- **Production migrations:** 0
- **Production seed executions:** 0
- **Live Stripe / GoCardless charges:** 0
- **Real SMS / Emails dispatched:** 0
- **Production Blob mutations:** 0
- **Production cron executions:** 0

---

## 9. Next Steps (Milestone 6C Prerequisites)

1. Create point-in-time backup snapshot branch on Neon production cluster.
2. Reconcile migration `0022_wild_agent_zero` into `drizzle.__drizzle_migrations`.
3. Verify zero pending migrations before Milestone 6D release deployment.

---

## 10. Recommendation

**PASS WITH NON-BLOCKING DEFERRED PROVIDERS — READY FOR 6C**
