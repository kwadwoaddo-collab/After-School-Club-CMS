# SPRINTSCALE CMS — PM-1.1
## HELP & TRAINING NAVIGATION DISCOVERABILITY
### POST-RELEASE UX CORRECTION

**Date:** 3 September 2026  
**Status:** COMPLETED — LOCAL COMMIT ONLY  
**Milestone Type:** Post-Release UX / Navigation Discoverability Correction  
**Baseline Release Code SHA:** `98d30c4` (`cms-help-training-v1.0.0`)  
**Baseline Closure Documentation SHA:** `aad2cab`  
**Historical Release Tag:** `cms-modernisation-v1.1.0` -> `de8b4e2` (Preserved intact)  

---

## 1. Baseline Verification

Before commencing PM-1.1 implementation, the repository state was forensically verified:
- **Active Branch:** `main`
- **HEAD SHA:** `aad2cab`
- **Remote `origin/main`:** `aad2cab`
- **Remote `origin/rebuild/cms-modernisation`:** `aad2cab`
- **Help Release Tag:** `cms-help-training-v1.0.0` -> `98d30c4`
- **Historical Release Tag:** `cms-modernisation-v1.1.0` -> `de8b4e2`
- **Working Tree:** Clean

---

## 2. Production UX Issue & Problem Analysis

Following the production deployment of Milestone PM-1H to `https://app.sprintscaleit.co.uk`, visual inspection identified a discoverability problem on desktop screens with standard navigation:
- On desktop, the "Help & Training" navigation entry appeared at the very bottom of the sidebar, beneath all 15 operational modules and `Settings`.
- On realistic viewport heights (e.g. 1280x800, 1440x900) with full operational modules visible, the Help entry was pushed below the immediately visible viewport or partially clipped.
- The bottom location visually associated Help with secondary utility controls rather than a core primary orientation tool.
- For staff onboarding or looking for guidance, the entry was easy to overlook.

**Classification:** POST-RELEASE UX / NAVIGATION DISCOVERABILITY DEFECT.

---

## 3. Root Cause Analysis

In `src/components/dashboard/Sidebar.tsx`:
- The desktop navigation items were partitioned into primary `navItems` (lines 137–157) and a separated bottom utility section (lines 393–450).
- `Help & Training` was implemented as a standalone `<div className="relative group/tooltip mb-2">` inside the bottom utility area, below the separator rule `<div className="h-px bg-border-subtle mb-4" />`.
- `ROLE_NAV` (lines 48–60) controlled which items from `navItems` were rendered for each authenticated role, but `Help & Training` was not defined inside `ROLE_NAV` or `navItems`; it was hardcoded at the bottom.

---

## 4. Navigation Architecture Discovered

1. **Shared Configuration:** `Sidebar.tsx` serves as both the desktop sidebar (expanded and collapsed rails) and the full mobile slide-out drawer on `<lg` screens.
2. **Role Filtering:** `ROLE_NAV: Record<string, string[]>` controls allowed primary navigation items per role (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`).
3. **Active Route Styling:** `navItems.map` evaluates `item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)`, applying `text-accent bg-accent-soft` and `aria-current="page"`.
4. **Mobile Bottom Navigation:** `MobileBottomNav.tsx` renders a separate 4-destination persistent bottom bar for mobile screens (`Dashboard`, `Students`, `Registrations`, `Settings`). It is intentionally distinct from the full drawer.
5. **Profile Menu:** `Header.tsx` (lines 490–498) already exposed a secondary `Help & Training` link in the user profile dropdown.

---

## 5. Exact Implementation Changes

### 1. `src/components/dashboard/Sidebar.tsx`
- **`ROLE_NAV`:** Added `'Help & Training'` immediately after `'Dashboard'` across all 4 authenticated staff roles (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`).
- **`navItems`:** Added `{ name: 'Help & Training', icon: CircleHelp, href: '/dashboard/help' }` immediately after `Dashboard` and before `Centres`.
- **Utility Area:** Removed the redundant bottom utility Help link from lines 396–425.
- **Canonical Entry:** Exactly ONE canonical Help & Training link now exists in the sidebar.

### 2. `src/components/dashboard/Header.tsx`
- Preserved existing secondary Help entry in the user profile dropdown (`/dashboard/help`).

### 3. `src/components/dashboard/MobileBottomNav.tsx`
- Untouched. No existing primary bottom-nav destination was altered or displaced.

---

## 6. Desktop Navigation Behavior

- **Ordering:** `Dashboard` -> `Help & Training` -> `Centres` -> `Team` -> `Communications` -> `Students` ...
- **Immediate Visibility:** Visible immediately above the fold on all standard viewports (1440x900, 1280x800) with zero scrolling required.
- **Collapsed State:** Shows centered `CircleHelp` icon with native `title="Help & Training"` tooltip.
- **Active State:** When visiting `/dashboard/help` (or subroutes `/dashboard/help/guides/*`, `/dashboard/help/videos/*`, `/dashboard/help/learning-paths/*`), the link highlights with `text-accent bg-accent-soft` and `aria-current="page"`.

