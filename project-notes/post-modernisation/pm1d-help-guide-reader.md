# SprintScale CMS — Post-Modernisation Enhancement PM-1D & PM-1D.R1
## In-App Help & Training Centre: Guide Reader, Markdown Rendering & Screenshot Integration

**Enhancement Track:** PM-1 — In-App Help & Training Centre  
**Milestone:** PM-1D & PM-1D.R1 — Guide Reader, Visual, Terminology & Navigation Reconciliation
**Certified Modernisation Baseline:** Release `cms-modernisation-v1.1.0` (`de8b4e2`) / Closure Commit `b67d5c3`  
**Date:** 2026-09-02  
**Status:** **PASS — PM-1D GUIDE READER VISUALLY RECONCILED — READY FOR FINAL REVIEW**

---

## 1. Executive Summary

Milestone **PM-1D** delivers the in-app interactive reading layer for SprintScale CMS training documentation. Reconciliation **PM-1D.R1** resolves 5 specific visual, terminology, and navigation findings identified during independent visual review of QA captures QA-D1 through QA-D7:

1. **Eliminated Duplicated Guide Heading:** Suppressed redundant document-level `# SprintScale CMS — ...` and initial subtitle lines at render-time (`stripDocumentPreamble`). Authoritative route header `<h1>` is the single visible primary guide title.
2. **Human-Readable Staff Role Labels:** Replaced internal enum strings (`TUTOR`, `MANAGER`, `FRONT_DESK`, `ORG_OWNER`) with canonical customer-facing labels (`Tutor / Club Leader`, `Centre Manager`, `Front Desk`, `Organisation Owner`) via shared `STAFF_ROLE_LABELS`.
3. **Mobile TOC Reconciliation:** Created `MobileTOC` client component that defaults to a collapsed state showing `In this guide (X sections)` with an accessible toggle button (`aria-expanded`), substantially reducing initial mobile scroll height while preserving the desktop sticky sidebar.
4. **Non-Actionable Video References:** Converted in-guide video links into styled informational badges (`— Available in Training Videos`) without raw `.mp4` URLs or active Watch CTAs, maintaining the clean milestone boundary for PM-1E.
5. **Category-Local Navigation Sequencing:** Refined Previous/Next guide navigation to operate within the current category, eliminating cross-category jumps (e.g. Attendance & Roll Call no longer jumps backward into Parent Portal; Master Manual continuous sequence remains coherent).

---

## 2. Baseline & Immutability Verification

| Dimension | Measured State | Compliance Verdict |
|---|---|---|
| **Local `main` HEAD** | `cbaeb80` (pre-amend) | Base PM-1D candidate |
| **Local `HEAD^`** | `c5ba2fb` | PM-1C.R1 reconciled shell commit |
| **Local `HEAD^^`** | `20a4e30` | PM-1B.R1 foundation commit |
| **Local `HEAD^^^`** | `1fa9ed5` | PM-1A discovery commit |
| **Local `HEAD^^^^`** | `b67d5c3` | Base programme closure commit |
| **`origin/main`** | `b67d5c3` | Parity maintained |
| **`origin/rebuild/cms-modernisation`** | `b67d5c3` | Parity maintained |
| **Release Tag Target** | `cms-modernisation-v1.1.0` -> `de8b4e2` | **IMMUTABLE / UNCHANGED** |
| **Working Tree** | Clean | 0 uncommitted changes |
| **Historical D6 Source Assets** | 130 / 130 SHA-256 verified | Preserved byte-identical |

---

## 3. Route Architecture & Authentication

- **Route:** `/dashboard/help/guides/[slug]`
- **Implementation:** App Router Server Component (`src/app/dashboard/help/guides/[slug]/page.tsx`).
- **Security & Authorization Boundaries:**
  1. `await auth()`: Validates NextAuth session; unauthenticated requests redirect to `/login`.
  2. `organisationId`: Requires completed onboarding; redirects unconfigured users to `/onboarding`.
  3. `getGuideBySlug(slug)`: Strictly queries the immutable `HELP_GUIDES` manifest. Unknown slugs or path traversal characters trigger `notFound()` immediately.
  4. Public access: **Strictly Denied**.
  5. Parent Portal route: **None added** (`PARENT` persona has no staff dashboard access).

---

## 4. Markdown Rendering Strategy & Preamble Suppression

- **Zero-Dependency Architecture:** Inspected `package.json`; avoided adding external libraries (`marked`, `react-markdown`, `remark`). Built `src/lib/help/markdown-renderer.tsx` using standard React server primitives.
- **Safety Invariant:** Never invokes `dangerouslySetInnerHTML`. Elements are constructed as pure React nodes (`<p>`, `<h2>`, `<figure>`, `<table>`, `<blockquote>`).
- **Preamble Suppression (`stripDocumentPreamble`):**
  - Audited all 34 guides: 34 / 34 start with `# SprintScale CMS — ...`.
  - Normalizes/suppresses the document title line, immediate non-numbered subtitle, and separating `---` rule.
  - Exactly 1 visible H1 on the page (the route header title).
  - Preserves all substantive section headings (H2/H3) and introductory text.
