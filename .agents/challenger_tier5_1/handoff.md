# Handoff Report — challenger_tier5_1

## 1. Observation

During our white-box audit and dynamic execution of tests, we observed the following behaviors and files:

### A. Aggressive CSS Button Shape Override
- **File**: `src/app/globals.css` (lines 789-822)
```css
body:not(.landing-page-active) :is(
  button,
  .btn,
  [class*="btn-"],
  [class*="button-"],
  a[class*="bg-primary"],
  a[class*="bg-secondary"],
  a[class*="btn-"],
  input[type="submit"]
):not(
  .keep-shape,
  table *,
  [role="gridcell"] *,
  [role="row"] *,
  [class*="pagination"] *,
  [aria-label*="pagination"] *,
  [aria-label*="Pagination"] *,
  [role="combobox"],
  [role="combobox"] *,
  [role="menu"] *,
  [role="menuitem"] *,
  [role="option"] *,
  [class*="select"] *,
  select *,
  [class*="dropdown"] *,
  [class*="calendar"] *,
  [class*="picker"] *,
  [class*="rdp"] *,
  [class*="icon"] *,
  .icon-button,
  [aria-label*="icon"]
) {
  border-radius: 9999px !important; /* rounded-full pill shape */
}
```
- **File**: `src/components/dashboard/Header.tsx` (lines 463-479)
```tsx
<button
    suppressHydrationWarning
    onClick={() => setShowUserMenu(!showUserMenu)}
    className="flex items-center gap-3.5 px-3 py-1.5 rounded-xl hover:bg-secondary transition-all duration-200 mr-2 group"
    aria-label="User menu"
>
```
- **Test execution log** (from task-249):
```
User menu button border-radius: 9999px
Theme toggle button border-radius: 9999px
```

### B. Portal Dropdown Viewport Detachment
- **File**: `src/components/dashboard/Sidebar.tsx` (lines 58-68, lines 288-299)
```tsx
    const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

    const openCentreDropdown = () => {
        if (centreBtnRef.current) {
            const rect = centreBtnRef.current.getBoundingClientRect();
            setDropdownAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
        setDropdownOpen(o => !o);
    };
...
    {dropdownOpen && dropdownAnchor && portalMounted && createPortal(
        <>
            <div className="fixed inset-0 z-[199]" onClick={closeCentreDropdown} />
            <div
                className="fixed bg-popover border border-border rounded-2xl shadow-2xl z-[200] py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                style={{ top: dropdownAnchor.top, left: dropdownAnchor.left, width: dropdownAnchor.width }}
            >
                {dropdownContent}
            </div>
        </>,
        document.body
    )}
```
- **Test execution log** (from task-249):
```
btnRectBefore: { x: 20, y: 164, width: 215, height: 51 }
dropdownRectBefore: { x: 20, y: 219, width: 215, height: 244 }
btnRectAfter: null
dropdownRectAfter: { x: 20, y: 219, width: 215, height: 244 }
Active Centre button is no longer visible/mounted. Dropdown portal is now detached and floating.
```

### C. Theme Hydration Flash
- **File**: `src/components/dashboard/Header.tsx` (lines 48-57, lines 59-91)
```tsx
    const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
    const [themeMounted, setThemeMounted] = useState(false);

    useEffect(() => {
        setThemeMounted(true);
        const savedTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);
```

### D. TypeScript and Lint Cleanliness
- **Command**: `npx tsc --noEmit`
- **Result**: Finished successfully with exit code 0 and no output (from task-266).
- **Command**: `npm run lint`
- **Result**: Finished successfully with exit code 0 and no output (from task-46).

---

## 2. Logic Chain

1. **Aggressive CSS Overrides**: The CSS rule in `src/app/globals.css` applies a `border-radius: 9999px !important` to all `button` tags unless they match specific selector guards or have the `.keep-shape` class guard.
2. We inspected `src/components/dashboard/Header.tsx` and observed that the user profile menu button and theme toggle button have `rounded-xl` classes but do NOT carry the `.keep-shape` class.
3. Therefore, their shapes are overridden to `9999px` (circle/pill shape). This was verified in Playwright test console output indicating a computed `border-radius: 9999px`.
4. **Portal Dropdown Alignment**: The active centre dropdown in `src/components/dashboard/Sidebar.tsx` renders in `document.body` via `createPortal`. Its top/left/width properties are statically set in the `dropdownAnchor` state when the trigger button is clicked.
5. There are no resize or window event listeners updating this anchor position.
6. When the viewport is resized to mobile, the sidebar collapses and the trigger button is unmounted from the DOM. However, the portal dropdown remains visible at `x = 20, y = 219`.
7. This causes the active dropdown portal to float detached in space on mobile viewports.
8. **Theme Flash**: The header theme state is initialized to `'system'` and only synced with `localStorage` in a post-mount `useEffect`. On serverside or initial client render, the HTML lacks the `.dark` or `.light` class, defaulting to media-query-based dark mode settings, causing a style flash on mount if system preferences mismatch the saved local setting.

---

## 3. Caveats

- We did not modify any implementation code to resolve these visual/behavioral bugs, as our mandate is review-only.
- All testing runs were performed against a local production build running on port 3005 to bypass port conflicts with a background `next start` server already running on port 3001.

---

## 4. Conclusion

- The newly modified source files (`src/app/layout.tsx`, `src/components/dashboard/Sidebar.tsx`, `src/components/dashboard/Header.tsx`, `src/app/globals.css`) compile and lint cleanly.
- However, we discovered two visual/behavioral bugs:
  1. The aggressive global `button` border-radius override to `9999px !important` overrides `rounded-xl` buttons (like profile menu, theme toggle, active centre selector) to pills.
  2. The portal-based active centre dropdown lacks repositioning logic on window resize or layout updates, causing viewport detachment.
- We have hardened the coverage by writing 5 Playwright adversarial test cases in `tests/adversarial.spec.ts` targeting theme toggle persistence, viewport dropdown detachment, aggressive border-radius overrides, scroll backdrop transitions, and mobile overlay backdrop clicks. All tests run and pass successfully.

---

## 5. Verification Method

To verify these findings and execute the newly written adversarial tests:

1. Ensure the database is seeded:
   ```bash
   npm run db:seed
   ```
2. Run the adversarial Playwright tests:
   ```bash
   npx playwright test tests/adversarial.spec.ts --config=playwright.adversarial.config.ts
   ```
3. Inspect `tests/adversarial.spec.ts` to review the test scenarios written.
4. Verify TypeScript and lint checks:
   ```bash
   npx tsc --noEmit
   npm run lint
   ```
