## 2026-07-17T13:43:18Z
Implement the dashboard homepage audit and upgrade.
Your working directory is: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_implement_dashboard_upgrade
The workspace is: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS
Please load the domain skill: /Users/kwadwo/.gemini/config/plugins/modern-web-guidance-plugin/skills/modern-web-guidance/SKILL.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Specific requirements:
1. Review the Explorer's analysis and code proposals in:
   /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/teamwork_preview_explorer_explore_dashboard/analysis.md
2. Upgrade the following five files per the follow-up request in ORIGINAL_REQUEST.md and the Explorer's analysis:
   - src/components/dashboard/DashboardHero.tsx: Fix missing firstName rendering, add time-aware greeting (Good morning/afternoon/evening, {firstName}), update subtitle, show compact firstName in sticky scrolled state.
   - src/components/dashboard/KpiGrid.tsx: Add glowClass and href properties to KpiStat interface, map each stat explicitly, remove old glowClasses string lookup, wrap each card in a Link component, increase card heights and padding, increase sparkline hover and default opacity, add pt-3 and text-[11px] subtext styling, add a pulsing status dot if pendingRegistrations > 0.
   - src/components/dashboard/StatCard.tsx: Replaces hardcoded light-mode slate/purple/cyan/amber colors with responsive CSS-variable variables (e.g. text-foreground, text-muted-foreground, bg-primary/10, etc.) for full dark mode support.
   - src/components/dashboard/TodaysSnapshot.tsx: Replace emerald/indigo/amber classes with tertiary, primary, accent-amber tokens, add min-w-0 for cell protection, add a title hover attribute with raw attendance counts on the progress bar, add a "View Attendance →" Link in the header, and implement a friendly Calendar empty state if snapshot.total === 0.
   - src/components/dashboard/DashboardSkeletons.tsx: Replace obsolete MD3 tokens with bg-secondary, bg-muted/60, bg-card, border-border/20, etc., and swap out animate-pulse for the skeleton-shimmer class from globals.css.
3. Verify your changes by running the test suite:
   - Run `npm run test` (must pass 133 tests)
   - Run `npm run lint` (must pass with 0 errors)
   - Run `npx tsc --noEmit` (must compile with 0 TypeScript errors)
4. Document all your changes in `changes.md` and write a detailed handoff report in `handoff.md` in your working directory.
5. Send a message back to me (conversation ID: c0400f14-dd0d-4f8d-9fb7-448a7f8a5c10) when complete.
