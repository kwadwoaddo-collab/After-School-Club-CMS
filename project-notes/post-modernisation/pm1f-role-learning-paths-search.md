# SprintScale CMS — Post-Modernisation Enhancement PM-1F
## Role Learning Paths, Help Search & Discovery

**Milestone:** PM-1F
**Date:** 2026-09-03
**Status:** **PASS — PM-1F COMPLETE — READY FOR INDEPENDENT VISUAL REVIEW**

---

## 1. Executive Summary

Milestone **PM-1F** delivers role-based learning paths, unified Help Centre search, and role-aware training recommendations for the SprintScale CMS post-modernisation Help & Training Centre.

Building upon the 34 written guides (PM-1B/PM-1D) and 52 certified micro-videos (PM-1E), PM-1F answers two fundamental operational questions for club staff:
1. **"What should I learn for my job?"** — Through 5 structured role learning paths mapping specific daily responsibilities and sequential curricula without implementing LMS bloat (no enrolment records, no completion quizzes, no certificates).
2. **"How do I find help for the task I am trying to do?"** — Through a real-time, client-safe, default-deny search engine scanning titles, descriptions, categories, keywords, and operational notes across guides, videos, and learning paths with distinct type badges.

---

## 2. Baseline Verification

- **Repository:** `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`
- **Branch:** `main`
- **Starting Local HEAD:** `fd83b35` (`fix(help): polish mobile video category rail`)
- **Remote `origin/main`:** `b67d5c3` (Programme Closure commit)
- **Certified Tag:** `cms-modernisation-v1.1.0 -> de8b4e2`
- **Working Tree:** Clean (0 uncommitted changes prior to PM-1F)

---

## 3. Persona Taxonomy & Role Architecture

| Persona Slug | Target Staff Audience | Authenticated Staff RBAC Mapping | Classification | Section Count | Key Focus |
|---|---|---|---|:---:|---|
| `organisation-owner` | Organisation Owners & Founders | `ORG_OWNER` | Staff Role Path | 5 | Governance, multi-centre configuration, batch invoicing, payment auditing, GDPR retention & permanent purge. |
| `centre-manager` | Centre Managers & Site Supervisors | `MANAGER` (also rec. for `ORG_OWNER`) | Staff Role Path | 5 | Intake triage, registration approval/decline, live roll call supervision, first aid body mapping, safeguarding notes. |
| `front-desk` | Front Desk & Reception Administrators | `FRONT_DESK` (rec. for `MANAGER`, `ORG_OWNER`) | Staff Role Path | 5 | Greeting desk, tablet kiosk sign-in, collector password verification, ad-hoc session bookings, offline cash/TFC voucher logging. |
| `tutor-club-leader` | Tutors, Coaches & Activity Leaders | `TUTOR` | Staff Role Path | 4 | Session delivery, live morning/afternoon register marking, allergy badge recognition, accident logging, homework notes. |
| `parent-portal` | Staff Reference for Parent Support | Recommended for `FRONT_DESK`, `MANAGER`, `ORG_OWNER` | **Staff Reference Only** | 4 | Self-service registration walkthrough, magic link login triage, parent booking interface, rate-limit warnings. **NOT a staff RBAC role.** |

### Role Safety & Non-Restriction Principle
- **Recommendation Only:** "Recommended for your role" is strictly navigational guidance and never a permission gate. All authenticated staff members retain unrestricted access to browse and view all learning paths, guides, and videos.
- **RBAC Immutability:** No changes were made to `@/lib/auth`, staff permissions, or RBAC tables. `CMS_STAFF_ROLES` remains `['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']`. The `PARENT` persona is explicitly marked `isStaffReferenceOnly: true`.

---

## 4. Product Truth & Compliance Invariants

