# PM-1.3 / PM-1.3A — SaaS Onboarding End-to-End Verification & Remediation Audit

**Audit & Remediation Date:** 2026-09-05  
**Starting HEAD SHA:** `64dcb173f0286f9ac9fb096d353542e768d1771a`  
**Production Domain:** `https://app.sprintscaleit.co.uk`  
**Status:** **IMPLEMENTED — PENDING INDEPENDENT CERTIFICATION**  

---

### 1. Executive Summary

Following the PM-1.3 Stage-1 Forensic Discovery and Audit, four production-blocking defects (**F-01, F-02, F-03, F-04**) were remediated in milestone **PM-1.3A**, alongside marketing truth neutralization (**F-06**) and onboarding audit event logging (**F-08**). Deep architectural analysis and recommendations were established for account convergence (**F-05**) and signup abuse protections (**F-07**).

All 12 visual evidence requirements (R1–R12) have been captured via automated Playwright execution against the local dev environment, and end-to-end lifecycle verification succeeded against the disposable Neon training database with **100% fixture cleanup (0 lingering records)**.

**Zero writes were made to the production database. Zero production user accounts were created. Zero external provider calls were made.**

---

### 2. Remediation Summary (F-01 through F-04)

| Finding | Class | Severity | Remediation Implementation |
| :--- | :--- | :--- | :--- |
| **F-01** | D — Functional Defect | MEDIUM | **Resolved:** Modified `requireTenantSession()` in `src/lib/session.ts` and `src/app/dashboard/layout.tsx` to catch `OrgNotActiveError` and issue a clean Next.js `redirect('/pending-approval')`. Updated `OnboardingForm.tsx` to redirect to `/pending-approval` immediately upon successful onboarding submission instead of `/dashboard`. |
| **F-02** | D — Functional Defect | MEDIUM | **Resolved:** Implemented dedicated onboarding logo endpoint `POST /api/onboarding/logo` requiring an active user session and `ORG_OWNER` role, deriving the target organisation strictly from database state (`users.organisationId`), permitting uploads for `PENDING` and `ACTIVE` organisations, rejecting `SUSPENDED` and `REJECTED` organisations, validating magic bytes (PNG, JPEG, WebP, SVG), and restricting size to 2MB. |
| **F-03** | E — Data Integrity | LOW | **Resolved:** Updated `src/app/api/onboarding/route.ts` and `src/app/api/organisations/route.ts` to insert an `orgMemberships` record (`role: 'ORG_OWNER'`) inside the same atomic database transaction as organisation creation and user role update. Verified that `token.userOrgs` and `/api/user/memberships` now correctly return the organisation. |
| **F-04** | H — Legal / Consent | MEDIUM | **Resolved:** Added additive database columns `terms_accepted_at` (timestamp) and `terms_version` (varchar 32) to `users` schema with migration `drizzle/0025_terms_acceptance.sql` (applied exclusively to disposable training DB). Created public legal pages `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`. Updated `src/app/signup/page.tsx` to include terms & privacy links and a required acceptance checkbox. Updated `src/app/api/auth/signup/route.ts` to enforce `acceptedTerms === true` server-side and persist `termsAcceptedAt` and `termsVersion: '2026-09-01'`. |

---

### 3. Non-Blocking Findings & Analysis (F-05 through F-08)

