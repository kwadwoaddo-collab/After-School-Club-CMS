# SprintScale CMS — Post-Modernisation Enhancement PM-1E
## Training Video Library & Playback Experience

**Enhancement Track:** PM-1 — In-App Help & Training Centre  
**Milestone:** PM-1E — Training Video Library & Playback  
**Certified Modernisation Baseline:** Release `cms-modernisation-v1.1.0` (`de8b4e2`) / Closure Commit `b67d5c3`  
**PM-1D Baseline Commit:** `ce02490`  
**Date:** 2026-09-03  
**Status:** **PASS — PM-1E IMPLEMENTATION COMPLETE — READY FOR VISUAL REVIEW**

---

## 1. Executive Summary

Milestone **PM-1E** delivers the in-app Training Video Library and native video playback experience for SprintScale CMS using the existing certified D6 video corpus (52 unique micro-videos).

Authenticated staff can browse and filter training videos by category, search by operational topic or role relevance, launch dedicated playback pages with native controls, move seamlessly between video walkthroughs and related written guides, and return to the Help Centre hub with clear breadcrumbs. In-guide video references in PM-1D documentation have been converted into active in-app navigation actions leading directly to dedicated video playback pages with zero raw MP4 links exposed.

### Key Deliverables:
1. **Certified Video Manifest (`src/lib/help/help-videos-manifest.ts`):** Canonical metadata registry of all 52 certified videos with unique slugs, canonical titles, accurate learning objectives, category mappings, duration labels, and related guide linkages.
2. **Training Video Library (`/dashboard/help/videos`):** Interactive library with 6 category filter pills, fast search, responsive 3-column card grid, and role relevance badges without raw asset IDs or enum codes.
3. **Dedicated Playback Route (`/dashboard/help/videos/[slug]`):** Responsive 16:9 native HTML5 video player with `preload="metadata"` and no autoplay, related written guide cards, category-local previous/next navigation, and breadcrumb navigation.
4. **PM-1D Guide Reference Integration:** Converted 77 in-guide video references into interactive navigation links to `/dashboard/help/videos/[slug]` with descriptive titles and duration badges.
5. **Help Hub Integration:** Converted the Help Hub Video Library card into an active entry point linking to `/dashboard/help/videos`.
6. **Automated Test Suite (`src/app/dashboard/help/__tests__/video-library.test.tsx`):** 18 comprehensive tests covering manifest integrity, slug uniqueness, public path safety, checksum matching, default-deny 404, role formatting, guide reference resolution, and category-local navigation.
7. **Quality Gates:** 100% passing across TypeScript (0 errors), ESLint (0 warnings), Vitest (71 test files, 689/689 tests passing), and Next.js production build (147 static pages generated).

---

## 2. Baseline & Immutability Verification

| Dimension | Measured State | Compliance Verdict |
|---|---|---|
| **Local `main` Starting HEAD** | `ce02490` | PM-1D certified candidate commit |
| **`HEAD^`** | `c5ba2fb` | PM-1C.R1 shell commit |
| **`HEAD^^`** | `20a4e30` | PM-1B.R1 foundation commit |
| **`HEAD^^^`** | `1fa9ed5` | PM-1A discovery commit |
| **`HEAD^^^^`** | `b67d5c3` | Base programme closure commit |
| **`origin/main`** | `b67d5c3` | Parity maintained |
| **`origin/rebuild/cms-modernisation`** | `b67d5c3` | Parity maintained |
| **Release Tag Target** | `cms-modernisation-v1.1.0` -> `de8b4e2` | **IMMUTABLE / UNCHANGED** |
| **Working Tree** | Clean | 0 uncommitted changes |
| **Historical D6 Source Assets** | 130 / 130 SHA-256 verified | Preserved byte-identical |

---

## 3. Forensic Video Corpus Audit (52 Videos)

- **Total Certified Videos:** 52 unique files (`SS-D6-V001.mp4` to `SS-D6-V052.mp4`)
- **Total Asset Size:** 47,297,259 bytes (45.11 MB)
- **Largest Video:** `SS-D6-V037.mp4` (1.74 MB)
- **Source/Public Checksum Parity:** 52 / 52 matched (0 failures, 0 modifications)
- **Guide Reference Audit:**
  - Total in-guide video references: **77**
  - Unique certified videos referenced in written guides: **47 / 52**
  - Unmapped / non-certified video references: **0**
  - Unreferenced videos: **5** (`SS-D6-V019`, `SS-D6-V028`, `SS-D6-V029`, `SS-D6-V050`, `SS-D6-V052` — all have certified parent guide linkages)

