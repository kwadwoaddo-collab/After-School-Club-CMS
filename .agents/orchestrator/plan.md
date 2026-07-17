# Execution Plan - After-School Club CMS UI & Typography Upgrade

This plan breaks down the global UI elements upgrade into a structured, step-by-step process.

## Phase 1: Investigation & Baseline Verification (Explorer Track)
- [ ] Spawn Explorer to run tests, list files, and analyze current implementation of font loading, sidebar, header, and global CSS overrides.
- [ ] Determine baseline for existing tests (lint, vitest, typescript).

## Phase 2: E2E Testing Track Setup
- [ ] Spawn E2E Testing subagent to audit existing tests and verify coverage of dashboard, students, finance, and settings features.
- [ ] Define the 4-tier E2E testing methodology in `TEST_INFRA.md`.
- [ ] Enhance E2E tests to meet minimum test case thresholds.
- [ ] Publish `TEST_READY.md`.

## Phase 3: Milestone Implementation (Implementation Track)
### Milestone 1: Typography System (R1)
- [ ] Upgrade Inter font loading in `src/app/layout.tsx` (add weights `[400, 500, 600, 700, 800]`, `display: 'swap'`).
- [ ] Configure `font-feature-settings: "cv01", "ss01", "liga" 1` globally.
- [ ] Audit and graduate letter-spacing on h1 (`-0.04em`), h2 (`-0.03em`), and h3 (`-0.02em`).
- [ ] Configure line heights for text size tiers.
- [ ] Verify using unit tests.

### Milestone 2: Sidebar Polish (R2)
- [ ] Add 2-3px left accent bar to active nav item.
- [ ] Add subtle gradient/inner shadow to org logo badge.
- [ ] Adjust nav item spacing (try `py-2.5` and `space-y-1`).
- [ ] Refine "Quick Links / Share Portals" label contrast and tracking (`tracking-[0.12em]`, opacity `80%`).
- [ ] Ensure collapsed mode icons are centered and have proper hover tooltips.
- [ ] Verify footer user name/role padding.

### Milestone 3: Header Polish (R3)
- [ ] Refine header border to use semi-transparent `border-border/60`.
- [ ] Style search input with Apple-quality styling (height, `rounded-2xl`, focus ring, background opacity).
- [ ] Update notification bell badge to use a pulse animation from globals.
- [ ] Refine user avatar button with `ring` hover treatment and correct initials typography.
- [ ] Refine user dropdown menu container styles and entry animation.
- [ ] Add theme toggle click feedback scale transition.

### Milestone 4: Global CSS Cleanup & Consistency (R4)
- [ ] Scope or remove aggressive `!important border-radius` overrides on `.card` and `button` to avoid breaking layouts.
- [ ] Remove dead Material Design 3 token variables from `@theme inline`.
- [ ] Ensure `:root` light and dark theme tokens are consistent.
- [ ] Verify light/dark mode render properly.

## Phase 4: Final Verification & Hardening (Phase 1 & 2 Integration)
- [ ] Verify all implementation changes against the Tier 1-4 tests in `TEST_READY.md`.
- [ ] Spawn Challenger to analyze source + tests for coverage gaps (Tier 5).
- [ ] Resolve any bugs found by Challenger.
- [ ] Run Forensic Auditor to confirm integrity.
- [ ] Send victory message to Sentinel.
