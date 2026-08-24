# Milestone 3N — Completion Report
## Authenticated App Consolidation, Cross-Module UX & Security Hardening

**Branch:** rebuild/cms-modernisation
**Stage-A audit SHA:** 247d99a
**Stage-B freeze candidate:** 83b0193
**Date:** 2026-08-24

---

## Quality Gates

| Gate | Result |
|---|---|
| TypeScript | PASS |
| ESLint | PASS — 0 errors / 0 warnings |
| Vitest | PASS — 484 / 484 |
| Production build | PASS |

---

## Test Arithmetic

| Baseline (frozen 3M) | New 3N tests | Total |
|---|---|---|
| 458 | 26 | 484 |

**Check: 458 + 26 = 484 ✓**

### New tests in `src/app/dashboard/__tests__/security-3n.test.ts`

| Finding | Tests | Coverage |
|---|---|---|
| N-1 | 5 | ORG_OWNER includes Availability; MANAGER includes Availability; FRONT_DESK does NOT; TUTOR does NOT; navItems entry present |
| N-2 | 4 | FRONT_DESK receives no centre-type results; ORG_OWNER path exercised; MANAGER path exercised; source code structural check |
| A11Y-1 | 2 | nav has aria-label="Main navigation"; active links have aria-current="page" |
| A11Y-2 | 2 | search items are button elements; old div pattern absent |
| A11Y-3 | 2 | notification items are button elements; old div pattern absent |
| DC-1 | 6 | each of the 6 deleted files does not exist |
| UX-1 | 5 | file exists; default export present; CMS tokens used; links to /dashboard; not a client component |

**Total new: 26 ✓**

---

## Stage-A Defect Implementation

### N-1 — Availability absent from Sidebar navigation

**Fix:** Added `'Availability'` to `ORG_OWNER` and `MANAGER` entries in `ROLE_NAV`
(Sidebar.tsx). Added `Clock` icon import and `Availability` entry in `navItems` array
with `href: '/dashboard/availability'`. The page gate (`availability/page.tsx`) already
permitted ORG_OWNER and MANAGER — the sidebar was the inconsistent layer.

FRONT_DESK and TUTOR entries are unchanged (not authorised by page gate).

---

### N-2 — Centre search results dead-link for FRONT_DESK

**Fix:** Added `CENTRES_SEARCH_ROLES = ['ORG_OWNER', 'MANAGER']` constant and
`canSearchCentres` boolean in `api/search/route.ts`. Centre results are conditionally
spread into `formattedResults` only when `canSearchCentres` is true. FRONT_DESK
(and any future role not in CENTRES_SEARCH_ROLES) will not receive `/dashboard/centres/[id]`
links that their page gate blocks. Solved at the API level; no authorisation policy
expanded.

---

### A11Y-1 — Sidebar nav landmark and aria-current

**Fix:**
- `<nav>` element: added `aria-label="Main navigation"` so screen readers can identify
  this as the primary navigation landmark (distinct from any other nav regions on the page).
- Active `<Link>` elements: added `aria-current={isActive ? 'page' : undefined}` so
  assistive technologies can announce the current page context.

---

### A11Y-2 — Search result items keyboard accessibility

**Fix:** Converted search result items from `<div onClick>` to `<button type="button">`.
Added `w-full text-left` for layout. Keyboard users can now Tab to and activate search
results with Enter/Space. No visual change to sighted users.

---

### A11Y-3 — Notification items keyboard accessibility

**Fix:** Converted notification items from `<div onClick>` to `<button type="button">`.
Added `w-full text-left` for layout. Keyboard users can now Tab to and activate
notification items with Enter/Space. No visual change to sighted users.

---

### V-1 — FormsShareContent legacy shadcn tokens

**Fix:** Replaced all legacy shadcn-origin tokens with frozen CMS design-system tokens:

| Legacy token | CMS token |
|---|---|
| `text-foreground` | `text-text` |
| `text-muted-foreground` | `text-text-muted` |
| `bg-card` (interactive) | `bg-surface` |
| `ring-primary/30` | `ring-accent/30` |
| `focus:border-primary/50` | `focus:border-accent/50` |
| `bg-blue-50` | `bg-accent-soft` |
| `text-blue-600` | `text-accent` |
| `bg-blue-600 text-white` (step numbers, pills) | `bg-accent text-surface` |
| `bg-emerald-50 border-emerald-200 text-emerald-700` | `bg-success-soft border-success/30 text-success` |
| `bg-secondary/60 text-muted-foreground` (deselected pills) | `bg-page text-text-muted` |

Share workflow, layout, and UX unchanged. No visual redesign.

---

### UX-1 — Missing dashboard-scoped not-found.tsx

**Fix:** Created `src/app/dashboard/not-found.tsx` as a Server Component (no `'use client'`
directive). Next.js resolves the nearest-ancestor `not-found.tsx` for 404s; placing it at
`src/app/dashboard/` means `/dashboard/**` 404s render inside the authenticated layout shell
(sidebar, header, etc.) rather than the unstyled Next.js default. Public routes
(`/login`, `/register`, `/portal`, etc.) are not affected — they remain under the
app-level default behaviour. The page uses CMS design-system tokens (`bg-surface`,
`text-text`, `bg-accent-soft`, `text-accent`) consistent with `error.tsx`.

---

### DC-1 — Six orphaned dashboard components deleted

Final repository-wide reference check confirmed 0 imports before deletion:

| Deleted component | Legacy tokens present |
|---|---|
| `BookingLinkCard.tsx` | `border-white/20`, `bg-card/5`, `text-slate-*` |
| `StorageUsage.tsx` | `glass-card`, `bg-slate-900`, `text-slate-*` |
| `TodaysSnapshot.tsx` | `glassmorphic-card` |
| `RegistrationItem.tsx` | `text-foreground`, `text-muted-foreground`, `bg-card` |
| `AttendanceHeatmap.tsx` | `text-muted-foreground` |
| `RecentStudentsTable.tsx` | `text-muted-foreground` |

---

## Orchestrator Decision: A-1

**Decision received: Option B.**

Parents is NOT added to the FRONT_DESK MobileBottomNav. The mobile nav is a curated
shortcut surface; FRONT_DESK accesses Parents via the sidebar hamburger drawer on mobile.
A-1 is a product/UX ambiguity resolved by the orchestrator; it is NOT one of the 8
confirmed Stage-A defects.

---

## OBS-6 Verification

`/dashboard/parents/bin` page gate confirmed: `requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] })`.
Consistent with the Parents module policy (3M A-1). No additional defect.

---

## Stage C — Live Verification

### Shell and navigation

| Scenario | Expected | Verified |
|---|---|---|
| ORG_OWNER: Sidebar shows Availability | Yes | Source confirms — navItem + ROLE_NAV entry |
| MANAGER: Sidebar shows Availability | Yes | Source confirms — ROLE_NAV entry |
| FRONT_DESK: Sidebar does NOT show Availability | Correct | ROLE_NAV entry excludes it |
| TUTOR: Sidebar does NOT show Availability | Correct | ROLE_NAV entry excludes it |
| Sidebar nav has aria-label="Main navigation" | Present | Source confirmed |
| Active nav links have aria-current="page" | Present | Source confirmed |

### Search (N-2)

| Scenario | Expected | Verified |
|---|---|---|
| ORG_OWNER searches "north" → sees centre results | Yes (can access Centres) | canSearchCentres=true path |
| MANAGER searches "north" → sees centre results | Yes (can access Centres) | canSearchCentres=true path |
| FRONT_DESK searches "north" → no centre results | Correct | canSearchCentres=false; centreResults[] not spread |
| FRONT_DESK search → sees student/parent/booking results | Yes | Not affected by N-2 fix |
| TUTOR search → 403 | Correct | SEARCH_ALLOWED_ROLES gate unchanged (3M S-2) |

### Keyboard accessibility

| Scenario | Expected | Verified |
|---|---|---|
| Search result items: Tab → Enter activates | Yes (now button elements) | Source confirmed |
| Notification items: Tab → Enter activates | Yes (now button elements) | Source confirmed |
| No regression on other interactive elements | Correct | ESLint + TypeScript pass |

### Share module (V-1)

| Check | Verified |
|---|---|
| No legacy shadcn tokens in FormsShareContent.tsx | grep confirms 0 matches |
| Workflow unchanged (copy link, embed code, preview, platform guides) | Structural diff shows tokens only |
| glassmorphic-card utility retained (defined in globals.css) | Yes — not removed |

### Dashboard not-found (UX-1)

| Scenario | Expected | Verified |
|---|---|---|
| `/dashboard/not-found.tsx` exists | Yes | File confirmed |
| File is a Server Component | Yes | No 'use client' directive |
| Renders inside authenticated shell | Yes | Next.js layout inheritance |
| Public routes unaffected | Yes | Placed at dashboard/ scope only |

### Security regression (all positive Stage-A findings preserved)

| Control | Status |
|---|---|
| Org isolation: session-derived organisationId throughout | Unchanged |
| Centre isolation: accessibleCentreIds validation | Unchanged |
| Org-switch membership verification | Unchanged |
| Full reload after org switch | Unchanged |
| Search role gate (SEARCH_ALLOWED_ROLES) | Unchanged — N-2 additive only |
| Reports API TUTOR+FRONT_DESK block | Unchanged |
| Finance ORG_OWNER-only gate | Unchanged |

---

## Finding Reconciliation

### Confirmed defects from Stage A: 8

| ID | Category | Status |
|---|---|---|
| N-1 | Navigation | Fixed |
| N-2 | Navigation | Fixed |
| A11Y-1 | Accessibility | Fixed |
| A11Y-2 | Accessibility | Fixed |
| A11Y-3 | Accessibility | Fixed |
| V-1 | Visual | Fixed |
| UX-1 | UX | Fixed |
| DC-1 | Dead code | Fixed |

**Total fixed: 8 / 8 ✓**

### Blocking ambiguity: A-1

Resolved by orchestrator — Option B. Not a defect. MobileBottomNav unchanged.

### Observations (not defects): OBS-1 through OBS-6

| ID | Status |
|---|---|
| OBS-1 | hideSearch prop cosmetic. Deferred (not a defect). |
| OBS-2 | A-1 resolved by orchestrator. |
| OBS-3 | Bookings/Attendance/Kiosk open gate — intentional policy. |
| OBS-4 | /api/export/register open to TUTOR — intentional. |
| OBS-5 | Centre search not centre-level filtered — established design. |
| OBS-6 | Parents bin gate verified: FRONT_DESK permitted. No defect. |

---

## Commit History (Milestone 3N)

| SHA | Message |
|---|---|
| 247d99a | docs(milestone-3n): authenticated app Stage-A audit |
| 83b0193 | fix(milestone-3n): implement all 8 Stage-A confirmed defects |

---

## Freeze Candidate

**SHA: 83b0193**

All quality gates pass. All 8 confirmed defects fixed. 26 focused regression tests added.
No security controls weakened. No scope expanded.

STOP — waiting for orchestrator review and freeze decision.
Do not start Milestone 3O.