### Category Distribution (52 Videos):
1. **Core Operations:** 19 videos (Attendance, Kiosk, Registrations, Bookings, Student profiles)
2. **Administration:** 15 videos (Venues, Bank details, Staff invites, Permissions, Recovery bin, Data export)
3. **Finance & Payments:** 10 videos (Agreed fees, Invoicing batch, Cash payments, Bank transfers, Voucher reconciliation)
4. **Getting Started:** 5 videos (Public multi-child registration, Portal tour, Staff invite acceptance, Portal booking)
5. **Safeguarding:** 2 videos (First aid body map accident logging, Confidential DSL safeguarding records)
6. **Troubleshooting:** 1 video (Parent Portal rate-limit 429 warning demonstration)

---

## 4. Metadata Architecture & Type-Safety

Video metadata is defined via `HelpVideoMetadata` in `src/lib/help/types.ts`:
```ts
export interface HelpVideoMetadata {
  id: string; // Certified asset ID, e.g. 'SS-D6-V001'
  slug: string; // URL-safe slug, e.g. 'registering-a-multi-child-family-via-public-portal'
  title: string; // Canonical D6 human-readable title
  description: string; // Accurate learning objective
  category: HelpCategory; // Standard HelpCategory
  videoUrl: string; // Public asset URL: '/training/assets/videos/SS-D6-Vxxx.mp4'
  durationSeconds: number; // Duration in seconds (e.g. 60, 45, 30)
  durationLabel: string; // e.g. '60s', '45s', '30s'
  targetGuideSlug: string; // Primary related guide slug
  recommendedStaffRoles: HelpStaffRole[]; // Staff roles for recommendation
  audienceLabel: string; // Target audience description
  relatedGuideSlugs: string[]; // Slugs of related written guides
  order: number; // Order within category
}
```

### Security & Access Control:
- Public URL format: strictly `/training/assets/videos/SS-D6-Vxxx.mp4`.
- Dynamic route `/dashboard/help/videos/[slug]`: queries `getVideoBySlug(slug)`. Unknown slugs immediately invoke `notFound()`.
- Dashboard authentication: unauthenticated requests redirect to `/login`.
- Completed onboarding: unconfigured accounts redirect to `/onboarding`.
- Zero raw filesystem paths, `file://` URLs, or repository directories exposed.

---

## 5. PM-1D In-Guide Video Reference Reconciliation

In PM-1D, video links were rendered as static badges: `[Title] — Available in Training Videos`.
In PM-1E, `src/lib/help/markdown-renderer.tsx` resolves video links against `getVideoById(id)`:
- Renders an interactive link to `/dashboard/help/videos/${video.slug}` with:
  - Video icon (`<Video className="size-3.5 ..." />`)
  - Title: `Watch: ${title}`
  - Duration badge: `(${video.durationLabel})`
- Zero raw MP4 URLs exposed as href attributes.
- Full backwards-compatible fallback to non-actionable badge if an unapproved reference ever occurred.

---

## 6. Video Delivery & Actual Playback QA Evidence

### HTTP Delivery:
- `HTTP/1.1 200 OK` for initial metadata and static requests.
- `Content-Type: video/mp4` correctly set by Next.js static asset server.
- `Accept-Ranges: bytes` supported.
- `HTTP/1.1 206 Partial Content` returned on range queries (e.g. `Range: bytes=0-1024`).

### Playback Sampling QA:
1. **Core Operations:** `SS-D6-V006` (*Marking Morning and Afternoon Class Register*)
   - Route: `/dashboard/help/videos/marking-morning-and-afternoon-class-register`
   - Result: Video loaded, playback initiated, `currentTime` advanced to 2.1s, 0 media errors.
2. **Finance:** `SS-D6-V014` (*Executing Monthly Invoicing Batch Run*)
   - Route: `/dashboard/help/videos/executing-monthly-invoicing-batch-run`
   - Result: Video loaded, playback initiated, `currentTime` advanced to 3.0s, 0 media errors.
3. **Administration:** `SS-D6-V020` (*Creating & Setting Up a New Centre Venue*)
   - Route: `/dashboard/help/videos/creating-and-setting-up-a-new-centre-venue`
   - Result: Video loaded, playback initiated, `currentTime` advanced to 9.0s, 0 media errors.
