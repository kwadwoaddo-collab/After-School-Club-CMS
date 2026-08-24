# Milestone 3N — Authenticated App Consolidation, Cross-Module UX & Security Hardening
## Stage A: Forensic Audit

**Date:** 2026-08-24
**Branch:** rebuild/cms-modernisation
**Starting SHA:** 033e758 (Milestone 3M frozen tip)
**Previous frozen baseline:** 458/458 tests passing

---

## 1. Starting State Verification

- branch: rebuild/cms-modernisation OK
- HEAD: 033e758 OK
- working tree: clean OK

---

## 2. Authenticated Application Shell

### Dashboard Layout (src/app/dashboard/layout.tsx)

| Concern | Status |
|---|---|
| Auth gate | auth() -> redirect /login if no session. OK |
| No-org gate | redirect /onboarding if no organisationId. OK |
| Role derivation | from session.user.role, defaults to TUTOR. OK |
| Org isolation | organisationId from session only; not caller-supplied. OK |
| Centre resolution | getUserAccessibleCentres(session.user.id). OK |
| Centre validation | resolveActiveCentreId validates cookie against accessibleCentreIds. OK |
| Subdomain org switch | verifies orgMemberships before updating user record. OK |
| currentPath cosmetic | documented as non-security boundary; hideSearch prop only. OK |
| Skip-to-content link | a#main-content present. OK |
| Bottom-nav clearance | .dashboard-main-content rule in globals.css. OK |

No defects in layout.tsx.

### Shared Shell Components

| Component | Concerns |
|---|---|
| Sidebar.tsx | nav has no aria-label; active links have no aria-current="page" -> A11Y-1 |
| Sidebar.tsx | ROLE_NAV and ALL_NAV up to date post-3K/3L/3M. OK |
| Sidebar.tsx | Share Portals gated on allowedActions (ORG_OWNER + MANAGER only). OK |
| Header.tsx | Search result items are div-onClick — not keyboard accessible -> A11Y-2 |
| Header.tsx | Notification items are div-onClick — not keyboard accessible -> A11Y-3 |
| Header.tsx | ROLE_LABELS includes all 4 roles post-3M. OK |
| MobileBottomNav.tsx | aria-current="page" present; aria-label on each link. OK |
| CentreFilterContext.tsx | URL centre validated against accessible centres before accepting. OK |
| OrgSwitcher.tsx | calls /api/user/switch-org which verifies membership. OK |
| OrgSwitcher.tsx | text-white on bg-accent for initials chip — intentional/acceptable contrast. OK |

---

## 3. Role -> Navigation -> Page-Gate Matrix

### Page-Gate Inventory

| Module | Gate mechanism | Permitted roles | Evidence |
|---|---|---|---|
| Dashboard | auth() only | All authenticated org members | layout.tsx |
| Centres | requireAuth | ORG_OWNER, MANAGER | centres/page.tsx |
| Staff/Team | requireAuth | ORG_OWNER | staff/page.tsx |
| Students | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK | students/page.tsx |
| Parents | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK | parents/page.tsx |
| Bookings | auth() only, no role check | All authenticated | bookings/page.tsx:50-72 |
| Attendance | auth() only, no role check | All authenticated | attendance/page.tsx |
| Incidents | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK | incidents/page.tsx |
| Kiosk | auth() only, no role check | All authenticated | kiosk/page.tsx |
| Registrations | requireAuth | ORG_OWNER, MANAGER, FRONT_DESK | registrations/page.tsx |
| Finance | Manual role check | ORG_OWNER only | finance/page.tsx:39 |
| Reports | Manual role check | ORG_OWNER, MANAGER | reports/page.tsx:17-19 |
| Communications | requireAuth | ORG_OWNER, MANAGER | communications/page.tsx |
| Settings | requireAuth | ORG_OWNER | settings/page.tsx |
| Availability | Manual role check | ORG_OWNER, MANAGER | availability/page.tsx:26-28 |
| Share | requireAuth | ORG_OWNER, MANAGER | share/page.tsx:15 |

