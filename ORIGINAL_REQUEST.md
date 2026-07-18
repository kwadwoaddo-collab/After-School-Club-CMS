# Original User Request

## Initial Request — 2026-07-16T22:59:54Z

You are a **meta-level product designer and frontend engineer** with the taste of a senior Apple HIG contributor. Your job is to audit and upgrade the **global UI elements** of an existing After-School Club CMS — specifically the sidebar, header, typography system, and global CSS — so that the entire app feels premium, coherent, and pixel-perfect at first glance.

The existing codebase already has a strong foundation: Apple HIG color tokens, Inter font, glassmorphism components, squircle radii, and dark/light mode support. Your task is NOT to rebuild from scratch. It is to find and fix the gaps, inconsistencies, and rough edges that stop it from feeling truly world-class.

**Ask yourself after every change: would this ship on apple.com? Would Linear or Vercel be proud of this?**

Working directory: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS

Integrity mode: development

---

## Context: What you will find

- **Framework:** Next.js 15 App Router, Tailwind v4 (no config file — all theming in `globals.css` via `@theme inline`)
- **Font:** Inter loaded via `next/font/google` — currently loaded without explicit weight or display configuration
- **Colour system:** Apple HIG HSL tokens (light + dark), with a comprehensive set of CSS custom properties in `:root`
- **Sidebar:** `src/components/dashboard/Sidebar.tsx` — glassmorphic, collapsible, role-gated nav. Nav items use `rounded-full` pill shape
- **Header:** `src/components/dashboard/Header.tsx` — glassmorphic header with search, notifications bell, and user avatar dropdown
- **Global CSS:** `src/app/globals.css` (~838 lines) — contains `@theme inline`, base tokens, component classes, and aggressive `body:not(.landing-page-active)` override blocks

---

## Requirements

### R1. Typography System
Upgrade the font loading and global typographic rhythm so that every heading, label, and body text feels intentional and premium.

Specific issues to fix:
- `layout.tsx` loads Inter with only `variable` and `subsets` — no explicit `weight` array, no `display: 'swap'` or `preload`. Load weights `[400, 500, 600, 700, 800]` properly.
- Headings across the dashboard use `font-weight: 700 !important` and `letter-spacing: -0.03em !important` via a global override in `globals.css`. Audit whether this override is being applied consistently and whether it looks right on h1 vs h3 (h1 should track tighter at -0.04em, h2 at -0.03em, h3 at -0.02em).
- Add `font-feature-settings: "cv01", "ss01", "liga" 1` globally for Inter's optical refinements.
- Ensure `line-height` is set appropriately per text size tier (display: 1.05, headings: 1.1, body: 1.5, captions: 1.4).

### R2. Sidebar Polish
Elevate the sidebar from functional to exceptional. Do not change routing, role-gating, or collapse logic.

Specific issues to fix:
- The active nav item uses `bg-primary/10` with `text-primary` — it reads clearly but has no left accent bar or any spatial depth indicator that distinguishes it from a simple hover. Add a subtle 2–3px left accent bar (using `border-l-2 border-primary` or a `::before` pseudo-element) on active items while keeping the pill background.
- The org logo badge (`w-9 h-9 rounded-xl bg-primary`) is good but could benefit from a subtle inner shadow or refined gradient (e.g. `bg-gradient-to-br from-primary to-primary/80`) to give it depth.
- Nav item spacing: currently `space-y-0.5` with `py-3`. This creates a tight rhythm. Evaluate whether `py-2.5` with `space-y-1` feels better (more breathable without wasting space).
- The "Quick Links / Share Portals" section label uses `text-[10px] uppercase tracking-widest` which is correct, but it renders as `text-muted-foreground` by default. Increase contrast slightly to `text-muted-foreground/80` and bump tracking to `tracking-[0.12em]` for refinement.
- Collapsed sidebar icon-only mode: icons should be vertically centered with `mx-auto` and have a clean tooltip. Verify that the tooltip (via `title` attribute) is styled well or add a proper hover tooltip for each nav icon.
- Footer area: ensure user name / role display (if present) has adequate padding and doesn't clip.

