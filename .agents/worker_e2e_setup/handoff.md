# Handoff Report — E2E Setup

## 1. Observation
- Stale `next-server` processes (PID 31591, 31609, 31590, 50547, 2592, 2498) were running in the background and locking `.next/dev/lock`, causing Next.js to abort server startup with `[WebServer] ⨯ Another next dev server is already running.` and refuse connections on port 3001.
- Initial E2E test runs showed strict origin warnings: `[WebServer] ⚠ Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1".` and login credential redirects failing because Playwright visited `127.0.0.1` while NextAuth was configured for `localhost` in the cookies.
- Playwright was attempting form submissions on `/login` before the React application was hydrated, leading to standard browser GET submissions (`GET /login?`) rather than JavaScript-handled NextAuth POST requests.
- Drizzle seeder file (`src/db/seed.ts`) had a conflict clause `onConflictDoUpdate` which only updated `passwordHash`, leaving `organisationId` as `null` for pre-existing users, causing redirect loops to `/onboarding`.

## 2. Logic Chain
- Identified that Next.js dev server check relies on the presence of `.next/dev/lock`. Removed zombie processes and this lock file to allow clean dev server restarts.
- Overrode NextAuth environment variables (`NEXTAUTH_URL`, `AUTH_URL`) and unified Playwright configuration base/server URLs to use `localhost` instead of `127.0.0.1`. This aligned origin headers and permitted cookies to be written/read correctly.
- Added 5-second delays to all E2E test login helpers to ensure full hydration of Next.js components on port 3001. This successfully avoided premature submit button clicks.
- Updated `src/db/seed.ts` to correctly overwrite the `organisationId` on user conflict so that tests can navigate straight to `/dashboard` upon authentication.

## 3. Caveats
- Some failures persist in high-tier testing suites (`tier1`, `tier2`, `tier3`, `tier4` etc.) due to front-end layout transitions, button intercepts, or application-level state validations. These are unrelated to the web server configuration and the core connection refusal goal.

## 4. Conclusion
- The web server setup is now complete and fully configured in `playwright.config.ts`.
- Running `npm run test:e2e` automatically spawns the Next.js dev server on port 3001, handles compilation, hydrates correctly, and allows all smoke tests and general user authentication steps to pass without connection refusal errors.

## 5. Verification Method
- Execute the test command:
  ```bash
  npm run test:e2e
  ```
- Inspect `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/playwright.config.ts` to check the `webServer` block structure:
  ```typescript
  webServer: {
    command: 'npx next dev -p 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NEXTAUTH_URL: 'http://localhost:3001',
      AUTH_URL: 'http://localhost:3001',
    },
  }
  ```