Note: Bookings, Attendance, and Kiosk are intentionally open to all staff roles (including TUTOR and FRONT_DESK). Consistent with Sidebar ROLE_NAV. Not defects.

### Sidebar ROLE_NAV (post-3M)

| Module | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR | Notes |
|---|---|---|---|---|---|
| Dashboard | YES | YES | YES | YES | OK |
| Centres | YES | YES | NO | NO | Consistent with gate |
| Team | YES | NO | NO | NO | Consistent with gate |
| Students | YES | YES | YES | NO | Consistent with gate |
| Parents | YES | YES | YES | NO | 3M A-1 fix OK |
| Bookings | YES | YES | YES | NO | Open gate; sidebar is subset |
| Attendance | YES | YES | YES | YES | Open gate; all in sidebar OK |
| Incidents | YES | YES | YES | NO | 3K policy OK |
| Kiosk | YES | YES | YES | YES | Open gate; all in sidebar OK |
| Registrations | YES | YES | YES | NO | 3L A-2 + gate consistent OK |
| Finance | YES | NO | NO | NO | Consistent with ORG_OWNER gate OK |
| Reports | YES | YES | NO | NO | Consistent with gate OK |
| Communications | YES | YES | NO | NO | Consistent with gate OK |
| Settings | YES | NO | NO | NO | Consistent with gate OK |
| Availability | -- | -- | -- | -- | NOT in Sidebar ALL_NAV -> N-1 |
| Share | YES (via allowedActions) | YES (via allowedActions) | NO | NO | Consistent with gate OK |

### MobileBottomNav ROLE_NAV (post-3M)

| Module | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| Dashboard | YES | YES | YES | YES |
| Students | YES | YES | YES | NO |
| Registrations | YES | YES | YES | NO |
| Settings | YES | NO | NO | NO |

All MobileBottomNav entries exist in Sidebar. Mobile nav is correctly a subset.

### Navigation vs Page-Gate Discrepancies

| Finding ID | Description | Classification |
|---|---|---|
| N-1 | Availability page (ORG_OWNER + MANAGER) absent from Sidebar ALL_NAV and ROLE_NAV — no UI path | Confirmed defect — navigation omission |
| N-2 | Search API returns centre-type results with /dashboard/centres/[id] URLs to FRONT_DESK; FRONT_DESK cannot access Centres page — dead link | Confirmed defect — role-sensitive search results |

---

## 4. Organisation Isolation

All surfaces inspected derive organisationId from session.user.organisationId.
/api/user/switch-org verifies orgMemberships before updating active org.
Subdomain org switch verified membership before persisting.
Full page reload on org switch resets client state.

No organisation isolation defects found.

---

## 5. Centre Isolation

resolveActiveCentreId validates cookie/URL centreId against accessibleCentreIds.
CentreFilterContext validates URL ?centre= against accessible centres list.
/api/export/register validates centreParam against accessibleCentreIds; cross-centre -> 403.
Subdomain centre force-selected only if in validCentreIds.
Post-org-switch full reload resets all client centre state.

No centre isolation defects found.

---

## 6. Global Search

| Concern | Status |
|---|---|
| Authentication | Session required; 401 on failure. OK |
| Role gate (S-2) | SEARCH_ALLOWED_ROLES: ORG_OWNER, MANAGER, FRONT_DESK; TUTOR -> 403. OK |
| Org isolation | organisationId from session. OK |
| Soft-delete (S-1) | isNull(children.deletedAt) + isNull(parents.deletedAt). OK |
| Booking org-isolation (S-3) | innerJoin centres + eq(centres.organisationId, organisationId). OK |
| Centre results for FRONT_DESK | Centre results returned; URLs -> /dashboard/centres/[id] inaccessible to FRONT_DESK | N-2 confirmed defect |
| Result navigation keyboard | div onClick — not keyboard accessible | A11Y-2 (search result items) |
| Empty state | "No results for..." shown. OK |
| Min query length | query.trim().length < 2 -> returns []. OK |

---

## 7. Shared Loading / Error / Empty States

