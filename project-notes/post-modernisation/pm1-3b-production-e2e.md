# PM-1.3B — Controlled Production SaaS Onboarding E2E
## Migration, Certified Release and First Real Production Lifecycle Verification

**Verification Date/Time:** 2026-09-05T04:20:00Z  
**Application Release SHA:** `b80cc7ba8840673078a6fffaea5b34015dc3df3a` (`b80cc7b`)  
**Production Domain:** `https://app.sprintscaleit.co.uk`  
**Status:** **PRODUCTION E2E COMPLETE — PENDING FINAL ORCHESTRATOR REVIEW**  
**Final Recommendation:** **PASS — PM-1.3B PRODUCTION E2E VERIFIED**  

---

### 1. Executive Summary

Milestone **PM-1.3B** represents the first end-to-end operational verification of the external multi-tenant onboarding lifecycle against live production infrastructure. 

Prior to mutating production data or deploying code, temporary Vercel Firewall protection was staged and published across all public creation and signup surfaces to prevent concurrency hazards. Database migration `0025_terms_acceptance.sql` was applied in an atomic transaction to add `terms_accepted_at` and `terms_version` without backfilling or fabricating historical user acceptance data. Certified release `b80cc7b` was pushed and deployed to production, reaching **● Ready** on `https://app.sprintscaleit.co.uk`.

A single controlled synthetic canary account and organisation was created through the real public user interface. The entire onboarding lifecycle was exercised and verified:
1. Public signup with mandatory versioned legal terms acceptance (`2026-09-01`).
2. Organisation onboarding and first centre creation with logo upload.
3. Strict enforcement of `PENDING` status landing on `/pending-approval`.
4. Persistence of `PENDING` state across page reloads, sign-out, and sign-in.
5. Direct navigation barrier redirecting `/dashboard` to `/pending-approval`.
6. Platform administrator review and approval via the production platform management UI (`/platform/organisations`).
7. Automatic promotion to `ACTIVE` status with verified `org.approved` audit event logging.
8. Operational dashboard access and tenant isolation verification (zero cross-tenant data leakage).
9. Dependency-safe relational cleanup restoring production exactly to the 1-organisation pre-migration baseline.

---

### 2. Pre-Migration Baseline & Environment State

- **Branch:** `main`
- **Certified Local HEAD:** `b80cc7b`
- **Origin Main (pre-release):** `64dcb17`
- **Origin Rebuild (pre-release):** `64dcb17`
- **Working Tree:** Clean
- **Certification Gates Reconfirmed:**
  - Typecheck: `npm run typecheck` → PASS (0 errors)
  - Lint: `npm run lint` → PASS (0 errors, 0 warnings)
  - Unit/Security Tests: `npm test` → PASS (76 test files, 811 tests passed)
  - Production Build: `npm run build` → PASS (156 static pages, 133 routes)
  - Git Diff Check: `git diff --check` → PASS (0 warnings)
- **Pre-Migration Production Database Baseline:**
  - Total organisations: `1`
  - ACTIVE: `1` (`Sydenham After School Club LTD`)
  - PENDING: `0`
  - SUSPENDED: `0`
  - REJECTED: `0`
  - NULL: `0`
  - `users.terms_accepted_at` & `users.terms_version`: Absent (verified)

---

### 3. Temporary Signup Protection (Edge Firewall)

Before applying the database migration or pushing application code, public creation surfaces were shielded using Vercel Web Application Firewall:
- **Rule Name:** `PM-1.3B Temporary Signup Protection`
- **Protected Paths:**
  - `/signup`
  - `/api/auth/signup`
  - `/onboarding`
  - `/api/onboarding`
  - `/api/organisations`
  - `/register-org`
- **Verification During Protection:**
  - `/` → HTTP 200 (healthy)
  - `/login` → HTTP 200 (healthy)
  - `/signup` → HTTP 403 (blocked at Edge)
  - `/onboarding` → HTTP 403 (blocked at Edge)
  - `/api/onboarding` → HTTP 403 (blocked at Edge)
  - Existing active tenant was completely unaffected and operational.

---

### 4. Database Migration 0025 Execution

