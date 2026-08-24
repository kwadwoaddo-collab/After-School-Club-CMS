# Milestone 3M — Dashboard & Cross-Module UX Modernisation
## Completion Report (Reconciled)

**Branch:** rebuild/cms-modernisation
**Frozen 3L baseline:** a80bbcf
**Stage-A audit SHA:** 2a3ce45
**Stage-B implementation SHA:** 75b43b6
**Stage-B final cleanup SHA:** bf8a7d0
**Freeze candidate (pre-reconciliation):** f748ea7
**Reconciliation commit:** (this commit — see below)

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
- `src/app/api/search/__tests__/search-3m.test.ts` — 7 tests (S-1 / S-2 / S-3)
- `src/app/dashboard/__tests__/dashboard-3m.test.ts` — 7 tests (D1 / D2 / D3 / D9 / N-1 / A-1-nav / U-1-deletion)

---

## Authoritative Finding-Count Summary

```
Original Stage-A confirmed defects:           15
Stage-A product-policy ambiguity (A-1):        1  (not in defect count)
Additional Stage-B/C confirmed defects:        0
Total confirmed defects ultimately fixed:     15

Non-defect observations acted upon:            2  (U-1, U-4 — see section below)
Non-defect ambiguity resolved:                 1  (A-1 — orchestrator Option A)
```

---

## Note on S-5

The Stage-A audit Section 10 explicitly states:

> S-5 (Defect = D3): RevenueWidget finance data exposed to all roles

S-5 and D3 are the **same finding** — S-5 is the security framing, D3 is the correctness
framing. They share a single fix (gate RevenueWidget to ORG_OWNER) and count as **one**
of the 15 confirmed defects. S-5 is represented in this report under the D3 row with the
notation "D3 / S-5".

The original completion report listed S-5 only inline as "D3 / S-5" in the Correctness
table. It was not a separate security-table entry because it is not a separate finding.

---

## Note on D9 Category

The original completion summary used the shorthand "D4–D11" for design-system token fixes.
This is misleading: D9 (Header ROLE_LABELS) belongs to the **Navigation / Role Consistency**
category, not the token category.

Exact token-fix IDs: **D4, D5, D6, D7, D8, D10, D11** (7 defects).
D9 is separately listed under Navigation / Role Consistency.

---

## Complete Finding Reconciliation Table

### Security / Data-Isolation  (3 defects: S-1, S-2, S-3)

| ID | In 15? | Fix | Files | Test |
|---|---|---|---|---|
| S-1 | YES | `isNull(children.deletedAt)` + `isNull(parents.deletedAt)` in search | `api/search/route.ts` | `search-3m.test.ts` |
| S-2 | YES | `SEARCH_ALLOWED_ROLES`; TUTOR → 403 | `api/search/route.ts` | `search-3m.test.ts` |
| S-3 | YES | `innerJoin centres` + `eq(centres.organisationId, organisationId)` on bookings | `api/search/route.ts` | `search-3m.test.ts` (structural) |

### Security / Role-Sensitive Data  (1 defect: S-5 = D3)

| ID | In 15? | Notes | Fix | Files | Test |
|---|---|---|---|---|---|
| S-5 / D3 | YES — one entry | S-5 = security framing; D3 = correctness framing. Single fix. | Gate `RevenueWidget` to `isOwner` (ORG_OWNER) | `page.tsx` | `dashboard-3m.test.ts` |

### Correctness  (3 defects: D1, D2, D3)

| ID | In 15? | Fix | Files | Test |
|---|---|---|---|---|
| D1 | YES | `href` corrected: `/dashboard/finances` → `/dashboard/finance` | `RevenueWidget.tsx` | `dashboard-3m.test.ts` |
| D2 | YES | `accessibleCentreIds` + `hasCentres` props; `inArray(bookings.centreId, ...)` | `DashboardSchedule.tsx`, `page.tsx` | `dashboard-3m.test.ts` |
| D3 | YES | Gate render to `isOwner` in `page.tsx` (= S-5) | `page.tsx` | `dashboard-3m.test.ts` |

### Navigation / Role Consistency  (2 defects: D9, N-1)