---

## 7. Mobile Navigation Behavior

- **Drawer Navigation:** Tapping the hamburger menu (`button[aria-label="Open menu"]`) opens the full slide-out drawer where `Help & Training` appears prominently near the top immediately below `Dashboard`.
- **Auto-Close:** Tapping `Help & Training` automatically closes the mobile drawer and navigates to `/dashboard/help`.
- **Bottom Navigation:** Persistent bottom navigation remains strictly intact (`Dashboard`, `Students`, `Registrations`, `Settings`).

---

## 8. Profile Menu Decision

Audit of `Header.tsx` confirmed that a secondary `Help & Training` entry was already cleanly implemented in the authenticated profile dropdown (lines 490–498).
- Preserved and verified functional.
- Recorded in visual evidence `N8.png`.

---

## 9. Role Verification

All 4 authenticated roles were verified in code and local execution:
- **`ORG_OWNER`:** Help & Training visible immediately below Dashboard (Full admin nav).
- **`MANAGER`:** Help & Training visible immediately below Dashboard (Manager nav; Finance/Settings hidden).
- **`FRONT_DESK`:** Help & Training visible immediately below Dashboard (Front desk operational nav).
- **`TUTOR`:** Help & Training visible immediately below Dashboard (Tutor operational nav: Dashboard, Help & Training, Attendance, Kiosk).

---

## 10. Automated Tests

Added dedicated test suite:
`src/components/dashboard/__tests__/pm11-navigation-discoverability.test.tsx`
Proves all 10 required invariants:
1. Help & Training exists in authenticated staff navigation.
2. Link points to `/dashboard/help`.
3. Appears immediately after Dashboard in primary navigation ordering.
4. Available for `ORG_OWNER`.
5. Available for `MANAGER`.
6. Available for `FRONT_DESK`.
7. Available for `TUTOR`.
8. Existing primary mobile bottom-nav destinations are unchanged.
9. No duplicate Help & Training sidebar entry exists.
10. Active-route styling and `aria-current="page"` behavior remains valid.
11. Collapsed state provides `title` tooltip and centered icon.

---

## 11. Visual QA Evidence Summary

All 8 required review screenshots captured, verified with `view_file`, and mirrored:
- **`N1.png`:** Desktop 1440 light theme showing Dashboard + Help & Training near top
- **`N2.png`:** Desktop 1440 dark theme showing Dashboard + Help & Training near top
- **`N3.png`:** Desktop 1280 showing clean layout and no overflow
- **`N4.png`:** Mobile 390 full navigation drawer showing Help & Training near top
- **`N5.png`:** Mobile 375 full navigation drawer showing Help & Training near top
- **`N6.png`:** `/dashboard/help` showing active Help & Training sidebar state (`text-accent bg-accent-soft`)
- **`N7.png`:** Non-owner role navigation (Centre Manager) showing role-filtered modules with Help & Training
- **`N8.png`:** Profile dropdown showing secondary Help entry

**Storage Locations:**
- Primary: `/tmp/sprintscale-pm11-nav-review/`
- Mirror: `~/Downloads/sprintscale-pm11-nav-review/`

---

## 12. Frozen Asset & Corpus Verification

- Ran `scripts/help-ingest-assets.ts`: 130 / 130 checksums matched (100% verified, 0 failures).
- Help manual modifications: 0
- Training video modifications: 0
- Learning path modifications: 0
- D6 source asset modifications: 0
- Public training asset modifications: 0

---

## 13. Quality Gate Summary

- **TypeScript Typecheck (`tsc --noEmit`):** PASS (0 errors)
- **ESLint (`eslint`):** PASS (0 errors, 0 warnings)
- **Vitest Full Test Suite:** PASS (74 test files, 755 tests passed, 0 failures)
- **Production Build (`next build`):** PASS (153/153 routes generated)
- **Git Formatting / Conflicts (`git diff --check`):** PASS

---

## 14. Changed File Audit

- `src/components/dashboard/Sidebar.tsx` (Reposition Help & Training to primary navItems and ROLE_NAV)
- `src/components/dashboard/__tests__/pm11-navigation-discoverability.test.tsx` (New focused test suite)
- `project-notes/post-modernisation/pm11-help-navigation-discoverability.md` (This document)

**Scope Exclusions Verified:**
- Database changes: 0
- Migration files: 0
- Dependencies / package.json: 0
- Unrelated application code: 0

---

## 15. Final Classification

`PASS — PM-1.1 NAVIGATION DISCOVERABILITY CORRECTION COMPLETE`