Migration `drizzle/0025_terms_acceptance.sql` was applied to the live production PostgreSQL cluster in an atomic transaction:
```sql
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "terms_version" varchar(50);
```
- **Execution Status:** SUCCESS
- **Column Verification:**
  - `terms_accepted_at`: `timestamp with time zone`, nullable, default `NULL`.
  - `terms_version`: `character varying(50)`, nullable, default `NULL`.
- **Historical Data Safety:** `0` existing users had fabricated or backfilled acceptance values. Pre-existing records legitimately retain `NULL` acceptance.

---

### 5. Application Deployment

- `git push origin main` completed: `64dcb17..b80cc7b`
- `rebuild/cms-modernisation` fast-forwarded: `64dcb17..b80cc7b`
- `git push origin rebuild/cms-modernisation` completed
- **Deployment URL:** `https://after-school-club-live-f7s4rl9q2-kwadwo-addos-projects.vercel.app`
- **Vercel Deployment ID:** `dpl_5hw5FdqXPsMcvQtQNAdR5dG1ZWDr`
- **Status:** **● Ready**
- **Domain Mapping:** `https://app.sprintscaleit.co.uk`
- **Deployment SHA Statement:** "Production deployment was triggered from certified b80cc7b and reached Ready; exact active deployment Git SHA was not independently returned by the available Vercel CLI evidence."

---

### 6. Edge Protection Removal & Smoke Verification

Following deployment confirmation, the temporary Vercel Firewall rule was removed and published:
- `/` → HTTP 200
- `/login` → HTTP 200
- `/terms` → HTTP 200
- `/privacy` → HTTP 200
- `/signup` → HTTP 200 (registration restored)
- `/onboarding` (unauthenticated) → HTTP 307 redirect to `/login`
- `/platform/organisations` (unauthenticated) → HTTP 307 redirect to `/login`
- Active Vercel custom firewall rules remaining: `0`

---

### 7. Controlled Production Canary Lifecycle

A single synthetic canary lifecycle was executed through real browser automation:
- **Canary Account:** `canary-pm13b-test@sydenhamasc.co.uk`
- **Canary Organisation:** `SprintScale Production Canary` (UUID: `d29ad23e-c970-4d9a-8abb-5d8653556bc4`)
- **Canary First Centre:** `Canary Main Hub` (UUID: `24da93f4-7502-42a9-a96a-f5205bd6c1b9`)
- **Canary User ID:** `e9356304-1fb0-433f-8ad1-3afdb411b030`

#### Lifecycle Milestones:
1. **Signup & Terms Acceptance (Step A–E):**
   - Form required checking the legal terms checkbox.
   - User account created with `terms_accepted_at = 2026-09-05T04:16:02.939Z` and `terms_version = '2026-09-01'`.
   - Evidence captured: `p1_production_signup.png`.
2. **Organisation & Centre Onboarding (Step F–I):**
   - User navigated to `/onboarding`.
   - Organisation name `SprintScale Production Canary` and centre `Canary Main Hub` registered.
   - Synthetic binary PNG logo uploaded via scoped onboarding logo endpoint.
   - Evidence captured: `p2_production_onboarding.png`, `p3_production_logo_state.png`.
3. **PENDING Status & Guardrail Barrier (Step J–O):**
   - Upon completing setup, user landed strictly on `/pending-approval`.
   - Status badge: `Pending Review`.
   - Reloading `/pending-approval` preserved pending state.
   - User logged out, then logged back in with credentials; landed back on `/pending-approval`.
   - Direct browser navigation to `/dashboard` immediately redirected to `/pending-approval`.
   - Evidence captured: `p4_production_pending_initial.png`, `p5_production_pending_after_login.png`, `p6_production_direct_dashboard_redirect.png`.

---

### 8. Database Canary Audit (Read-Only)

Read-only PostgreSQL query immediately post-onboarding verified:
- `users` record count: 1 canary (`terms_accepted_at` populated, `terms_version = '2026-09-01'`)
- `organisations` record count: 1 canary (`approval_status = 'PENDING'`)
- `centres` record count: 1 canary (`Canary Main Hub`)
- `org_memberships` record count: 1 canary (`role = 'ORG_OWNER'`)
- `audit_events` logged: `org.onboarding_completed`
- Aggregate at this stage: Total = 2 (1 ACTIVE pre-existing, 1 PENDING canary).

