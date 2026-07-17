# Sidebar Polish Worker Task

- Objective: Implement R2 Sidebar Polish.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_sidebar`
- Tasks:
  1. Active nav item accent bar:
     - In `src/components/dashboard/Sidebar.tsx`, edit the active nav item link styling to include a 2-3px left accent bar (e.g., using a pseudo-element `before:absolute before:left-0 before:top-1/4 before:h-1/2 before:w-1 before:bg-primary before:rounded-r-md` or `border-l-2 border-primary` with suitable adjustments so the pill background is maintained).
  2. Org logo badge:
     - Update the organization logo container in `Sidebar.tsx` to use a refined gradient like `bg-gradient-to-br from-primary to-primary/80` or with a subtle inner shadow/border ring for depth.
  3. Nav item spacing:
     - Evaluate and adjust the spacing of navigation items. Change the outer nav container from `space-y-0.5` to `space-y-1`, and change the item link padding from `py-3` to `py-2.5`.
  4. Quick Links section label:
     - Refine the text colors/contrast and tracking for section headers. In `Sidebar.tsx` (or other sidebar files), increase contrast for nav section labels (e.g. `text-muted-foreground/80`) and tracking to `tracking-[0.12em]`.
  5. Collapsed mode tooltips & icons:
     - Center icons in collapsed mode with `mx-auto` (rather than `justify-center` on the link or with side margin issues) and verify or add a hover tooltip (via `title` or similar) for collapsed nav items and centre selector button.
  6. Sidebar Footer:
     - Add a clean user profile area at the bottom of the sidebar displaying the user's avatar/initials, name, and role. Ensure it is responsive, fits well inside the sidebar layout without clipping, and has a tooltip in collapsed mode.
  7. Verify changes compile and all 123 vitest unit tests pass.
