# Milestone 2 — Visual Correction Pass — Completion Report

**Status: correction pass complete. Awaiting visual re-review. Milestone 3 NOT started, per instruction.**

## 1. What this pass was

The previously-delivered Milestone 2 work (branch `rebuild/cms-modernisation`, HEAD `776187a`, bundle `milestone-2-cms-rebuild.bundle`) was reviewed and found **not close enough to InvoiceFlow** — it read as "the old CMS with InvoiceFlow colours" rather than a shared product family. This pass re-inspected InvoiceFlow's actual source (shell components and UI primitives) and reworked the CMS's shell and Dashboard to match its geometry, density, and accent discipline much more closely, while preserving 100% of CMS business logic, data, and permissions.

**The previous Milestone 2 bundle is superseded. Do not use it.** The bundle below is the only one that should be applied.

## 2. Visual Delta From Previous Attempt

**Dashboard header/filter area.** Previously a tall, standalone rounded panel: three-row stack of `rounded-full`/`shadow-inner` pills on legacy tokens (`bg-secondary`, `text-muted-foreground`, `text-primary/80` — this component had never actually been touched since before Milestone 1). Now a compact flat toolbar — a segmented Weekly/Monthly control plus icon-button date navigation — presented as an action inline with the page header, not a separate chrome band. All filter functionality (view toggle, prev/next, quick filters, today) is unchanged.

**Greeting.** Previously a dedicated hero section below a sticky title bar: an org-name label, a `text-display`-sized "Good morning, Repro" heading, and a supporting paragraph — three lines of dedicated vertical space plus its own visual weight. Now one quiet description line under the "Dashboard" page title ("Good morning, X · Org — here's how things are looking today."), built on the shared `PageHeader` primitive. Greeting logic, organisation context, and the supporting copy are all still there, just compacted.

**Onboarding checklist.** Logic identical (progress tracking, auto-expand of the first incomplete step, dismissal persistence, completion celebration). Presentation rebuilt: the `rounded-[24px]` outer card, background glow blur, and blue/teal gradients are gone, replaced with a flat `rounded-lg` surface, restrained accent usage, smaller radii, and the shared `Button` primitive for the step CTA (previously a hand-rolled gradient button). The welcome modal, which sits directly above the checklist on first load and was carrying the same old visual language, was brought into line as part of the same pass (not explicitly named in the correction ticket, but part of the same first-run surface).

**Sidebar.** Width 256px → InvoiceFlow's exact 240px; the collapsed rail narrowed from 80px to 72px. The `before:` pseudo-element left accent bar on the active nav item is gone — InvoiceFlow's `sidebar-nav.tsx` uses a plain solid `bg-accent-soft` fill with no left-rule decoration, so that's what the CMS now does too. Nav icons went from 20px to InvoiceFlow's 16px; icon/label gap and inter-item spacing both tightened.

**Top bar.** Height went from a responsive `h-16 sm:h-20` to InvoiceFlow's single fixed `h-14` at every breakpoint. The duplicate greeting that lived in the top bar (redundant with the Dashboard's own greeting) is gone. The "Spotlight-Style Search Focus Backdrop Overlay" — a full-screen dimming layer on search focus — is gone; it doesn't exist in InvoiceFlow and was pure decoration. Scroll-position-driven shadow logic is gone; background now matches InvoiceFlow's `bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80` exactly, with a plain `border-border` instead of a semi-transparent one.

**Accents.** The org/centre switcher (`OrgSwitcher.tsx`) was still using a `bg-gradient-to-br from-primary to-primary/80` badge with a glow ring and shadow — legacy code untouched since before Milestone 1. Rebuilt onto InvoiceFlow's exact `business-switcher.tsx` chip pattern (flat `rounded-md bg-accent` trigger, `rounded-sm bg-accent-soft` dropdown chips). In the KPI grid, the "Bookings" tile's icon chip was reassigned from `bg-info-soft`/blue to a neutral treatment — it carries no actual "info" state, and mixing blue with the accent teal was the single clearest instance of the "two competing brand colours" problem called out in the ticket.

