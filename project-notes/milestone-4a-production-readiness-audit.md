# Milestone 4A — Production Configuration & Infrastructure Readiness Audit
## Stage A: System & Infrastructure Audit Report

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `95487e4` (Phase 3 frozen tip)  
**Audit Conducted at:** `95487e4`

---

## 1. Environment Variable & Secret Inventory

| Variable | Used By | Server/Client | Required? | Production Critical? | Fallback / Handling | Risk |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | `src/db/index.ts` | Server | YES | CRITICAL | None (`process.env.DATABASE_URL!`); startup fails if missing | Core DB connectivity |
| `AUTH_SECRET` | NextAuth (`auth.ts`), JWT signing | Server | YES | CRITICAL | Fails safe in production (3Q CONFIG-1) | Authentication token signing |
| `PARENT_SESSION_SECRET` | `parent-auth.ts` | Server | Optional | MEDIUM | Falls back to `AUTH_SECRET` | Parent portal session signing |
| `CRON_SECRET` | `/api/cron/**` | Server | YES | HIGH | Cron endpoints return 503/401 if unset | Machine endpoint protection |
| `STRIPE_SECRET_KEY` | `stripe.ts`, portal checkout | Server | Optional | HIGH | Stripe disabled if unset/mock (`sk_xxx`) | Online card payments |
| `STRIPE_WEBHOOK_SECRET` | `stripe.ts`, invoice webhook | Server | Optional | HIGH | Webhook verification fails closed if unset | Invoice payment reconciliation |
| `RESEND_API_KEY` | `email.ts`, `reminders` | Server | Optional | HIGH | Email disabled if unset/mock (`re_xxx`) | Transactional email delivery |
| `FROM_EMAIL` | `email.ts` | Server | Optional | LOW | `noreply@sprintscaleit.co.uk` | Email sender address |
| `FROM_NAME` | `email.ts` | Server | Optional | LOW | `SprintScale` | Email sender name |
| `GOCARDLESS_ACCESS_TOKEN` | `gocardless.ts` | Server | Optional | HIGH | Unsafe stub mode in unconfigured state | Direct debit payments |
| `GOCARDLESS_ENVIRONMENT` | `gocardless.ts` | Server | Optional | LOW | `sandbox` | Direct debit API target |
| `TWILIO_ACCOUNT_SID` | `sms.ts` | Server | Optional | MEDIUM | SMS disabled if unset/mock | SMS notifications |
| `TWILIO_AUTH_TOKEN` | `sms.ts` | Server | Optional | MEDIUM | SMS disabled if unset/mock | SMS notifications |
| `TWILIO_PHONE_NUMBER` | `sms.ts` | Server | Optional | MEDIUM | SMS disabled if unset/mock | SMS notifications |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PATH` | `google-calendar.ts` | Server | Optional | LOW | `./credentials/google-service-account.json` | Google Calendar sync |
| `NEXT_PUBLIC_BASE_URL` | Booking, Login, Sharing | Both | YES | MEDIUM | Falls back to `http://localhost:3000` | Outbound links & redirects |
| `UPSTASH_REDIS_REST_URL` | `rate-limit.ts` | Server | Optional | MEDIUM | In-memory / permissive fallback | Serverless rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | `rate-limit.ts` | Server | Optional | MEDIUM | In-memory / permissive fallback | Serverless rate limiting |
| `BLOB_READ_WRITE_TOKEN` | `@vercel/blob`, `upload/route.ts` | Server | YES | HIGH | Injected automatically by Vercel Blob | File & photo storage |
| `ALLOWED_FRAME_ANCESTORS` | `next.config.ts` | Server | Optional | LOW | `'self'` only | Iframe embedding CSP |
| `NEXT_PUBLIC_SENTRY_DSN` | `instrumentation.ts` | Both | Optional | LOW | Sentry disabled if unset | Error monitoring |

---

## 2. Infrastructure & Service Readiness Audit

### 2.1 Authentication & Token Paths
- **Staff NextAuth:** NextAuth v5 session strategy is JWT; password hashing uses bcrypt; magic links and staff invites use SHA-256 token hashing (`TOKEN-1`).
- **Parent Session:** HS256 JWT cookies (`parent_session`). Secret derivation throws fail-safe error in production if `PARENT_SESSION_SECRET` / `AUTH_SECRET` is unset (`CONFIG-1`).
- **Client Exposure:** Scrutiny of all `'use client'` files confirmed zero server secrets, tokens, or private keys are exposed to the client bundle.

