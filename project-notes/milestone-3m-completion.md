# Milestone 3M — Dashboard & Cross-Module UX Modernisation
## Completion Report

**Branch:** rebuild/cms-modernisation  
**Frozen 3L baseline:** a80bbcf  
**Stage-A audit SHA:** 2a3ce45  
**Stage-B implementation SHA:** 75b43b6  
**Stage-B final cleanup SHA:** bf8a7d0  
**Milestone 3M freeze candidate:** bf8a7d0

---

## Quality Gates (Final)

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** |
| ESLint | **PASS — 0 errors / 0 warnings** |
| Vitest | **458 / 458 PASS** |
| Production build | **PASS (exit 0)** |

---

## Test Arithmetic

| | Count |
|---|---|
| 3L frozen baseline | 444 |
| New 3M tests | +14 |
| **3M total** | **458** |

**New test files:**
- `src/app/api/search/__tests__/search-3m.test.ts` — 7 tests (S-1/S-2/S-3)
- `src/app/dashboard/__tests__/dashboard-3m.test.ts` — 7 tests (D1/D2/D3/A-1/N-1/D9/U-1)

---

## Defect Inventory (15 Stage-A confirmed + A-1 ambiguity)

### Security / data-isolation (S-1, S-2, S-3)

| ID | Defect | Fix | File |
|---|---|---|---|
| S-1 | Soft-deleted children/parents in search results | `isNull(children.deletedAt)` + `isNull(parents.deletedAt)` | `api/search/route.ts` |
| S-2 | TUTOR could call `/api/search` directly (bypassing Students/Parents page gates) | `SEARCH_ALLOWED_ROLES` constant; TUTOR → 403 | `api/search/route.ts` |
| S-3 | Booking results lacked org-isolation — cross-org name collision possible | `innerJoin centres` + `centres.organisationId = organisationId` | `api/search/route.ts` |

### Correctness (D1, D2, D3)

| ID | Defect | Fix | File |
|---|---|---|---|
| D1 | RevenueWidget dead link `/dashboard/finances` → should be `/dashboard/finance` | Corrected `href` | `RevenueWidget.tsx` |
| D2 | DashboardSchedule used org-wide `centres.organisationId` filter — non-owners saw all centres | Accept `accessibleCentreIds` + `hasCentres` props; use `inArray(bookings.centreId, accessibleCentreIds)` | `DashboardSchedule.tsx`, `page.tsx` |
| D3 / S-5 | RevenueWidget finance data exposed to TUTOR/FRONT_DESK/MANAGER | Gate render to `isOwner` (ORG_OWNER) in `page.tsx` | `page.tsx` |

### Navigation / role consistency (A-1, N-1, D9)

| ID | Defect | Fix | File |
|---|---|---|---|
| A-1 | FRONT_DESK Sidebar missing `Parents` despite page gate permitting access | `'Parents'` added to FRONT_DESK `ROLE_NAV` (orchestrator Option A) | `Sidebar.tsx` |
| N-1 | FRONT_DESK MobileBottomNav missing `Registrations` (inconsistent with 3L A-2 sidebar fix) | `'Registrations'` added to FRONT_DESK `ROLE_NAV` | `MobileBottomNav.tsx` |
| D9 | Header `ROLE_LABELS` missing `FRONT_DESK` — raw enum shown in UI | `FRONT_DESK: 'Front Desk'` added | `Header.tsx` |

### Design system token fixes (D4–D11)

