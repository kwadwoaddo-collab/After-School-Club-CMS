# Design System: After-School Club CMS
**Primary Project ID:** `1638800519015830521`
**Secondary Project ID (Dashboard):** `10562091658058307698`
**Last Synthesized:** 2026-03-19

---

## 1. Visual Theme & Atmosphere

### North Star: "The Architectural Void" meets "Institutional Clarity"

The design system is a **dark-mode-first**, authority-driven SaaS aesthetic built for busy school administrators. It balances high-end editorial precision with operational clarity—every element earns its place. The overriding philosophy is *intentional emptiness*: information floats in a logical, layered hierarchy on a warm, near-black canvas, lit from within by electric blue and violet accents.

**Core Vibes:**
- **Dashboard / Admin Screens** — "Sovereign Console": Dark, atmospheric, premium. Glassmorphic sidebars, tonal surface layering, no solid border lines.
- **Data-Heavy Tables** — "Institutional Clarity": High information density without clutter; using tonal alternating rows, not grid lines.
- **Landing / Marketing Pages** — "Premium Institutional": Bold hero areas, large editorial typography, and subtle scan-line motion effects over Obsidian Black backgrounds.

---

## 2. Color Palette & Roles

> **Critical Rule:** Never use pure `#000000` black. The canonical dark base is `#131313`.
> **No-Line Rule:** Solid 1px borders for sectioning are **strictly prohibited**. Use background color shifts to define boundaries.

### Primary Surfaces (Dark Mode Foundation)

| Token Name            | Hex       | Role & Usage                                            |
|:----------------------|:----------|:--------------------------------------------------------|
| `surface`             | `#131313` | Global page background. The "void."                     |
| `surface-dim`         | `#131313` | Alias for base background; used interchangeably.        |
| `surface-container-lowest` | `#0e0e0e` | Deepest layer; dropdown menus, popover backdrops.  |
| `surface-container-low` | `#1c1b1b` | Secondary sections; sidebar background base.         |
| `surface-container`   | `#20201f` | Cards, table rows, content panels.                      |
| `surface-container-high` | `#2a2a2a` | Elevated cards, hovered list items.                 |
| `surface-container-highest` | `#353535` | Floating elements, modal backgrounds, tooltips.  |
| `surface-bright`      | `#393939` | Top-layer divider surfaces, active nav items.           |
| `surface-variant`     | `#353535` | Input backgrounds, chip containers.                     |

### Accent Colors (Functional Beacons)

| Token Name              | Hex       | Role & Usage                                                  |
|:------------------------|:----------|:--------------------------------------------------------------|
| `primary`               | `#adc6ff` | Pastel blue; primary text links, active nav indicators, icon color for selected state. |
| `primary-container`     | `#4d8eff` | Vivid blue; primary CTA button fill, progress bar fill.       |
| `override-primary`      | `#3B82F6` | Hard override for Tailwind; use `blue-500` equivalent.        |
| `on-primary`            | `#002e6a` | Text on primary buttons (dark navy on blue).                  |
| `secondary`             | `#d0bcff` | Soft violet; **Tutor role** badges, secondary status.         |
| `secondary-container`   | `#571bc1` | Deep violet; neutral status chips, secondary CTA fills.       |
| `override-secondary`    | `#8B5CF6` | Hard override violet; use `violet-500` equivalent.            |
| `tertiary`              | `#ffb599` | Warm peach/orange; **Parent role** highlights, alert states.  |
| `tertiary-container`    | `#f66018` | Vivid orange; warning badges, tertiary CTAs.                  |
| `override-tertiary`     | `#EA580C` | Hard override; use `orange-600` equivalent.                   |

### Text & On-Surface Colors

| Token Name          | Hex       | Role & Usage                                            |
|:--------------------|:----------|:--------------------------------------------------------|
| `on-surface`        | `#e5e2e1` | Primary body text, headings on dark surfaces.           |
| `on-surface-variant`| `#c2c6d6` | Secondary body text, captions, metadata labels.         |
| `on-background`     | `#e5e2e1` | Primary text applied directly on the base background.   |
| `outline`           | `#8c909f` | Icon strokes, subtle decorative lines.                  |
| `outline-variant`   | `#424754` | Ghost border fallback, used at **15% opacity** only.    |
| `error`             | `#ffb4ab` | Inline error text.                                      |
| `error-container`   | `#93000a` | Error state background for chips and banners.           |

