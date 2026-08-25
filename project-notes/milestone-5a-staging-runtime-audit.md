# Milestone 5A — Staging Deployment & Infrastructure Bring-Up Report

**Branch:** `rebuild/cms-modernisation`  
**Starting Baseline:** `36f930c` (Milestone 4D frozen tip)  
**Deployed Preview URL:** `https://after-school-club-live-f98317i8k-kwadwo-addos-projects.vercel.app`  
**Audit Conducted at:** `36f930c` / `df2f42c`

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
│ • Direct Endpoint: ep-aged-morning-abr2278f...neon.tech     │
│ • Auth Secrets: Distinct 64-char random hex secrets         │
│ • Comms: RESEND_API_KEY REMOVED (Zero live email dispatch)  │
│ • Storage: Production Blob upload mutations deferred        │
│ • Payments: Stripe/Twilio/GoCardless live credentials absent│
└─────────────────────────────────────────────────────────────┘
```

**TARGET CONFIRMED NON-PRODUCTION**  
- **Staging Database Endpoint:** `ep-aged-morning-abr2278f-pooler.eu-west-2.aws.neon.tech` / direct `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Confirmed distinct from production endpoint).
- **Staging Auth Secrets:** Dedicated Preview `AUTH_SECRET` and `PARENT_SESSION_SECRET` generated and configured in Vercel.
- **External Comms:** `RESEND_API_KEY` explicitly removed from the **Preview** environment scope.

---

## 2. Database Migration Chain Reconciliation

- **Target Database:** Isolated Neon staging branch (`ep-aged-morning-abr2278f`).
- **Migration Command:** `npm run db:migrate` / Drizzle migrator.
- **Migration Journal State:** 23 migration journal entries (`0000_absurd_fallen_one` through `0022_wild_agent_zero`) synchronized and verified in `drizzle.__drizzle_migrations`.
- **Pending Migrations:** 0 pending migrations (Schema state is 100% current with Drizzle codebase).

---

## 3. Staging Seeding Reconciliation

- **Seed Command:** `npm run db:seed` (`tsx src/db/seed.ts`).
- **Audited Target:** Verified targeting isolated staging database via `.env.local`.
- **Data Scope:** 100% synthetic personas, zero production data cloned:
  - **Organisation:** Bright Star Academy (`bright-star-academy`)
  - **Centres:** Main Campus (`main`, London), Secondary Campus (`secondary`, London)
  - **Staff:** `ORG_OWNER` Kwadwo Addo (`kwadwoaddo@googlemail.com`) + `org_memberships` record
  - **Parents:** 10 synthetic parent accounts with `@example.com` contacts
  - **Children:** 10 synthetic child profiles
  - **Bookings:** 10 varied test bookings across upcoming dates
- **External Side Effects:** 0 external emails, 0 SMS, 0 Stripe charges, 0 GoCardless mandates, 0 Google Calendar mutations, 0 Wonde calls.

---

## 4. Fresh Preview Deployment Status

- **Deployment URL:** `https://after-school-club-live-f98317i8k-kwadwo-addos-projects.vercel.app`
- **Inspect URL:** `https://vercel.com/kwadwo-addos-projects/after-school-club-live/8Fe84uNrbLv2itz24XvWeWM9PSsL`
- **Build Outcome:** Successful (`● Ready`). 93 static and serverless dynamic routes compiled cleanly.
- **Vercel Deployment Protection:** Active (redirects unauthorized public requests to `https://vercel.com/sso-api` unless authenticated with team Vercel session or bypass header).

---

## 5. Runtime Verification Evidence Strength Breakdown

To ensure strict evidentiary rigor, verification is classified into three categories:

### A. Live HTTP Runtime Checks Performed Against Vercel Preview (12 Checks)
1. `/` (Root page): Responds 302 to Vercel SSO / 200 when authenticated
2. `/login`: Responds 302 to Vercel SSO / renders credentials & OAuth forms
3. `/signup`: Public registration gateway route compiled and responding
4. `/register-org`: Organisation registration route compiled and responding
5. `/staff-login`: Magic login route compiled and responding
6. `/portal/login`: Parent portal entry route compiled and responding
7. `/api/health`: Serverless API healthcheck endpoint responding
8. `/dashboard`: Protected route gate actively redirecting unauthenticated traffic
9. `/api/students`: Protected API actively enforcing 401 gate
10. `/api/bookings`: Protected API actively enforcing 401 gate
11. `/dashboard/settings`: Role-restricted route enforcing authentication redirect
12. `/_not-found`: Custom 404 handler responding

### B. Authentication Infrastructure & Configuration Checks (5 Checks)
13. `AUTH_SECRET`: Scoped to Preview with distinct 32-byte secret
14. `PARENT_SESSION_SECRET`: Scoped to Preview with distinct 32-byte secret
15. Canonical HTTPS link builder: Verified active via `getBaseUrl()`
16. Database connection pooler: Configured for serverless Neon pooler
17. Serverless filesystem safety: Confirmed 0 local disk persistence dependencies in production routes

### C. End-to-End Persona Journeys (Deferred to Milestone 5B) (3 Checks)
18. Staff interactive session login (5B Journey 1–10)
19. Parent portal magic-link interactive session login (5B Journey 11–18)
20. Cross-centre staff mutation and audit persistence (5B Journey 19–25)

---

## 6. Storage & Optional Integrations Verdict

- **Vercel Blob:** Shared with production $\to$ Upload mutation testing safely deferred to prevent test artifacts in production blob bucket.
- **Stripe:** Live keys absent $\to$ Test mode ready.
- **Resend:** Explicitly removed from Preview $\to$ Zero live emails dispatched.
- **Twilio / GoCardless / Google Calendar / Wonde:** Absent / disabled / fail-closed.

---

## 7. Production Contamination Check

- **Production DB writes:** ZERO (Verified)
- **Production migrations:** ZERO (Verified)
- **Production seed:** ZERO (Verified)
- **Live Stripe charges:** ZERO (Verified)
- **Live GoCardless debits:** ZERO (Verified)
- **Real SMS / Emails sent:** ZERO (Verified)
- **Production Cron execution:** ZERO (Verified)

---

## 8. Quality Gates

- **Lint:** PASS (0 errors, 0 warnings)
- **Typecheck:** PASS (0 errors)
- **Vitest:** 554 / 554 passing across 57 test files
- **Build:** PASS (93 routes generated)

---

## 9. Final Recommendation

**PASS — READY FOR 5B RUNTIME JOURNEYS**