| ID | Defect | Tokens replaced | File |
|---|---|---|---|
| D4 | `error.tsx`: `text-white` invisible in light mode; `bg-card`, `bg-primary`, `text-on-primary`, `outline-variant`, `rounded-[32px]` | → `bg-surface`, `border-border`, `text-text`, `text-text-muted`, `bg-accent`, `rounded-xl` | `error.tsx` |
| D5 | `loading.tsx`: `bg-card`, `border-outline-variant`, `rounded-[24/32px]` | → `bg-secondary`, `border-border`, `rounded-xl` + `role="status"` | `loading.tsx` |
| D6 | `DashboardSchedule`: `bg-white dark:bg-slate-900`, `border-slate-*`, `hover:bg-slate-*`, `text-muted-foreground` | → `Card`, `border-border`, `text-text`, `text-text-muted` (fixed as part of D2) | `DashboardSchedule.tsx` |
| D7 | `ActivityTab` (3 card wrappers): `bg-white dark:bg-slate-900`, `border-slate-200/60 dark:border-slate-800` | → `bg-surface`, `border-border`, `rounded-xl` | `ActivityTab.tsx` |
| D8 | `RevenueWidget`: `bg-white dark:bg-slate-900`, `border-slate-*`, `text-muted-foreground`, `text-destructive`, `bg-destructive/10` | → `bg-surface`, `border-border`, `text-text-muted`, `text-danger`, `bg-danger-soft` | `RevenueWidget.tsx` |
| D10 | `CentreFilterContext.CentreSelector`: `!text-white`, `!bg-secondary/40`, `!border-outline-variant`, `focus:!border-primary` | → `text-text`, `bg-secondary`, `border-border`, `focus:border-accent` | `CentreFilterContext.tsx` |
| D11 | `DashboardSchedule` status badges: `bg-primary/10 text-primary` | → `bg-success-soft text-success`, `bg-warning-soft text-warning`, `bg-danger-soft text-danger` | `DashboardSchedule.tsx` |

### UX fixes (U-1, U-4)

| ID | Fix | File |
|---|---|---|
| U-1 | Deleted orphaned `OverviewTab.tsx` (214 lines, never imported, duplicated KPI queries) | `OverviewTab.tsx` removed |
| U-4 | `OnboardingChecklist` and `WelcomeModal` gated to `ORG_OWNER` — non-owner staff could not complete setup steps anyway | `page.tsx` |

---

## Ambiguity (A-1) — Orchestrator Decision

**A-1:** FRONT_DESK Parents sidebar visibility  
**Decision:** Option A — add `'Parents'` to FRONT_DESK `ROLE_NAV` in `Sidebar.tsx`.  
**Rationale:** `/dashboard/parents` page gate explicitly permits FRONT_DESK. Sidebar was the inconsistent layer. Follows Milestone 3L A-2 precedent for Registrations.  
**Not counted in D1–D15 defect list** (product ambiguity, not confirmed defect).

---

## Frozen-Module Exceptions (Narrow, Documented)

Per Milestone 3M requirements, three frozen-module files were touched with minimal, documented changes:

| File | Change |
|---|---|
| `Sidebar.tsx` | FRONT_DESK `ROLE_NAV` entry only — added `'Parents'` (A-1) |
| `MobileBottomNav.tsx` | FRONT_DESK `ROLE_NAV` entry only — added `'Registrations'` (N-1) |
| `Header.tsx` | `ROLE_LABELS` constant only — added `FRONT_DESK: 'Front Desk'` (D9) |

---

## Stage-C Verification (Source-Level)

| Check | Result |
|---|---|
| S-2: TUTOR → 403 on search | `SEARCH_ALLOWED_ROLES` constant confirmed; test passes |
| S-1: soft-delete filters present | `isNull(children.deletedAt)` + `isNull(parents.deletedAt)` confirmed |
| S-3: booking org-isolation | `innerJoin centres … eq(centres.organisationId, organisationId)` confirmed |
| D1: link corrected | `href="/dashboard/finance"` confirmed; no `finances` in JSX |
| D2: centre scope props | `accessibleCentreIds`, `hasCentres`, `centreScopeCondition` all present |
| D3: RevenueWidget gate | `{isOwner && (<Suspense>…<RevenueWidget…>` confirmed |
| A-1: Parents in FRONT_DESK nav | `FRONT_DESK: ['Dashboard', 'Students', 'Parents', …]` confirmed |
| N-1: Registrations in mobile nav | `FRONT_DESK: ['Dashboard', 'Students', 'Registrations']` confirmed |
| D9: ROLE_LABELS FRONT_DESK | `FRONT_DESK: 'Front Desk'` confirmed |
| D4–D11: legacy tokens removed | 0 occurrences of `bg-white`, `dark:bg-slate`, `border-slate-2*`, `bg-card`, `outline-variant`, `bg-primary`, `text-on-primary`, `text-muted-foreground` in modified components |
| U-1: OverviewTab deleted | `src/app/dashboard/_components/OverviewTab.tsx` confirmed absent |
| Production build | PASS — exit 0, no errors/warnings |

---

## No New Ambiguities Discovered

Stage B/C implementation did not surface any additional product-policy ambiguities requiring orchestrator decision.

---

**STOP — Milestone 3M complete. Do not begin Milestone 3N.**
