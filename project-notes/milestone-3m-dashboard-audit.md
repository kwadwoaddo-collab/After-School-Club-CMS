# Milestone 3M — Dashboard & Cross-Module UX Modernisation
## Stage A: Forensic Audit

**Date:** 2026-08-24
**Branch:** rebuild/cms-modernisation
**Starting SHA:** a80bbcf (Milestone 3L frozen tip)
**Previous frozen baseline:** 444/444 tests passing

---

## 1. Starting Branch / SHA Verification

- branch: rebuild/cms-modernisation ✅
- HEAD: a80bbcf ✅
- origin: in sync ✅
- working tree: clean ✅

---

## 2. Surface Inventory

### A. Dashboard Landing Page

| File | Purpose |
|---|---|
| src/app/dashboard/page.tsx | Primary dashboard route — auth, org, centre filter, KPI data |
| src/app/dashboard/loading.tsx | Route-level loading skeleton |
| src/app/dashboard/error.tsx | Route-level error boundary |
| src/app/dashboard/_components/DashboardKpis.tsx | Async KPI widget wrapper |
| src/app/dashboard/_components/DashboardSchedule.tsx | Today's bookings schedule |
| src/app/dashboard/_components/ActivityTab.tsx | Feed + registration funnel |
| src/app/dashboard/_components/OverviewTab.tsx | ORPHANED — imported nowhere in page.tsx |
| src/app/dashboard/_components/DashboardSkeletons.tsx | Suspense skeleton components |
| src/components/dashboard/KpiGrid.tsx | KPI card grid presentation |
| src/components/dashboard/DashboardHero.tsx | Page header / greeting |
| src/components/dashboard/DashboardFilter.tsx | Date/view filter control |
| src/components/dashboard/OnboardingChecklist.tsx | Onboarding progress |
| src/components/dashboard/WelcomeModal.tsx | First-visit welcome modal |
| src/components/dashboard/RevenueWidget.tsx | Finance summary widget |
| src/components/dashboard/GrowthSparkline.tsx | Sparkline chart for KPI cards |

### B. Shared Authenticated Shell

| File | Purpose |
|---|---|
| src/app/dashboard/layout.tsx | Root dashboard layout |
| src/components/dashboard/Sidebar.tsx | Collapsible sidebar with nav + centre selector |
| src/components/dashboard/Header.tsx | Fixed header — search, notifications, theme, user menu |
| src/components/dashboard/MobileBottomNav.tsx | Mobile bottom tab bar |
| src/components/dashboard/SidebarContext.tsx | Sidebar collapsed/open state |
| src/components/dashboard/CentreFilterContext.tsx | Centre selection persistence |
| src/components/dashboard/DashboardContent.tsx | Right-side content wrapper |
| src/components/dashboard/OrgSwitcher.tsx | Multi-org switcher in sidebar |
| src/components/dashboard/HeaderPortal.tsx | Portal for list-page header injection |

### C. Dashboard APIs Called by Shell

| Endpoint | Caller | Purpose |
|---|---|---|
| GET /api/search | Header.tsx | Global search |
| GET /api/notifications | Header.tsx | Load notifications |
| PATCH /api/notifications | Header.tsx | Mark read / all read |
| GET /api/user/switch-org | OrgSwitcher.tsx | Org switch |

---

## 3. Data-Flow Map

DashboardPage (RSC):
- auth() → session
- getUserAccessibleCentreIds(userId) → accessibleCentreIds
- resolveActiveCentreId(searchParams.centre, accessibleCentreIds) → activeCentreId
- db organisations, centres, registrations count, bookings count, staffInvites count
- Renders: DashboardHero, DashboardFilter, OnboardingChecklist (all roles), WelcomeModal (all roles)
- DashboardKpisWidget (Suspense) → getStudentKpis, getBookingKpis, getRegistrationKpis, getWeeklyRegistrations
- DashboardSchedule (Suspense) → bookings TODAY where centres.organisationId = org.id [NOT centre-restricted for non-owners]
- ActivityTab isFeedOnly (Suspense) → recentBookings + recentRegistrations (centre-scoped)
- RevenueWidget (Suspense) → invoices WHERE organisationId [shown to ALL roles including TUTOR]
- ActivityTab isFunnelOnly (Suspense) → registration pipeline

---

## 4. API / Server Action Inventory

