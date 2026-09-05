# PM-1.3 / PM-1.3A / PM-1.3A.C — SaaS Onboarding End-to-End Verification & Remediation Audit

**Audit & Remediation Date:** 2026-09-05  
**Starting Baseline HEAD SHA:** `64dcb173f0286f9ac9fb096d353542e768d1771a`
**Current HEAD SHA:** `f19f924` (Local `main`, unpushed)
**Production Domain:** `https://app.sprintscaleit.co.uk`
**Status:** **IMPLEMENTED — PENDING INDEPENDENT CERTIFICATION**

---

### 1. Executive Summary

Following the PM-1.3 Stage-1 Forensic Discovery and Audit, four production-blocking defects (**F-01, F-02, F-03, F-04**) were remediated in milestone **PM-1.3A**, alongside marketing truth neutralization (**F-06**) and onboarding audit event logging (**F-08**). Deep architectural analysis and recommendations were established for account convergence (**F-05**) and signup abuse protections (**F-07**).

Under **PM-1.3A.C (Certification Reconciliation)**, additional security, legal, and data-integrity reconciliations were implemented:
1. **Logo Upload Security & Hardening:** The onboarding logo endpoint (`POST /api/onboarding/logo`) was strictly restricted to organisations in `PENDING` status (ACTIVE organisations must use the operational `/api/upload/logo` endpoint). Ownership is verified authoritatively against `orgMemberships` (`role === 'ORG_OWNER'`) in addition to `users.role`. SVG uploads were **completely removed** to eliminate stored XSS, script execution, and XML injection risks; only PNG, JPEG, and WEBP are permitted with strict binary magic-byte verification. Client path traversal is impossible (filenames generated server-side via `nanoid`).
2. **Membership Idempotency:** The database schema enforces a unique constraint on `(user_id, organisation_id)` in `org_memberships`. Both `/api/onboarding` and `/api/organisations` run inside atomic database transactions with pre-flight duplication checks (`users.organisationId` and `users.email` / `organisations.slug`), preventing duplicate memberships, centres, or organisations upon request retries.
3. **Terms Version Single Source of Truth:** `CURRENT_TERMS_VERSION = '2026-09-01'` is extracted into `src/lib/constants/legal.ts`, shared identically across `/terms`, `/privacy`, and `/api/auth/signup`.
4. **Legal Claim Neutralization:** Unsupported claims of legal or GDPR certification were removed. The documentation and public legal pages explicitly declare: *"Initial Terms and Privacy pages implemented; formal legal review remains an operational/business requirement prior to commercial reliance."*
5. **Fail-Closed E2E & Capture Script Safety:** Both `scripts/verify-pm13a-e2e.ts` and `scripts/capture-pm13a-evidence.ts` import and enforce `assertSafeTrainingEnvironment()` from `src/lib/training-guard.ts`, requiring `ALLOW_TRAINING_SEED=true`, `TRAINING_ENVIRONMENT=oakridge`, and matching the exact Neon training host (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`). Any attempt to target production or an unknown host fails closed immediately before database connection or browser launch.
6. **Real PNG Contact Sheet:** A high-resolution labeled PNG contact sheet (`pm13a_contact_sheet.png`) assembling all 14 panels (R1 through R12) was generated and verified.

---

### 2. Remediation Summary (F-01 through F-04)

| Finding | Class | Severity | Remediation Implementation |
| :--- | :--- | :--- | :--- |
| **F-01** | D — Functional Defect | MEDIUM | **Resolved:** Modified `requireTenantSession()` in `src/lib/session.ts` and `src/app/dashboard/layout.tsx` to catch `OrgNotActiveError` and issue a clean Next.js `redirect('/pending-approval')`. Updated `OnboardingForm.tsx` to redirect to `/pending-approval` immediately upon successful onboarding submission instead of `/dashboard`. |
| **F-02** | D — Functional Defect | MEDIUM | **Resolved & Hardened:** Implemented dedicated onboarding logo endpoint `POST /api/onboarding/logo` requiring an active user session and `ORG_OWNER` membership in `orgMemberships`. Target organisation is strictly derived from database state (`users.organisationId`), permitting uploads **only** for `PENDING` organisations, rejecting `ACTIVE`, `SUSPENDED`, and `REJECTED`. Validates binary magic bytes for PNG, JPEG, and WEBP. SVG is explicitly disallowed. |
| **F-03** | E — Data Integrity | LOW | **Resolved:** Updated `src/app/api/onboarding/route.ts` and `src/app/api/organisations/route.ts` to insert an `orgMemberships` record (`role: 'ORG_OWNER'`) inside the same atomic database transaction as organisation creation and user role update. Database uniqueness is guaranteed by `unique().on(table.userId, table.organisationId)`. |
| **F-04** | H — Legal / Consent | MEDIUM | **Resolved & Reconciled:** Added additive database columns `terms_accepted_at` (timestamp) and `terms_version` (varchar 32) to `users` schema with migration `drizzle/0025_terms_acceptance.sql` (applied exclusively to disposable training DB). Created public legal pages `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`. Shared constant `CURRENT_TERMS_VERSION` guarantees synchronization. Updated `src/app/api/auth/signup/route.ts` to enforce `acceptedTerms === true` server-side. |

---

### 3. Non-Blocking Findings & Analysis (F-05 through F-08)

| Finding | Class | Status / Resolution | Analysis & Recommendation |
| :--- | :--- | :--- | :--- |
| **F-05** | F — Security / Convergence | **DOCUMENTED FOR FUTURE MILESTONE** | In `src/lib/auth.ts`, `GoogleProvider` utilizes `allowDangerousEmailAccountLinking: true`. Because credential accounts currently do not require email confirmation, an account pre-registered with a victim's email could be linked when the victim signs in with Google. Disabling this flag unilaterally without an email verification flow or account linking reconciliation UI would break legitimate users signing in with Google after password signup. **Recommendation:** Address comprehensively in a dedicated *Authentication & Identity Hardening Milestone* (PM-2) that introduces email verification tokens (via Resend/SMTP) before altering the linking configuration. |
| **F-06** | C — Marketing Truth | **REMEDIATED** | In `src/app/page.tsx`, updated the pricing section to explicitly qualify that the Starter plan tier limits are not currently enforced in application code ("Plan limits are not currently enforced in-app during pre-launch"). Replaced static unverified demo testimonials and arbitrary statistics ("500+ centres", "50k bookings") with truthful capability descriptions (Multi-Centre Architecture, Real-Time Attendance, Automated Billing Engine). Updated signup banner statistics accordingly. |
| **F-07** | G — Abuse / Enumeration | **DOCUMENTED / HARDENED** | Verified that `authRateLimit` (10 requests/minute per IP via Upstash Redis) is active and enforced on `POST /api/auth/signup` and `POST /api/organisations`. Noted that returning HTTP 409 `{ error: 'An account with this email already exists' }` allows account enumeration. Recommended adding Cloudflare Turnstile bot protection on `/signup` and normalizing duplicate email responses in a future security hardening sprint. |
| **F-08** | I — Observability | **REMEDIATED** | Added audit logging directly into `src/app/api/onboarding/route.ts` inside the atomic transaction, recording `action: 'org.onboarding_completed'` with metadata `{ orgName, centreName }` in the `auditEvents` table. If the audit insert fails, the transaction rolls back completely. |

---

### 4. Verification & Quality Gates

#### 4.1 Automated Security & Integrity Tests
The dedicated security suite `src/lib/security-pm13a.test.ts` contains 28 tests verifying:
- Unauthenticated logo upload denied (401)
- PENDING owner allowed with valid PNG, JPEG, and WEBP (200)
- ACTIVE organisation denied on onboarding logo route (403)
- SUSPENDED and REJECTED organisations denied (403)
- Non-owner staff member denied (403)
- User without organisation denied (403)
- SVG upload denied unconditionally (400)
- Fake PNG (text/HTML renamed .png), fake JPEG, fake WEBP denied (400)
- Oversized file (>2MB) denied (400)
- Initial `orgMemberships` row created with role `ORG_OWNER`
- Onboarding retry returns 400 "Organisation already set up"
- Transaction rollback prevents partial state
- Terms version persistence equals `CURRENT_TERMS_VERSION`
- Rejection of signup without terms acceptance (400)
- Training guard fail-closed rules (missing flags, production host, unknown host)
- Lifecycle redirections for PENDING, SUSPENDED, and REJECTED to `/pending-approval`
- Dashboard access permitted for ACTIVE tenant

**Test Suite Results:**
- `npm test`: **PASS** (76 test files, 811 tests passed, 0 failures).
- Security regression check (`pm12`, `4b`, `3o`): **ALL 56 PASS**.

#### 4.2 Quality Gates
- **TypeScript Compilation:** `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck` -> **PASS (0 errors)**.
- **ESLint:** `npm run lint` -> **PASS (0 errors, 0 warnings)**.
- **Production Build:** `NODE_OPTIONS="--max-old-space-size=8192" npm run build` -> **PASS (156 static pages generated, 133 API/app routes)**.
- **Git Diff Hygiene:** `git diff --check` -> **PASS (0 warnings, clean diff)**.

---

### 5. Disposable E2E Test Execution

The verification script [`scripts/verify-pm13a-e2e.ts`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/scripts/verify-pm13a-e2e.ts) ran against the disposable Neon training database with `assertSafeTrainingEnvironment()`:
1. **User Registration:** Created synthetic user with `acceptedTerms = true`. Verified `termsAcceptedAt` and `termsVersion = CURRENT_TERMS_VERSION`.
2. **Onboarding Transaction:** Executed atomic transaction creating organisation (`approvalStatus = 'PENDING'`), centre, user update, `orgMemberships` row, and `org.onboarding_completed` audit event.
3. **Pending Guard Verification:** Confirmed `assertOrgActive` throws `OrgNotActiveError` and `requireTenantSession` redirects to `/pending-approval`.
4. **Scoped Logo Upload:** Uploaded synthetic PNG via `POST /api/onboarding/logo` while `PENDING` -> status 200 returned.
5. **Platform Approval Transition:** Transitioned status to `ACTIVE`. Verified `org.approved` audit event.
6. **Active Access Verification:** Confirmed `/dashboard` access permitted.
7. **Suspension Lifecycle:** Transitioned status to `SUSPENDED`. Verified `org.suspended` audit event and immediate operational lock-out.
8. **Reactivation Lifecycle:** Restored status to `ACTIVE`. Verified access re-established.
9. **Rejection Lifecycle:** Synthetic tenant created and transitioned to `REJECTED`. Verified `org.rejected` audit event and operational lock-out.
10. **Database Teardown:** Verified deletion of all synthetic rows. **Cleanup count = 0 synthetic fixtures remaining**.

---

### 6. Visual Evidence Collection

All 12 visual evidence requirements were captured via Playwright automation and compiled into both an individual screenshot directory and a real, stitched PNG contact sheet:

- **Screenshot Directory:** `/Users/KWADW/.gemini/antigravity-ide/brain/570ce807-40be-438c-8def-b8238b3ec657/pm13a_evidence/`
- **Real PNG Contact Sheet Path:** `/Users/KWADW/.gemini/antigravity-ide/brain/570ce807-40be-438c-8def-b8238b3ec657/pm13a_evidence/pm13a_contact_sheet.png` (1872 x 4380, 360.8 KB, 14 labeled panels)

| Ref | Description | Viewport | Target File |
| :--- | :--- | :--- | :--- |
| **R1** | Signup page with terms checkbox & links | Desktop (1280x800) | `r1_signup_desktop.png` |
| **R1M** | Signup page with terms checkbox & links | Mobile (390x844) | `r1_signup_mobile.png` |
| **R2** | Public Terms of Service page | Desktop (1280x800) | `r2_terms.png` |
| **R3** | Public Privacy Policy page | Desktop (1280x800) | `r3_privacy.png` |
| **R4** | Organisation onboarding form | Desktop (1280x800) | `r4_onboarding.png` |
| **R5** | Scoped logo upload state | Desktop (1280x800) | `r5_onboarding_logo.png` |
| **R6** | Pending approval screen | Desktop (1280x800) | `r6_pending_desktop.png` |
| **R6M** | Pending approval screen | Mobile (390x844) | `r6_pending_mobile.png` |
| **R7** | Direct dashboard navigation redirect | Desktop (1280x800) | `r7_direct_pending_dashboard_redirect.png` |
| **R8** | Platform admin pending view | Desktop (1280x800) | `r8_platform_pending_org.png` |
| **R9** | Platform admin approved active view | Desktop (1280x800) | `r9_approved_active_platform.png` |
| **R10** | Active tenant dashboard | Desktop (1280x800) | `r10_active_dashboard.png` |
| **R11** | Suspended organisation state | Desktop (1280x800) | `r11_suspended_org.png` |
| **R12** | Rejected organisation state | Desktop (1280x800) | `r12_rejected_org.png` |

---

### 7. Production Safety Invariants Maintained

- **Production Database Writes:** `0`
- **Production User Accounts Created:** `0`
- **Production Deployments Triggered:** `0`
- **Git Commits Pushed to Remote:** `0` (Local branch only)
- **External API Provider Calls:** `0` (Zero calls to Resend, Stripe, Twilio, Wonde, or Google)
- **Secrets Exposed:** `NO`
