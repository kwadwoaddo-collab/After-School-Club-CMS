## 2026-07-17T14:08:29Z
You are a Worker agent. Your task is to resolve issues identified by the Reviewer during the second round of verification for the Dashboard homepage upgrade.

Please apply the following changes to the specified files:

1. **`src/components/dashboard/StatCard.tsx` (Integrity Fix - Color Glows)**:
   - Replace the dummy/facade `glowClasses` object mapping (lines 20-25) which currently maps all colors to the identical `'border-border hover:shadow-md'`.
   - Update it to use distinct theme-aware color border and hover shadow styles:
     ```typescript
     const glowClasses = {
         violet: 'border-border hover:border-accent-violet/30 hover:shadow-md hover:shadow-accent-violet/10',
         cyan: 'border-border hover:border-accent-cyan/30 hover:shadow-md hover:shadow-accent-cyan/10',
         amber: 'border-border hover:border-accent-amber/30 hover:shadow-md hover:shadow-accent-amber/10',
         primary: 'border-border hover:border-primary/30 hover:shadow-md hover:shadow-primary/10',
     };
     ```

2. **`src/components/dashboard/DashboardHero.tsx` (Responsiveness Fix - Mobile Sticky Layout)**:
   - In lines 50-51, change:
     `isScrolled ? "flex-row items-center" : "flex-col md:flex-row md:items-center"`
     to:
     `isScrolled ? "flex-col md:flex-row md:items-center" : "flex-col md:flex-row md:items-center"`
     This ensures that when scrolled, the title and controls stack vertically on mobile screens instead of breaking the layout horizontally.

3. **`src/components/dashboard/KpiGrid.tsx` (Correctness Fix - Bookings Sparkline)**:
   - In the Bookings card stat definition (around lines 103-116), add the missing sparkline data property:
     `sparkline: growthStats,`
     This will render the watermark sparkline correctly.

4. **`src/components/dashboard/DashboardSkeletons.tsx` (Quality Fix - CLS Alignment)**:
   - For `KpiGridSkeleton` (lines 11, 18):
     - Change wrapper class `gap-6` to `gap-5`.
     - Change card class `p-6 rounded-xl` to `p-5 rounded-2xl`.
   - For `ModuleCardSkeleton` (line 61):
     - Change card class `p-6 rounded-2xl flex flex-col gap-6` to `p-8 rounded-3xl flex flex-col gap-8`.

Do NOT modify any other files (specifically, do not modify `DashboardFilter.tsx` or files outside the target component set).

Your working directory is `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_verification_fixes`. Once done, run typecheck, linting, and tests to verify everything passes, and write your handoff.md report inside this directory.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