### Light Mode Supplement (CMS Portal / Login screens)

The portal login page and certain public-facing flows use a **light mode** with the following adjustments:

| Token Name     | Hex       | Role                                          |
|:---------------|:----------|:----------------------------------------------|
| Background     | `#FFFFFF` | Page background                               |
| Surface        | `#F8F9FA` | Card and container background                 |
| Primary        | `#136dec` | CTA buttons, active nav, links                |
| On-Primary     | `#FFFFFF` | Text on blue buttons                          |
| Border         | `#E5E7EB` | Light dividers (allowed in light mode only)   |
| Body Text      | `#111827` | Dark text on white                            |
| Muted Text     | `#6B7280` | Labels, secondary descriptions                |

---

## 3. Typography Rules

**Font Family:** `Inter` — exclusively, across all weights and sizes.
**Fallback Stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

> Load Inter from Google Fonts: `?family=Inter:wght@300;400;500;600;700;800&display=swap`

### Scale & Usage

| Level         | Size        | Weight | Letter Spacing | Usage                                             |
|:--------------|:------------|:-------|:---------------|:--------------------------------------------------|
| Display LG    | 3.5rem      | 800    | -0.02em        | Hero headlines, major value propositions.         |
| Display MD    | 2.25rem     | 700    | -0.02em        | Page titles, section heroes.                      |
| Headline LG   | 2rem        | 700    | -0.01em        | Section titles, modal headers.                    |
| Headline MD   | 1.5rem      | 600    | 0              | Card titles, panel headings.                      |
| Headline SM   | 1.25rem     | 600    | 0              | Sub-section labels, table headers.                |
| Body LG       | 1rem        | 400    | 0              | Primary body copy, form labels, descriptions.     |
| Body MD       | 0.875rem    | 400    | 0              | Table cell content, data rows.                    |
| Body SM       | 0.75rem     | 400    | 0              | Supporting copy, fine print.                      |
| Label LG      | 0.875rem    | 500    | +0.01em        | Button text, nav labels.                          |
| Label MD      | 0.75rem     | 500    | +0.05em        | Status chips, metadata tags. **Always uppercase.**|
| Label SM      | 0.625rem    | 600    | +0.08em        | Mini badges, counts. **Always uppercase.**        |

**Key Rules:**
- Use `on_surface_variant` (`#c2c6d6`) for long-form body text to reduce eye fatigue.
- Use `#FFFFFF` only for primary headlines and critical data values.
- Section titles should have generous top margins (`spacing-24` / `6rem`) to breathe.

---

## 4. Elevation & Depth: The Layering Principle

Depth is achieved through **Tonal Layering** — never hard shadows with offsets.

### Surface Stack (Bottom → Top)

```
1. surface-dim      (#131313)  — Page base
2. surface-container-low (#1c1b1b) — Secondary sections, sidebars
3. surface-container (#20201f)  — Cards, table panels
4. surface-container-high (#2a2a2a) — Elevated cards
5. surface-container-highest (#353535) — Modals, floating dropdowns
```

### Shadow Styles

| Context         | Shadow Rule                                               |
|:----------------|:----------------------------------------------------------|
| Floating card   | `box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5)` — soft cloud, no offset |
| Modal / Sheet   | `box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6)` — ambient, large radius |
| Nav / Sidebar   | No shadow — achieved via surface color shift alone        |
| Ghost border    | `border: 1px solid rgba(66, 71, 84, 0.15)` — felt, not seen |

---

## 5. Component Stylings

### Buttons

| Type      | Background                              | Text           | Border | Radius       | Hover State           |
|:----------|:----------------------------------------|:---------------|:-------|:-------------|:----------------------|
| Primary   | Gradient: `#adc6ff` → `#4d8eff` (135°) | `#002e6a`      | None   | `rounded-full` (pill) | Increase brightness 10%, add `0 0 20px rgba(77,142,255,0.3)` glow |
| Secondary | `#353535` (`surface-container-highest`) | `#e5e2e1`      | None   | `rounded-lg` | `#2a2a2a` background shift |
| Tertiary  | Transparent                             | `#e5e2e1`      | None   | `rounded-lg` | `rgba(173,198,255,0.1)` background on hover |
| Danger    | `#93000a` (`error-container`)           | `#ffb4ab`      | None   | `rounded-lg` | Darken background     |
| Ghost CTA | `rgba(173,198,255,0.08)`                | `#adc6ff`      | `1px solid rgba(173,198,255,0.2)` | `rounded-lg` | Increase border opacity to 0.5 |

