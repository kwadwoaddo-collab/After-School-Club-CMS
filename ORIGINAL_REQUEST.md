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