- **Video Link Handling:**
  - 28 guides contain 77 video references pointing to 47 unique MP4 files.
  - Rendered as styled informational badges: `[Title] — Available in Training Videos` with `data-video-target`.
  - Zero raw MP4 URLs, download anchors, or active Watch CTAs exposed in PM-1D.

---

## 5. Table of Contents & Navigation Logic

- **Deterministic TOC:** Generated via `extractTOC(content)` by identifying H2 and H3 markdown headings from cleaned content. Duplicate headings receive sequential suffixes (`-2`, `-3`).
- **Mobile TOC Component (`MobileTOC.tsx`):**
  - Collapsed by default: renders `In this guide ({items.length} sections)` with `Show sections` button.
  - Expandable on demand with accessible `aria-expanded` and focus rings.
- **Category-Local Prev/Next Navigation:** Derived via `getGuideNavigation(slug)` from category-local guide sequence:
  - First guide in category: `prev: null`
  - Last guide in category: `next: null`
  - Prevents erratic category jumps (e.g. Attendance & Roll Call does not link back to Parent Portal).
  - Master Manual: 5 continuous parts remain sequenced 1 → 2 → 3 → 4 → 5.

---

## 6. Screenshot & Media Asset Integration

- **Asset Source:** Strictly resolved against public certified screenshot copies:
  `/training/assets/screenshots/annotated/SS-D6-Sxxx.png`.
- **Integrity:** 103 screenshot references across the 34 guides were verified; 103 / 103 exist with 0 missing.
- **Alt Text:** Descriptive functional alt text used throughout; zero raw IDs (`SS-D6-Sxxx`) exposed as visible alt text or captions.

---

## 7. Verification & Quality Gates

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full type check across all guide reader modules |
| **ESLint** | `npm run lint` | **PASS (0 warnings/errors)** | Strict code style and no-any compliance |
| **Unit & Integration Tests** | `npm test -- --run` | **PASS (673/673 passed)** | 70 test files; 24 tests in help test suite |
| **Production Build** | `npm run build` | **PASS (33.7s)** | 95 static/dynamic routes compiled cleanly |
| **Asset Checksum Audit** | `scripts/help-ingest-assets.ts` | **PASS (130/130 matched)** | 0 failures, 0 modifications |
| **Visual QA Review** | Local Playwright QA | **PASS** | Captured R1-D1 to R1-D6 screenshots without issues |

---

## 8. Visual Reconciliation Capture Matrix (PM-1D.R1)

Screenshots saved to review directory `/tmp/sprintscale-pm1d-r1-visual-review/`:
- **R1-D1:** [`R1-D1-desktop-top.png`](file:///tmp/sprintscale-pm1d-r1-visual-review/R1-D1-desktop-top.png) — Desktop guide page top (single H1, human-readable roles, clean article start).
- **R1-D2:** [`R1-D2-mobile-top.png`](file:///tmp/sprintscale-pm1d-r1-visual-review/R1-D2-mobile-top.png) — Mobile guide top (collapsed mobile TOC: `In this guide (16 sections)`).
- **R1-D3:** [`R1-D3-mobile-toc-expanded.png`](file:///tmp/sprintscale-pm1d-r1-visual-review/R1-D3-mobile-toc-expanded.png) — Mobile TOC expanded on user toggle with accessible links.
- **R1-D4:** [`R1-D4-video-reference.png`](file:///tmp/sprintscale-pm1d-r1-visual-review/R1-D4-video-reference.png) — Non-actionable video reference badge (`— Available in Training Videos`).
- **R1-D5:** [`R1-D5-desktop-bottom.png`](file:///tmp/sprintscale-pm1d-r1-visual-review/R1-D5-desktop-bottom.png) — Desktop bottom (category-local navigation: Attendance has NO previous guide; next is Bookings & Scheduling).
- **R1-D6:** [`R1-D6-desktop-dark.png`](file:///tmp/sprintscale-pm1d-r1-visual-review/R1-D6-desktop-dark.png) — Desktop dark mode top (clean contrast and dark theme styling).

---

## 9. Scope Invariants Maintained

- **Database Changes:** **0**
- **Dependency Changes:** **0**
- **Auth Changes:** **0**
- **RBAC Changes:** **0**
- **Parent Portal Changes:** **0**
- **Search Implementation:** **0** (Deferred to PM-1F)
- **Video Player Implementation:** **0** (Deferred to PM-1E)
- **LMS Features:** **0**
- **Production Changes:** **0**
- **Unrelated Product Changes:** **0**