| File | Status |
|---|---|
| src/app/dashboard/error.tsx | Tokens fixed in 3M (D4); role="alert" present. OK |
| src/app/dashboard/loading.tsx | Tokens fixed in 3M (D5); role="status" present. OK |
| src/app/dashboard/not-found.tsx | Does NOT exist. Next.js default 404 used. -> UX-1 |
| src/app/not-found.tsx | Does NOT exist. |

Finding UX-1: No not-found.tsx at dashboard or app scope. Authenticated users navigating
to /dashboard/students/nonexistent-id receive the unstyled Next.js default 404 page
outside the authenticated shell. Not a security issue; broken UX experience.

---

## 8. Design-System Token Scan

### Active components with legacy tokens:

| Component | Legacy tokens | In active use? | Finding |
|---|---|---|---|
| FormsShareContent.tsx | text-foreground, text-muted-foreground, ring-primary/30, focus:border-primary/50, bg-card | YES (Share module, ORG_OWNER+MANAGER) | V-1 |
| OrgSwitcher.tsx | text-white on bg-accent (initials chip) | YES | Intentional — acceptable contrast. Not a defect. |
| Header.tsx | None found | YES | OK |
| Sidebar.tsx | None found | YES | OK |
| MobileBottomNav.tsx | None found | YES | OK |

Note: glassmorphic-card is defined in globals.css with dark-mode adaptation. Not a broken token.

### Orphaned components with legacy tokens:

| Component | Legacy tokens | Orphaned? |
|---|---|---|
| BookingLinkCard.tsx | border-white/20, bg-card/5, text-slate-300/400/500 | YES — zero imports in src/app |
| StorageUsage.tsx | glass-card, bg-slate-900, text-white, text-slate-* | YES — zero imports |
| TodaysSnapshot.tsx | glassmorphic-card | YES — zero imports |
| RegistrationItem.tsx | text-foreground, text-muted-foreground, bg-card, rounded-[24px] | YES — zero imports |
| AttendanceHeatmap.tsx | text-muted-foreground | YES — zero imports |
| RecentStudentsTable.tsx | text-muted-foreground | YES — zero imports |

All 6 are in src/components/dashboard/. DC-1 covers all of them.

---

## 9. Responsive Shell Audit

| Surface | 375px | 768px | 1440px |
|---|---|---|---|
| Sidebar | Mobile drawer + overlay OK | Collapses to icon-only at lg OK | Full sidebar OK |
| MobileBottomNav | Visible, correct clearance OK | Hidden at lg OK | Hidden OK |
| Header | Responsive OK | Search hidden on mobile (acceptable) OK | Full OK |
| Main content | pb clearance via .dashboard-main-content OK | OK | OK |

No responsive defects in the shell.

---

## 10. Accessibility Audit

| ID | Finding | Location | Severity |
|---|---|---|---|
| A11Y-1 | nav in Sidebar has no aria-label; active Link elements have no aria-current="page" | Sidebar.tsx:322 | Medium |
| A11Y-2 | Search result items are div-onClick with no role="button", no tabIndex, no onKeyDown | Header.tsx:300-316 | Medium |
| A11Y-3 | Notification items are div-onClick with no role="button", no tabIndex, no onKeyDown | Header.tsx:402-414 | Medium |

---

## 11. Authentication / Session Failure Behaviour

| Scenario | Behaviour | Status |
|---|---|---|
| No session | redirect /login | OK |
| No organisationId | redirect /onboarding | OK |
| Org fetch failure | try/catch fallback to 'AfterSchool' | OK non-critical |
| Invalid cookie centreId | resolveActiveCentreId rejects and falls back to first accessible | OK |
| Zero accessible centres | hasCentres=false, dashboard loads with empty KPIs | OK |
| Session expiry | Middleware redirect; no infinite loop observed | OK |

---

## 12. Shared API / Action Security