### GET /api/search
- Auth: PASS — auth() checked, 401 on failure
- Org isolation: PASS — organisationId from session only
- Centre isolation: FAIL — searches all org centres, not user-accessible subset
- Soft delete: FAIL — children and parents not filtered by deletedAt
- Role restriction: FAIL — no role gating; TUTOR can search students/parents
- Booking org isolation: FAIL — booking WHERE clause lacks org constraint on bookings.centreId

### GET+PATCH /api/notifications
- Auth: PASS
- User scoping: PASS — userId = session.user.id enforced on both GET and PATCH
- Org isolation: N/A (scoped by user)

---

## 5. Authorization Matrix — Page Level

| Module | Page Gate | Permitted Roles |
|---|---|---|
| Dashboard | auth() only | all authenticated org members |
| Centres | requireAuth | ORG_OWNER, MANAGER |
| Staff/Team | requireAuth | ORG_OWNER |
| Students | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK |
| Parents | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK |
| Bookings | auth() only | all authenticated org members |
| Attendance | auth() only | all authenticated org members |
| Incidents | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK |
| Kiosk | auth() only | all authenticated org members |
| Registrations | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK |
| Finance | manual | ORG_OWNER only |
| Reports | manual | ORG_OWNER, MANAGER |
| Communications | requireAuth | ORG_OWNER, MANAGER |
| Settings | requireAuth | ORG_OWNER |
| Share | requireAuth | ORG_OWNER, MANAGER |

---

## 6. Navigation Matrix

### Sidebar ROLE_NAV

| Module | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| Dashboard | YES | YES | YES | YES |
| Centres | YES | YES | NO | NO |
| Team | YES | NO | NO | NO |
| Students | YES | YES | YES | NO |
| Parents | YES | YES | NO | NO |
| Bookings | YES | YES | YES | NO |
| Attendance | YES | YES | YES | YES |
| Incidents | YES | YES | YES | NO |
| Kiosk | YES | YES | YES | YES |
| Registrations | YES | YES | YES | NO |
| Finance | YES | NO | NO | NO |
| Reports | YES | YES | NO | NO |
| Communications | YES | YES | NO | NO |
| Settings | YES | NO | NO | NO |

### MobileBottomNav ROLE_NAV

| Module | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| Dashboard | YES | YES | YES | YES |
| Students | YES | YES | YES | NO |
| Registrations | YES | YES | NO | NO |
| Settings | YES | NO | NO | NO |

---

## 7. Navigation vs Page-Gate Contradictions

### N-1 — FRONT_DESK MobileBottomNav missing Registrations
- Page gate: FRONT_DESK permitted
- Sidebar: FRONT_DESK sees Registrations (added in 3L A-2)
- MobileBottomNav: FRONT_DESK: ['Dashboard', 'Students'] — Registrations absent
- Evidence: MobileBottomNav.tsx line 23
- Precedent: 3L A-2 orchestrator decision added Registrations to sidebar for FRONT_DESK
- Classification: Confirmed defect (sidebar and mobile disagree post-3L-A-2)

### N-2 — FRONT_DESK Parents: page permits but sidebar hides
- Page gate: requireAuth(['ORG_OWNER', 'MANAGER', 'FRONT_DESK'])
- Sidebar: Parents absent from FRONT_DESK ROLE_NAV
- Status: BLOCKING AMBIGUITY A-1 — see Section 17

### N-3 — Header ROLE_LABELS missing FRONT_DESK
- FRONT_DESK users see raw "FRONT_DESK" string in header role display
- Confirmed defect D9

---

## 8. KPI Correctness Analysis

### getStudentKpis
- total: COUNT(DISTINCT children.id) with org, centre, soft-delete filtering — CORRECT
- activePeriod: children.createdAt in date range — CORRECT
- Label "New Students" is accurate

### getBookingKpis
- totalAll: COUNT(*) with centreCondition — CORRECT for centre-scoped total
- No status filtering (includes cancelled) — known architectural choice, documented observation

### getRegistrationKpis
- total, pending, activePeriod all correct
- centreCondition and org scoping applied

### DashboardSchedule (Today's bookings)
- WHERE centres.organisationId = org.id — org-scoped but NOT centre-scoped
- D2: MANAGER with restricted centre access can see cross-centre bookings