---

### 9. Platform Administrator Review & Approval

Using the platform administrator identity (`kaddo@sydenhamasc.co.uk`, allowlisted in `PLATFORM_ADMIN_EMAILS`):
- Loaded `/platform/organisations`.
- Confirmed `SprintScale Production Canary` displayed with status badge `PENDING`.
- Evidence captured: `p7_platform_admin_pending_canary.png`.
- Clicked `Approve` for the canary organisation.
- Action executed Next.js Server Action `approveOrg`, invoking `applyTransition()` with platform admin ID `b0133bbb-e915-4caf-a508-4b3e041b8f3d`.
- Page refreshed: status updated to `ACTIVE`.
- Evidence captured: `p8_platform_admin_active_canary.png`.
- Database audit log verified: `org.approved` event written.

---

### 10. Operational Dashboard & Multi-Tenant Isolation

Returning to the canary owner authenticated session:
- Navigated to `/dashboard` → Successfully loaded operational CMS dashboard.
- Evidence captured: `p9_canary_active_dashboard.png`.
- Navigated to `/dashboard/students` → Clean empty-state table rendered. Verified zero records from the pre-existing production tenant (`Sydenham After School Club LTD`).
- Evidence captured: `p10_canary_empty_students_module.png`.
- Navigated to `/dashboard/centres` → Displayed only `Canary Main Hub`.
- Tenant isolation confirmed: **STRICT PASS**.

---

### 11. Relational Canary Cleanup

Canary-created records were mapped and safely removed within a single atomic database transaction:
1. Unlinked `users.organisation_id` for canary user (`e9356304-1fb0-433f-8ad1-3afdb411b030`).
2. Deleted canary `audit_events` (2 rows: `org.onboarding_completed`, `org.approved`).
3. Deleted canary `org_memberships` (1 row).
4. Deleted canary `centres` (1 row: `Canary Main Hub`).
5. Deleted canary `organisations` (1 row: `SprintScale Production Canary`).
6. Deleted canary `users` (1 row).
7. Committed transaction.

**Post-Cleanup Verification:**
- Total organisations: `1`
- ACTIVE: `1` (`Sydenham After School Club LTD`)
- PENDING: `0`
- SUSPENDED: `0`
- REJECTED: `0`
- Canary organisations remaining: `0`
- Canary users remaining: `0`
- Canary centres remaining: `0`
- Canary memberships remaining: `0`
- Baseline aggregate restored: **100% MATCH TO PRE-MIGRATION STATE**.

---

### 12. External Side Effects Audit

- Resend: `0` calls
- Stripe: `0` calls
- GoCardless: `0` calls
- Twilio: `0` calls
- Google Calendar: `0` calls
- Wonde: `0` calls
- Google OAuth: Not invoked (canary executed with email/password credentials)

---

### 13. Production Evidence Manifest

All visual artifacts were captured live against `https://app.sprintscaleit.co.uk` and are archived in the ide artifact storage:
- `p1_production_signup.png` — Signup form with versioned Terms checkbox
- `p2_production_onboarding.png` — Organisation onboarding entry form
- `p3_production_logo_state.png` — First centre name & logo upload
- `p4_production_pending_initial.png` — `/pending-approval` post-onboarding
- `p5_production_pending_after_login.png` — `/pending-approval` after sign-out/sign-in
- `p6_production_direct_dashboard_redirect.png` — Direct `/dashboard` redirect enforcement
- `p7_platform_admin_pending_canary.png` — Platform Admin review showing canary PENDING
- `p8_platform_admin_active_canary.png` — Platform Admin review showing canary ACTIVE
- `p9_canary_active_dashboard.png` — Canary tenant live operational dashboard
- `p10_canary_empty_students_module.png` — Multi-tenant data isolation proof
- `pm13b_contact_sheet.png` — Stitched 10-panel visual verification summary
