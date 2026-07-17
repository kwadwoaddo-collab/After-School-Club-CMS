## 2026-07-17T00:57:51Z
You are worker_adversarial_fix, a teamwork worker agent. Your working directory is: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_adversarial_fix
The codebase is in: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS

Your task is to implement the fixes for the visual and behavioral gaps identified during Tier 5 Challenger audits:
1. Initialize your BRIEFING.md and progress.md in your working directory.
2. Edit `src/components/dashboard/Sidebar.tsx` to:
   - Add a window resize listener, sidebar scroll listener, and React `useEffect` listening to `collapsed` that closes the active centre dropdown safely by setting `dropdownOpen` to `false`.
   - Add the `.keep-shape` class to the active centre dropdown buttons (both expanded and collapsed buttons) to preserve their squircle design.
3. Edit `src/components/dashboard/Header.tsx` to:
   - Add the `.keep-shape` class to the user profile menu button, notifications bell button, and theme toggle button to prevent the global CSS button overrides from turning them into pills.
4. Edit `src/app/layout.tsx` to:
   - Inject an inline blocking `<script>` element inside the `<head>` tag of the HTML output that synchronously determines and applies the correct theme class (`dark` or `light`) to `document.documentElement` before rendering, eliminating theme hydration style flash.
5. Edit `tests/adversarial.spec.ts` and `tests/adversarial2.spec.ts` to:
   - Refactor the button shape tests to assert that the buttons do NOT have `9999px` border-radius (e.g. they should have custom radii, not full pills).
   - Refactor the active centre dropdown misalignment test to assert that the dropdown is closed (hidden) after resizing the viewport or toggling collapsed state.
6. Verify all test suites compile and pass successfully:
   - Run vitest tests: `npm run test`
   - Run E2E tests: `npm run test:e2e` (with dev server or start server running)
   - Run type checks: `npx tsc --noEmit`
   - Run ESLint checks: `npm run lint`
7. Save your findings in a handoff report at `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_adversarial_fix/handoff.md`.
8. Send a completion message to the parent orchestrator (Conv ID: 3bc813a1-29bb-4002-8aa6-7a968f36c9b7).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
