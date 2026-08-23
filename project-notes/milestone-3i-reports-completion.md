# Milestone 3I — Reports — Completion Report

## 1. Milestone

CMS Rebuild — Milestone 3I: Reports

**Repo**: `kwadwoaddo-collab/After-School-Club-CMS`
**Branch**: `rebuild/cms-modernisation`

## 2. Starting state

Verified before any edit: `git status` clean, `git branch --show-current` = `rebuild/cms-modernisation`, `git rev-parse --short HEAD` = `403a194`, matching the ticket's authoritative expected starting state exactly. A `git fetch origin rebuild/cms-modernisation` additionally confirmed `origin/rebuild/cms-modernisation` had been updated to `403a194` externally (branch reported "up to date with origin" after the fetch) — corroborating the ticket's claim that Milestone 3H had been imported/pushed since this session last touched git. No reset/rebase/amend/stash/cherry-pick/merge/history-rewrite was performed or needed.

## 3. Surface inventory

Full Stage-A audit: `project-notes/milestone-3i-reports-audit.md` (mirrored to the Claude Project). Summary: Reports is a single dashboard page (`src/app/dashboard/reports/page.tsx`) with two tabs — "Activity Report" (a date-ranged executive summary: KPI cards, new-registrations table, new-bookings table, attendance-by-centre table, pending-actions table, and a client-side print-to-PDF export) and "Data Exports" (two CSV downloads: bookings and students). Behind these: one weekly-report server action (`src/features/reports/weekly-report.action.ts`), two export server actions living in sibling frozen-module files (`getExportData` in `bookings/actions.ts`, `getStudentExportData` in `students/actions.ts`, both used exclusively by Reports), three standalone CSV API routes (`/api/reports/{attendance,bookings,students}`), one client-only PDF generator (`src/lib/pdf-report.ts`), and two pieces of dead/orphaned code discovered incidentally (`src/features/reports/queries.ts` and `src/components/dashboard/DataExportSection.tsx` — both documented, neither touched). Reports surfaces no financial/revenue data of any kind — the Finance-report audit section is not applicable.

## 4. Data-source map

Registrations (`registrations`/`registrationChildren`/`registrationParents`), Bookings (`bookings`/`bookingAttendees`), Students/Parents (`children`/`parents`), and Centres/Organisations for scoping — all read-only, no writes anywhere in this module. Full join paths and per-metric source tables are in the audit doc §B.

## 5. Report/metric definitions

Every metric was traced to its exact source query and cross-checked for the classic reporting errors (fan-out double-counting, cancelled/void inclusion, `centre=all` widening, label-vs-status filtering). One metric ("Sessions Run") was found to measure distinct *bookings* rather than distinct *session occurrences* — checked against the frozen Bookings/Attendance modules for an established precedent to compare against (none exists; this is a Reports-original metric) and classified as a **documented ambiguity, not changed**, since the current computation is a defensible reading of the label and no established semantic is being violated (audit §C.1). No metric definition was invented or altered.

## 6. Date/time semantics

Server-local timezone throughout (no explicit UTC conversion anywhere in the codebase — consistent, pre-existing, org-wide behaviour). Inclusive `startOfDay`/`endOfDay` date-range boundaries, 90-day max range, end-before-start rejected. Two independent time bases are used and clearly separated: session date (`bookings.startAt`) for attendance/sessions-run figures, and creation date (`*.createdAt`) for new-registrations/new-bookings activity counts — this is intentional and documented, not a bug (audit §D).

## 7. Authorization matrix

| Surface | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| `/dashboard/reports` page | ✅ | ✅ | ❌ | ❌ |
| Activity Report (`getWeeklyReport`) | ✅ | ✅ | ❌ | ❌ |
| Bookings CSV export (Reports tab) | ✅ | ✅ | ✅ → **❌ (fixed, O.1)** | ❌ |
| Students CSV export (Reports tab) | ✅ | ✅ | ✅ → **❌ (fixed, O.3)** | ❌ |
| `/api/reports/attendance` | ✅ | ✅ | ❌ | ❌ |
| `/api/reports/bookings` | ✅ | ✅ | ❌ | ❌ |
| `/api/reports/students` | ✅ | ✅ | ❌ | ❌ |

