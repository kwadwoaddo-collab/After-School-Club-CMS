# SPRINTSCALE CMS — PM-1G
## RESPONSIVE, ACCESSIBILITY & FINAL HELP CENTRE VISUAL QA

**Date:** 3 September 2026  
**Status:** COMPLETED — READY FOR PM-1H  
**Milestone Type:** Post-Modernisation Help Centre Visual, Responsive, Accessibility & Semantic QA  
**Target Commit Subject:** `fix(help): complete final training centre QA`  

---

## 1. Milestone Objective and Governance Posture

PM-1G is the final QA milestone before PM-1H production verification. It does not introduce new features, database schema changes, or authentication shifts. Its strict objective is:
> *Can an authenticated SprintScale staff member discover, navigate, read, watch and use the Help & Training Centre comfortably and accurately on desktop, tablet and mobile, with no misleading semantics, inaccessible interactions, broken visual states or obvious polish defects?*

### Governance Posture
- Historical CMS Modernisation Programme remains **CLOSED**.
- Release tag `cms-modernisation-v1.1.0 -> de8b4e2` is unmodified.
- Baseline commit: `fe2c866` (`fix(help): reconcile learning path recommendations`).
- Remote tracking branches `origin/main` (`b67d5c3`) and `origin/rebuild/cms-modernisation` (`b67d5c3`) remain untouched. **NO PUSH** is performed.
- Production database host was **NEVER contacted**.

---

## 2. Pre-QA Committed Baseline Verification

Prior to any changes, the baseline was confirmed:
- Git Working Tree: Clean
- Branch: `main`
- HEAD commit: `fe2c866`
- Log: `fe2c866 fix(help): reconcile learning path recommendations`
- Full test suite at baseline: 72 test files, 727 tests passed.
- D6 assets at baseline: 130/130 assets verified with zero checksum failures.

---

## 3. Training Environment Verification and Safety Confirmation

The database host configuration was verified via sanitised environment inspection without leaking credentials:
- **Active DB Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Approved UK AWS Neon Training Host)
- **Production Host Checked:** `ep-super-dawn-abuicpc2`
- **Production Host Contacted:** **NO**
- **Safety Flags:** `ALLOW_TRAINING_SEED=true`, `TRAINING_ENVIRONMENT=oakridge`

---

## 4. Responsive Inspection Matrix Across All Viewports

The in-app Help Centre was rigorously tested and verified across multiple screen widths:
- **Desktop Large (1440px):** Full multi-column grid, sticky sidebar, table of contents rail, expanded video player, search overlay.
- **Desktop Small (1280px):** Proportional layout preserved, no horizontal overflow.
- **Tablet (768px):** Clean two-column fallback, responsive tables horizontally scrollable with visible clipping indicators.
- **Mobile Standard (390px - iPhone 12/13/14/15/16):** Single column stacked layout, horizontal category rails, collapsible table of contents, floating bottom navigation clearance.
- **Mobile Compact (375px - iPhone SE):** Tightened padding, no clipped cards, full touch target accessibility (>= 44x44px).

---

## 5. Desktop 1440 Help Hub Verification (Evidence: G1, G2)

- **Header:** Single H1 heading `Help & Training` with supporting subtitle.
- **Summary Badges:** Three pill badges displaying exact counts:
  - `34 Training Guides`
  - `52 Training Videos`
  - `5 Learning Paths`
- **Search Input:** Full-width combobox with search icon and clear query action.
- **Welcome Banner:** "Welcome to the SprintScale Training Centre" with domain capability highlights ("Standardised", "7 Domains").
- **Role-Tailored Recommendation Section:** Displays "Recommended for you (Organisation Owner)" card linking directly to the primary learning path (`/dashboard/help/learning-paths/organisation-owner`).
- **Curated Guides Grid:** 4 role-specific quick-start guides with reading time and direct links.
- **Theme Modes:** Light mode (G1) and Dark mode (G2) verified with flawless contrast, clear borders, and zero theme leakage.

