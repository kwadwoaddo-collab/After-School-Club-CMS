# Original User Request

## Initial Request — 2026-07-17T14:37:37Z

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