### 2.2 Payment Integrations (Stripe & GoCardless)
- **Stripe:** Fully configured with server-side amount calculation, customer metadata binding, and cryptographic webhook signature verification (`stripe.webhooks.constructEvent`).
- **GoCardless (DEFECT CONFIG-GC-1):** In unconfigured state, `GoCardlessService` returns stub simulated success (`CU...`, `BR...`, `PM...`). In production, this must throw an error when `GOCARDLESS_ACCESS_TOKEN` is unset rather than simulating payment success.

### 2.3 File Uploads & Storage (DEFECT UPLOAD-1)
- `/api/upload` uses `@vercel/blob` (`uploadToBlob`) with MIME validation and magic-byte checks.
- `/api/upload/logo` writes directly to local filesystem `public/uploads/logos` via `fs.writeFile`. On Vercel serverless runtime, the filesystem is ephemeral and read-only outside `/tmp`. Logo uploads must use `@vercel/blob` storage.

### 2.4 Public URL & Canonical Origin Derivation (DEFECT URL-1)
- Outbound links in `src/lib/services/booking.ts:65`, `src/app/api/portal/login/route.ts:44`, and `src/app/api/cron/reminders/route.ts:186` fall back to `http://localhost:3000` or relative paths when `NEXT_PUBLIC_BASE_URL` is omitted.
- A centralized `getBaseUrl()` utility should resolve `NEXT_PUBLIC_BASE_URL || NEXTAUTH_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000')`.

### 2.5 Cron & Machine Boundaries
- All 3 cron endpoints (`/api/cron/billing`, `/api/cron/reminders`, `/api/cron/school-year-roll`) strictly enforce `Authorization: Bearer <CRON_SECRET>`.
- `vercel.json` defines matching daily/annual schedules.

### 2.6 Serverless Rate Limiting
- `rate-limit.ts` uses `@upstash/ratelimit` with Redis sliding window. In multi-instance Vercel serverless deployments, setting `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` provides distributed rate limiting; unconfigured dev environments fail open gracefully.

### 2.7 Database Connection Pool
- `src/db/index.ts` configures `postgres(connectionString, { max: 10, idle_timeout: 20, connect_timeout: 10 })`. Compatible with pooled PostgreSQL backends (Supabase / Neon / RDS Proxy).

---

## 3. Confirmed Defects for Remediation

| ID | Severity | Surface | Root Cause | Proposed Remediation |
|----|----------|---------|------------|----------------------|
| **CONFIG-GC-1** | HIGH | `src/lib/services/gocardless.ts` | `GoCardlessService` returns stub fake success IDs when unconfigured. | In `NODE_ENV === 'production'`, calling GoCardless methods without `GOCARDLESS_ACCESS_TOKEN` must fail closed (`throw new Error('GoCardless is not configured')`). |
| **UPLOAD-1** | HIGH | `src/app/api/upload/logo/route.ts` | Logo upload writes to local disk `public/uploads/logos` via `fs.writeFile`, incompatible with Vercel serverless ephemeral filesystem. | Migrate logo upload to `@vercel/blob` (`uploadToBlob`). |
| **URL-1** | MEDIUM | Outbound links in `booking.ts`, `portal/login`, `reminders` | Fallback to `http://localhost:3000` or relative paths in email bodies when `NEXT_PUBLIC_BASE_URL` is unset. | Implement central `getBaseUrl()` helper supporting `VERCEL_URL` fallback. |
| **ENV-DOC-1** | LOW | `.env.example` | `.env.example` only lists 4 variables, missing required production keys. | Expand `.env.example` with categorized production variable inventory. |

---

## 4. Defect Count & Severity Breakdown

- **Total Confirmed Defects:** 4
- **CRITICAL:** 0
- **HIGH:** 2 (`CONFIG-GC-1`, `UPLOAD-1`)
- **MEDIUM:** 1 (`URL-1`)
- **LOW:** 1 (`ENV-DOC-1`)
- **Observations / Deferred:** 4 (Transitive npm audit advisories, Inferred workspace root warning, Next.js middleware deprecation notice, Turbopack NFT trace notice)
- **4B Blockers:** 0
- **Blocking Ambiguities:** 0

---

## 5. Stage A Conclusion & Recommendation

All 4 confirmed defects are clear engineering correctness fixes. No product-policy ambiguity exists.

**Recommendation:** Proceed directly to Stage B remediation.
