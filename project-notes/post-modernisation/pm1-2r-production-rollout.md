# PM-1.2R — Controlled Production Rollout Evidence
## Organisation Approval Guardrail

**Rollout Date/Time:** 2026-09-05T02:28:30Z  
**Application Release SHA:** `6eb3e602e8e506c422261ba1a81843c69bd5b24b` (`6eb3e60`)  
**Production Domain:** `https://app.sprintscaleit.co.uk`  
**Final Classification:** **PASS — PM-1.2R PRODUCTION ROLLOUT VERIFIED**

---

### 1. Executive Summary

Milestone PM-1.2 (Organisation Approval Status Guardrail) was rolled out to production under controlled operational supervision. The deployment was executed with hosting-level protection (Vercel WAF deny rules) covering all public registration and organisation creation surfaces, preventing race conditions during the additive database migration.

The certified application release SHA is **`6eb3e60`**.

---

### 2. Pre-Migration Baseline & Preconditions

- **Starting Branch:** `main`
- **Starting HEAD:** `6eb3e60`
- **Origin Main (pre-push):** `1a74984`
- **Origin Rebuild (pre-push):** `1a74984`
- **Working Tree:** Clean
- **Pre-Migration Organisation Count:** 1
- **approval_status Column Pre-Migration:** Absent
- **PLATFORM_ADMIN_EMAILS in Vercel Production:** Configured (`YES`)

---

### 3. Organisation Creation Path Audit & Temporary Protection

All production paths capable of creating an organisation were identified:
- `src/app/api/onboarding/route.ts` (POST)
- `src/app/api/organisations/route.ts` (POST)
- User-facing entry points: `/signup`, `/api/auth/signup`, `/onboarding`, `/api/onboarding`, `/api/organisations`, `/register-org`

Temporary Edge Protection:
- Vercel Firewall rule `PM-1.2R Temporary Signup Protection` was staged and published.
- Verified Edge deny (HTTP 403) across all 6 registration/creation paths.
- Verified uninterrupted operation of `/` (HTTP 200) and `/login` (HTTP 200).

---

### 4. Production Database Migration

The reviewed and certified migration was applied to the active production PostgreSQL database:
`drizzle/0024_org_approval_status.sql`

Immediate Post-Migration Aggregate Verification:
- **Total Organisations:** 1
- **ACTIVE:** 1 (Pre-existing legitimate organisation preserved)
- **PENDING:** 0
- **SUSPENDED:** 0
- **REJECTED:** 0
- **NULL:** 0
- **approval_status Column:** Present
- **Column Default:** `'PENDING'::organisation_status`
- **NOT NULL Constraint:** Enforced (`true`)
- **organisation_status Enum:** Present (`true`)
- **orgs_approval_status_idx Index:** Present (`true`)

---

### 5. Code Deployment & Rebuild Branch Reconciliation

- `git push origin main` completed: `1a74984..6eb3e60`
- `rebuild/cms-modernisation` fast-forward reconciled: `1a74984..6eb3e60`
- `git push origin rebuild/cms-modernisation` completed
- Vercel Production deployment: `https://after-school-club-live-rjlu5j8yq-kwadwo-addos-projects.vercel.app`
- Production Deployment Status: **● Ready**
- Canonical Domain Mapping: `https://app.sprintscaleit.co.uk` active and verified.

---

### 6. Production Smoke & Verification Results

1. **Homepage (`/`):** HTTP 200 (healthy)
2. **Login (`/login`):** HTTP 200 (healthy)
3. **Platform Route (`/platform/organisations`):** HTTP 307 redirecting unauthenticated requests to `/login` (actively enforcing `requirePlatformAdmin()`)
4. **Dashboard (`/dashboard`):** HTTP 307 redirecting unauthenticated requests to `/login` (no redirect loop, no redirect to `/pending-approval`)
5. **Existing Tenant Safety:** Database-authoritative check confirmed pre-existing organisation has `approval_status = 'ACTIVE'` (zero operational disruption).
6. **Platform Admin Security Boundary:** Guard fails closed if unauthenticated or not allowlisted in `PLATFORM_ADMIN_EMAILS`.
7. **Ordinary Tenant Isolation:** Tenant roles (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`) are denied access to `/platform/*`.

---

### 7. Restoration of Public Registration

- The temporary Vercel Firewall rule `PM-1.2R Temporary Signup Protection` was removed and published.
- Endpoint Verification:
  - `/` -> HTTP 200
  - `/signup` -> HTTP 200 (public registration restored)
  - `/onboarding` -> HTTP 307 redirect to `/login` (identity check enforced)

---

### 8. Post-Release Production Database Audit

Final read-only aggregate check:
- **Total Organisations:** 1
- **ACTIVE:** 1
- **PENDING:** 0
- **SUSPENDED:** 0
- **REJECTED:** 0
- **NULL:** 0
- **Column Default:** `'PENDING'::organisation_status`
- **NOT NULL:** Enforced
- **Production Mutations Performed:** Exactly migration `0024` execution (0 manual status manipulations, 0 test organisations created)
- **External Provider Calls:** 0 (Stripe, GoCardless, Resend, Twilio, Wonde NOT invoked)
- **Secrets Exposed:** None

---

### 9. Known Limitations & Roadmap Handoff

- **API 401 vs 403 Semantics:** API routes return HTTP 401 for both unauthenticated callers and non-ACTIVE organisations (`getApiSession()` returns `null`). This fails closed and is secure, but does not differentiate at the HTTP status layer.
- **End-to-End Registration Verification:** Production end-to-end verification of the full PENDING-to-ACTIVE journey with a newly registered business is scheduled under milestone **PM-1.3 (SaaS Onboarding End-to-End Verification)**.