**Radii.** Every shell/Dashboard surface touched this pass now uses InvoiceFlow's component-scale radii: `rounded-md` for buttons, interactive rows, and icon chips; `rounded-lg` for cards; `rounded-sm` for badges and small chips. No 20px+ container radius remains in any file this pass touched (`OrgSwitcher`'s old `rounded-xl`/`rounded-[somewhat]` badge and `DashboardFilter`'s `rounded-full` pills are gone; `OnboardingChecklist`'s `rounded-[24px]` outer card is gone).

**Cards.** `Card`/`CardHeader`/`CardContent` were corrected to match InvoiceFlow's `card.tsx` exactly (bordered header, tightened content padding), and the missing `CardDescription`/`CardFooter` exports were added.

**Mobile density.** With the greeting compacted into one line and the filter toolbar shrunk to a single compact row, the first mobile viewport now reaches the KPI grid and bottom tab bar noticeably sooner than before — verified directly against a fresh 375px screenshot (see below).

## 3. InvoiceFlow Similarity Assessment

| Area | Rating | Notes |
|---|---|---|
| Sidebar width/spacing/active state | **VERY CLOSE** | Matches InvoiceFlow's `w-60`, `size-4` icons, `gap-2.5`, `space-y-0.5`, and the plain `bg-accent-soft` active fill exactly. Collapse-to-rail behaviour is a deliberate CMS-specific retention (see §5). |
| Top bar height/background/border | **VERY CLOSE** | `h-14`, `bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80`, `border-border` all copied exactly from `top-bar.tsx`. |
| Top bar mobile composition | **ADAPTED** | InvoiceFlow's mobile top bar shows a `Wordmark` next to the hamburger; the CMS shows no equivalent (org identity lives in the sidebar/drawer's `OrgSwitcher` instead, and there's no separate CMS wordmark asset). Functionally equivalent, not visually identical. |
| Buttons/Cards/Badges | **VERY CLOSE** | Class values now match InvoiceFlow's primitives directly; variant/size *key names* were deliberately kept as the CMS's existing names to avoid an app-wide API break (ticket explicitly allows this). |
| OrgSwitcher chip | **VERY CLOSE** | Copied InvoiceFlow's `business-switcher.tsx` chip geometry (`size-7`/`size-6`, `rounded-md`/`rounded-sm`) directly. |
| Dashboard header/filter toolbar | **CLOSE** | InvoiceFlow has no exact equivalent (it has no cross-cutting date filter on its dashboard), so this is a CMS-specific control built in InvoiceFlow's visual language (flat segmented control, icon-button nav, `rounded-md`) rather than a literal port. |
| Greeting/hero | **CLOSE** | InvoiceFlow's authenticated pages carry no greeting at all; the CMS's greeting is a genuine product requirement (ticket §14), so it's now expressed as an InvoiceFlow-style `PageHeader` description line rather than removed. |
| Onboarding checklist / welcome modal | **CLOSE** | InvoiceFlow has no onboarding-checklist equivalent to copy directly; rebuilt in its visual language (flat surfaces, `rounded-lg`, restrained accent, shared `Button`) rather than matched pixel-for-pixel against a source. |
| KPI cards | **CLOSE** | Structure, icon-chip geometry, and now the semantic tone-token convention match InvoiceFlow's `financial-summary-widgets.tsx` closely; the CMS's version legitimately carries more per-tile data (trend badges, sparklines, subtext) that InvoiceFlow's simpler widget doesn't have — a genuine business-requirement difference (ticket §14), not a leftover old-CMS pattern. |
| Bottom-nav / mobile navigation | **DELIBERATELY DIFFERENT** | InvoiceFlow has no bottom tab bar; the CMS's is a mobile-ergonomics decision from Milestone 1 that the ticket explicitly permits keeping. |
| Below-the-fold Dashboard widgets (Today's Schedule, Sessions & Bookings, Registrations, Finance Overview, Registration Funnel) | **OUT OF SCOPE — UNCHANGED** | Not named in the correction ticket's 17-point list and outside "shell + Dashboard header/filter/greeting/onboarding/sidebar/topbar/KPI/primitives." Still on older `rounded-xl`/`bg-blue-500/10` styling. Flagged here rather than silently left inconsistent — a natural next-pass candidate if the reviewer wants the whole Dashboard page brought in line, but doing so was judged out of this ticket's explicit scope and the "no other module internals" guardrail. |

## 4. Font Decision

**Recommendation: adopt Geist. Applied.**

InvoiceFlow uses Geist (via the `geist` npm package) as its typeface, applied once at the root layout. The CMS was using `next/font/google`'s Inter, which:

- Looks visually distinct from Geist at a glance (different x-height, different numeral proportions) — a small but real contributor to the "not quite the same family" impression.
- Requires a network fetch at build time, which is the CMS's known sandboxed-build fragility source. Every prior milestone's webpack build needed the `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` environment-variable workaround, and that workaround does not exist for Turbopack builds at all.

The `geist` package ships GeistSans/GeistMono as local static `.woff2` files bundled at `npm install` time — zero network dependency at build time, in any bundler. Adopting it both improves visual consistency with InvoiceFlow and permanently removes a real, previously-documented build risk. `npx next build` (default Turbopack) now completes cleanly with no font-related workaround needed at all — confirmed in this pass (see §7).

Applied at the root layout (`src/app/layout.tsx`), matching InvoiceFlow's own approach — not scoped only to the authenticated dashboard. Public/auth pages (`/login`, `/signup`, booking/registration portal pages, etc.) inherit the change automatically since they had no separate font declaration of their own; there is nothing else to update. `--font-sans` in `globals.css` now points at `--font-geist-sans`.

## 5. What Was Deliberately Kept Different (per ticket §14)

- CMS navigation labels, routes, and the full role-gated nav item set.
- Centre-switching dropdown and multi-centre "Combined View" concept (no InvoiceFlow equivalent).
- Sidebar collapse-to-rail behaviour (InvoiceFlow's sidebar has no collapsed state — it's simply hidden below `lg`).
- Mobile bottom-tab navigation.
- All KPI/business data and its meaning (student/booking/registration counts, trend calculations, sparkline data).
- CMS permissions/role model.

## 6. Screenshots

Captured against a local Postgres instance seeded with real data, a real NextAuth credentials session (`kwadwoaddo@googlemail.com` / ORG_OWNER), and `next start` (production build) — not mocks. Delivered alongside this report:

- `desktop-1440-dashboard.png` / `desktop-1440-dashboard-full.png` — 1440px desktop, viewport and full-page.
- `tablet-834-dashboard.png` — 834px tablet, collapsed nav.
- `tablet-834-drawer-open.png` — 834px tablet, navigation drawer open (verifies the Milestone 1b tablet-overlap fix survived this pass's density changes).
- `mobile-375-dashboard.png` / `mobile-375-dashboard-full.png` — 375px mobile, viewport and full-page.

**On InvoiceFlow reference screenshots:** InvoiceFlow's own stack (Firebase/Firestore) is materially different from the CMS's (Postgres/Drizzle), and standing up a Firebase emulator with seed data to render its live UI was judged disproportionate to this pass. Instead, the comparison in §3 above is done directly against InvoiceFlow's source files (exact class names, spacing, and geometry values) rather than an eyeballed screenshot — more precise for a class-level match, though it is a different evidence type than a side-by-side render. Flagging this trade-off explicitly rather than silently skipping the "rendered UI" ask.

## 7. Engineering Guardrails

- No database, auth, RBAC, booking, attendance, finance, or registrations logic touched.
- No production deployment or migrations touched.
- No Milestone 3 work started.
- `npx tsc --noEmit -p .` — clean, no errors.
- `npx vitest run` — 216/216 passing (same count as the prior Milestone 2 baseline); the one failing test *file* (`src/features/communications/actions.test.ts`, a pre-existing `next/server` module-resolution issue in this sandbox unrelated to any file this pass touched) is a 0-test failure to load, not a regression — same as before this pass.
- `npm run lint` — 69 problems (64 errors, 5 warnings), identical to the documented Milestone 2 baseline. No new lint errors or warnings in any file this pass touched.
- `npx next build` — clean production build, 93 static/dynamic routes generated. No font-fetch workaround needed (see §4).

## 8. Git Reconciliation

- **Starting HEAD (base of both Milestone 2 attempts):** `951cd76` (Milestone 1 final closure).
- **Previous interim HEAD referenced in an earlier report:** `a5ae4b0` ("hide the mobile bottom nav while the nav drawer is open").
- **Previously-delivered bundle's actual HEAD:** `776187a` ("Milestone 2: completion report").
- **SHA discrepancy explained:** these are not divergent branches or lost work — `776187a` is one commit *after* `a5ae4b0` on the same linear history: `a5ae4b0` was the last code commit, and `776187a` added only the completion-report document on top of it. A report referencing `a5ae4b0` was simply pointing at the last code-bearing commit rather than the report-bearing commit at the true HEAD. Both SHAs are present, in order, in the bundle below.
- **Final HEAD after this correction pass:** `371359a`.
- **Complete commit list, `951cd76..HEAD`:**

  ```
  371359a Milestone 2 Correction Pass: align Dashboard loading skeletons to the new geometry
  f5f470f Milestone 2 Correction Pass — Font Decision: adopt Geist, drop next/font/google
  d96ff0d Milestone 2 Correction Pass: declutter Dashboard hero/filter/onboarding/KPIs
  547c1c1 Milestone 2 Correction Pass: tighten shell geometry to InvoiceFlow proportions
  391857d Milestone 2 Correction Pass: align Button/Card/Badge exactly to InvoiceFlow
  776187a Milestone 2: completion report
  a5ae4b0 Milestone 2: hide the mobile bottom nav while the nav drawer is open
  0cf45e8 Milestone 2: modernize Dashboard KPI cards and hero onto the new Card primitive
  3623101 Milestone 2: modernize the application shell and fix the tablet overlap
  c5a4cf7 Milestone 2: restyle Button/Badge/EmptyState onto the new token layer
  20d9941 Milestone 2: InvoiceFlow design foundation + shared primitives
  ```

- **What each correction commit contains** (the five new commits on top of the previously-delivered `776187a`):
  1. `391857d` — Button/Card/Badge exact-match to InvoiceFlow's primitives (radii, ghost variant, Card sub-parts, Badge sizing).
  2. `547c1c1` — Sidebar/Header/DashboardContent geometry (widths, heights, spacing, removed decoration) and a full OrgSwitcher rebuild off legacy tokens.
  3. `d96ff0d` — DashboardHero/DashboardFilter/OnboardingChecklist/WelcomeModal decluttering and KPI accent-token correction.
  4. `f5f470f` — Font decision: Geist adoption at the root layout.
  5. `371359a` — Dashboard loading-skeleton geometry brought in line with the reworked components.

- **Final bundle:** one bundle, `milestone-2-cms-rebuild-CORRECTED.bundle`, built from `951cd76..HEAD` (contains all eleven commits above, including the six from the original Milestone 2 delivery). **This supersedes and replaces** the previously-delivered `milestone-2-cms-rebuild.bundle` — do not apply both. To apply:

  ```
  git fetch /path/to/milestone-2-cms-rebuild-CORRECTED.bundle rebuild/cms-modernisation:rebuild/cms-modernisation
  git push origin rebuild/cms-modernisation
  ```

  (The branch has still not been pushed to GitHub from this environment, per instruction — the sandbox's git-proxy blocks direct `git push` to `kwadwoaddo-collab/After-School-Club-CMS` with a 403; the bundle remains the delivery mechanism.)

## 9. Next Step

Per instruction: **stopping here.** Do not begin Milestone 3. Awaiting visual re-review of the screenshots and this report before any further action (either a further correction round, or approval to push and proceed).
