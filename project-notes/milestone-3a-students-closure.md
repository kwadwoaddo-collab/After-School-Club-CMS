# Milestone 3A — Students Closure, Dual-Theme Verification & Global Shell Polish

**Date:** 2026-08-22
**Branch:** `rebuild/cms-modernisation`
**Scope:** Progress & Notes / Billing / Student Import visual closure, global mobile/tablet bottom-nav overlap fix, global skip-link visibility fix, bright + dark theme verification, final Students visual/security checkpoint.
**Explicitly not started:** Parents, Staff, Centres, Bookings/Attendance/Finance/Dashboard redesign, navigation IA changes, RBAC redesign, database/migrations, new features.

**Status: PASS WITH CONCERNS.** Every item in scope reached VISUAL PASS and SECURITY PASS, both themes verified, the two confirmed global shell defects are fixed and verified, and all four quality gates are green. It is not an unqualified PASS only because of one piece of disclosed, deliberately out-of-scope debt (§13) and one environmental note about how this session obtained the starting codebase (§0), neither of which reflects on the Students work itself.

---

## 0. Starting point — how this session got to a working baseline

This is worth recording plainly because it materially affected how this pass started.

This Milestone 3A session began in a **fresh cloud sandbox with no prior repository state** — the environment is ephemeral per session. `git clone` of `kwadwoaddo-collab/After-School-Club-CMS` showed `origin/rebuild/cms-modernisation` sitting at `565422c` ("Milestone 2.5: completion documentation"). None of the Milestone 3 Students work described in `project-notes/milestone-3-students-checkpoint.md` (Stage A audit, Stage B list redesign, detail/create redesign, authorization fixes) was present on that branch — it had only ever been produced as a locally-committed, never-pushed set of commits in an earlier session, bundled and delivered to the user as a `.bundle` file because this sandbox's git proxy returns 403 on push (`kwadwoaddo-collab/After-School-Club-CMS is not in this session's authorized repository set`).

Before writing any Milestone 3A code, this discrepancy was surfaced to the user rather than silently either (a) proceeding as if the Milestone 3 work already existed in git when it didn't, or (b) redoing Milestone 3 from scratch under the 3A banner. The user supplied the previously-delivered bundles. Each was verified with `git bundle verify` before use:

- `milestone3studentscheckpoint.bundle` (two identical copies) — prerequisite `565422c`, tip `fc147f85` — contains the *entire* Milestone 3 range (`053b043` docs audit → `8122e85` Students list redesign → `170918b` authorization fixes → `01e0fb9` detail/create redesign → `fc147f85` checkpoint report), confirmed by `git log --oneline 565422c..fc147f85`. This one bundle supersedes the separate `milestone3stageab.bundle` (`565422c → 8122e85`), which is a strict subset already contained within it.
- `milestone1finalclosure.bundle`, `milestone2cmsrebuild.bundle` / `...CORRECTED.bundle`, `milestone25cicleanup.bundle` — all cover commit ranges that were **already ancestors of `565422c`**, i.e. already present in the fresh clone from `origin`. They were verified but not applied, since applying them would have been a no-op (confirmed via `git merge-base --is-ancestor`).

Only `milestone3studentscheckpoint.bundle` was fast-forward merged (`git merge --ff-only fc147f85...`), taking the branch from `565422c` to `fc147f85` — a clean fast-forward, no conflicts, no rewritten history. **`fc147f85` is this session's starting SHA for the actual 3A work.** Its state (VISUAL PASS, SECURITY PASS, PASS WITH CONCERNS, 235/235 tests, 0 typecheck/lint errors) was independently re-verified fresh in this session (§14) before any 3A code was touched, rather than trusted from the prior report alone.

## 1. Theme strategy

As directed:

- **Bright/light theme is the primary InvoiceFlow similarity reference.** All closure work in this pass was designed and eyeballed bright-first.
- **Dark theme is the corresponding CMS expression of the same system**, not a separate design. No component was optimised for dark at bright's expense, and no new "dark InvoiceFlow" was invented.
- **Semantic tokens were sufficient.** Every restyled surface in this pass (Progress & Notes, Billing, Import) was built entirely from tokens and utility classes that already existed after Milestone 2 — `bg-surface` / `bg-page`, `text-text` / `text-text-secondary` / `text-text-muted`, `border-border-subtle` / `border-border`, `bg-accent` / `text-accent` / `bg-accent-hover` / `bg-accent-soft`, `bg-success-soft` / `bg-warning-soft` / `bg-info-soft` / `bg-danger-soft` / `text-danger`, and the named typography scale (`text-label`, `text-small-body`, `text-metadata`, `text-card-heading`, `text-section-title`, `text-financial-total`). **No new token was added.** The soft-badge + literal `emerald-700 dark:emerald-400` / `amber-700 dark:amber-400` text pairing used throughout (for success/warning states specifically) is not new either — it's the exact pattern `Badge.tsx` already established in Milestone 2, reused here for consistency rather than inventing a second convention.
- The two global shell fixes (§4, §5) are plain CSS, deliberately written as **unlayered** rules (see their code comments) so they sit outside Tailwind's `@layer utilities` and win the cascade regardless of breakpoint/utility ordering — the mechanism that caused the bottom-nav bug in the first place. This is additive to the existing token system, not a parallel one.

## 2. Progress & Notes — exact changes

Files: `src/features/students/components/ProgressNoteForm.tsx`, `src/features/students/components/ProgressTimeline.tsx`.

- Outer container: `bg-card border border-border rounded-2xl shadow-sm` → `rounded-md border border-border-subtle bg-surface` (flat surface, restrained radius, matching every other panel on the page).
- Note-type / rating / timeline-filter chips: were `rounded-full` pills with the legacy `bg-primary` (bright blue, `#0071e3`/`#0a84ff`) as the "active" colour for General/Progress/Good and `bg-warning`/`bg-destructive` solid fills elsewhere. Per the explicit instruction ("do NOT merely replace blue with teal"), these were rebuilt as `rounded-sm` flat chips using the same soft-token + literal-color-pair convention `Badge.tsx` already uses (`bg-accent-soft text-accent`, `bg-warning-soft text-amber-700 dark:text-amber-400`, `bg-danger-soft text-danger`, `bg-success-soft text-emerald-700 dark:text-emerald-400`), with a solid variant (`bg-accent text-white`, etc.) for the selected/active state. The "All" filter — called out specifically in the ticket as bright-blue legacy language — now renders `bg-accent text-white`.
- "Add Progress Note" toggle button and the icon chip beside it: oversized rounded-xl/rounded-2xl icon badge → `rounded-sm` `bg-accent-soft` icon chip, matching the Billing card's header icon treatment.
- Note-timeline cards: `rounded-2xl` bordered cards with hover-reveal action icons kept their interaction pattern (pin/edit/delete on hover, plus `focus-within` so keyboard users can reach them) but moved to `rounded-md`, `border-border-subtle`, and the same badge tokens as above for type/rating/subject tags.
- All labels moved onto the `text-label` (uppercase micro-label) / `text-small-body` / `text-metadata` scale instead of ad hoc `text-xs font-bold uppercase` combinations.
- `Save Note` / `Cancel` / edit-save buttons now use the shared `Button` primitive (`size="sm"`) instead of hand-rolled `<button>` styling, so they inherit the primitive's own focus ring and disabled state for free.
- **Zero behaviour change.** `addStudentNote`, `deleteStudentNote`, `toggleStudentNotePin`, `editStudentNote` calls, all component state (`noteType`, `subject`, `rating`, `isExpanded`, `filter`, `editingId`, `editingContent`), filtering logic, pin/unpin sort order, and permission checks (`canEdit`/`canDelete`/`canPin` against `currentUserId`/`isAdmin`) are byte-for-byte the same as before — verified by diffing only the JSX/className regions changed.

