# Header Polish Worker Task

- Objective: Implement R3 Header Polish.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_header`
- Tasks:
  1. Header Border:
     - In `src/components/dashboard/Header.tsx`, edit the header element border class. Change the border from a solid `border-border` to a semi-transparent border `border-border/60` (or `border-sidebar-border/60`).
  2. Search Bar:
     - Upgrade the search input container `form` in `Header.tsx` to have a height of `h-10`, a border radius of `rounded-2xl` (18px) instead of `rounded-xl`, and an Apple-quality backdrop/focus ring (verify focus rings and opacity).
  3. Notification Badge:
     - Update the notification bell unread badge in `Header.tsx` to include `animate-pulse` or `animate-ping` or double-badge treatment (a solid badge on top of an `animate-ping` ring) to make it premium and dynamic.
  4. User Avatar Button:
     - Refine the user avatar / initials button in `Header.tsx` to have a clean hover state `ring-2 ring-border hover:ring-primary/40` and `transition-all duration-200`. The initials text must use `font-semibold text-sm tracking-tight`.
  5. User Dropdown Menu:
     - Refine the dropdown menu class. Change its shadow to `shadow-2xl` and border radius to `rounded-2xl` (using popover theme variables, border, and slide-in entry animation).
  6. Theme Toggle:
     - Implement the theme toggle button in `Header.tsx` next to the notifications button. Load active theme from `localStorage` on mount. Add state for `'light' | 'dark' | 'system'`. Set appropriate classes (`light` / `dark`) on `document.documentElement` based on the active theme, and render the Sun (light), Moon (dark), or Cloud (system) Lucide icon. Ensure the button has a tactile transition scaling style: `active:scale-95 transition-transform duration-200`.
  7. Verify changes compile and all 129 vitest unit tests pass.
