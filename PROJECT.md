# Project: After-School Club CMS UI & Typography Upgrade

## Architecture
This project is an existing After-School Club CMS built using:
- **Framework**: Next.js 15 App Router
- **Styles**: Tailwind CSS v4 (inline theme setup in `src/app/globals.css`)
- **Database**: Drizzle ORM
- **Testing**: Vitest for unit/integration tests, Playwright for E2E tests

The architecture is standard Next.js App Router structure:
- `src/app/layout.tsx` is the root layout handling global typography (Inter font).
- `src/components/dashboard/Sidebar.tsx` renders the left side navigation dashboard navigation.
- `src/components/dashboard/Header.tsx` renders the top header.
- `src/app/globals.css` defines global variables, fonts, components, and animations.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite Setup & Audit (E2E Track) | Audit existing tests, design/enhance E2E test suite to satisfy 4-tier requirements, and generate `TEST_READY.md`. | None | DONE |
| 2 | Typography Upgrade | Fix Inter font loading in `src/app/layout.tsx`, global headings typography and letter spacing/line heights. | None | DONE |
| 3 | Sidebar Polish | Accent bar on active nav item, org logo gradient/shadow, spacing adjustments, label contrast, tooltips in collapsed mode. | None | DONE |
| 4 | Header Polish | Transparent border, Apple-quality search input, bell badge animations, user avatar ring hover, initials, user dropdown menu, theme toggle. | None | DONE |
| 5 | Global CSS & Overrides Cleanup | Scope/remove aggressive card/button border-radius overrides, clean up dead MD3 theme tokens, align light/dark modes. | M2, M3, M4 | DONE |
| 6 | E2E and Adversarial Hardening | Verify all unit and E2E tests pass, run Challenger checks, run Forensic Auditor, run Adversarial Coverage Hardening (Tier 5). | M1, M2, M3, M4, M5 | DONE |

## Interface Contracts
- **Global Theme Tokens**: Custom HSL color variables must be consistent between `:root` (light mode) and `.dark` / `@media (prefers-color-scheme: dark)` (dark mode).
- **Navigation State**: Sidebar collapse/expand state is controlled via React hooks, and must remain fully responsive and functional.
- **Component Classes**: Global style overrides on `.card` and `button` components must either be scoped using `.keep-shape` class guards or refactored to component-level styles.