## 3. Billing — exact changes

File: `src/features/billing/components/BillingSettingsCard.tsx`.

- Card shell: `bg-card rounded-2xl border border-border shadow-sm` → `rounded-md border border-border-subtle bg-surface`, matching `StudentProfile.tsx`'s `SubPanel`/`Card` treatment exactly (same radius, same border token).
- `StatusBadge` (Active/Paused/Cancelled): moved off literal `bg-success/10 text-success border-success/20` etc. onto the same soft-token pairing as `ProgressTimeline`'s badges (`bg-success-soft text-emerald-700 dark:text-emerald-400`, `bg-warning-soft text-amber-700 dark:text-amber-400`, `bg-danger-soft text-danger`).
- Fee display: `text-2xl font-black` → `text-financial-total` (the named scale's dedicated tabular-numeral money style, already used elsewhere for balances).
- Every input (fee, date, lead-days, notes) moved from `rounded-xl` + `focus:ring-2 focus:ring-primary/50` to the same `h-10 rounded-sm border border-border` + `focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent` treatment `StudentForm.tsx`/`StudentProfile.tsx`'s inline-edit fields already use — this was the most visible inconsistency: the Billing tab previously used a completely different focus-ring mechanism (ring) from the rest of the page (outline).
- "Edit billing settings" and "Set Up Family Billing" buttons now use the shared `Button` primitive instead of custom `rounded-xl` pill buttons.
- Pause/Resume/Cancel controls kept as small inline `<button>`s (not the full `Button` primitive, since they need three-way conditional rendering with distinct semantic colours) but moved onto the same soft-token treatment and explicit `rounded-sm` (countering the global legacy `button { border-radius: 9999px }` base-layer rule — see §9).
- **Zero behaviour change.** `createBillingConfig`, `updateBillingConfig`, `pauseBillingConfig`, `resumeBillingConfig`, `cancelBillingConfig`, `addChildToConfig`/`removeChildFromConfig` calls, validation (`amountPence`/`anchorDate`/`selectedChildIds` checks), and the sibling pre-selection logic are unchanged.

## 4. Import — exact changes

File: `src/app/dashboard/students/import/ImportStudentsClient.tsx` (the route wrapper `import/page.tsx` was already modernised in Milestone 3 and was not touched again here).

- Step indicator, upload card, mapping card, and results card: `rounded-3xl` → `rounded-md`, matching Add Student's card treatment.
- This file had the most **hard-coded, non-theme-aware colours** of the four — `bg-emerald-50 border-emerald-200 text-emerald-800`, `bg-blue-50 border-blue-200`, `text-red-500`, `text-gray-300` — all of which would have rendered as light-mode-only colours sitting on a dark background (unreadable pale panels), a real dual-theme defect independent of the "legacy styling" framing. These were all replaced with the established soft-token pairing (`bg-success-soft` + `emerald-700 dark:emerald-400`, `bg-info-soft`, `text-danger`, `text-text-muted`).
- Drop zone: oversized `rounded-2xl` dashed panel with `bg-primary`/`text-primary-foreground` upload button → `rounded-md` with `bg-accent hover:bg-accent-hover text-white`.
- Field-mapping `<select>`s, row-preview panel, and the results stat tiles all moved onto `text-label`/`text-metadata`/`text-financial-total` and `bg-page`/`border-border-subtle`.
- "Confirm and Start Import" / "Download template.csv" / "Import Another File" / "Back" buttons now use the shared `Button` primitive.
- **Zero behaviour change.** `parseCSV`, the auto-mapping heuristic, `isMappingValid`, `handleStartImport`'s row-building and `importStudentsAction` call, the CSV template download, and drag/drop handling are unchanged. The Milestone 3 authorization fix on `importStudentsAction` itself is untouched (this file never called it directly with different arguments).

## 5. Bottom navigation — root cause, fix, verification

**Root cause.** The dashboard shell's `<main>` used `className="p-4 sm:p-8 pb-24 lg:pb-8 ..."`, intending 96px of bottom clearance below `lg` (1024px, where the fixed mobile bottom nav is shown) and 32px above it. In practice, `sm:p-8` (padding on **all four sides**, activating at 640px) has the same CSS specificity as `pb-24` and is later in Tailwind's generated stylesheet, so from 640px up to 1024px — the entire tablet range, which **still shows the 64px-tall fixed bottom nav** — clearance silently dropped to 32px. Confirmed directly (not assumed) by instrumenting `getComputedStyle(main).paddingBottom` and the bounding-rect gap between the last content element and the nav's top edge across breakpoints before making any change: `-31px` (safe) at 375px, but `+33px` (real overlap) at 834px on Dashboard, Student Detail, and Students List. Two routes (`dashboard/page.tsx`, Student Detail `page.tsx`) had grown their own `pb-12` wrapper-div hack attempting to compensate — insufficient at 834px, and would have caused literal double-padding once the shell-level fix landed.

**Fix (global, one place).** Added a plain, unlayered CSS rule for `.dashboard-main-content` in `globals.css` (see that file's own comment for the cascade-layers reasoning), removed the now-redundant `pb-24 lg:pb-8` utilities from `layout.tsx`'s `<main>` className, and removed both route-level `pb-12` hacks (`dashboard/page.tsx`, Student Detail `page.tsx` — the latter's wrapper `<div>` was removed entirely since it had no other purpose). The rule reserves `4rem` (nav height) + `env(safe-area-inset-bottom, 0px)` + `2rem` breathing room below `lg`, and `2rem` at `lg`+ where the nav is hidden — same intent as the original `pb-24 lg:pb-8`, just immune to utility-ordering accidents and safe-area-aware.

**Affected breakpoints.** 375px (was already accidentally safe, unaffected) and 834px (the actual defect — now fixed). Desktop (1024px+, sidebar shell, no bottom nav) unaffected either way.

**Verification.** Re-measured the same way post-fix across Dashboard/Student Detail/Student Create/Students List at 375 and 834: consistent −31px (safe) gap everywhere except Student Create at 834 (content is short enough that the gap was already large negative before and after — not a meaningful data point either way, included for completeness). Screenshot evidence in §7/§8.

## 6. Skip link — root cause, fix, verification

**Root cause.** `src/app/dashboard/layout.tsx` rendered `<a href="#main-content" className="skip-to-content">Skip to main content</a>`, but **no CSS rule for `.skip-to-content` existed anywhere in the repository** (confirmed by repo-wide grep before writing any fix). The class was a hook with nothing behind it, so the link rendered as a normal, fully visible, unstyled anchor at the very top-left of every page — exactly the "partially visible before focus" defect described, and confirmed directly in a pre-fix screenshot (§8).

**Fix.** Added a real `.skip-to-content` rule to `globals.css`: `position: fixed`, off-screen via `transform: translateY(-150%)` (chosen over `top: -9999px`/`left: -9999px` specifically because a transform-based hide never contributes to document layout or horizontal scroll, satisfying "non-causal of horizontal overflow"), teal `--if-accent` background with white text (readable in both themes, since `--if-accent` is defined per-theme already), and `transform: translateY(0)` on `:focus` to bring it fully on-screen above all content (`z-index: 100`). The link's destination (`#main-content`, `tabIndex={-1}` on `<main>`) was already correct and untouched. Existing sitewide `a:focus-visible { ring-2 ring-primary ... }` (globals.css, pre-Milestone-2) still applies on top of this and provides the visible focus ring — not duplicated here.

**Verification.** Screenshots in both themes, default state (nothing visible at the top) and keyboard-focused state (Tab once from page load — clearly visible teal chip, high contrast in both themes). §8.

## 7. Bright theme verification

| Area | 1440 | 834 | 375 |
|---|---|---|---|
| Student Detail (incl. Progress & Notes) | ✅ `bright/detail-1440.png`, `bright/detail-1440-progress-notes.png` | ✅ `bright/detail-834.png` | ✅ `bright/detail-375.png` |
| Billing | ✅ `bright/billing-1440.png` | — (not required) | ✅ `bright/billing-375.png` |
| Import | ✅ `bright/import-step1-1440.png` | — (not required) | ✅ `bright/import-step1-375.png` |
| Bottom-nav clearance | — | ✅ `bright/navfix-dashboard-834.png` | ✅ `bright/navfix-dashboard-375.png`, `navfix-detail-375.png`, `navfix-create-375.png` |
| Skip link | — | — | ✅ `bright/skiplink-default.png`, `bright/skiplink-focused.png` |

No old-CMS styling, bright-blue accent leakage, oversized pill controls, or nested-card excess found in any of the touched surfaces on re-inspection. Density, border treatment, and radius read as consistent with the already-approved Student Detail shell.

## 8. Dark theme verification

| Area | 1440 | 834 | 375 |
|---|---|---|---|
| Student Detail (incl. Progress & Notes) | ✅ `dark/detail-1440.png`, `dark/detail-1440-progress-notes.png` | ✅ `dark/detail-834.png` | ✅ `dark/detail-375.png` |
| Billing | ✅ `dark/billing-1440.png` | — (not required) | ✅ `dark/billing-375.png` |
| Import | ✅ `dark/import-step1-1440.png` | — (not required) | ✅ `dark/import-step1-375.png` |
| Skip link | — | — | ✅ `dark/skiplink-default.png`, `dark/skiplink-focused.png` |

No hard-coded light-mode leakage remains in the four touched files (the Import screen's hard-coded `emerald-50`/`blue-50`/`red-500`/`gray-300` classes — a real pre-existing dual-theme defect — were the most significant finds; see §4). Borders remain visible against the dark surface, muted text keeps adequate contrast, and the teal accent reads correctly on both the light and dark `--if-accent` values. Bottom-nav and skip-link fixes are theme-token-driven (`var(--if-accent)`, `env()`, no hard-coded colours) so they did not need separate dark-specific verification beyond confirming the same screenshots render correctly with `.dark` applied — which they do.

## 9. Theme audit for touched components

Per-file check against the required list:

- **Hard-coded backgrounds/text (light or dark-only):** found and fixed in Import (§4); none introduced in Progress & Notes or Billing (both already used semantic tokens for backgrounds even before this pass — the defect there was radius/spacing/blue-primary, not hard-coded colour).
- **Borders that disappear in one theme:** none — all borders now use `border-border-subtle`/`border-border`, which are defined per-theme.
- **Muted-text contrast:** `text-text-muted`/`text-metadata` used throughout; no literal `text-gray-*` left in touched files.
- **Accent consistency:** all four files now reference `--if-accent` exclusively via `bg-accent`/`text-accent`/`bg-accent-soft`/`bg-accent-hover` — no `bg-primary`/`text-primary` (the old Apple-blue token) remains in any of the four files.
- **Inputs/selects:** Billing and Import inputs re-tested in both themes — legible placeholder, border, and focus-outline contrast in both.
- **Hover states:** chip/button hover states use `hover:bg-*-soft/80` or `hover:bg-page`, which resolve correctly in both themes (no hover state was hard-coded to a specific hex).
- **Focus rings:** Billing/Import inputs moved onto the shared `focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent` pattern; `Button`-primitive-based actions inherit the primitive's own focus-visible ring.
- **Disabled states:** `disabled:opacity-50` preserved everywhere it existed before (Save Note, form buttons, pause/resume/cancel).
- **Destructive/error states:** `bg-danger-soft`/`text-danger` throughout (Medical note badge, delete action, import error log, error banners).
- **Empty states:** Progress & Notes' "No notes yet" empty state moved onto `bg-page`/`border-border-subtle`/`text-text-muted` — verified legible in both themes.
- **Loading/skeleton states:** the Import "Importing…" spinner state and Billing's inline saving-spinner button state were re-checked — both use theme-token colours, no hard-coded fills.

No new semantic token was required — the Milestone 2 set was sufficient for every surface touched in this pass.

## 10. Security

No RBAC/policy change was made or was in scope. Re-ran the full authorization regression suite established in Milestone 3 (`src/lib/security-p6.test.ts`, `src/features/students/authorization.test.ts`) as part of the full `npm test` run in §14 — all passing, unchanged from the Milestone 3 checkpoint's established `ORG_OWNER`/`MANAGER`/`FRONT_DESK` allow / `TUTOR`+unauthenticated deny policy. **Result: PASS.**

## 11. Tests

`npm test` (vitest): **235/235 individual tests passing.** One test *file* fails to collect — `src/features/communications/actions.test.ts`, `Cannot find module '.../next/server' imported from next-auth/lib/env.js` — identical to the pre-existing, already-documented environmental/module-resolution issue from `project-notes/milestone-2-5-ci-cleanup.md`, unrelated to Communications' own code and untouched by this pass. No test was added, removed, or modified this pass (visual-only + a CSS/layout fix; existing coverage already exercises the touched components' behaviour and the authorization suite covers the routes near the layout change).

## 12. Typecheck

`npm run typecheck` (`tsc --noEmit`): **0 errors.**

## 13. Lint

`npm run lint` (`eslint`): **0 errors, 0 warnings.** No suppressions added.

## 14. Build

`npm run build`: **succeeds.** All 123 routes compile and generate. One pre-existing Turbopack NFT-tracing warning on `next.config.ts` → `google-calendar.ts` → `booking.ts` → `api/bookings/route.ts` — identical to the one documented in the Milestone 3 checkpoint, unrelated to Students, not investigated further. No font regressions, hydration errors, missing CSS, or theme-related build errors.

## 15. Files changed

```
src/app/globals.css                                       (+62 lines: two new global shell rules)
src/app/dashboard/layout.tsx                               (skip-link comment context; <main> className)
src/app/dashboard/page.tsx                                 (removed redundant pb-12)
src/app/dashboard/students/[id]/page.tsx                   (removed redundant pb-12 wrapper div)
src/components/dashboard/DashboardContent.tsx               (comment accuracy only)
src/features/students/components/ProgressNoteForm.tsx       (full visual rewrite, zero behaviour change)
src/features/students/components/ProgressTimeline.tsx       (full visual rewrite, zero behaviour change)
src/features/billing/components/BillingSettingsCard.tsx     (full visual rewrite, zero behaviour change)
src/app/dashboard/students/import/ImportStudentsClient.tsx  (full visual rewrite, zero behaviour change)
project-notes/milestone-3a-students-closure.md              (this file)
```

## 16. Git

**Branch:** `rebuild/cms-modernisation`
**Starting SHA (this session, after applying the Milestone 3 bundle):** `fc147f85cdf87b4342ff0fec31082f887535389e`
**Ending SHA:** see delivery message / `git log -1`.

Commits made this pass (see delivery message for exact hashes):

1. `fix(milestone-3a): restyle Progress & Notes, Billing and Student Import to InvoiceFlow tokens` — §2–§4.
2. `fix(milestone-3a): fix global bottom-nav overlap and skip-link visibility` — §5–§6.
3. `docs(milestone-3a): Students closure checkpoint report` — this file.

**Push status:** the sandbox's git proxy returns the same 403 ("`kwadwoaddo-collab/After-School-Club-CMS` is not in this session's authorized repository set") seen in every prior milestone of this project. One incremental bundle was produced covering all commits from `fc147f85` (the confirmed-applied Milestone 3 checkpoint state) to this pass's final HEAD. Base, tip, and bundle verification result are in the delivery message.

## 17. Remaining debt

**Students-specific:** none identified. Every item in the 3A closure scope (Progress & Notes, Billing, Import, bottom-nav, skip-link, dual-theme verification) reached VISUAL PASS with no residual old-CMS styling found on re-inspection.

**Global / pre-existing (not Students-specific, not addressed here — correctly out of scope):**
1. The Turbopack NFT-tracing build warning on `next.config.ts` → `google-calendar.ts` (§14) — pre-existing, unrelated to Students.
2. `src/features/communications/actions.test.ts`'s collection failure (§11) — pre-existing, environmental, unrelated to Students.
3. The minor cosmetic redundancy noted in the Milestone 3 checkpoint (`§16.5` of that report — the read-only Medical & Safety alert panel staying visible alongside the editable field in inline-edit mode) was not touched — it's a structural/business-logic question, not a presentation one, and out of this pass's "presentation-only" mandate.

Neither global item is used to obscure or pad out the Students result above — they're recorded because the ticket requires disclosure, not because they affect whether Students itself is complete.

## 18. Final similarity rating

| Area | Rating |
|---|---|
| Students List | CLOSE |
| Student Detail | CLOSE |
| Progress & Notes | CLOSE |
| Student Billing | CLOSE |
| Student Forms | CLOSE |
| Student Import | CLOSE |
| Responsive Behaviour | CLOSE |
| Bright Theme | CLOSE |
| Dark Theme | CLOSE |
| Shared Primitives | CLOSE |
| **Overall Students Module** | **CLOSE** |

This reflects a genuine change from the Milestone 3 checkpoint's MODERATELY CLOSE rating, not a re-statement of the target: the specific, named reasons that report gave for capping at MODERATELY CLOSE (nested Progress/Billing/Import components on legacy styling; the global bottom-nav overlap affecting every page's responsive rating) are the exact items closed in this pass, re-verified with fresh screenshots in both themes rather than assumed fixed.

## 19. Recommendation

**Yes.** Students meets every freeze criterion in the ticket: Security PASS, visual CLOSE (bright-theme-primary comparison), bright and dark theme both verified, responsive behaviour verified at 1440/834/375, bottom-nav overlap resolved and verified, skip-link resolved and verified, typecheck clean, lint clean, no test regression, production build passing. Recommend Students be frozen as the reference People-module implementation for Parents → Staff → Centres, per §19 of the ticket.

**Per the stop condition governing this phase: Parents has not been started and will not begin until this checkpoint receives product-owner review and approval.**