The two "✅ → ❌" rows are O.1/O.3 — both server actions previously blocked only TUTOR; a FRONT_DESK caller could invoke them directly (independently of the page-level redirect) and receive a full org-wide export. Fixed to match the page gate and the three API routes, which were already correct.

## 8. Organisation isolation

Every surface carries an explicit, independent organisation filter. No client-suppliable ID exists anywhere in Reports that could be tampered with to cross organisations — the Activity Report accepts only two date strings, and both CSV export flows accept no parameters at all. No organisation-isolation defect found (audit §J).

## 9. Centre isolation

Reports has **no client-supplied centre parameter anywhere** — no centre dropdown, no `centre` query param, nothing to widen or tamper with via `centre=all` or a crafted ID. This eliminates that entire class of risk structurally. The centre-scoping gaps that did exist were a complete *absence* of centre filtering in three surfaces rather than a bypassable one:

- **O.2** — `getExportData()` (bookings CSV, Reports tab): org-gated only, no centre restriction at all. Fixed to match the frozen Bookings list page's own established "all centres → `inArray(bookings.centreId, accessibleCentreIds)`" pattern.
- **O.4** — `getStudentExportData()` (students CSV, Reports tab): same gap. Fixed to match the frozen Students list page's own established "`inArray(children.centreId, accessibleCentreIds) OR children.centreId IS NULL`" pattern (children can be centre-less).
- **O.6** — `GET /api/reports/students`: unlike its own two sibling routes in the same directory (which both already scoped correctly), this one did not. Fixed to mirror them, plus the same centre-less-child handling as O.4.

**Live-verified** (Stage C, §12 below): a MANAGER with access to Main Campus + Secondary Campus, but *not* a third centre (Riverside Annex, which holds 1 student and 0 bookings in the seeded dataset), received exactly the students/bookings belonging to their two accessible centres in both exports — Riverside Annex's record did not appear.

## 10. Export security

See §7 and §9 (O.1–O.7) for the role/centre/soft-delete gaps, all fixed. Additionally:

**O.5/O.7 — soft-delete filtering.** `getStudentExportData()` and `/api/reports/students` had no `deletedAt` exclusion at all, unlike the frozen Students list page. Fixed to add `isNull(children.deletedAt)` and `isNull(parents.deletedAt)`, matching that page's own established condition exactly. **Live-verified**: a temporary child record was inserted under the one soft-deleted parent already present in the seeded dev database, confirmed present in the raw table, then confirmed **absent** from the live student export after the fix — then the temporary record was removed (disposable dev-DB fixture; see §24).