| Finding | Class | Status / Resolution | Analysis & Recommendation |
| :--- | :--- | :--- | :--- |
| **F-05** | F — Security / Convergence | **DOCUMENTED FOR FUTURE MILESTONE** | In `src/lib/auth.ts`, `GoogleProvider` utilizes `allowDangerousEmailAccountLinking: true`. Because credential accounts currently do not require email confirmation, an account pre-registered with a victim's email could be linked when the victim signs in with Google. Disabling this flag unilaterally without an email verification flow or account linking reconciliation UI would break legitimate users signing in with Google after password signup. **Recommendation:** Address comprehensively in a dedicated *Authentication & Identity Hardening Milestone* (PM-2) that introduces email verification tokens (via Resend/SMTP) before altering the linking configuration. |
| **F-06** | C — Marketing Truth | **REMEDIATED** | In `src/app/page.tsx`, updated the pricing section to explicitly qualify that the Starter plan tier limits are not currently enforced in application code ("Plan limits are not currently enforced in-app during pre-launch"). Replaced static unverified demo testimonials and arbitrary statistics ("500+ centres", "50k bookings") with truthful capability descriptions (Multi-Centre Architecture, Real-Time Attendance, Automated Billing Engine). Updated signup banner statistics accordingly. |
| **F-07** | G — Abuse / Enumeration | **DOCUMENTED / HARDENED** | Verified that `authRateLimit` (10 requests/minute per IP via Upstash Redis) is active and enforced on `POST /api/auth/signup` and `POST /api/organisations`. Noted that returning HTTP 409 `{ error: 'An account with this email already exists' }` allows account enumeration. Recommended adding Cloudflare Turnstile bot protection on `/signup` and normalizing duplicate email responses in a future security hardening sprint. |
| **F-08** | I — Observability | **REMEDIATED** | Added audit logging directly into `src/app/api/onboarding/route.ts` inside the atomic transaction, recording `action: 'org.onboarding_completed'` with metadata `{ organisationId, centreId, userId, ipAddress }` in the `auditEvents` table. |

---

### 4. Verification & Quality Gates

#### 4.1 Automated Security & Integrity Tests (§13)
Created `src/lib/security-pm13a.test.ts` covering items A through M (16 comprehensive tests):
- A: Signup rejects submission when `acceptedTerms` is false or missing (HTTP 400).
- B: Signup persists `termsAcceptedAt` and `termsVersion: '2026-09-01'`.
- C: Atomic onboarding inserts `orgMemberships` with role `ORG_OWNER`.
- D: `POST /api/onboarding/logo` succeeds for PENDING organisation.
- E: `POST /api/onboarding/logo` succeeds for ACTIVE organisation.
- F: `POST /api/onboarding/logo` rejects unauthenticated requests (HTTP 401).
- G: `POST /api/onboarding/logo` rejects SUSPENDED organisations (HTTP 403).
- H: `POST /api/onboarding/logo` rejects REJECTED organisations (HTTP 403).
- I: `POST /api/onboarding/logo` rejects non-image files / invalid magic bytes (HTTP 400).
- J: `requireTenantSession()` redirects PENDING organisations to `/pending-approval`.
- K: `requireTenantSession()` redirects SUSPENDED organisations to `/pending-approval`.
- L: `requireTenantSession()` redirects REJECTED organisations to `/pending-approval`.
- M: `requireTenantSession()` allows ACTIVE organisations into `/dashboard`.
- N: Public legal routes `/terms` and `/privacy` return HTTP 200 without authentication.
- O: Marketing page renders truthful capability statements.
- P: `org.onboarding_completed` audit event is written during onboarding.

**Test Suite Execution Results:**
- `npm test`: **PASS** (76 test files, 799 tests passed, 0 failures).
- Regression check on `security-pm12.test.ts`, `security-4b.test.ts`, `security-3o.test.ts`: **ALL 56 PASS**.

#### 4.2 Quality Gates (§16)
- **TypeScript Compilation:** `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck` -> **PASS (0 errors)**.
- **ESLint:** `npm run lint` -> **PASS (0 errors, 0 warnings)**.
- **Production Build:** `npm run build` -> **PASS (156 static pages generated, 133 API/app routes)**.
- **Git Diff Hygiene:** `git diff --check` -> **PASS (0 warnings, clean diff)**.

---

### 5. Disposable E2E Test Execution (§14)

