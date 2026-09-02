# SprintScale CMS — Post-Modernisation Enhancement PM-1C
## In-App Help & Training Centre: Navigation, Shell & Hub View (Reconciled PM-1C.R1)

**Enhancement Track:** PM-1 — In-App Help & Training Centre  
**Milestone:** PM-1C & PM-1C.R1 — Navigation, Shell, Hub View & Visual / Compliance-Copy Reconciliation
**Certified Modernisation Baseline:** Release `cms-modernisation-v1.1.0` (`de8b4e2`) / Closure Commit `b67d5c3`  
**Date:** 2026-09-02  
**Status:** **PASS — PM-1C VISUALLY RECONCILED — READY FOR FINAL VISUAL CONFIRMATION**

---

## 1. Executive Summary

Milestone **PM-1C** (and reconciliation **PM-1C.R1**) delivers the user-facing foundation of the In-App Help & Training Centre.

Authenticated CMS staff can discover, navigate to, and explore the Help & Training Hub at `/dashboard/help`. The Hub integrates seamlessly with SprintScale's modernised dashboard design language, providing role-tailored recommendations, an overview of all 7 certified training categories, a curated selection of common operational tasks, and forthcoming feature teasers for the interactive reader (PM-1D) and video library player (PM-1E)—all without creating broken links or 404 destinations.

### Key Deliverables:
1. **Desktop Navigation (`src/components/dashboard/Sidebar.tsx`):** Added "Help & Training" utility link with `CircleHelp` icon in the desktop utility area above user profile.
2. **Header User Menu Navigation (`src/components/dashboard/Header.tsx`):** Added "Help & Training" menu item with `CircleHelp` icon inside the user profile dropdown.
3. **Mobile Access:** Inherited through the responsive mobile drawer in `Sidebar.tsx` (closes automatically upon navigation); `MobileBottomNav.tsx` remains focused on primary operational workflows without clutter.
4. **Protected Route (`/dashboard/help`):** Implemented via App Router Server Component (`src/app/dashboard/help/page.tsx`), inheriting full authentication and onboarding protections from `DashboardLayout`.
5. **Interactive Hub View (`src/app/dashboard/help/_components/HelpHubView.tsx`):**
   - Professional welcome header with manifest-derived counters: **34 Training Guides** and **52 Training Videos**.
   - Conservative operational hero copy: *"Browse role-specific onboarding paths, daily operational checklists, and step-by-step functional guides designed to support consistent safeguarding, attendance, finance and day-to-day centre operations."* (No unsupported compliance claims).
   - "Recommended for you" card grid tailored to authenticated staff roles (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`) using human-readable labels.
   - "Common tasks" quick-reference cards for frequent operational workflows (roll call, bookings, invoices, reconciliation, safeguarding).
   - 7 certified category cards with dynamic guide counts and expandable preview drawers (Option B: zero dead links).
   - Forthcoming teasers for Video Library and Continuous User Manual using customer-facing `"Coming Soon"` labels (zero internal milestone IDs).
6. **Automated Tests (`src/app/dashboard/help/__tests__/help-hub.test.tsx`):** 11 comprehensive tests verifying authentication boundaries, role safety, human-readable labels, navigation rendering, category integrity, and strict absence of internal PM milestone terminology or compliance claims.
7. **Quality Gates:** 100% Passing (TypeScript, ESLint, 660 Vitest unit tests across 69 test files, Next.js production build with 94 compiled routes).

---

## 2. Baseline & Immutability Verification

| Dimension | Measured State | Compliance Verdict |
|---|---|---|
| **Local `main` HEAD** | Amended PM-1C commit | PM-1C Hub Shell commit |
| **Local `HEAD^`** | `20a4e30` | PM-1B.R1 foundation commit |
| **Local `HEAD^^`** | `1fa9ed5` | PM-1A discovery commit |
| **Local `HEAD^^^`** | `b67d5c3` | Base programme closure commit |
| **`origin/main`** | `b67d5c3` | Parity maintained |
| **`origin/rebuild/cms-modernisation`** | `b67d5c3` | Parity maintained |
| **Release Tag Target** | `cms-modernisation-v1.1.0` -> `de8b4e2` | **IMMUTABLE / UNCHANGED** |
| **Working Tree** | Clean | 0 uncommitted changes |
| **Historical D6 Source Assets** | 130 / 130 SHA-256 verified | Preserved byte-identical |

---

## 3. Navigation Implementation

### 3.1 Desktop Sidebar Utility Area
- **File:** `src/components/dashboard/Sidebar.tsx`
- **Location:** Utility footer above user avatar and Share Portals.
- **Icon:** `CircleHelp` from `lucide-react`.
- **Active State:** Highlighted when `pathname.startsWith('/dashboard/help')`.
- **Collapsed State:** Displays floating tooltip `"Help & Training"` on hover.
- **Audience:** Visible to all authenticated staff roles (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`).
- **Parent Portal:** `PARENT` is not a staff role and does not receive staff dashboard navigation.

### 3.2 Header User Profile Menu
- **File:** `src/components/dashboard/Header.tsx`
- **Location:** User profile dropdown menu above "Sign Out".
- **Icon:** `CircleHelp` from `lucide-react`.
- **Interaction:** Closes menu upon click and transitions smoothly to `/dashboard/help`.