### R3. Header Polish
The header is the most visible UI element. Make it feel truly premium.

Specific issues to fix:
- The glassmorphism header (`backdrop-blur-xl`, `bg-header/60`) is good. Ensure the `border-bottom` uses `border-b border-border/60` — a slightly transparent border — rather than a harsh full-opacity line.
- The search bar: if it uses a plain `input` styled via the globals, audit that its height, border-radius (should be `rounded-2xl` / 18px), background opacity, and focus ring are all precisely Apple-quality.
- The notification bell: if it has an unread badge, ensure the badge uses `animate-ping` or a `status-dot` pulse already defined in `globals.css` rather than a static red dot.
- The user avatar / initials button: it should have a clean `ring-2 ring-border hover:ring-primary/40` treatment on hover, with `transition-all duration-200`. The initials text should use `font-semibold text-sm tracking-tight`.
- The user dropdown menu: it should use `bg-popover border border-border rounded-2xl shadow-2xl` with smooth `animate-in fade-in slide-in-from-top-2 duration-150` animation (these classes are already defined in globals.css).
- The theme toggle (Sun/Moon/Cloud) should feel tactile — `active:scale-95 transition-transform`.

### R4. Global CSS Cleanup & Consistency
The `globals.css` file has several rough edges that need addressing.

Specific issues to fix:
- The `body:not(.landing-page-active)` override blocks that force `border-radius: 24px !important` on all `.card` elements and `border-radius: 9999px !important` on all buttons are EXTREMELY aggressive and will break form elements, table rows, and any button that should not be a pill (e.g. icon-only buttons in tables). These overrides must be **scoped more carefully** or removed in favour of component-level styling. The designer must audit which components break and either remove these overrides or add `.keep-shape` guards where needed.
- The `--color-*` theme block inside `@theme inline` has dozens of Material Design 3 tokens (`--color-secondary-fixed-dim`, `--color-on-tertiary-fixed-variant`, etc.) that are never referenced in any component. These are dead variables adding ~60 lines of noise. Remove them.
- Ensure `:root` variables and `@media (prefers-color-scheme: dark)` are properly aligned — currently there's both a `@media` block AND a `.dark` class block, which is correct for Tailwind dark-mode class strategy. Confirm both are consistent.
- The `@keyframes` section at the end is well structured. Do not change it.

### R5. No Regressions
All changes must be purely visual and must not break any existing functionality.

- `npm run lint` must pass with 0 errors after all changes.
- `npm run test` must pass (all 123 tests green).
- `npx tsc --noEmit` must compile with 0 TypeScript errors.
- The CMS must still render correctly in both light and dark modes.
- The sidebar collapse/expand, centre selector dropdown, and role-based nav filtering must all continue to work.

---

## Acceptance Criteria

### Typography
- [ ] Inter is loaded with weights `[400, 500, 600, 700, 800]` and `display: 'swap'`
- [ ] Headings have graduated letter-spacing: h1 `-0.04em`, h2 `-0.03em`, h3 `-0.02em`
- [ ] `font-feature-settings` includes `"cv01"`, `"ss01"`, `"liga"` globally
- [ ] Line-height is explicitly set per text tier, not left to browser defaults

### Sidebar
- [ ] Active nav item has a visible left accent bar or equivalent spatial depth cue
- [ ] Org logo has refined gradient or inner depth treatment
- [ ] Collapsed icon-only mode renders icons cleanly centred with accessible tooltips
- [ ] Nav section label contrast and tracking is refined

### Header
- [ ] Header border uses a semi-transparent `border-border/60` not a full-opacity line
- [ ] Search bar has precise Apple-quality styling (height, radius, focus ring)
- [ ] Notification badge (if present) uses a pulse animation from globals
- [ ] User avatar button has `ring` hover treatment and correct initials typography
- [ ] User dropdown uses `rounded-2xl`, `shadow-2xl`, and slide-in animation