| API | Org isolation | Role gate | Centre validation | Status |
|---|---|---|---|---|
| /api/search | session-derived OK | SEARCH_ALLOWED_ROLES (3M) OK | N/A | OK + N-2 |
| /api/notifications | userId=session.user.id OK | All staff (appropriate) | N/A | OK |
| /api/user/switch-org | membership check OK | Any authenticated | N/A | OK |
| /api/centres | session org OK | ORG_OWNER only | N/A | OK |
| /api/centres/[id] | session org + row check OK | ORG_OWNER | N/A | OK |
| /api/branding | session org OK | ORG_OWNER | N/A | OK |
| /api/export/register | getUserAccessibleCentres OK | All staff (intentional — TUTOR has attendance) | centreParam validated OK | OK |
| /api/export/finance | session org OK | ORG_OWNER only OK | OK | OK |
| /api/reports/attendance | session org OK | ORG_OWNER, MANAGER OK | OK | OK |
| /api/reports/bookings | session org OK | ORG_OWNER, MANAGER OK | OK | OK |
| /api/reports/students | session org OK | ORG_OWNER, MANAGER OK | OK | OK |
| /api/staff/assign-centres | target user org verified OK | ORG_OWNER only OK | centreIds validated against org OK | OK |

No new shared API security defects found.

---

## 13. Mobile Navigation Reconciliation (post-3K/3L/3M)

Sidebar ROLE_NAV vs page gates — confirmed consistent:
- FRONT_DESK: Parents OK (3M A-1)
- FRONT_DESK: Registrations OK (3L A-2)
- FRONT_DESK: Incidents OK (3K Option C)
- TUTOR: Incidents NOT present OK (3K removed)

MobileBottomNav vs Sidebar:
- FRONT_DESK: Registrations OK (3M N-1)
- FRONT_DESK: Parents — NOT in MobileBottomNav.

AMBIGUITY A-1: Should Parents be added to the FRONT_DESK MobileBottomNav?

Evidence FOR (Option A):
- 3M A-1 added Parents to FRONT_DESK sidebar (orchestrator decision)
- Parents page gate permits FRONT_DESK
- Operational staff may need mobile access to parent contacts

Evidence AGAINST (Option B):
- Mobile nav is deliberately limited to highest-priority items
- FRONT_DESK already has 3 mobile items; adding Parents = 4
- 3M N-1 only added Registrations, not Parents, to mobile nav
- Mobile nav having fewer items than sidebar is established architecture

This is a product-design decision. Not inventing policy.

STOPPING for orchestrator decision on A-1 before Stage B begins.

Options:
- Option A: Add Parents to FRONT_DESK MobileBottomNav ROLE_NAV
- Option B: Leave mobile nav unchanged; FRONT_DESK accesses Parents via sidebar hamburger

Implementer recommendation: Option B. The sidebar drawer is available on mobile.
FRONT_DESK already has 3 mobile items. Parents is accessible via sidebar on mobile.
Adding it would approach the practical space limit without clear operational necessity.

---

## 14. Dead / Orphaned Shared UI

6 orphaned components in src/components/dashboard/ — all confirmed unused (zero imports in src/app):

1. BookingLinkCard.tsx
2. StorageUsage.tsx
3. TodaysSnapshot.tsx
4. RegistrationItem.tsx
5. AttendanceHeatmap.tsx
6. RecentStudentsTable.tsx

DC-1 covers all 6.

---

## 15. Cross-Module Link Audit

| Link | Destination | FRONT_DESK safe? | Status |
|---|---|---|---|
| Dashboard -> Students | /dashboard/students | YES | OK |
| Dashboard -> Finance | /dashboard/finance | Not shown (isOwner gate) | OK |
| Search -> /dashboard/students/[id] | Students detail | YES gate permits | OK |
| Search -> /dashboard/parents/[id] | Parents detail | YES gate permits | OK |
| Search -> /dashboard/bookings/[id] | Bookings detail | YES accessible | OK |
| Search -> /dashboard/centres/[id] | Centres detail | NO — FRONT_DESK blocked | N-2 |
| Parents -> /dashboard/parents/bin | Recovery Bin | FRONT_DESK sees Parents in sidebar; bin is sub-item. Page gate not yet verified | OBS-6 |
| Attendance -> /dashboard/attendance/ledger | Session Ledger | All-staff gate; TUTOR can reach | OK |

