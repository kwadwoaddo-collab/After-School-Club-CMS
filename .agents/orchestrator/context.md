# Project Context - After-School Club CMS UI & Typography Upgrade

## Codebase Paths
- **Working Directory**: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/orchestrator`
- **Root Directory**: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS`
- **Original User Request**: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/ORIGINAL_REQUEST.md`

## Key Files to Edit
- **Font & Global Layout**: `src/app/layout.tsx`
- **Sidebar**: `src/components/dashboard/Sidebar.tsx`
- **Header**: `src/components/dashboard/Header.tsx`
- **Global Styles**: `src/app/globals.css`

## Testing Context
- **Unit/Integration Tests**: `vitest` (`npm run test`)
- **E2E Tests**: Playwright (`npx playwright test` / `npm run test:e2e`)
- **Linting**: ESLint (`npm run lint`)
- **TypeScript Compilation**: `npx tsc --noEmit`

## Environment Variables & Configuration
- Tailwind v4 configured inline in `src/app/globals.css` via `@theme inline`.
- Next.js 16.2.9 / React 19.2.7.
