# Typography Upgrade Worker Task

- Objective: Implement R1 Typography System upgrades.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_typography`
- Tasks:
  1. Edit `src/app/layout.tsx` to load Inter with weights `[400, 500, 600, 700, 800]` and `display: 'swap'`.
  2. Edit `src/app/globals.css` to add `font-feature-settings: "cv01", "ss01", "liga" 1` globally (e.g. inside `html` or `body` or `:root`).
  3. Refactor global heading overrides in `src/app/globals.css` to apply graduated letter-spacing (h1: `-0.04em`, h2: `-0.03em`, h3: `-0.02em`) and remove the aggressive `font-weight: 700 !important` overrides if they conflict with font hierarchy, or apply them elegantly. Ensure line-height is explicitly configured per text size tier (display: 1.05, headings: 1.1, body: 1.5, captions: 1.4).
  4. Verify changes compile and all 123 vitest unit tests pass.
