# PM-1.2 — Organisation Approval Status Guardrail

## Status: IMPLEMENTED — PENDING RELEASE CERTIFICATION
**Audited:** 2026-09-04
**Test Suite:** 783 / 783 passing (75 test files, 0 failures)

---

## Problem Statement

Prior to PM-1.2, a newly registered organisation that was not yet approved by platform operators could immediately access all dashboard functionality. There was no lifecycle gate between "organisation exists" and "organisation can operate the platform".

---

## Design Decisions

### 1. Fail-Closed by Default
New organisations are inserted with `approval_status = 'PENDING'`. No code path defaults to ACTIVE.

### 2. DB-Authoritative Status (Never JWT/Session)
`requireTenantSession()` calls `assertOrgActive()` at request time — direct DB read. Revocations and approvals are immediately effective on the next request without requiring JWT/session refresh.

### 3. Platform Admin is Independent of Tenant Membership
Platform admins are identified exclusively by the `PLATFORM_ADMIN_EMAILS` environment allowlist. They are not `ORG_OWNER` users and have `organisationId = null`. Platform routes use `requirePlatformAdmin()`. If `PLATFORM_ADMIN_EMAILS` is empty or unset, the guard fails closed.

### 4. Redirect Loop Prevention
- `/pending-approval` → uses `requireAuthenticatedIdentity()` (no org-status check; renders status-specific copy for PENDING, SUSPENDED, and REJECTED)
- `/onboarding` → uses `requireAuthenticatedIdentity()` (no org-status check)
- `/dashboard/*` → uses `requireTenantSession()` (blocks non-ACTIVE orgs with redirect to `/pending-approval`)

### 5. API Routes Do Not Redirect
API routes use `getApiSession()`. In the current implementation, `getApiSession()` returns `null` for unauthenticated requests, identity without organisation, and authenticated users whose organisation is not `ACTIVE`. Operational API route handlers then return `{ error: 'Unauthorized' }` with HTTP status `401`. Server actions use `requireTenantSession()`, which throws a redirect caught by Next.js navigation.

---

## Auth Helper Hierarchy

| Helper | Use Case | On Failure |
|--------|----------|------------|
| `requireTenantSession()` | Dashboard pages, server actions | Throws redirect |
| `getApiSession()` | API route handlers (`src/app/api/`) | Returns null |
| `requireAuthenticatedIdentity()` | `/onboarding`, `/pending-approval`, `/platform` | Redirects to `/login` only |
| `requirePlatformAdmin()` | `/platform/*` pages and platform server actions | Redirects unauthenticated to `/login`, non-admin to `/dashboard` |
| `requireAuth()` | Server components needing roles | Throws redirect |
| `requireApiAuth()` | API routes needing roles | Returns null |

---

## Files Changed

### Core Security & Guardrails
- `drizzle/0024_org_approval_status.sql` — PostgreSQL migration script
- `src/lib/org-approval-guard.ts` — `assertOrgActive()`, `isPlatformAdmin()`, `requirePlatformAdmin()`
- `src/app/pending-approval/page.tsx` — lifecycle experience page
- `src/app/pending-approval/_components/OrgStatusClient.tsx` — status UI (PENDING, SUSPENDED, REJECTED)
- `src/app/platform/layout.tsx` — platform administration shell layout
- `src/app/platform/organisations/page.tsx` — organisation approval management page
- `src/app/platform/organisations/actions.ts` — approve, reject, suspend, reactivate server actions with audit logging
- `src/lib/security-pm12.test.ts` — 28 dedicated security unit tests exercising the unmocked real guard

### Core Modified
- `src/db/schema.ts` — `organisationStatusEnum` enum and `approvalStatus`, `approvedAt`, `approvedBy`, `rejectionReason` columns
- `src/lib/session.ts` — `requireTenantSession`, `getApiSession`, `requireAuthenticatedIdentity`
- `src/lib/require-auth.ts` — org-status enforcement in `requireAuth` and `requireApiAuth`
- `vitest.setup.ts` — global `redirect()` mock and default non-operational suite mock
- `vitest.config.ts` — setup file registration

### Removed Obsolete Routes
- `src/app/api/admin/migrate-users/route.ts` — DELETED
- `src/app/api/admin/seed-centre-billing/route.ts` — DELETED (contained historical seed fixtures; verified zero live references across repository)

---

## Test Infrastructure & Verification

### Global Mock vs. Dedicated Security Tests
- In `vitest.setup.ts`, `assertOrgActive` is mocked as a resolving no-op for legacy unit tests to preserve suite velocity.
- `src/lib/security-pm12.test.ts` explicitly bypasses the mock using `vi.importActual` to directly exercise real guard code:
  - 8 tests for `isPlatformAdmin()` (case-insensitivity, allowlist parsing, empty/unset fail-closed)
  - 11 tests for `assertOrgActive()` (ACTIVE resolves, PENDING/SUSPENDED/REJECTED/NOT_FOUND throw `OrgNotActiveError`, DB-authoritative status changes without session refresh)
  - 9 tests for `requirePlatformAdmin()` (unauthenticated redirects to `/login`, tenant roles denied with redirect to `/dashboard`, platform admin identity permitted without orgId)

### Full Quality Gate Results
- TypeScript: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` -> PASS (0 errors)
- ESLint: `npm run lint` -> PASS (0 errors)
- Unit Tests: `npm test -- --run` -> PASS (75 test files, 783 tests, 0 failures)
- Production Build: `NODE_OPTIONS="--max-old-space-size=8192" npm run build` -> PASS (153 static pages compiled)
- Whitespace Check: `git diff --check HEAD^..HEAD` -> PASS (0 warnings)

---

## Migration Validation (Disposable/Training DB)

Execution of `drizzle/0024_org_approval_status.sql` was verified against the disposable PostgreSQL database:
1. Pre-existing synthetic organisation remained `ACTIVE`.
2. `information_schema` verified column default `'PENDING'::organisation_status`.
3. Inserting organisation without `approval_status` defaulted to `PENDING`.
4. `NOT NULL` constraint enforced.
5. Invalid enum value rejected.
6. Index `orgs_approval_status_idx` verified.
7. Idempotency confirmed (re-running migration succeeded without errors).

---

## Production Rollout Plan (Design Only)

1. Set `PLATFORM_ADMIN_EMAILS` environment variable in production hosting configuration.
2. Brief maintenance window or signup pause to prevent registration interleaving.
3. Apply `drizzle/0024_org_approval_status.sql` against production PostgreSQL (existing organisations set to `ACTIVE`, column default set to `PENDING`).
4. Deploy PM-1.2 application build.
5. Post-deployment smoke test:
   - Verify existing organization can access dashboard.
   - Verify `/platform/organisations` accessible by platform admin.
   - Verify non-platform admin redirected away from `/platform`.
6. Resume public registration.