### 3.3 Mobile Access Strategy
- Rather than overcrowding `MobileBottomNav` (which remains dedicated to core operational tabs: Dashboard, Attendance, Bookings, Students/Parents/Registrations), mobile users access Help & Training via the mobile slide-out drawer triggered by the Header hamburger icon.
- Clicking the link in the mobile drawer automatically closes the drawer (`setCollapsed(true)`).

---

## 4. Help Route Architecture & Protection

- **Route:** `/dashboard/help`
- **Protection:**
  - `const session = await auth();` redirects unauthenticated requests to `/login`.
  - `if (!session.user.organisationId)` redirects incomplete accounts to `/onboarding`.
  - Inherits `DashboardLayout` layout shell and centre filtering contexts.
  - Public access: **Strictly Denied (Redirects with 307 to /login)**.
  - Parent Portal route: **None added in PM-1C** (remains strictly out of scope).

---

## 5. Hub View Architecture & Design

```
/dashboard/help
├── Header (Page title, subtitle, live counts: 34 Training Guides, 52 Training Videos)
├── Welcome Banner (Operational guidance, 7 operational domains)
├── Recommended For You (Staff-role tailored cards: top 4 guides)
├── Common Tasks (Frequent operational tasks: attendance, billing, intake)
├── Browse by Category (7 cards with guide counts & expandable preview drawers)
└── Upcoming Features ("Coming Soon" Video Library & Manual teasers)
```

### 5.1 Role-Aware Recommendations
- Recommendations are derived directly from `getGuidesByRole(userRole)`.
- Human-readable role labels:
  - `ORG_OWNER` -> `Organisation Owner`
  - `MANAGER` -> `Centre Manager`
  - `FRONT_DESK` -> `Front Desk`
  - `TUTOR` -> `Tutor / Club Leader`
- **Safety Invariant:** Manager is never described as DSL; Owner is never described as DPO.
- Recommendations highlight relevant guides while making clear that staff can browse all 34 guides across all categories (Recommendation != RBAC restriction).

### 5.2 Category Cards & Zero Dead Links (Option B)
- 7 Categories dynamically populated from `getAllCategories()` and `getGuidesByCategory(cat.id)`:
  1. Getting Started & Role Guides (9 guides)
  2. Core Operations (7 guides)
  3. Safeguarding & Incidents (1 guide)
  4. Finance, Billing & Payments (4 guides)
  5. Administration & System Setup (4 guides)
  6. Troubleshooting & Support (4 guides)
  7. Master User Manual (5 guides)
- **Zero Dead Links:** To prevent placeholder 404 links before PM-1D implements the markdown guide reader, each category card includes an expandable drawer revealing the included guides, reading times, and a note that the full reader is arriving soon.

---

## 6. PM-1C.R1 Visual & Compliance-Copy Reconciliation

### 6.1 Compliance Claim Removal
- **Previous Hero Copy:** *"All materials are certified for compliance with UK after-school club regulations, safeguarding standards, and financial reconciliation workflows."*
- **Reconciled Hero Copy:** *"Browse role-specific onboarding paths, daily operational checklists, and step-by-step functional guides designed to support consistent safeguarding, attendance, finance and day-to-day centre operations."*
- **Verdict:** Unsupported compliance guarantees completely eliminated in favor of conservative operational guidance.

### 6.2 Counter Badge Updates
- `"34 Approved Guides"` -> `"34 Training Guides"`
- `"52 Micro-Videos"` -> `"52 Training Videos"`

### 6.3 Internal Terminology Removal
- Replaced `"Milestone PM-1E"` badge with `"Coming Soon"`.
- Replaced `"Milestone PM-1D"` badge with `"Coming Soon"`.
- Replaced drawer text `"Interactive markdown reader available in Milestone PM-1D."` with `"Interactive guide reader coming soon."`
- Replaced video teaser text `"Integrated video player arriving in Milestone PM-1E"` with `"Integrated video player coming soon"`.
- Replaced manual teaser text `"Interactive chapter reader arriving in Milestone PM-1D"` with `"Interactive chapter reader coming soon"`.
- All user-facing copy strictly excludes internal project milestone IDs, D6 references, and audit/registry terms.

---

## 7. Verification & Quality Gates

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full type check across all new help modules |
| **ESLint** | `npm run lint` | **PASS (0 warnings/errors)** | Strict code style and no-any compliance |
| **Unit & Integration Tests** | `npm test -- --run` | **PASS (660/660 passed)** | 69 test files; 11 Help Hub tests |
| **Production Build** | `npm run build` | **PASS (22.0s)** | 94 static/dynamic routes compiled cleanly |
| **Asset Checksum Audit** | `scripts/help-ingest-assets.ts` | **PASS (130/130 matched)** | 0 failures, 0 modifications |
| **Visual Recheck** | Local Playwright Recheck | **PASS** | Captured 3 recheck screenshots without visual regressions |

---

## 8. Scope & Invariant Protection

- **Database Changes:** **0**
- **Dependency Changes:** **0**
- **Authentication Changes:** **0**
- **Parent Portal Changes:** **0**
- **D6 Source Modifications:** **0**
- **Production Changes:** **0**
- **Unrelated Changes:** **0**

---

## 9. Next Milestone Handoff (PM-1D)

With the navigation entry points, shell, hub view, and reconciled compliance copy certified:
- **Milestone PM-1D** will build the in-app Markdown Guide Reader (`/dashboard/help/guides/[slug]`), table of contents, reading progress, and rich media asset embed components.