### Cards & Containers

- **Corner Radius:** `rounded-2xl` (1.5rem / 24px) for large containers; `rounded-xl` (0.75rem / 12px) for internal components.
- **Internal Spacing:** `p-6` (1.5rem) default padding; `p-4` (1rem) for compact data cards.
- **Dividers within cards:** Use spacing / background shift only. **Never use `<hr>` or border-bottom.**
- **Stat Counter Cards:** White value (`#FFFFFF`), muted label (`#c2c6d6`), trend indicator using `tertiary` orange for growth, `error` red for deficit.

### Navigation Sidebar

- **Background:** Glassmorphism — `surface-variant` at 60% opacity + `backdrop-blur-xl` (20px blur).
- **Width:** 240px (Desktop), collapses to icon-only 64px on mobile.
- **Active Nav Item:** `primary` (`#adc6ff`) icon + label color, `surface-bright` (`#393939`) pill background.
- **Inactive Nav:** `outline` (`#8c909f`) icon, `on-surface-variant` label.
- **Nav Group Separator:** 1px `outline-variant` at 20% opacity.
- **User Profile Block (bottom):** Avatar circle (32px), name in `Body LG`, role in `Label MD` uppercase muted.

### Data Tables

- **Header Row:** `surface-container-low` background, `Label MD` uppercase text in `on-surface-variant`.
- **Data Rows:** Alternating between `surface-container` and `surface-container-high` for zebra striping (no grid lines).
- **Row Hover:** Shift to `surface-container-highest` with a subtle left-border accent in `primary`.
- **Action Column:** Icon buttons only (`ghost` style), revealed on row hover.
- **Pagination:** `secondary` style buttons, current page in `primary`.

### Input Fields & Forms

| State   | Background                   | Border / Ring                          | Label              |
|:--------|:-----------------------------|:---------------------------------------|:-------------------|
| Default | `surface-container-lowest`   | None visible                           | `on-surface-variant`, `Label MD` |
| Focus   | `surface-container-lowest`   | `0 0 0 2px rgba(173,198,255,0.2)` glow | `primary` colour   |
| Error   | `surface-container-lowest`   | `0 0 0 2px rgba(255,180,171,0.4)` glow | `error` colour     |
| Disabled| `surface-container`          | None                                   | `outline` (muted)  |

- **Radius:** `rounded-xl` (0.75rem)
- **Select Dropdowns:** Match input style; options rendered on `surface-container-highest` background.

### Status Chips & Badges

| Status    | Background            | Text          | Usage                        |
|:----------|:----------------------|:--------------|:-----------------------------|
| Active    | `primary-container`   | `on-primary`  | Approved, Live, Confirmed    |
| Pending   | `secondary-container` | `#d0bcff`     | Awaiting Review, Scheduled   |
| Warning   | `tertiary-container`  | `#5a1c00`     | Action Required, Overdue     |
| Error     | `error-container`     | `error`       | Failed, Rejected, Cancelled  |

- **Radius:** `rounded-full` (pill shape always).
- **Size:** `Label MD` text, `py-0.5 px-3` padding.

### Role Colour Coding

| Role       | Accent             | Usage                               |
|:-----------|:-------------------|:------------------------------------|
| Tutor      | `secondary` violet (`#d0bcff`) | Avatar ring, role badge background |
| Student    | `primary` blue (`#adc6ff`)     | Highlighted rows, ID badges        |
| Parent     | `tertiary` orange (`#ffb599`)  | Contact tags, parent portal links  |
| Admin      | White (`#FFFFFF`)  | Super-admin indicator               |

---

## 6. Layout Principles

### Grid System

- **Dashboard Shell:** Fixed sidebar (240px) + fluid content area.
- **Content Area Grid:** 12-column grid at `max-width: 1440px`, centered.
- **Stat Cards Row:** 4-column grid for top KPI summary, collapses to 2×2 on tablet.
- **Main Content Split:** 60% data panel / 40% activity feed (where applicable).

### Spacing Scale

