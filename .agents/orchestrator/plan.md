# Execution Plan - Dashboard Homepage Upgrade

This plan breaks down the dashboard homepage components upgrade into a structured, step-by-step process.

## Milestone 1: Decompose & Explore
- [ ] Spawn Explorer to analyze the target components:
  - `src/components/dashboard/DashboardHero.tsx`
  - `src/components/dashboard/KpiGrid.tsx`
  - `src/components/dashboard/StatCard.tsx`
  - `src/components/dashboard/TodaysSnapshot.tsx`
  - `src/components/dashboard/DashboardSkeletons.tsx`
- [ ] Explorer runs baseline linting, typescript checking, and testing (`npm run lint`, `npx tsc --noEmit`, `npm run test`).
- [ ] Explorer reports on current code structures and verifies component usage.

## Milestone 2: Upgrade Hero & KPI Cards
- [ ] Spawn Worker to make changes:
  - **DashboardHero**: Implement time-aware greeting (Good morning/afternoon/evening, {firstName}), update subtitle, show first name in sticky collapsed state.
  - **KpiGrid**: Refactor `KpiStat` interface to include explicit `glowClass`, remove `glowClasses` map, increase card dimensions to `min-h-[148px] p-5`, increase sparkline opacity (0.2 -> 0.4 on hover), wrap cards in `<Link>`, add pulsing dot next to "Pending Approval" if pendingRegistrations > 0, set footer subtext to `text-[11px]` with `pt-3`.
  - **StatCard**: Replace hardcoded light-mode classes with theme-aware/CSS-variable classes (e.g. `bg-primary/10`, `text-accent-violet`, `text-foreground`, etc.).

## Milestone 3: Upgrade Snapshot & Skeletons
- [ ] Spawn Worker to make changes:
  - **TodaysSnapshot**: Consolidate color classes to CSS variables, implement friendly empty state (Calendar icon + message) when snapshot total is 0, add "View Attendance →" link, add `title` attribute to attendance progress bar.
  - **DashboardSkeletons**: Replace broken MD3 containers with `bg-secondary`, `bg-muted/60`, `bg-card`, `border-border/20`, and use `skeleton-shimmer` from `globals.css` on animatable blocks.

## Milestone 4: Verification & Integrity
- [ ] Spawn Reviewer to review code changes and verify visual appeal.
- [ ] Spawn Challenger to execute tests and ensure no regressions.
- [ ] Spawn Forensic Auditor to verify integrity and compile a clean report.
- [ ] Send victory message to the parent Sentinel.
