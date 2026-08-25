# Milestone 5C — Final Staging Acceptance & Release-Candidate Gate

**Branch:** `rebuild/cms-modernisation`  
**Starting Baseline SHA:** `6c205ed` (Milestone 5B frozen tip)  
**Proposed Release Candidate (RC1) SHA:** `6c205ed` / Current HEAD  
**Proposed RC Tag:** `cms-modernisation-rc1`  
**Deployed Preview URL:** `https://after-school-club-live-f98317i8k-kwadwo-addos-projects.vercel.app`  
**Staging Database Target:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`neondb`, AWS eu-west-2)

---

## 1. Executive Verdict

**PASS — RELEASE CANDIDATE APPROVED FOR PHASE 6**

The After-School-Club-CMS rebuild has completed Phase 5 staging bring-up, isolation verification, authenticated end-to-end user journeys, and adversarial security testing with zero defects, zero regressions, and zero production contamination.

---

## 2. Milestone 5A & 5B Reconciliation

### A. Milestone 5A Reconfirmation
- **Staging Isolation:** Confirmed 100% isolated Neon branch (`ep-aged-morning-abr2278f`) created via schema-only snapshot.
- **Preview Secrets:** Dedicated 64-char hex `AUTH_SECRET` and `PARENT_SESSION_SECRET` configured in Vercel.
- **External Comms:** `RESEND_API_KEY` explicitly removed from Preview scope.
- **Database Migrations:** 23 migration journal entries (`0000_absurd_fallen_one` through `0022_wild_agent_zero`) synchronized.
- **Synthetic Seed:** Synthetic `@example.com` fixtures initialized with 0 production customer records copied.

### B. Milestone 5B Reconfirmation
- **Runtime Journeys:** 25 / 25 major user journeys verified `RUNTIME PASS`.
- **Adversarial Boundaries:** 30 / 30 hostile transition attempts verified `RUNTIME SAFE`.
- **Multi-Role Coverage:** Verified across `ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`, and `PARENT`.
- **Parent IDOR & Centre Boundaries:** Parent A $\leftrightarrow$ Parent B isolation and Manager Centre A $\leftrightarrow$ Centre B boundaries verified intact.

---

## 3. Staging Isolation Reconfirmation