### RevenueWidget
- invoices WHERE organisationId = org.id — org-scoped PASS
- D3: Shown to ALL roles; TUTOR/FRONT_DESK see finance totals they cannot access via Finance module
- D1: Links to /dashboard/finances (typo — should be /dashboard/finance)

---

## 9. Centre Filter Analysis

- resolveActiveCentreId: URL → cookie → accessibleCentreIds[0] fallback — CORRECT
- CentreFilterContext: cookie + localStorage, router.refresh() on change — CORRECT
- ORG_OWNER gets all org centres — CORRECT
- Non-owner: restricted to assigned centres, inaccessible cookie value cleared — CORRECT
- Zero-centre: hasCentres=false, conditions use sql`false`, dashboard loads with 0 KPIs — CORRECT
- First-load: no empty-state bug observed (falls back to first accessible centre, not 'all')
- DashboardSchedule does NOT honour centre filter for non-owners — D2

---

## 10. Security Findings

### S-1 (Defect): /api/search — soft-deleted records returned
- children and parents lack isNull(deletedAt) filter
- Fix: Add isNull(children.deletedAt) and isNull(parents.deletedAt)

### S-2 (Defect): /api/search — no role restriction
- TUTOR can search students/parents via this API despite page-level exclusion
- Fix: Require role in ['ORG_OWNER', 'MANAGER', 'FRONT_DESK']

### S-3 (Defect): /api/search — booking results lack org isolation
- Bookings WHERE clause has no centreId/org constraint via centres table
- Fix: Add centres join with eq(centres.organisationId, organisationId)

### S-4 (Observation — not new): page.tsx loads all org centres for onboarding check
- Intentional: owner needs to know if any centre exists regardless of RBAC
- Not a security defect

### S-5 (Defect = D3): RevenueWidget finance data exposed to all roles
- Fix: Gate RevenueWidget rendering on userRole === 'ORG_OWNER' in page.tsx

---

## 11. Confirmed Defects

| ID | Severity | Location | Description |
|---|---|---|---|
| D1 | Medium | RevenueWidget.tsx:108 | Dead link /dashboard/finances — route is /dashboard/finance |
| D2 | Medium | DashboardSchedule.tsx | Today's Schedule not centre-scoped for non-owners |
| D3 | Medium | page.tsx + RevenueWidget | RevenueWidget exposed to TUTOR/FRONT_DESK; finance data leak |
| D4 | Low | error.tsx | text-white, text-on-surface-variant, bg-primary, text-on-primary — legacy tokens, invisible in light mode |
| D5 | Low | loading.tsx | bg-card, border-outline-variant/5, rounded-[24px/32px] — pre-design-system tokens |
| D6 | Low | DashboardSchedule.tsx | bg-white dark:bg-slate-900, border-slate-*, hover:bg-slate-*, text-muted-foreground — legacy tokens |
| D7 | Low | ActivityTab.tsx:280,408,525 | bg-white dark:bg-slate-900, border-slate-200/60 — legacy card tokens |
| D8 | Low | RevenueWidget.tsx:89-95 | bg-white dark:bg-slate-900, border-slate-*, text-muted-foreground — legacy tokens |
| D9 | Low | Header.tsx:27-33 | Missing FRONT_DESK in ROLE_LABELS — raw string shown in UI |
| D10 | Low | CentreFilterContext.tsx | CentreSelector: !text-white, !bg-secondary/40 — legacy tokens (dead component) |
| D11 | Low | DashboardSchedule.tsx:60 | Status badge: bg-primary/10 text-primary — not semantic tokens |
| S-1 | Medium | /api/search | Soft-deleted children/parents in search results |
| S-2 | Medium | /api/search | No role restriction — TUTOR access to search |
| S-3 | Low | /api/search | Booking results lack org-isolation constraint |
| N-1 | Low | MobileBottomNav.tsx | FRONT_DESK: Registrations in sidebar but not mobile nav (post-3L inconsistency) |

Total: 15 confirmed defects

---

## 12. UX Findings

### U-1: OverviewTab.tsx is orphaned
- Not imported in page.tsx. 214 lines of duplicated KPI queries. Safe to delete.

### U-2: DashboardSchedule has no centre-filter awareness
- "Today's Schedule" shows org-wide bookings regardless of selected centre
- One-fix overlap with D2

