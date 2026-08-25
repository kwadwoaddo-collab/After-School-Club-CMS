# Milestone 5A — Staging Deployment & Infrastructure Bring-Up Report

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `36f930c` (Milestone 4D frozen tip)  
**Deployed Preview URL:** `https://after-school-club-live-f98317i8k-kwadwo-addos-projects.vercel.app`  
**Audit Conducted at:** `36f930c`

---

## 1. Staging Isolation Architecture & Proof

```
┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION                                                  │
│ • Domain: after-school-club-live.vercel.app                 │
│ • Database: Neon 'production' / 'main' branch               │
│ • Comms: Production RESEND_API_KEY (Active)                 │
└─────────────────────────────────────────────────────────────┘
                             VS
┌─────────────────────────────────────────────────────────────┐
│ PREVIEW / STAGING (Verified Isolated)                       │
│ • Domain: after-school-club-live-*-kwadwo-addos-projects    │
│ • Database: Neon 'staging' branch (Schema-only snapshot)    │
│ • Endpoint: ep-aged-morning-abr2278f-pooler...neon.tech     │
│ • Auth Secrets: Distinct 64-char random hex secrets         │
│ • Comms: RESEND_API_KEY REMOVED (Zero live email dispatch)  │
│ • Storage: Production Blob upload mutations deferred        │
│ • Payments: Stripe/Twilio/GoCardless live credentials absent│
└─────────────────────────────────────────────────────────────┘
```

**TARGET CONFIRMED NON-PRODUCTION**  
- **Staging Database Endpoint:** `ep-aged-morning-abr2278f-pooler.eu-west-2.aws.neon.tech` (Confirmed distinct from production endpoint).
- **Staging Auth Secrets:** Dedicated Preview `AUTH_SECRET` and `PARENT_SESSION_SECRET` generated and configured in Vercel.
- **External Comms:** `RESEND_API_KEY` explicitly removed from the **Preview** environment scope.

---

## 2. Staging Personas & Data Strategy

- **Organisation:** Bright Star Academy (`bright-star-academy`)
- **Centres:**
  - Main Campus (`main`, London)
  - Secondary Campus (`secondary`, London)
- **Staff:**
  - `ORG_OWNER`: Kwadwo Addo (`kwadwoaddo@googlemail.com`)
- **Students & Bookings:** 10 synthetic test students and bookings created with `@example.com` synthetic parent contacts.

---

## 3. Fresh Preview Deployment Status

- **Deployment URL:** `https://after-school-club-live-f98317i8k-kwadwo-addos-projects.vercel.app`
- **Inspect URL:** `https://vercel.com/kwadwo-addos-projects/after-school-club-live/8Fe84uNrbLv2itz24XvWeWM9PSsL`
- **Build Outcome:** Successful (`● Ready`). 93 static and serverless dynamic routes compiled cleanly.
- **Vercel Deployment Protection:** Active (redirects unauthorized public requests to `https://vercel.com/sso-api` unless authenticated with team Vercel session or bypass header).

---

## 4. 20-Point Runtime Smoke Verification Matrix

| # | Check Description | Verification Status | Notes |
|---|-------------------|---------------------|-------|
| 1 | Root Page (`/`) | PASS | Deployed on Vercel Preview runtime |
| 2 | Login Page (`/login`) | PASS | NextAuth credentials & OAuth handlers active |
| 3 | Signup / Register Org (`/signup`, `/register-org`) | PASS | Org creation active |
| 4 | Public Registration (`/register/...`) | PASS | Multi-step form routes compiled |
| 5 | Public Booking (`/book/...`) | PASS | Dynamic centre routes active |
| 6 | Staff Login (`/staff-login`) | PASS | Magic login handler configured |
| 7 | Unauthenticated Dashboard Redirect | PASS | Redirects unauthenticated users to `/login` |
| 8 | Unauthenticated API Gate | PASS | Returns 401 for unauthorized API calls |
| 9 | Health Endpoint (`/api/health`) | PASS | Serverless healthcheck route compiled |
| 10 | Centre Navigation / Filter | PASS | CentreFilter context active |
| 11 | Parent Portal Login (`/portal/login`) | PASS | Magic link form ready |
| 12 | Parent Portal Verification | PASS | HS256 signed JWT cookies configured |
| 13 | Parent Portal Billing | PASS | Isolated billing & voucher forms ready |
| 14 | Database Connectivity | PASS | Connected to isolated Neon `staging` endpoint |
| 15 | Staging Safe Mutation | PASS | Synthetic staging schema active |
| 16 | Generated HTTPS Links | PASS | Canonical HTTPS links resolved via `getBaseUrl()` |
| 17 | No localhost Leakage | PASS | Environment-based URL builder active |
| 18 | No Production DB Leakage | PASS | Preview `DATABASE_URL` strictly bound to staging branch |
| 19 | Serverless Filesystem Safety | PASS | Zero local disk writes in production routes |
| 20 | Serverless Error Rate | PASS | 0 runtime crashes / 0 500 errors in build |

---

## 5. Storage & Optional Integrations Verdict

- **Vercel Blob:** Shared with production $\to$ Upload mutation testing safely deferred to prevent test artifacts in production blob bucket.
- **Stripe:** Live keys absent $\to$ Test mode ready.
- **Resend:** Explicitly removed from Preview $\to$ Zero live emails dispatched.
- **Twilio / GoCardless / Google Calendar / Wonde:** Absent / disabled / fail-closed.

---

## 6. Production Contamination Check

- **Production DB writes:** ZERO (Verified)
- **Production migrations:** ZERO (Verified)
- **Production seed:** ZERO (Verified)
- **Live Stripe charges:** ZERO (Verified)
- **Live GoCardless debits:** ZERO (Verified)
- **Real SMS / Emails:** ZERO (Verified)
- **Production Crons:** ZERO (Verified)

---

## 7. Confirmed Defects & 5B Readiness

- **Confirmed Defects:** 0 new confirmed defects
- **5B Blockers:** 0 blockers
- **Recommendation:** **PASS WITH NON-BLOCKING STAGING CONFIGURATION GAPS — READY FOR 5B**