| ID | In 15? | Fix | Files | Test |
|---|---|---|---|---|
| D9 | YES | `FRONT_DESK: 'Front Desk'` added to `ROLE_LABELS` | `Header.tsx` | `dashboard-3m.test.ts` |
| N-1 | YES | `'Registrations'` added to FRONT_DESK `ROLE_NAV` | `MobileBottomNav.tsx` | `dashboard-3m.test.ts` |

### Design System Token Fixes  (7 defects: D4, D5, D6, D7, D8, D10, D11)

Note: D9 is NOT in this group — it is listed under Navigation above.

| ID | In 15? | Tokens replaced | Files | Test |
|---|---|---|---|---|
| D4 | YES | `text-white`/`bg-card`/`bg-primary`/`text-on-primary`/`outline-variant`/`rounded-[32px]` → design system tokens; added `role="alert"` | `error.tsx` | Source-level |
| D5 | YES | `bg-card`/`border-outline-variant`/`rounded-[24/32px]` → `bg-secondary`/`border-border`/`rounded-xl`; added `role="status"` | `loading.tsx` | Source-level |
| D6 | YES | `bg-white dark:bg-slate-900`/`border-slate-*`/`hover:bg-slate-*`/`text-muted-foreground` → `Card`/design tokens | `DashboardSchedule.tsx` | Source-level (fixed with D2) |
| D7 | YES | `bg-white dark:bg-slate-900`/`border-slate-200/60` → `bg-surface`/`border-border`/`rounded-xl` (3 card wrappers) | `ActivityTab.tsx` | Source-level |
| D8 | YES | `bg-white dark:bg-slate-900`/`border-slate-*`/`text-muted-foreground`/`text-destructive`/`bg-destructive/10` → design tokens | `RevenueWidget.tsx` | Source-level |
| D10 | YES | `!text-white`/`!bg-secondary/40`/`!border-outline-variant`/`focus:!border-primary` → design tokens | `CentreFilterContext.tsx` | Source-level |
| D11 | YES | `bg-primary/10 text-primary` badge → `bg-success-soft text-success` / `bg-warning-soft text-warning` / `bg-danger-soft text-danger` | `DashboardSchedule.tsx` | Source-level (fixed with D2) |

### Defect Count Check

| Category | IDs | Count |
|---|---|---|
| Security / data-isolation | S-1, S-2, S-3 | 3 |
| Security / role-sensitive data (= D3) | S-5 | 0 additional (counted under D3) |
| Correctness | D1, D2, D3 | 3 |
| Navigation / role | D9, N-1 | 2 |
| Design system tokens | D4, D5, D6, D7, D8, D10, D11 | 7 |
| **Total** | | **15** |

No overlap. No double-counting. All 15 Stage-A confirmed defects are fixed.

---

## Product-Policy Ambiguity A-1 — Not a Confirmed Defect

| Item | Value |
|---|---|
| ID | A-1 |
| Stage-A classification | Blocking product-policy ambiguity (Section 17 of audit) |
| Included in 15? | **NO** |
| Additional Stage-B/C defect? | **NO** |
| Action | Orchestrator decision: Option A |
| Fix | `'Parents'` added to FRONT_DESK `ROLE_NAV` in `Sidebar.tsx` |
| Regression test | `dashboard-3m.test.ts` — "A-1 – Sidebar FRONT_DESK ROLE_NAV includes Parents" |

---

## UX Observations U-1 and U-4 — Not Confirmed Defects

These items appear in Stage-A audit **Section 12: UX Findings** — explicitly separate from
Section 11 "Confirmed Defects". They are UX observations/recommendations.

The original completion report presented them under a "UX fixes" heading alongside confirmed
defects. This was documentation drift. They are not additional confirmed defects.

| ID | Stage-A classification | In 15? | Additional defect? | Action taken |
|---|---|---|---|---|
| U-1 | UX observation — dead code | NO | NO | `OverviewTab.tsx` deleted: 214-line orphaned file, never imported, duplicated KPI queries. Low-risk housekeeping with clear Stage-A evidence. |
| U-4 | UX observation — UX recommendation | NO | NO | `OnboardingChecklist` + `WelcomeModal` gated to `ORG_OWNER` in `page.tsx`. Non-owner staff cannot complete onboarding steps (Settings/Centres/Staff-invite are ORG_OWNER-only). UX improvement; not a security or correctness defect. |

