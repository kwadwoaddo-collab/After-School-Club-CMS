# Adversarial and Visual Gaps Fix Worker Task

- Objective: Fix visual and behavioral gaps identified by Tier 5 Challengers and verify tests.
- Working Directory: `/Users/kwadwo/Ai-lab/agent-os/After-School-Club-CMS/.agents/worker_adversarial_fix`
- Tasks:
  1. Fix active centre dropdown detachment bug:
     - In `src/components/dashboard/Sidebar.tsx`, add a `useEffect` that listens to window `resize` and `scroll` events, and to changes in the `collapsed` state, and closes the active centre dropdown safely (by setting `dropdownOpen` to `false`).
  2. Fix aggressive button overrides on squircle controls:
     - Add the `.keep-shape` class to the button elements in `src/components/dashboard/Header.tsx` (the user profile dropdown button, theme toggle button, and notifications button) and `src/components/dashboard/Sidebar.tsx` (the active centre dropdown selector buttons) so their designed `rounded-xl` shape is not overridden to pills.
  3. Fix theme hydration flash:
     - In `src/app/layout.tsx`, inject an inline blocking theme script in the `<head>` (using `dangerouslySetInnerHTML`) that checks `localStorage` and `prefers-color-scheme` pre-mount and synchronously adds the `.dark` or `.light` class to `document.documentElement` before rendering the HTML body.
  4. Refactor adversarial tests:
     - In `tests/adversarial.spec.ts` and `tests/adversarial2.spec.ts`, update the assertions. Instead of asserting that the bugs exist, assert that:
       - The active centre dropdown is closed (hidden) after resizing the viewport.
       - The user menu button, theme toggle, and notification buttons have correct squircle border-radii (not `9999px`).
  5. Run and verify all 133 unit tests and all Playwright tests pass successfully.
