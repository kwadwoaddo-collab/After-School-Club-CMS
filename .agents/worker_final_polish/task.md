# Final Test Polish and Configuration Worker Task

- Objective: Fix the table locator strictness issue and ignore desktop-only adversarial tests on Mobile Chrome.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_final_polish`
- Tasks:
  1. Fix table locator strict mode violation:
     - In `tests/tier3.spec.ts` line 116, change `page.locator('table')` to `page.locator('table').first()`.
  2. Configure Playwright configs to ignore adversarial tests on mobile:
     - In the following Playwright config files:
       - `.agents/auditor_milestone_final/playwright.config.ts`
       - `playwright.config.ts`
       - `playwright.custom.config.ts`
       - `playwright.adversarial.config.ts`
     - Inside the `Mobile Chrome` project block under `projects:`, add the property:
       ```typescript
       testIgnore: /adversarial.*\.spec\.ts/,
       ```
       to prevent running the desktop-oriented visual/interaction tests on mobile Chrome.
  3. Rebuild (if needed) and run type checks, lints, and E2E Playwright tests to ensure 100% pass status on all browsers and devices:
     - Run `npx tsc --noEmit`
     - Run `npm run lint`
     - Run `npm run test`
     - Run `npx playwright test --config .agents/auditor_milestone_final/playwright.config.ts`