---

## Observations NOT Acted Upon This Milestone

| ID | Description | Disposition |
|---|---|---|
| U-2 | DashboardSchedule centre-filter UX | Alias of D2 — fixed |
| U-3 | RevenueWidget overdue link | Alias of D1 — fixed |
| U-5 | Header `hideSearch` prop inoperative | Deferred — not a security or correctness defect |
| S-4 | page.tsx loads all org centres for onboarding | Observation only — intentional, not a defect |
| A-3/A-4 | Notification/search keyboard accessibility | Deferred — outside 3M scope |
| R-3 | MobileBottomNav FRONT_DESK operational gap | Fixed as part of N-1 |
| LDM-1–5 | Light/dark theme token observations | Aliases of D4–D8 — fixed |

---

## Frozen-Module Exceptions (Narrow, Documented)

| File | Change | Reason |
|---|---|---|
| `Sidebar.tsx` | FRONT_DESK `ROLE_NAV` entry only — added `'Parents'` | A-1 orchestrator decision |
| `MobileBottomNav.tsx` | FRONT_DESK `ROLE_NAV` entry only — added `'Registrations'` | N-1 confirmed defect |
| `Header.tsx` | `ROLE_LABELS` constant only — added `FRONT_DESK: 'Front Desk'` | D9 confirmed defect |

---

## Stage-C Verification (Source-Level)

| Check | Result |
|---|---|
| S-1: soft-delete filters present | `isNull(children.deletedAt)` + `isNull(parents.deletedAt)` confirmed |
| S-2: TUTOR → 403 on search | `SEARCH_ALLOWED_ROLES` constant confirmed; test passes |
| S-3: booking org-isolation | `innerJoin centres … eq(centres.organisationId, organisationId)` confirmed |
| S-5 / D3: RevenueWidget gate | `{isOwner && (<Suspense>…<RevenueWidget…>` confirmed |
| D1: link corrected | `href="/dashboard/finance"` confirmed; no `finances` in JSX |
| D2: centre scope props | `accessibleCentreIds`, `hasCentres`, `centreScopeCondition` all present |
| D4: error.tsx tokens | 0 occurrences of `text-white`/`bg-card`/`bg-primary`/`outline-variant` in error.tsx |
| D5: loading.tsx tokens | 0 occurrences of `bg-card`/`outline-variant`/`rounded-[` in loading.tsx |
| D6 + D11: DashboardSchedule tokens | 0 occurrences of `bg-white`/`dark:bg-slate`/`bg-primary/10` in DashboardSchedule.tsx |
| D7: ActivityTab tokens | 0 occurrences of `bg-white`/`dark:bg-slate`/`border-slate-200` in ActivityTab.tsx |
| D8: RevenueWidget tokens | 0 occurrences of `bg-white`/`dark:bg-slate`/`text-destructive`/`bg-destructive` in RevenueWidget.tsx |
| D9: ROLE_LABELS FRONT_DESK | `FRONT_DESK: 'Front Desk'` confirmed in Header.tsx |
| D10: CentreSelector tokens | 0 occurrences of `!text-white`/`!border-outline-variant` in CentreFilterContext.tsx |
| A-1: Parents in FRONT_DESK sidebar | `FRONT_DESK: ['Dashboard', 'Students', 'Parents', …]` confirmed |
| N-1: Registrations in mobile nav | `FRONT_DESK: ['Dashboard', 'Students', 'Registrations']` confirmed |
| U-1: OverviewTab deleted | `src/app/dashboard/_components/OverviewTab.tsx` confirmed absent |
| Production build | PASS — exit 0, no errors/warnings |

---

## No New Ambiguities Discovered

Stage B/C implementation did not surface any additional product-policy ambiguities requiring orchestrator decision.

---

**STOP — Milestone 3M complete. Do not begin Milestone 3N.**
