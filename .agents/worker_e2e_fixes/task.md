# E2E Test Fixes and Visual Tuning Worker Task

- Objective: Fix Visual overrides, active centre dropdown mobile resize, E2E port numbers, strict mode locators, and Mobile Chrome viewport test failures.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_e2e_fixes`
- Tasks:
  1. Fix Aggressive CSS button shape override:
     - In `src/app/globals.css`, add a specific rule at the bottom of the file to guarantee that `.keep-shape` controls retain their correct 12px squircle shape:
       ```css
       body:not(.landing-page-active) .keep-shape {
         border-radius: 12px !important;
       }
       ```
  2. Fix Active Centre dropdown resize behavior:
     - Ensure that the window resize and scroll listeners in `src/components/dashboard/Sidebar.tsx` correctly dismiss the active centre dropdown.
  3. Fix E2E tests with hardcoded ports:
     - In `tests/dagenham-booking.spec.ts` and `tests/tier4.spec.ts`, replace the hardcoded `http://localhost:3005` URLs with relative paths (e.g. `/book/...`).
  4. Fix strict mode violation:
     - In `tests/tier4.spec.ts` Scenario 2 (line 70), add `.first()` to the locator for `text="Bright Star Academy"` to prevent strict mode errors when multiple elements match.
  5. Fix Mobile Chrome viewport failures in E2E tests:
     - Audit the E2E test files (including `tests/tier1.spec.ts`, `tests/tier2.spec.ts`, `tests/tier3.spec.ts`, `tests/tier4.spec.ts`).
     - For tests that interact with or assert on the sidebar navigation links, click the mobile hamburger menu button (e.g., `button[aria-label="Open menu"]`) first if the viewport is in mobile mode (i.e. if the hamburger button is visible).
     - Add a helper function or conditional blocks to handle the mobile drawer flow safely.
  6. Rebuild and verify:
     - Run `npm run build` to update the production build.
     - Run type checks (`npx tsc --noEmit`) and lints (`npm run lint`).
     - Run all unit tests (`npm run test`) and all Playwright E2E tests (`npx playwright test` or `npm run test:e2e`). Confirm 100% pass status.