1. **Safeguarding Distinction:** CMS role does not equal formal Designated Safeguarding Lead (DSL) appointment. Centre Manager access to safeguarding notes is permission-controlled. No claim is made that the CMS executes statutory local authority referrals.
2. **Finance Integrity:** Only verified payments reduce invoice balances; there is no unbacked family credit ledger. Invoice voiding is strictly Owner-only.
3. **Communication Accountability:** Broadcast delivery metrics reflect application dispatch accounting, not external webhook delivery receipts; dispatch operates in-process.
4. **Data Management:** V032 is a partial organisation JSON export, not automated full GDPR/SAR fulfilment.
5. **Session Scheduling:** V040 is single family session booking, not recurring-plan term management.
6. **External Integrations:** Stripe live card processing and Wonde MIS sync remain deferred stubs in fail-closed safety modes.

---

## 5. Technical Implementation Details

### A. Data Models (`src/lib/help/types.ts`)
- Added `LearningPathSectionItem` (unifying `guide` and `video` references with operational focus notes).
- Added `LearningPathSection` (grouping sequential operational topics).
- Added `HelpLearningPathMetadata` (manifest metadata with `audienceLabel`, `recommendedStaffRoles`, and `isStaffReferenceOnly`).
- Updated `HelpSearchResult` to include `learningPaths?: HelpLearningPathMetadata[]` and `totalCount?: number`.

### B. Canonical Manifest (`src/lib/help/help-learning-paths-manifest.ts`)
- Composes 40 approved guide references and 52 certified video references.
- 100% of referenced slugs resolve to certified entries in `HELP_GUIDES` and `HELP_VIDEOS`.
- 0 broken references, 0 arbitrary file paths.

### C. Client-Safe Search Engine (`src/lib/help/search-help.ts`)
- Separated search engine from server-side markdown loading (`fs`), eliminating Node.js bundle bleed into client components.
- In-memory indexing across guides, videos, and learning paths.
- Default-deny architecture: internal docs, credentials, and `project-notes/` are unsearchable.
- Re-exported via `src/lib/help/get-help-content.ts` for full backward compatibility.

### D. User Interface Components
- `HelpSearchBar.tsx`: Client component providing instant search dropdown, filter tabs (`All`, `Learning Paths`, `Guides`, `Videos`), result counters, type badges, and keyboard navigation.
- `LearningPathsListView.tsx`: Index view displaying prominent "Recommended for your role" card alongside responsive grid of all 5 learning paths with topic previews and item counts.
- `LearningPathDetailView.tsx`: Reader view with breadcrumbs, role guidance notice, numbered section blocks, distinct guide/video cards with operational focus callouts, and sequential previous/next path navigation.
- `HelpHubView.tsx`: Integrated Help search bar in header, recommended learning path banner, and 3-card Core Training Modules section (`Role Learning Paths`, `Training Video Library`, `Full Continuous User Manual`).

---

## 6. Verification & Quality Gates

| Gate | Command / Script | Result | Notes |
|---|---|:---:|---|
| **TypeScript** | `npm run typecheck` | **PASS** | 0 type errors across entire codebase |
| **ESLint** | `npm run lint` | **PASS** | 0 errors, 0 warnings |
| **Unit & Integration Tests** | `npm test -- --run` | **PASS (72/72 files, 719/719 tests)** | Included comprehensive `learning-paths-search.test.tsx` suite |
| **Next.js Production Build** | `npm run build` | **PASS** | 153/153 static and dynamic routes compiled cleanly |
| **D6 Checksums** | `npx tsx scripts/help-ingest-assets.ts` | **PASS (130/130 matched)** | 78 screenshots and 52 videos verified byte-identical |
| **Git Diff Whitespace** | `git diff --check` | **PASS** | Zero trailing whitespace or blank line issues |

---

## 7. Visual Review Matrix (PM1F-E1 through PM1F-E12)

All 12 visual review screenshots are saved in `/tmp/sprintscale-pm1f-visual-review/` and mirrored to `~/Downloads/`:

1. **PM1F-E1**: [`PM1F-E1-desktop-learning-paths-index.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E1-desktop-learning-paths-index.png) — Desktop 1440px Light Mode: Learning paths index showing recommended role card, search bar, and 5 learning path cards.
2. **PM1F-E2**: [`PM1F-E2-desktop-owner-path.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E2-desktop-owner-path.png) — Desktop 1440px Light Mode: Organisation Owner path detail with governance, staffing, finance, and rollover sections.
3. **PM1F-E3**: [`PM1F-E3-desktop-manager-path.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E3-desktop-manager-path.png) — Desktop 1440px Light Mode: Centre Manager path detail with intake, attendance, first aid, and safeguarding sections.
4. **PM1F-E4**: [`PM1F-E4-desktop-front-desk-path.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E4-desktop-front-desk-path.png) — Desktop 1440px Light Mode: Front Desk path detail with kiosk, intake, bookings, and payment reconciliation sections.
5. **PM1F-E5**: [`PM1F-E5-desktop-tutor-path.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E5-desktop-tutor-path.png) — Desktop 1440px Light Mode: Tutor path detail with roll call, allergy badges, accident logging, and homework notes sections.
6. **PM1F-E6**: [`PM1F-E6-desktop-parent-portal-path.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E6-desktop-parent-portal-path.png) — Desktop 1440px Light Mode: Parent Portal Staff Reference path detail with registration, booking, and rate-limit triage sections.
7. **PM1F-E7**: [`PM1F-E7-mobile-learning-paths-index.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E7-mobile-learning-paths-index.png) — Mobile 390px Light Mode: Learning paths overview on narrow mobile device.
8. **PM1F-E8**: [`PM1F-E8-mobile-path-detail.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E8-mobile-path-detail.png) — Mobile 390px Light Mode: Centre Manager path detail on narrow mobile device.
9. **PM1F-E9**: [`PM1F-E9-desktop-hub-search-results.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E9-desktop-hub-search-results.png) — Desktop 1440px Light Mode: Help Hub with search bar active, showing live dropdown matching "attendance" across guides and videos with distinct badges.
10. **PM1F-E10**: [`PM1F-E10-desktop-hub-with-recommendation.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E10-desktop-hub-with-recommendation.png) — Desktop 1440px Light Mode: Help Hub showing role-recommended path banner and updated 3-column Core Training Modules.
11. **PM1F-E11**: [`PM1F-E11-desktop-learning-paths-dark.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E11-desktop-learning-paths-dark.png) — Desktop 1440px Dark Mode: Learning paths overview rendered in dark theme.
12. **PM1F-E12**: [`PM1F-E12-unknown-path-404.png`](file:///tmp/sprintscale-pm1f-visual-review/PM1F-E12-unknown-path-404.png) — Desktop 1440px: Non-existent path slug triggering graceful 404 response.

---

## 8. Git Forensics & Commit Preparation

- **Modified Files:**
  - `src/lib/help/types.ts`
  - `src/lib/help/get-help-content.ts`
  - `src/app/dashboard/help/page.tsx`
  - `src/app/dashboard/help/_components/HelpHubView.tsx`
- **Created Files:**
  - `src/lib/help/help-learning-paths-manifest.ts`
  - `src/lib/help/search-help.ts`
  - `src/app/dashboard/help/_components/HelpSearchBar.tsx`
  - `src/app/dashboard/help/learning-paths/page.tsx`
  - `src/app/dashboard/help/learning-paths/_components/LearningPathsListView.tsx`
  - `src/app/dashboard/help/learning-paths/[slug]/page.tsx`
  - `src/app/dashboard/help/learning-paths/[slug]/_components/LearningPathDetailView.tsx`
  - `src/app/dashboard/help/__tests__/learning-paths-search.test.tsx`
  - `project-notes/post-modernisation/pm1f-role-learning-paths-search.md`
- **Candidate Commit Subject:** `feat(help): add role learning paths and search`