---

## 16. Security Regression Overview

All 3D-3M security fixes verified in-place:
- Org isolation at shared boundaries: OK
- Centre isolation with validation: OK
- Search role gate (3M S-2): OK
- Search soft-delete (3M S-1): OK
- Search booking org-isolation (3M S-3): OK
- Finance ORG_OWNER-only (3M D3/S-5): OK
- Cross-org switch membership verification: OK
- Reports API role blocking (TUTOR + FRONT_DESK): OK

No regression of frozen security controls found.

---

## 17. Confirmed Defects

| ID | Category | Severity | Location | Description |
|---|---|---|---|---|
| N-1 | Navigation | Low | Sidebar.tsx ALL_NAV | Availability module absent from Sidebar navigation — ORG_OWNER and MANAGER have no UI path |
| N-2 | Navigation | Medium | api/search/route.ts + Header.tsx | Search returns centre-type results with /dashboard/centres/[id] URLs to FRONT_DESK; Centres gate blocks FRONT_DESK — dead/misleading links |
| A11Y-1 | Accessibility | Medium | Sidebar.tsx:322 | nav has no aria-label; active Link elements have no aria-current="page" |
| A11Y-2 | Accessibility | Medium | Header.tsx:300-316 | Search result items are div-onClick — no role="button", no tabIndex, no onKeyDown |
| A11Y-3 | Accessibility | Medium | Header.tsx:402-414 | Notification items are div-onClick — no role="button", no tabIndex, no onKeyDown |
| V-1 | Visual | Low | FormsShareContent.tsx | Active Share module uses text-foreground, text-muted-foreground, ring-primary/30, focus:border-primary/50 — shadcn tokens not aligned with CMS design system |
| UX-1 | UX | Low | app-level | No not-found.tsx at dashboard or app scope — authenticated users get unstyled Next.js default 404 outside the authenticated shell |
| DC-1 | Dead code | Low | src/components/dashboard/ | 6 orphaned components confirmed unused: BookingLinkCard, StorageUsage, TodaysSnapshot, RegistrationItem, AttendanceHeatmap, RecentStudentsTable |

Total confirmed defects: 8

By category:
- Security: 0
- Correctness: 0
- Navigation: 2 (N-1, N-2)
- Responsive: 0
- Accessibility: 3 (A11Y-1, A11Y-2, A11Y-3)
- Visual: 1 (V-1)
- UX: 1 (UX-1)
- Dead code: 1 (DC-1)

Category total: 0+0+2+0+3+1+1+1 = 8 OK

---

## 18. Observations / Recommendations (NOT defects)

| ID | Description |
|---|---|
| OBS-1 | hideSearch prop on Header is inoperative (documented in layout.tsx). Cleanup deferred. |
| OBS-2 | FRONT_DESK Parents in MobileBottomNav — see Ambiguity A-1. Orchestrator decision required. |
| OBS-3 | Bookings/Attendance/Kiosk auth()-only gates are intentional policy. Not defects. |
| OBS-4 | /api/export/register available to all authenticated staff (TUTOR has attendance access). Intentional. |
| OBS-5 | Centre search results not centre-level filtered — org-scoped is the established design. |
| OBS-6 | Parents Recovery Bin sub-item visible to FRONT_DESK. /dashboard/parents/bin gate not yet verified — to be confirmed in Stage B. |

Observations/recommendations: 6

---

## 19. Blocking Ambiguity

A-1: Should Parents be added to the FRONT_DESK MobileBottomNav ROLE_NAV?

See Section 13 for full evidence and options.

This is a blocking product-policy ambiguity.

Stage A is complete. Stopping for orchestrator decision on A-1.

---

## Pending Verification (Stage B regardless of A-1 decision)

- OBS-6: /dashboard/parents/bin page gate for FRONT_DESK
- N-2 fix: Filter centre-type results from search API for FRONT_DESK (API-level or result-level)

---

*Audit prepared by Milestone 3N implementation agent.*
*Stopping for orchestrator decision on A-1 before Stage B begins.*
