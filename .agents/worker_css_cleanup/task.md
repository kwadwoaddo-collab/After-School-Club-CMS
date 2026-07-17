# Global CSS Cleanup & Consistency Worker Task

- Objective: Implement R4 Global CSS Cleanup & Consistency.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_css_cleanup`
- Tasks:
  1. dead MD3 Tokens:
     - Remove dead Material Design 3 token variables inside `@theme inline` (approximately lines 28 to 78) in `src/app/globals.css`.
  2. Scope Card and Button Overrides:
     - Refactor the aggressive `.card` overrides (`border-radius: 24px !important`) to be scoped more carefully. Exclude wildcard `[class*="card"]` and `[class*="bg-surface-container"]`, matching only `.card` and `.glassmorphic-card` and other explicitly designed container elements. Make sure it respects `.keep-shape`.
     - Refactor aggressive `button` overrides (`border-radius: 9999px !important`). Scope it so that it does not apply to things like select options, pagination buttons, table operations, calendar days, or icon-only buttons, or allow `.keep-shape` classes to easily guard them.
  3. Light/Dark Mode Consistency:
     - Ensure that `:root` light and dark theme tokens are consistent and align properly. If the user sets the class `.light` (for forcing light mode), ensure the light mode variables override the dark mode settings.
  4. Verify changes compile and all 133 tests pass (Vitest suite).