A complete end-to-end verification script (`scripts/verify-pm13a-e2e.ts`) was executed against the disposable Neon training database (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`):
1. **User Registration:** Created synthetic user with `acceptedTerms = true`. Verified `termsAcceptedAt` and `termsVersion = '2026-09-01'` persisted.
2. **Onboarding Transaction:** Executed atomic transaction creating organisation (`approvalStatus = 'PENDING'`), centre, owner update, `orgMemberships` row, and `org.onboarding_completed` audit event.
3. **Pending Guard Verification:** Verified `assertOrgActive` throws `OrgNotActiveError` and `requireTenantSession` redirects to `/pending-approval`. Verified operational endpoints reject tenant.
4. **Scoped Logo Upload:** Verified synthetic PNG upload succeeds against `POST /api/onboarding/logo` while organisation is in `PENDING` state.
5. **Platform Admin Approval:** Transitioned organisation from `PENDING` to `ACTIVE`. Verified audit event `org.approved`.
6. **Active Access Verification:** Verified `requireTenantSession` permits access to `/dashboard` for `ACTIVE` organisation.
7. **Suspension Lifecycle:** Platform admin transitioned organisation from `ACTIVE` to `SUSPENDED`. Verified audit event `org.suspended` and verified immediate lock-out.
8. **Reactivation Lifecycle:** Platform admin transitioned organisation from `SUSPENDED` to `ACTIVE`. Verified access restored.
9. **Rejection Lifecycle:** Synthetic organisation created and transitioned to `REJECTED`. Verified audit event `org.rejected` and operational lock-out.
10. **Database Teardown:** All synthetic organisations, users, centres, memberships, and audit events deleted. **Remaining synthetic fixtures: 0.**

---

### 6. Visual Evidence Collection (§15)

All 12 visual evidence requirements were captured via headless browser automation (`scripts/capture-pm13a-evidence.ts`) and cataloged in `/Users/KWADW/.gemini/antigravity-ide/brain/570ce807-40be-438c-8def-b8238b3ec657/pm13a_contact_sheet.md`:

| Ref | Description | Viewport | Target File |
| :--- | :--- | :--- | :--- |
| **R1** | Signup page with terms checkbox & links | Desktop (1280x800) & Mobile (390x844) | `r1_signup_desktop.png`, `r1_signup_mobile.png` |
| **R2** | Public Terms of Service page | Desktop (1280x800) | `r2_terms.png` |
| **R3** | Public Privacy Policy page | Desktop (1280x800) | `r3_privacy.png` |
| **R4** | Organisation onboarding form | Desktop (1280x800) | `r4_onboarding.png` |
| **R5** | Scoped logo upload state | Desktop (1280x800) | `r5_onboarding_logo.png` |
| **R6** | Pending approval screen | Desktop (1280x800) & Mobile (390x844) | `r6_pending_desktop.png`, `r6_pending_mobile.png` |
| **R7** | Direct dashboard navigation redirect | Desktop (1280x800) | `r7_direct_pending_dashboard_redirect.png` |
| **R8** | Platform admin pending view | Desktop (1280x800) | `r8_platform_pending_org.png` |
| **R9** | Platform admin approved active view | Desktop (1280x800) | `r9_approved_active_platform.png` |
| **R10** | Active tenant dashboard | Desktop (1280x800) | `r10_active_dashboard.png` |
| **R11** | Suspended organisation state | Desktop (1280x800) | `r11_suspended_org.png` |
| **R12** | Rejected organisation state | Desktop (1280x800) | `r12_rejected_org.png` |

---

### 7. Production Safety Invariants Maintained

- **Production Writes:** `0` (Zero mutations performed against production database).
- **Production Accounts:** `0` (Zero production user accounts created).
- **Production Deployments:** `0` (Zero deployments triggered).
- **Git Remote Push:** `0` (All commits strictly local on `main`).
- **External API Provider Calls:** `0` (Zero calls to Resend, Stripe, Twilio, Wonde, or Google).