---

## 6. Mobile 390 / 375 Help Hub Verification (Evidence: G3)

- Clean vertical stack avoiding horizontal scrollbar on body.
- Top badges wrap gracefully into multi-line pill container.
- Search input occupies 100% available viewport width.
- Category cards and learning path banners adjust margins for single-hand mobile usage.
- Bottom clearance prevents MobileBottomNav from obscuring any interactive element.

---

## 7. Desktop Guide Reader & Sticky TOC Verification (Evidence: G4, G7)

- Verified at `/dashboard/help/guides/attendance-roll-call`.
- **Breadcrumbs:** `Help & Training > Guides > Functional Manual: Attendance & Roll Call`.
- **Article Structure:** Replaced nested `<main>` with semantic `<article>`, preserving a single top-level `<main id="main-content">` inside DashboardLayout.
- **Sticky Table of Contents:** Right-hand sticky sidebar with active section tracking, smooth anchor scrolling, and readable section hierarchy.
- **Prose Typography:** Max-w-3xl readability container, comfortable line heights, high-contrast code snippets and callout alert boxes.

---

## 8. Mobile Guide Reader & Collapsibility Verification (Evidence: G5, G6)

- On mobile (390px), the sticky desktop sidebar is replaced with a collapsible mobile Table of Contents drawer/accordion.
- **Collapsed State (G5):** Shows concise "Table of Contents (N sections)" button.
- **Expanded State (G6):** Tapping expands a full list of jump-links with clear tap targets; tapping any link smoothly scrolls to the target anchor and closes or focuses the section.

---

## 9. Guide Image Rendering, Responsive Tables & Prose Verification (Evidence: G7)

- High-density screenshots rendered using Next.js Image with verified public D6 assets (`/help-assets/screenshots/...`).
- Screenshots include descriptive captions, subtle rounded borders, and responsive scaling.
- Markdown tables (such as the Attendance Codes and Status Matrix) render with horizontal scrolling wrappers (`overflow-x-auto`) to prevent table blowout on narrow viewports.

---

## 10. Desktop Video Library Verification (Evidence: G8, G9)

- Verified at `/dashboard/help/videos`.
- **Header:** Single H1 `Training Videos` with subtitle explaining click-by-click micro-walkthroughs.
- **Badge:** `52 Training Videos` badge.
- **Category Filter Tabs:**
  - All Videos (52)
  - Getting Started (5)
  - Core Operations (19)
  - Safeguarding (2)
  - Finance & Payments (10)
  - Administration (15)
  - Troubleshooting (1)
- **Grid:** 3-column responsive card layout with preview thumbnails, circular play overlay, duration badges, and role audience labels.
- Verified in both Light mode (G8) and Dark mode (G9).

---

## 11. Mobile Video Library & Category Rail Verification (Evidence: G10, G11)

- On mobile (390px), category tabs render as a smooth horizontally scrollable rail with snap support.
- **Rail Start (G10):** Displays "All Videos (52)" and "Getting Started (5)".
- **Rail End (G11):** Scrolling horizontally reveals "Troubleshooting (1)". Selecting Troubleshooting updates the active filter and displays the troubleshooting video card immediately.

---

## 12. Desktop & Mobile Video Player Verification (Evidence: G12, G13)

- Verified at `/dashboard/help/videos/marking-morning-and-afternoon-class-register`.
- **Player Attributes:** Native HTML5 `<video controls playsInline preload="metadata">` without autoplay, ensuring user-controlled playback and compliance with bandwidth/accessibility standards.
- **Desktop Active Playback (G12):** Video plays back smoothly with timecode display, volume/scrubber controls, and crisp 1080p screencast rendering.
- **Mobile Active Playback (G13):** Native player scales within the mobile container without horizontal page expansion.
- **Related Guides:** Linked guides below the player provide immediate context.
- **Verified Wording:** Tagged with "Verified Training Asset" badge.

