# PM-1.2 — Organisation Approval Status Guardrail

## Status: COMPLETE ✓
**Completed:** 2026-09-04  
**Test Suite:** 755 / 755 passing (74 test files, 0 failures)

---

## Problem Statement

Prior to PM-1.2, a newly registered organisation that was not yet approved by platform operators could immediately access all dashboard functionality. There was no lifecycle gate between "organisation exists" and "organisation can operate the platform".

---

## Design Decisions

### 1. Fail-Closed by Default
New organisations are inserted with `approval_status = 'PENDING'`. No code path defaults to ACTIVE.

### 2. DB-Authoritative Status (Never JWT/Session)
`requireTenantSession()` calls `assertOrgActive()` at request time — direct DB read. Revocations are immediately effective.

### 3. Platform Admin is Independent of Tenant Membership
Platform admins identified by `PLATFORM_ADMIN_EMAILS`. They are NOT `ORG_OWNER` users and have no `organisationId`. Platform routes use `requireAuthenticatedIdentity()`.

### 4. Redirect Loop Prevention
- `/pending-approval` → uses `requireAuthenticatedIdentity()` (no org-status check)
- `/onboarding` → uses `requireAuthenticatedIdentity()` (no org-status check)
- `/dashboard/*` → uses `requireTenantSession()` (blocks non-ACTIVE orgs)

### 5. API Routes Do Not Redirect
API routes use `getApiSession()` → returns `null` for unauthenticated/non-ACTIVE (allows 401/403 HTTP responses).  
Server actions use `requireTenantSession()` → throws redirect (caught by Next.js).

---

## Auth Helper Hierarchy

| Helper | Use Case | On Failure |
|--------|----------|------------|
| `requireTenantSession()` | Dashboard pages, server actions | Throws redirect |
| `getApiSession()` | API route handlers (src/app/api/) | Returns null |
| `requireAuthenticatedIdentity()` | /onboarding, /pending-approval, /platform | Redirects to /login only |
| `requireAuth()` | Server components needing roles | Throws redirect |
| `requireApiAuth()` | API routes needing roles | Returns null |

---

## Files Changed

### New Files
- `drizzle/0024_org_approval_status.sql`
- `src/lib/org-approval-guard.ts`
- `src/app/pending-approval/page.tsx`
- `src/app/platform/` (platform admin routes)
- `src/lib/security-4a.test.ts`

### Core Modified
- `src/db/schema.ts` — approval_status column
- `src/lib/session.ts` — requireTenantSession, getApiSession, requireAuthenticatedIdentity
- `src/lib/require-auth.ts` — org-status enforcement in requireAuth/requireApiAuth
- `vitest.setup.ts` — global redirect() mock
- `vitest.config.ts` — setup file registration

### Bulk Migrations
- 77+ server actions: `auth()` → `requireTenantSession()`
- 32 API routes: `auth()` → `getApiSession()`

---

## Test Infrastructure

### Global Redirect Mock (vitest.setup.ts)
```ts
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));
```

### Test Assertion Convention (PM-1.2 style)
- `auth → null` → `.rejects.toThrow('REDIRECT:/login')`
- `auth → { user: { id, no org } }` → `.rejects.toThrow('REDIRECT:/onboarding')`
- `auth → { user with PENDING org }` → `.rejects.toThrow('REDIRECT:/pending-approval')`

---

## Verification

```
Test Files  74 passed (74)
     Tests  755 passed (755)
```

---

## Deployment Notes

> **OPERATOR ACTION REQUIRED before deploy:**
> 1. Run `drizzle/0024_org_approval_status.sql` against production
> 2. Migration sets all existing orgs to ACTIVE
> 3. New orgs after deploy default to PENDING
> 4. Use `/platform/organisations` for approval/rejection