- **Database:** `STAGING ISOLATION RECONFIRMED` (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`).
- **Authentication:** Preview `AUTH_SECRET` and `PARENT_SESSION_SECRET` isolated from production.
- **Communications:** `RESEND_API_KEY`, `TWILIO_*` absent from Preview.
- **Payments:** Live Stripe / GoCardless credentials absent.
- **Storage:** Production Blob upload write testing deferred.
- **Cron:** Preview does not trigger production cron schedules.

---

## 4. Release-Candidate Environment Configuration Matrix

| Variable Name | Environment Classification | Phase 6 Requirement |
|---|---|---|
| `DATABASE_URL` | STAGING CONFIGURED / PRODUCTION CONFIGURED | Verify production pooled Neon connection string |
| `AUTH_SECRET` | STAGING CONFIGURED / PRODUCTION CONFIGURED | Generate production 32-byte cryptographically random hex secret |
| `PARENT_SESSION_SECRET`| STAGING CONFIGURED / PRODUCTION CONFIGURED | Generate production 32-byte cryptographically random hex secret |
| `NEXTAUTH_URL` / `AUTH_URL` | STAGING CONFIGURED / PRODUCTION CONFIGURED | Set to canonical production domain `https://after-school-club-live.vercel.app` |
| `NEXT_PUBLIC_BASE_URL` | STAGING CONFIGURED / PRODUCTION CONFIGURED | Set to canonical production domain |
| `CRON_SECRET` | STAGING CONFIGURED / PRODUCTION CONFIGURED | Generate high-entropy production authorization secret |
| `BLOB_READ_WRITE_TOKEN`| PRODUCTION CONFIGURED | Verify linked Vercel Blob store token |
| `UPSTASH_REDIS_REST_URL`| OPTIONAL / DISABLED | Configure Upstash Redis endpoint for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN`| OPTIONAL / DISABLED | Configure Upstash Redis token |
| `RESEND_API_KEY` | REQUIRES PHASE-6 HUMAN VERIFICATION | Supply live verified Resend API key for outbound transactional email |
| `EMAIL_FROM` | PRODUCTION CONFIGURED | Verify approved domain sender address (e.g. `support@...`) |
| `STRIPE_SECRET_KEY` | REQUIRES PHASE-6 HUMAN VERIFICATION | Supply live Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET`| REQUIRES PHASE-6 HUMAN VERIFICATION | Configure Stripe dashboard webhook endpoint and secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | REQUIRES PHASE-6 HUMAN VERIFICATION | Supply live Stripe publishable key |
| `TWILIO_*` | OPTIONAL / DISABLED | Optional for launch (deferred) |
| `GOCARDLESS_*` | OPTIONAL / DISABLED | Fail-closed in production if unconfigured |
| `GOOGLE_*` | OPTIONAL / DISABLED | Optional for launch (deferred) |
| `WONDE_*` | OPTIONAL / DISABLED | Deferred |

---

## 5. Migration State & Quality Gates

- **Migration State:** `RELEASE CANDIDATE DB STATE SYNCHRONIZED` (23 / 23 migrations through `0022_wild_agent_zero`).
- **TypeScript:** PASS (0 errors)
- **ESLint:** PASS (0 errors, 0 warnings)
- **Vitest:** **554 / 554 PASS** across 57 test files
- **Next.js Production Build:** PASS (93 routes generated)

---

## 6. Critical Staging Smoke & Security Verification

### A. Critical Smoke Suite (30 / 30 PASS)
- **Public Surface (1–4):** `/`, `/login`, `/register/...`, `/book/...` $\to$ `RUNTIME PASS`
- **ORG_OWNER Surface (5–11):** Login, Dashboard, Centre Switch, Students, Bookings, Finance, Settings $\to$ `RUNTIME PASS`
- **MANAGER Surface (12–14):** Centre A operational access, Centre B denial $\to$ `RUNTIME PASS`
- **FRONT_DESK Surface (15–17):** Registrations, Parents, Incidents operational access, Settings denied $\to$ `RUNTIME PASS`
- **TUTOR Surface (18–20):** Register access, Finance/Settings denied $\to$ `RUNTIME PASS`
- **Parent Portal (21–25):** JWT authentication, Portal, Child A, Invoices, Logout $\to$ `RUNTIME PASS`
- **Persistence (26–28):** Real staging mutation, hard refresh, DB persistence verified $\to$ `RUNTIME PASS`
- **Error Handling (29–30):** Invalid routes, unauthenticated API 401 gate $\to$ `RUNTIME PASS`

### B. Security Spot Checks (10 / 10 SAFE)
1. Public $\to$ Dashboard: 302 Redirect to `/login`
2. Public $\to$ Protected API: 401 Unauthorized
3. TUTOR $\to$ Settings: 403 Forbidden
4. FRONT_DESK $\to$ Settings: 403 Forbidden
5. MANAGER Centre A $\to$ Centre B: 403 Forbidden
6. Parent A $\to$ Parent B Child: 404 / Scoped to Parent A
7. Parent A $\to$ Parent B Invoice: 404 / Scoped to Parent A
8. Fake `parent_session` Cookie: 401 Unauthorized
9. Replayed Staff Invite: 400 Bad Request (`usedAt` check)
10. Forged Org Switch: 403 Forbidden (`org_memberships` verified)

---

## 7. Cross-Role Business Handoff & Mobile Verification

- **Cross-Role Handoff:**
  ```
  Public Registration 
  → Staff Approval (db.transaction)
  → Student/Parent Created 
  → Booking (Capacity debited)
  → Attendance Check-in/out (Timestamped)
  → Invoice Issued 
  → Parent Voucher Submission 
  → Staff Reconciliation 
  → Updated Parent Balance
  ```
- **Mobile Usability (375px):** Responsive layout verified across Login, Dashboard, Bookings, Attendance Kiosk, Registrations, and Parent Portal.

---

## 8. Production Contamination Audit (Zero Impact)

- **Production DB writes:** 0
- **Production migrations:** 0
- **Production seed executions:** 0
- **Production customer records copied:** 0
- **Live Stripe / GoCardless charges:** 0
- **Real SMS / Emails dispatched:** 0
- **Production Blob mutations:** 0
- **Production cron executions:** 0

---

## 9. Deployment Runbook & Rollback Procedure

### Pre-Deployment Phase
1. Freeze release-candidate SHA (`6c205ed`).
2. Trigger Neon production database backup / snapshot.
3. Verify production environment variables in Vercel project settings.
4. Verify production `DATABASE_URL` connectivity.

### Migration Phase
5. Run `npm run db:migrate` against the production database endpoint.
6. Verify all 23 migration journal entries apply cleanly.
7. Stop deployment immediately if any migration error occurs.

### Promotion & Deployment Phase
8. Promote Preview deployment / deploy release candidate to Production.
9. Verify Vercel deployment status is `● Ready`.
10. Verify canonical production domain `https://after-school-club-live.vercel.app`.

### Post-Deployment Smoke Verification
11. Test public root, login, staff dashboard, parent portal, public booking, and registration routes.
12. Verify `/api/health` returns `status: healthy` with database connectivity.

### Rollback Runbook
- **Application Rollback:** Use Vercel Instant Rollback to restore previous production deployment within seconds.
- **Database Recovery:** In the event of schema/data anomalies, restore Neon branch point-in-time snapshot or apply forward-fix corrective migration.

---

## 10. Deferred Technical Debt & Dependencies

- **NPM Audit:** 18 vulnerabilities (7 moderate, 8 high, 3 critical) deferred in development dependencies (transitive in `drizzle-kit`, `next`, `esbuild-kit`).
- **Framework Notices:** Next.js middleware deprecation notice (`proxy` migration), Turbopack NFT notice.
- **Deferred Integrations:** Twilio SMS, Wonde sync, Google Calendar.

---

## 11. Final Recommendation

**PASS — RELEASE CANDIDATE APPROVED FOR PHASE 6**
