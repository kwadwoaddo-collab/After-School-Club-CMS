## 2026-07-17T00:08:59Z
You are worker_css_cleanup, a teamwork worker agent. Your working directory is: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_css_cleanup
The codebase is in: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS

Your task is to implement the Global CSS Cleanup & Consistency (R4) upgrades:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Edit `src/app/globals.css` to:
   - Remove the dead Material Design 3 token variables inside `@theme inline` (lines 28 to 78) that are never used in any codebase file.
   - Refactor the aggressive `.card` overrides (`border-radius: 24px !important`): remove the broad wildcard matches `[class*="card"]` and `[class*="bg-surface-container"]` which override internal layout components, and target only `.card`, `.glassmorphic-card`, and other card surfaces explicitly. Exclude components with `.keep-shape`.
   - Refactor the aggressive button overrides (`border-radius: 9999px !important`): ensure it doesn't break table layouts, pagination, dropdown menus, calendar pickers, select fields, or icon buttons. Refine the query or add exceptions to prevent overrides on smaller control elements.
   - Ensure light/dark mode `:root` tokens are consistent. Specifically, add a `.light` class block or `:root.light` selector that defines the light mode custom property HSL variables so that when class `light` is applied to `html`, it properly overrides any prefers-color-scheme media queries.
3. Run verification checks:
   - Run vitest tests: `npm run test`
   - Run linting: `npm run lint`
   - Run TypeScript checks: `npx tsc --noEmit`
   Verify everything compiles and passes with 0 warnings or errors.
4. Save your findings in a handoff report at `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_css_cleanup/handoff.md`.
5. Send a completion message to the parent orchestrator (Conv ID: 3bc813a1-29bb-4002-8aa6-7a968f36c9b7).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