### Global CSS
- [ ] Aggressive `!important border-radius` overrides on `.card` and `button` are scoped or removed — no visible layout breaks across dashboard, students, finance, and settings pages
- [ ] Dead Material Design 3 token variables removed from `@theme inline`
- [ ] Light and dark mode `:root` tokens are consistent

### No Regressions
- [ ] `npm run lint` exits 0
- [ ] `npm run test` — all 123 tests pass
- [ ] `npx tsc --noEmit` exits 0
- [ ] App renders correctly in both light and dark modes (manually verify in browser)

## Follow-up — 2026-07-17T14:37:37Z

You are a **meta-level product designer and frontend engineer** auditing and upgrading the **Dashboard homepage** of an After-School Club CMS. The app is built on Next.js 15 App Router with Tailwind v4 (no config file — all tokens in `globals.css` via `@theme inline`).

**Ask yourself after every change: would this ship on apple.com? Would Linear or Vercel be proud of this?**

Do not change any data-fetching logic, routing, or server-side code. All changes are purely visual and structural.

Working directory: /Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS

---

## Files to work on

- `src/components/dashboard/DashboardHero.tsx`
- `src/components/dashboard/KpiGrid.tsx`
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/TodaysSnapshot.tsx`
- `src/components/dashboard/DashboardSkeletons.tsx`

---

## Requirements

### R1. DashboardHero — Fix the missing greeting and elevate the welcome area

**Bug:** `firstName` is passed as a prop but is never rendered. The hero just says "Overview". Fix this immediately.

Specific changes:
- Display a time-aware greeting as the page `<h1>`: `Good morning, {firstName}` / `Good afternoon` / `Good evening`. Use a helper function keyed on `new Date().getHours()` (< 12 → morning, < 17 → afternoon, else → evening).
- Keep "Overview" as a secondary line or subtitle label below the greeting, not the primary heading.
- The org name badge (`{orgName}`) above the heading is fine — keep it.
- The existing subtitle `"Centres, enrolments, and booking activity — all in one place."` is generic and flat. Replace with something warmer: `"Here's how things are looking today."` — shorter, more personal.
- The background gradient `from-card via-card to-primary/5` is barely perceptible. Add a slightly more pronounced gradient wash: `from-card via-card/95 to-primary/8` with a subtle radial glow on the right side.
- The sticky collapsed state should show the greeting first name in compact form.
- Ensure the scroll listener uses `{ passive: true }` — already present, keep it.

### R2. KpiGrid — Fix broken hover glows and elevate card quality

**Bug:** The `glowClasses` map uses the full `colorClass` string as a lookup key, but the key `'text-violet-600 dark:text-violet-400'` will never match because the value has spaces and pseudo-selectors. The violet card gets no glow on hover. Fix this by restructuring the `KpiStat` type to include a separate `glowClass` field on each stat definition instead of deriving it from `colorClass`.

Specific changes:
- Add `glowClass: string` to the `KpiStat` interface and set it explicitly on each stat object (e.g., `glowClass: 'glow-hover-primary'`, `glowClass: 'glow-hover-accent-violet'`, `glowClass: 'glow-hover-tertiary'`, `glowClass: 'glow-hover-warning'`).
- Remove the `glowClasses` Record lookup entirely. Use `stat.glowClass` directly in the `cn()` call.
- **Card size**: change `min-h-[116px]` to `min-h-[148px]` — more breathing room.
- **Padding**: change `p-4` to `p-5`.
- **Sparkline visibility**: bump from `opacity-[0.15]` to `opacity-[0.2]` default and `opacity-[0.4]` on hover.
- **Footer**: give it `pt-3` and use `text-[11px]` instead of `text-[10px]` for the subtext.
- **Make each card a link**: wrap the card in `<Link href="...">` so clicking Students → `/dashboard/students`, Bookings → `/dashboard/bookings`, Registrations → `/dashboard/registrations`, Pending → `/dashboard/registrations?status=pending`. Add `cursor-pointer`.
- **Pending card urgency**: if `pendingRegistrations > 0`, add a small pulsing dot indicator (use the `animate-ping` pattern from globals.css) next to the "Pending Approval" label.

### R3. StatCard.tsx — Dark mode fix

This component uses hardcoded light-mode Tailwind classes (`text-slate-700`, `text-slate-900`, `bg-purple-50`, `border-purple-200`) that are not theme-aware and will look broken in dark mode.

Rewrite using CSS variable-based classes:
- `text-slate-700` → `text-foreground`
- `text-slate-900` → `text-foreground`
- `text-slate-600` → `text-muted-foreground`
- `bg-purple-50` / `bg-cyan-50` / `bg-amber-50` / `bg-blue-50` → `bg-primary/10`, `bg-accent-violet/10`, `bg-accent-amber/10`, `bg-accent-cyan/10`
- `text-purple-600` etc. → `text-accent-violet`, `text-accent-cyan`, `text-accent-amber`, `text-primary`
- `border-purple-200` etc. → `border-border`
- Hover shadows → `hover:shadow-md`
- Keep the `glass-card` base class.

### R4. TodaysSnapshot — Polish and theme consistency

Specific changes:
- Replace all `text-emerald-600 dark:text-emerald-400` patterns. Use `text-tertiary` for green (confirmed), `text-accent-amber` for amber/pending/warning, `text-primary` for blue/checked-in.
- Add `min-w-0` to metric cells to prevent overflow.
- Add a `title` attribute to the attendance progress bar showing raw numbers (e.g., `title="12 of 15 attended"`).
- Add a "View Attendance →" link at the bottom-right of the header bar pointing to `/dashboard/attendance`. Use `text-primary text-[11px] font-semibold hover:underline`.
- If `snapshot.total === 0`, show a friendly empty state: a `Calendar` icon + `"No sessions scheduled for today"` text instead of a grid of zeroes.

### R5. DashboardSkeletons.tsx — CRITICAL: Fix broken MD3 tokens

**This is broken.** The skeleton file uses Material Design 3 token class names that no longer exist:
- `bg-surface-container-high` → `bg-secondary`
- `bg-surface-bright` → `bg-muted/60`
- `bg-surface-container-low` → `bg-card`
- `border-outline-variant/10` → `border-border/20`

Also: use the `skeleton-shimmer` class already defined in `globals.css` on animated placeholder blocks instead of plain `animate-pulse`.

### R6. No Regressions
- `npm run lint` must pass with 0 errors.
- `npm run test` must pass — all 133 tests green.
- `npx tsc --noEmit` must compile with 0 TypeScript errors.
- All changes are visual/structural — no data-fetching, routing, or auth logic changes.

---

## Acceptance Criteria

### DashboardHero
- [ ] `firstName` is rendered in a time-aware greeting (Good morning / afternoon / evening, {firstName})
- [ ] Subtitle updated to warmer copy: "Here's how things are looking today."
- [ ] Sticky collapsed state shows first name

### KpiGrid
- [ ] `glowClasses` map removed; each stat has an explicit `glowClass` field — violet card now glows on hover
- [ ] Cards are `min-h-[148px] p-5`
- [ ] Sparkline opacity increased
- [ ] Each card is a clickable link to the relevant section
- [ ] Pending card has a pulsing urgency indicator when count > 0
- [ ] Footer subtext is `text-[11px]` with `pt-3`

### StatCard
- [ ] All hardcoded light-mode color classes replaced with CSS variable equivalents
- [ ] Renders correctly in both light and dark mode

### TodaysSnapshot
- [ ] Color classes consolidated — no more `dark:` variants, uses CSS variable palette
- [ ] Zero-state shows a friendly empty state message instead of a grid of zeroes
- [ ] "View Attendance →" link present in header bar
- [ ] Attendance bar has accessible `title` attribute

### DashboardSkeletons
- [ ] All MD3 token class names replaced (`bg-secondary`, `bg-muted/60`, `bg-card`, `border-border/20`)
- [ ] Shimmer blocks use `skeleton-shimmer` class from globals.css

### No Regressions
- [ ] `npm run lint` exits 0
- [ ] `npm run test` — all 133 tests pass
- [ ] `npx tsc --noEmit` exits 0