---

## 13. Role Learning Paths Overview Verification (Evidence: G14, G15)

- Verified at `/dashboard/help/learning-paths`.
- **Header:** Single H1 `Role Learning Paths`.
- **Primary Recommendation Card:** Visually prominent callout for the authenticated staff user's role.
- **Curated Paths Grid:**
  1. Organisation Owner (`/dashboard/help/learning-paths/organisation-owner`)
  2. Centre Manager (`/dashboard/help/learning-paths/centre-manager`)
  3. Front Desk (`/dashboard/help/learning-paths/front-desk`)
  4. Tutor / Club Leader (`/dashboard/help/learning-paths/tutor-club-leader`)
  5. Parent Portal Staff Reference (`/dashboard/help/learning-paths/parent-portal`)
- Verified on Desktop (G14) and Mobile (G15).

---

## 14. Role Learning Path Detail Verification (Evidence: G16)

- Verified at `/dashboard/help/learning-paths/organisation-owner` when logged in as `ORG_OWNER`.
- **Role Invariant:** Displays `Recommended for your role (Organisation Owner)` badge.
- **Breadcrumbs:** `Help & Training > Learning Paths > Organisation Owner: Governance, Finance & Multi-Centre Control`.
- **Role Guidance Notice:** Clarifies that the sequence is designed for Organisation Owners, while noting that authorised staff have full access across all departments.
- **Sequential Curriculum:** Ordered sections with guide cards and video cards displaying estimated durations.

---

## 15. Cross-Functional Path Viewing Semantics Verification (Evidence: G17)

- Verified at `/dashboard/help/learning-paths/centre-manager` when logged in as `ORG_OWNER`.
- **Semantic Correction:** Instead of erroneously displaying "Recommended for your role", it explicitly displays:
  `Audience: Centre Managers & Site Supervisors`
- Confirms that non-primary paths accurately display their intended operational audience rather than misrepresenting staff recommendations.

---

## 16. Parent Portal Staff Reference Path Verification (Evidence: G18)

- Verified at `/dashboard/help/learning-paths/parent-portal`.
- **Distinction Enforced:** Parent Portal is **NOT** a staff RBAC role.
- **Badge:** Displays `Staff Reference for Parent Support`.
- **Role Guidance Notice:** Clearly states that this path is designed as a staff reference for assisting families with self-service parent portal tasks (registration, session bookings, magic-link authentication).

---

## 17. Help Search Bar Responsive, Accessibility & Combobox Verification (Evidence: G19, G20)

- **ARIA Attributes Added:**
  - `role="combobox"` on `<input>`
  - `aria-expanded={isOpen}`
  - `aria-haspopup="listbox"`
  - `aria-controls="help-search-dropdown"`
  - `id="help-search-dropdown"` and `role="listbox"` on results container
- **Keyboard Interactions:**
  - Pressing `Escape` key immediately closes the results dropdown.
  - Clicking the clear `x` button resets the search query and restores document focus back to the search input.
- **Filtering & Categories:** Results dropdown partitions results into All, Learning Paths, Guides, and Videos with match counts.
- Verified on Desktop (G19) and Mobile (G20).

---

## 18. Unknown Slug Handling and Safe 404 Verification (Evidence: G21)

- Verified with arbitrary unknown slugs:
  - `/dashboard/help/guides/unknown-guide-test-slug` -> Safe 404 Page Not Found
  - `/dashboard/help/videos/unknown-video-test-slug` -> Safe 404 Page Not Found
  - `/dashboard/help/learning-paths/unknown-path-test-slug` -> Safe 404 Page Not Found
- Server-side helpers (`getGuideBySlug`, `getVideoBySlug`, `getLearningPathBySlug`) return `null` safely without unhandled exceptions or 500 errors.
- Client gracefully displays standard Next.js `notFound()` UI with "Back to Dashboard" navigation.

---