4. **Parent Portal:** `SS-D6-V005` (*Booking a Session via Parent Portal*)
   - Route: `/dashboard/help/videos/booking-a-session-via-parent-portal`
   - Result: Video loaded, playback initiated, played through completion (8.0s), 0 media errors.
5. **Mobile Playback:** Verified at 390px viewport; responsive player controls and layout intact.

---

## 7. Visual Review Capture Matrix (PM-1E)

Screenshots stored in review folder `/tmp/sprintscale-pm1e-visual-review/`:
- **E1:** [`E1-desktop-library-light.png`](file:///tmp/sprintscale-pm1e-visual-review/E1-desktop-library-light.png) — Desktop Training Video Library in light mode showing 52 video cards and category pills.
- **E2:** [`E2-desktop-library-dark.png`](file:///tmp/sprintscale-pm1e-visual-review/E2-desktop-library-dark.png) — Desktop Training Video Library in dark mode with design system contrast.
- **E3:** [`E3-mobile-library.png`](file:///tmp/sprintscale-pm1e-visual-review/E3-mobile-library.png) — Mobile Training Video Library at 390px viewport with stacked cards.
- **E4:** [`E4-desktop-video-light.png`](file:///tmp/sprintscale-pm1e-visual-review/E4-desktop-video-light.png) — Desktop individual video playback page in light mode.
- **E5:** [`E5-desktop-video-dark.png`](file:///tmp/sprintscale-pm1e-visual-review/E5-desktop-video-dark.png) — Desktop individual video playback page in dark mode.
- **E6:** [`E6-mobile-video.png`](file:///tmp/sprintscale-pm1e-visual-review/E6-mobile-video.png) — Mobile individual video playback page with responsive player.
- **E7:** [`E7-video-playback-active.png`](file:///tmp/sprintscale-pm1e-visual-review/E7-video-playback-active.png) — Active video playback in progress with actual certified video loaded and time elapsed.
- **E8:** [`E8-related-guides.png`](file:///tmp/sprintscale-pm1e-visual-review/E8-related-guides.png) — Related written guide cards section below the player.
- **E9:** [`E9-prev-next-nav.png`](file:///tmp/sprintscale-pm1e-visual-review/E9-prev-next-nav.png) — Category-local Previous/Next video navigation controls.
- **E10:** [`E10-guide-actionable-video-link.png`](file:///tmp/sprintscale-pm1e-visual-review/E10-guide-actionable-video-link.png) — PM-1D written guide showing the interactive in-app video walkthrough link.
- **E11:** [`E11-category-filter.png`](file:///tmp/sprintscale-pm1e-visual-review/E11-category-filter.png) — Category filter interaction showing filtered Finance & Payments videos.
- **E12:** [`E12-unknown-video-404.png`](file:///tmp/sprintscale-pm1e-visual-review/E12-unknown-video-404.png) — Safe 404 Not Found error page on unknown video slug.

---

## 8. Quality Gates & Test Results

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Verified across all video library routes and manifests |
| **ESLint** | `npm run lint` | **PASS (0 warnings/errors)** | Verified code formatting and strict rule adherence |
| **Unit & Integration Tests** | `npm test -- --run` | **PASS (689/689 passed)** | 71 test files; 18 new PM-1E video tests passing |
| **Production Build** | `npm run build` | **PASS** | 147 static pages compiled cleanly |
| **D6 Checksum Verification** | `scripts/help-ingest-assets.ts` | **PASS (130/130 matched)** | 78 screenshots and 52 videos verified byte-identical |

---

## 9. Scope Invariants Maintained

- **Database Changes:** **0**
- **Dependency Changes:** **0**
- **Auth Changes:** **0**
- **RBAC Changes:** **0**
- **Parent Portal Changes:** **0**
- **Search Implementation:** **0** (Deferred to PM-1F)
- **LMS Features (Quizzes, Scores, Progress):** **0**
- **Production Changes:** **0**
- **Historical D6 Modifications:** **0**

---

## 10. Known Limitations & PM-1F Handoff

- Video playback uses native HTML5 browser controls (`controls`, `preload="metadata"`).
- In-guide video references now link directly to dedicated `/dashboard/help/videos/[slug]` routes.
- Ready for Milestone **PM-1F** (Global Help Centre Search & Search Indexing).

---

## 11. Post-Modernisation Reconciliation PM-1E.R1

**Ticket:** PM-1E.R1 — Training Video Library Category Navigation Visual Reconciliation
**Date:** 2026-09-03
**Status:** **PASS — PM-1E.R1 COMPLETE — READY FOR INDEPENDENT VISUAL REVIEW**

### 1. Orchestrator Finding
During independent review of PM-1E visual review screenshots E1–E12, the orchestrator noted:
- At 1280px desktop, the rightmost category pill ("Troubleshooting (1)") was visually clipped against the content container edge.
- At 390px mobile, category pills extended offscreen with `scrollbar-none`, appearing accidentally clipped rather than intentionally navigable.

### 2. Root Cause Analysis
- In `src/app/dashboard/help/videos/_components/VideoLibraryView.tsx`, the tablist container used `flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none` unconditionally across all screen sizes.
- On desktop, the total width of the 8 category buttons (~880–920px) exceeded available container width in narrower desktop views (e.g. 1280px with 256px sidebar leaves ~900px), causing the rightmost item to truncate because `flex-wrap` was omitted.
- On mobile, `scrollbar-none` concealed the scroll affordance without active scroll management.

### 3. Reconciliation Strategy (Option C — Responsive Hybrid)
- **Desktop & Tablet (`sm:` and above)**: Applied `sm:overflow-x-visible sm:flex-wrap`. Categories wrap naturally onto subsequent rows as needed. Every category is immediately visible, clickable, and discoverable with zero horizontal scroll container.
- **Mobile (`< sm` / 390px / 375px)**: Maintained an intentional horizontal scrolling rail (`overflow-x-auto scroll-smooth pb-2 scrollbar-thin`) with `flex-shrink-0` on all pills to guarantee label integrity. Added `tablistRef` with automatic smooth scroll-into-view for active categories.
- **Strict Boundary**: Zero page-level horizontal overflow across all tested viewports (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`).

### 4. Browser QA & Viewport Measurements
- **1440px**: `scrollWidth <= clientWidth` (PASS: all 8 pills fit on 1 row cleanly)
- **1280px**: `scrollWidth <= clientWidth` (PASS: pills wrap cleanly onto 2 lines, Troubleshooting fully visible)
- **1024px**: `scrollWidth <= clientWidth` (PASS: pills wrap cleanly onto 2 lines, no overflow)
- **768px**: `scrollWidth <= clientWidth` (PASS: pills wrap cleanly onto 2 lines, no overflow)
- **390px**: `scrollWidth <= clientWidth` (PASS: page overflow = 0; internal rail scrolls smoothly; Troubleshooting reachable)
- **375px**: `scrollWidth <= clientWidth` (PASS: page overflow = 0; Troubleshooting reachable & fully visible in Dark Mode)

### 5. Category Filtering Integrity
- **All Videos**: 52
- **Getting Started**: 5
- **Core Operations**: 19
- **Safeguarding**: 2
- **Finance & Payments**: 10
- **Administration**: 15
- **Troubleshooting**: 1
- **Filtering & Search**: Verified intact across single and combined queries.

### 6. Visual Review Artifacts (PM-1E.R1)
Stored in `/tmp/sprintscale-pm1e-r1-visual-review/`:
- **R1-E1**: [`R1-E1.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E1.png) — Desktop 1440px Light Mode (all categories accessible in single row)
- **R1-E2**: [`R1-E2.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E2.png) — Desktop 1280px Dark Mode (clean wrap onto 2 lines, no clipping)
- **R1-E3**: [`R1-E3.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E3.png) — Tablet 768px Light Mode (clean wrap onto 2 lines, no page overflow)
- **R1-E4**: [`R1-E4.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E4.png) — Mobile 390px Light Mode initial state (smooth rail)
- **R1-E5**: [`R1-E5.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E5.png) — Mobile 390px scrolled to final category (Troubleshooting completely visible)
- **R1-E6**: [`R1-E6.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E6.png) — Mobile 390px Troubleshooting selected (1 video card rendered)
- **R1-E7**: [`R1-E7.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E7.png) — Mobile 375px Dark Mode final category reachable & active
- **R1-E8**: [`R1-E8.png`](file:///tmp/sprintscale-pm1e-r1-visual-review/R1-E8.png) — Desktop 1440px Finance & Payments selected (10 video cards rendered)