**O.8 — CSV/formula-injection.** All four CSV-generating code paths quoted every cell and escaped embedded quotes (correctly preventing delimiter/newline breakage) but did not neutralise a leading `=`, `+`, `-`, or `@` — which a spreadsheet application will still evaluate as a formula trigger even inside a quoted cell. Several exported fields (parent/child names) are free text supplied through the public self-registration flow, so this is reachable from a normal, unprivileged submission path. Fixed with a single new shared helper (`src/lib/csv-safety.ts`, `neutralizeCsvFormula`) applied at all four sites: `ReportsClient.tsx`'s `downloadCSV`, and the `escape()` functions in all three `/api/reports/*` routes. **Live-verified**: every exported UK phone number in the seeded dataset (e.g. `+44 7700 900342`) is genuinely a real-world case of a leading-`+` value, and the live export correctly rendered it as `'+44 7700 900342` — the standard, spreadsheet-hidden neutralisation prefix — confirming the fix is active on real data, not just synthetic test input.

## 11. Confirmed defects

**O.1 — `getExportData()` (bookings CSV export) did not block FRONT_DESK.**
- **Problem**: `src/features/bookings/actions.ts` blocked only `TUTOR`.
- **Impact**: a FRONT_DESK user — explicitly redirected away from the Reports page — could call this server action directly and receive a full CSV-ready export of every booking in the organisation.
- **Evidence**: direct read of the function; confirmed its only caller anywhere in the app is `ReportsClient.tsx` (grep-verified).
- **Fix**: block FRONT_DESK alongside TUTOR.
- **Test**: `src/features/reports/export-security.test.ts`, "rejects FRONT_DESK (O.1 — previously not blocked)".

**O.2 — `getExportData()` had no centre scoping.**
- **Problem**: org-gated only; returned bookings across every centre in the org.
- **Impact**: a non-owner user assigned to only some centres could export every other centre's booking data too — less restrictive than the on-screen Bookings list, which does scope by centre.
- **Evidence**: `src/app/dashboard/bookings/page.tsx:166-172`'s own established "all centres" condition.
- **Fix**: add `inArray(bookings.centreId, accessibleCentreIds)`.
- **Test**: "scopes results to the caller's accessible centres (O.2 — previously org-wide)"; live-verified in §9/§12.

**O.3 — `getStudentExportData()` did not block FRONT_DESK.** Same problem/impact/fix pattern as O.1, in `src/features/students/actions.ts`. Test: "rejects FRONT_DESK (O.3 — previously not blocked)".

**O.4 — `getStudentExportData()` had no centre scoping.** Same pattern as O.2, matching the frozen Students list page's `inArray(children.centreId, accessibleCentreIds) OR children.centreId IS NULL` condition. Test: "scopes results to accessible centres, including centre-less children (O.4 — previously org-wide)"; live-verified.

**O.5 — `getStudentExportData()` had no soft-delete filter.**
- **Problem**: no `deletedAt` exclusion on either `children` or `parents`.
- **Impact**: a deleted student/parent record, invisible everywhere else in the product, would still appear in the export.
- **Evidence**: `src/app/dashboard/students/page.tsx:94-97`'s own established `isNull` conditions.
- **Fix**: add both `isNull` conditions.
- **Test**: live-verified via a disposable dev-DB fixture (§10, §24) — unit-test coverage in `export-security.test.ts` confirms the query path is exercised; the live fixture is the stronger proof for this specific condition given Drizzle query-builder mocking limits.

**O.6 — `/api/reports/students` had no centre scoping.** Unlike its own sibling routes `attendance/route.ts` and `bookings/route.ts` in the same directory. Fixed to mirror them exactly, including their "zero accessible centres → empty CSV" early-return shape. Test: `src/app/api/reports/students/route.test.ts`, "scopes the export query to the caller's accessible centres (O.6)"; live-verified.

**O.7 — `/api/reports/students` had no soft-delete filter.** Same fix and rationale as O.5.

**O.8 — CSV/formula-injection risk across all four CSV-generation sites.** See §10 for full detail. Fix: `src/lib/csv-safety.ts`. Tests: `src/lib/csv-safety.test.ts` (5 unit tests on the helper itself) plus a dedicated regression test in `route.test.ts` ("neutralises a leading formula-trigger character in an exported cell (O.8)"); live-verified on real seeded phone-number data.

**O.9 — Booking/registration status labels incomplete — found live in Stage C.**
- **Problem**: `STATUS_LABELS` in `weekly-report.action.ts` omitted `rescheduled` and `not_interested`, falling back to the raw, lowercase enum string.
- **Impact**: cosmetic only — a live "rescheduled" booking rendered its status badge as lowercase "rescheduled" beside properly-cased "Confirmed"/"Cancelled" badges in the same table column (see screenshot evidence, §19). The underlying data was always correct.
- **Evidence**: caught during Stage C visual verification (1440px light-theme screenshot of the Activity Report), not in the static Stage-A read — originally logged there as documented, deliberately-unfixed debt; reclassified once seen live, mirroring the same discipline used for Milestone 3H's C10.
- **Fix**: add both missing entries to the shared map.
- **Test**: no dedicated unit test added (a pure label-lookup table; the existing `weekly-report.action.ts` has no test file at all — the fix carries the same test-coverage level as the rest of that untested file. See §24).

**C6 equivalent — no such item.** All identified findings above are confirmed defects; no ambiguity required inventing a policy or a STOP (audit §P covers the two open, deliberately-undecided items: the "Sessions Run" label semantics, and nothing else material).

## 12. Cross-module reconciliation

Performed against the seeded dev database directly (`psql`), independent of the application code, then compared against the live rendered Activity Report for a custom range of 2026-08-01 to 2026-08-31:

- **Booking count** — hand-counted 11 bookings with `created_at` in the period across both accessible centres → report showed **New Bookings: 11**. Match.
- **Sessions/attendance** — hand-counted 6 `confirmed`-status bookings with `start_at` in the period (5 at Main Campus, 1 at Secondary Campus), of which 1 had `attendance_status = 'present'` (at Main Campus) → report showed **Sessions Run: 6**, **Attendance by Centre**: Main Campus 5/5/1/20%, Secondary Campus 1/1/0/0% → org-wide **Attendance Rate: 17%** (round(1/6 × 100) = 16.67% → 17%). Match on every figure, for both ORG_OWNER and a MANAGER whose accessible centres cover the same underlying bookings.
- **Registrations** — the seeded database has zero `registrations` rows; the report correctly showed **New Registrations: 0**, an explicit "No new registrations for this period" empty state (not an error), and **Pending This Period: 0** / **Overdue Follow-ups: 0**. Match (trivially, but confirmed rendered as a proper empty state rather than a false zero or an error).
- **Centre-scoped export exclusion** — Riverside Annex (1 student, 0 bookings, inaccessible to the test MANAGER) was absent from both the live bookings and live student CSV exports for that user, while present in the underlying database. Confirmed via direct row-count comparison.
- **Soft-delete exclusion** — see §10/§24 for the disposable-fixture reconciliation.

Every reconciled figure matched exactly. No report could not be reconciled — sufficient seeded data existed for every metric family present in Reports.

## 13. Bookings report findings

No dedicated "Bookings Report" view exists beyond the Reports CSV export and the Activity Report's "New Bookings"/"Attendance by Centre" sections. Booking/attendee counts are correctly deduplicated via `countDistinct` at every join point; cancelled/rescheduled/pending bookings are visibly labelled (not silently hidden) in the activity log, while only `confirmed` bookings feed the attendance/sessions aggregates. No classic reporting error (fan-out inflation, cancelled-as-confirmed, etc.) found (audit §E).

## 14. Attendance report findings

Reconciled against two independent existing definitions and found **consistent with both**: the shared `src/lib/attendance.ts` `countAttendance()` helper (which counts `attended` only on `status === 'present'`, separate from `late`) and the frozen Attendance dashboard's own `attendanceRate = present / totalStudents` calculation (denominator includes not-yet-marked attendees, numerator is present-only). No divergence found — no fix needed (audit §C.2, §F).

## 15. Finance report findings

Not applicable. Reports displays no financial/revenue data anywhere (confirmed by exhaustive grep for `invoice`/`payment`/`revenue`/`stripe` across every Reports-owned file — zero hits).

## 16. Student/parent report findings

No fabricated lifecycle/"Active" status invented anywhere — the "New Registrations" table uses the real persisted `registrationStatusEnum2` values, and the student exports use only real, persisted `children`/`parents` columns. The confirmed defects specific to this data (O.3–O.5, O.7) are detailed above.

## 17. UI/UX changes

None to layout or visual styling — no confirmed visual/design defect was found in either the static read or Stage C live screenshots. The Reports module already correctly reuses the frozen `Card`/`Table`/badge/StatCard patterns, semantic colour tokens, and responsive grid behaviour (`grid-cols-2 md:grid-cols-3` for KPI cards). The only user-visible change is O.9's status-badge label fix (a "rescheduled" badge now reads "Rescheduled" instead of the raw lowercase enum string) and the error-vs-success feedback already present in export flows was left untouched (no changes needed there).

## 18. Files changed

| File | Change |
|---|---|
| `src/features/bookings/actions.ts` | O.1/O.2 fixes to `getExportData()` |
| `src/features/students/actions.ts` | O.3/O.4/O.5 fixes to `getStudentExportData()` |
| `src/app/api/reports/students/route.ts` | O.6/O.7/O.8 fixes |
| `src/app/api/reports/attendance/route.ts` | O.8 fix (CSV-injection guard) |
| `src/app/api/reports/bookings/route.ts` | O.8 fix (CSV-injection guard) |
| `src/app/dashboard/reports/ReportsClient.tsx` | O.8 fix (CSV-injection guard) |
| `src/features/reports/weekly-report.action.ts` | O.9 fix (`STATUS_LABELS` completeness) |
| `src/lib/csv-safety.ts` | **New** — shared `neutralizeCsvFormula` helper (O.8) |
| `src/lib/csv-safety.test.ts` | **New** — 5 regression tests |
| `src/features/reports/export-security.test.ts` | **New** — 11 regression tests (O.1–O.5) |
| `src/app/api/reports/students/route.test.ts` | **New** — 6 regression tests (O.6–O.8) |
| `project-notes/milestone-3i-reports-audit.md` | **New** — Stage-A audit |
| `project-notes/milestone-3i-reports-completion.md` | **New** — this report |

## 19. Responsive verification

**1440 / 834 / 375** — all verified via live Playwright screenshots of both tabs (Activity Report with live data loaded, and Data Exports) in both themes. KPI grid correctly reflows (3 → 2 columns), the wide activity tables scroll within their own `overflow-x-auto` container rather than the page, filter/date controls stack cleanly, and the mobile bottom-nav does not obscure content. Programmatically confirmed **zero page-level horizontal overflow** at all three widths (`document.documentElement.scrollWidth - clientWidth === 0` at 375, 834, and 1440).

## 20. Theme verification

**Bright / dark** — both verified via live screenshots. Cards, tables, badges, inputs, and the empty state all use semantic tokens and render with correct contrast in dark mode; no hardcoded-light-mode artifacts found. (`pdf-report.ts`'s output is a separate, intentionally paper-styled print document — see audit §N — which is not part of the in-app theme system by design, the same way an invoice PDF wouldn't be.)

## 21. RSC/runtime verification

Zero console errors and zero page errors on both the ORG_OWNER and MANAGER Activity Report runs (the reconciliation script captured both). One `ClientFetchError` (`ClientFetchError: Failed to fetch... getSession`) appeared during the FRONT_DESK/TUTOR role-denial checks — this is the same pre-existing, previously-diagnosed test-harness artifact from rapid unpaced `page.goto()` calls documented in both the Finance and Communications milestones (a NextAuth client-side `getSession()` race under rapid navigation, not a real regression); it did not appear during the paced reconciliation/screenshot runs. No RSC function-prop violations are structurally possible — the Server Component `page.tsx` passes zero props to `<ReportsClient />`, and both client components import their server actions directly rather than receiving them as props. No chart library is used anywhere in Reports.

## 22. Automated quality gates

- **Typecheck**: 0 errors.
- **Lint**: 0 errors / 0 warnings.
- **Tests**: **407 / 407 passing** (baseline was 383/383; +24 new tests added across `csv-safety.test.ts` (5), `export-security.test.ts` (11), and `route.test.ts` (6, one overlapping with O.8 coverage) — no existing test was skipped, deleted, or weakened).
- **Production build**: PASS.

## 23. Frozen-module regression verification

Two frozen-module files were edited (`src/features/bookings/actions.ts`, `src/features/students/actions.ts`) because their edited functions (`getExportData`, `getStudentExportData`) are Reports' sole callers despite being colocated with their respective feature's other code. Their own test suites were re-run in isolation after the edits and confirmed clean: `bookings/actions.test.ts` + `bookings/authorization.test.ts` + `students/authorization.test.ts` → **35/35 passing**, no regressions. No shared centre-filter/finance/attendance/chart helper or `Table`/`Card` primitive was modified — only the two data-access functions above.

## 24. Remaining debt / ambiguities

- **"Sessions Run" metric semantics** (audit §C.1) — counts distinct bookings, not distinct session occurrences; no established precedent exists elsewhere in the codebase to compare against, and the current reading is defensible. Documented, not changed.
- **Dead code**: `src/features/reports/queries.ts` (zero callers) and `src/components/dashboard/DataExportSection.tsx` (orphaned, unmounted component — but its target `/api/reports/*` routes remain independently reachable regardless, which is why O.6–O.8 were still real, live defects despite the component never rendering). Neither touched — out of scope per "no unrelated dead-code deletion."
- **Incidentally discovered, not touched**: `src/app/dashboard/bookings/page.tsx:304` links to a non-existent `/api/bookings/export` route (404 on click) — a pre-existing Bookings-module defect unrelated to any Reports surface.
- **`weekly-report.action.ts` has no dedicated test file.** This predates Milestone 3I; the O.9 fix (a label-lookup-table addition) was made without adding new tests for this specific file, consistent with its existing (zero) coverage level rather than expanding scope into a full test suite for an untouched-otherwise file.
- **Disposable dev-DB fixture**: one temporary `children` row was inserted under the seeded database's one soft-deleted parent (Grace Okafor) to empirically prove the O.5 fix, confirmed excluded from the live export, then deleted. No trace remains in the dev database.
- **Finance M6** (`resolveActiveCentreId` first-load mismatch) — not applicable; Reports never calls `resolveActiveCentreId`.
- **Main-branch scheduled CI failures** — untouched, out of scope, `main` not modified.

## 25. Scope confirmation

No frozen module's UI was touched. Two frozen-module **data-access functions only** were edited (`getExportData`, `getStudentExportData`), narrowly and with regression verification, per the ticket's own explicit allowance for a "directly required and clearly evidenced" source-module fix. No new report, metric, export type, chart library, caching layer, or analytics architecture was introduced. No schema migration was performed or required.

## 26. Similarity rating

**9/10** — Reports already reused the frozen `Card`/`Table`/badge/StatCard/semantic-token/responsive patterns correctly before this milestone; no visual rework was needed. The one point held back reflects the pre-existing, now-fixed label-completeness gap (O.9) and the documented "Sessions Run" naming ambiguity, both minor.

## 27. Git

- **Base**: `403a194`
- **Final tip**: see commit log below (this report is written before the commit step; the completion message will confirm the final SHA)
- **Commits**: two, following the established milestone pattern — one for audit + Stage B fixes, one for this completion report
- **Working tree**: clean before commit, to be confirmed clean after
- **Bundle**: `milestone-3i-reports-<BASE>-<TIP>.bundle` (final filename confirmed after commit, following the established naming convention)

## 28. Recommendation

**PASS — recommend freezing Milestone 3I.**

All four quality gates are clean, including 407/407 tests (up from 383, with 24 new regression tests and zero skipped/weakened). Nine confirmed defects were fixed with narrow, evidenced changes: eight security/authorization gaps (O.1–O.8 — two role-gate bypasses, three centre-scoping omissions, one soft-delete-filter omission, and one CSV-injection risk spanning four call sites) plus one display-label completeness fix (O.9) found live during Stage C rather than in the static audit. Every fix mirrors an already-established sibling pattern from a frozen module (Bookings, Students, or Reports' own sibling API routes) rather than inventing new policy. Key report figures were independently reconciled against the seeded database and matched exactly across every metric family present in Reports (bookings, sessions/attendance, registrations). No frozen module's UI was touched; the two frozen-module data-access functions edited were regression-verified clean. No metric definition was invented, no new report/chart/export type was added, and the one metric-naming ambiguity found ("Sessions Run") was documented rather than acted on without evidence.