## 19. Accessibility Audit Findings and Fixes

1. **Heading Structure:**
   - Enforced single H1 invariant on every Help Centre route (`HelpHubView`, `VideoLibraryView`, `VideoPlayerView`, `LearningPathsListView`, `LearningPathDetailView`, Guide Reader).
   - Strict H1 -> H2 -> H3 hierarchy maintained throughout.
2. **HTML Semantics:**
   - Replaced nested `<main>` element in Guide Reader (`src/app/dashboard/help/guides/[slug]/page.tsx`) with semantic `<article>`, eliminating HTML validator violation of multiple `<main>` landmarks.
3. **Search Combobox Semantics:**
   - Added combobox / listbox ARIA relationships, `aria-expanded`, and keyboard escape handling to `HelpSearchBar.tsx`.
4. **Touch Targets:**
   - All interactive buttons and links across mobile rails, TOC toggles, and navigation cards have minimum touch targets of 44x44px.
5. **Video Element Accessibility:**
   - Standard HTML5 controls provided, no autoplay, playsinline enabled.

---

## 20. Wording, Compliance and Semantic Audit Findings and Fixes

All marketing overclaims and regulatory compliance buzzwords were audited and eliminated:
- Removed "certified training guides" -> replaced with neutral "training guides".
- Removed "certified screencasts" -> replaced with "video walkthroughs".
- Removed "52 Certified Screencasts" -> replaced with "52 Training Videos".
- Removed "Certified Training Asset" -> replaced with "Verified Training Asset".
- Preserved strict role boundary distinctions:
  - Staff RBAC roles remain: `ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`.
  - Parent Portal remains exclusively a staff reference guide, never a staff role.
  - No claims of UK regulatory, safeguarding, Ofsted, or statutory certification.

---

## 21. D6 Source and Public Asset Integrity Verification

Ran `scripts/help-ingest-assets.ts`:
- **Total Source Assets:** 130 (78 screenshots, 52 videos)
- **Total Public Assets:** 130 verified
- **Checksum Matches:** 130 / 130 (100%)
- **Checksum Failures:** 0
- **Public Assets Location:** `/public/help-assets/screenshots/` and `/public/help-assets/videos/`
- **Frozen D6 Source Assets Location:** `/docs/D6-reference/`

---

## 22. Automated Test Suite Expansion and Results

Added dedicated PM-1G test suite:
`src/app/dashboard/help/__tests__/pm1g-final-qa.test.tsx` (17 tests) covering:
1. Heading Hierarchy & Single H1 Invariant across all 5 Help views.
2. User-Facing Terminology & Compliance Overclaim Exclusions.
3. HelpSearchBar Accessibility, ARIA Combobox, and Escape/Clear Interactions.
4. Semantic Invariant & Canonical Primary Role Mapping (including Parent Portal reference isolation).
5. Unknown Slug Safety returning null cleanly.

**Full Test Suite Execution:**
- **Test Files:** 73 passed (73 total)
- **Total Tests:** 744 passed (744 total, 100% pass)
- **Skipped / Failed:** 0

---

## 23. Full Quality Gate Results

| Quality Gate | Command | Result |
| :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors) |
| **Lint** | `npm run lint` (`eslint`) | **PASS** (0 errors, 0 warnings) |
| **Vitest** | `npm test -- --run` | **PASS** (73 files, 744 tests) |
| **Production Build** | `npm run build` (`next build`) | **PASS** (153/153 routes static/dynamic) |
| **D6 Ingestion** | `npx tsx scripts/help-ingest-assets.ts` | **PASS** (130/130 verified, 0 failures) |

---

## 24. PM-1H Production Verification Readiness Declaration

All visual, responsive, accessibility, interaction, and semantic standards established for the in-app Help & Training Centre have been fully verified and certified.

The Help Centre is stable, beautiful, responsive, and semantically truthful. **PM-1G is COMPLETED.** The codebase is ready for PM-1H production verification.