### U-3: RevenueWidget overdue link is dead (see D1)
- /dashboard/finances → /dashboard/finance

### U-4: Onboarding checklist shown to non-owners
- MANAGER/FRONT_DESK/TUTOR cannot complete onboarding steps (Settings, Centres, Staff invite are owner-only)
- Confusing UX for non-owner roles
- Recommendation: Gate OnboardingChecklist and WelcomeModal on ORG_OWNER role

### U-5: Header hideSearch prop inoperative
- layout.tsx documents currentPath always empty in production
- hideSearch is always false — search bar appears on Registrations/Bookings/Students where it was meant to be hidden

---

## 13. Accessibility Findings

### A-1: error.tsx — no landmark role on error container
### A-2: loading.tsx — skeleton divs lack role="status" aria-label
### A-3: Notification panel items — div onClick, not keyboard accessible (Header.tsx:402)
### A-4: Search results — div onClick items, not keyboard accessible (Header.tsx:299-319)

---

## 14. Responsive Findings

### R-1: Dashboard grid layout — correct responsive breakpoints
### R-2: Header search hidden on mobile (hidden sm:block) — acceptable
### R-3: MobileBottomNav FRONT_DESK gap — only Dashboard + Students on mobile; operational staff lack mobile access to Bookings, Attendance, Incidents, Registrations (addressed by N-1 fix)

---

## 15. Light/Dark Theme Findings

### LDM-1: ActivityTab.tsx — bg-white dark:bg-slate-900, border-slate-* (D7)
### LDM-2: DashboardSchedule.tsx — bg-white dark:bg-slate-900, border-slate-*, hover:bg-slate-*, text-muted-foreground (D6)
### LDM-3: RevenueWidget.tsx — bg-white dark:bg-slate-900, border-slate-*, text-muted-foreground (D8)
### LDM-4: error.tsx — text-white (invisible in light), text-on-surface-variant, bg-primary, text-on-primary (D4)
### LDM-5: loading.tsx — bg-card, border-outline-variant/5 (D5)

---

## 16. Dead / Orphaned Code

| Item | Status |
|---|---|
| OverviewTab.tsx | Orphaned — not imported anywhere. Safe to delete. |
| CentreSelector in CentreFilterContext.tsx | Dead export, broken tokens. |
| hideSearch prop on Header | Inoperative (currentPath always empty). Evaluate for removal. |

---

## 17. Blocking Ambiguity

### A-1: FRONT_DESK Parents sidebar visibility

Evidence:
- Parents page gate: requireAuth(['ORG_OWNER', 'MANAGER', 'FRONT_DESK']) — FRONT_DESK can access
- Sidebar ROLE_NAV: FRONT_DESK does NOT include Parents
- FRONT_DESK can reach /dashboard/parents via direct URL or cross-links

Established precedent:
- Milestone 3L A-2: FRONT_DESK given sidebar access to Registrations to match page gate

Options:
- Option A: Add Parents to FRONT_DESK ROLE_NAV in Sidebar (recommended — mirrors 3L A-2)
- Option B: Remove FRONT_DESK from Parents page gate (security regression — not recommended)
- Option C: Accept inconsistency; FRONT_DESK reaches Parents via cross-links only

Recommendation: Option A — consistent with 3L A-2 precedent. FRONT_DESK operational staff need parent contact access.

---

## 18. Frozen Module Exceptions Potentially Required

| Component | Reason | Scope |
|---|---|---|
| Sidebar.tsx | A-1 resolution if Option A; N-1 Registrations mobile | Narrow — ROLE_NAV only |
| MobileBottomNav.tsx | N-1 FRONT_DESK Registrations gap | Narrow — ROLE_NAV only |
| Header.tsx | D9 FRONT_DESK label; A-3/A-4 keyboard; hideSearch | Targeted lines |

Note: All three are primary 3M scope (shared shell), not frozen individual module files.

---

## 19. Stage A Stop Condition Assessment

ONE blocking product-policy ambiguity found: A-1 (FRONT_DESK Parents sidebar visibility).

Awaiting orchestrator decision on A-1 before Stage B begins.

All other items (D1–D11, S-1–S-3, N-1, U-1–U-5) have clear unambiguous evidence and do not require orchestrator input.

---

*Audit prepared by Milestone 3M implementation agent. Stopping for orchestrator decision on A-1.*