- Base unit: `4px` (`spacing-1`). All margins/padding are multiples of 4.
- **Section Vertical Padding:** `py-16` (4rem) desktop minimum; `py-24` (6rem) for landing page sections ("Premium Gap" rule).
- **Card Internal:** `p-6` (1.5rem); sub-elements `gap-4` (1rem).
- **Hero Sections:** `py-40` (10rem) top padding for maximum brand authority.

### Whitespace Philosophy

> **"If in doubt, double the padding."**

- Use whitespace as a functional tool — it communicates hierarchy.
- Landing pages use `160px` vertical padding between sections.
- Cards surface content with at minimum `24px` internal padding.
- Crowding is prohibited: if a screen feels busy, increase the surface-to-content ratio.

### Responsive Breakpoints

| Breakpoint | Min-Width | Layout Behaviour                               |
|:-----------|:----------|:-----------------------------------------------|
| `mobile`   | —         | Single column, sidebar becomes bottom nav       |
| `tablet`   | `768px`   | 2-column grid, condensed sidebar               |
| `desktop`  | `1024px`  | Full layout with fixed sidebar                 |
| `wide`     | `1440px`  | Max-width container locks, extra whitespace    |

---

## 7. Motion & Animation

### Principles

- Animations should feel **purposeful**, not decorative.
- Duration cap: `300ms` for micro-interactions, `600ms` for page transitions.
- Prefer `ease-out` for entrances, `ease-in-out` for continuous loops.

### Keyframe Library

```css
/* Staggered Reveal — for dashboard card entrance */
@keyframes staggerFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Apply with: animation-delay: calc(var(--i) * 80ms) */

/* Scanning Line — for data-heavy sections */
@keyframes scanLine {
  0%   { transform: translateY(-100%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(100vh); opacity: 0; }
}
/* Electric Blue glow: 2px height, rgba(173,198,255,0.15) */

/* Breathing Glow — for active/selected states */
@keyframes breatheGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(77,142,255,0.3); }
  50%       { box-shadow: 0 0 24px rgba(77,142,255,0.6); }
}

/* Magnetic Hover — for CTA buttons */
/* Apply transform: scale(1.02) on hover with transition: 200ms ease-out */
```

---

## 8. Specialist SaaS Patterns

### Student Identity Badges

- Circular avatar (40px / 64px / 80px depending on context).
- Role colour ring (2px border): Blue for Students, Violet for Tutors, Orange for Parents.
- Name in `Headline SM`, role in `Label MD` uppercase.
- Attendance rate shown as a radial progress chip alongside.

### Booking / Session Cards

- Time displayed in **24-hour format** (e.g., `15:30 - 17:00`).
- Session name in `Body LG` bold; location in `Label MD` muted.
- Coloured left-border accent for session type (club category colour).

### Assessment Workflow (Multi-Step)

- Step indicator uses horizontal stepper: numbered circles, active in `primary`.
- Review screen shows a summarised card for each completed step.
- Destructive actions (cancel booking) require a confirmation modal.

### KPI Stat Cards

- Large number in `Display MD` white, metric name in `Label LG` muted.
- Supporting trend (`+28%`) in `body-sm` with coloured arrow: green for growth, `tertiary` for neutral, `error` for decline.
- Cards use `surface-container` background with `rounded-2xl` and `20px 50px rgba(0,0,0,0.5)` shadow.

---

## 9. Do's and Don'ts

### ✅ Do
- Use **surface nesting** — inner cards are always lighter (higher surface token) than their parent.
- Use `primary` colour exclusively for **primary interactive elements** — the eye should be drawn to it.
- Show accessibility: ensure text-to-background contrast ≥ 4.5:1 for body text.
- Use Material Symbols (Outlined) for all iconography. Match `on-surface-variant` colour.

### ❌ Don't
- **Don't use 100% opaque borders** for sectioning. It breaks the "Void" illusion.
- **Don't use pure black** (`#000`). Use `#0e0e0e` at darkest.
- **Don't use horizontal/vertical-offset drop shadows.** Shadows must be centred and large-radius.
- **Don't crowd the layout.** Increase surface-to-content ratio if a screen feels busy.
- **Don't mix light-mode and dark-mode components** in the same screen without a clear mode decision.

---

## 10. Stitch Project References

| Project                         | ID                    | Last Updated   |
|:--------------------------------|:----------------------|:---------------|
| After-School Club CMS           | `1638800519015830521` | 2026-03-19     |
| Dashboard Overview (SprintScale)| `10562091658058307698`| 2026-03-19     |
