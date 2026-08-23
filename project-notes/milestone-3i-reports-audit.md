# Milestone 3I — Reports — Stage-A Audit

**Repo**: `kwadwoaddo-collab/After-School-Club-CMS`
**Branch**: `rebuild/cms-modernisation`
**Base**: `403a194` (frozen Milestone 3H tip)

## A. Surface inventory

| Surface | File | Type | Auth | Role gate | Org scope | Centre scope | Notes |
|---|---|---|---|---|---|---|---|
| Reports page | `src/app/dashboard/reports/page.tsx` | Server Component | `auth()` inline | ORG_OWNER/MANAGER only (TUTOR/FRONT_DESK redirect to `/dashboard`) | org row fetch only | — | Renders `<ReportsClient />`; no props passed |
| Reports shell (tabs) | `src/app/dashboard/reports/ReportsClient.tsx` | Client Component | — (page already gated) | — | — | — | Two tabs: "Activity Report" (default) and "Data Exports" |
| Activity report (weekly/CEO report) | `src/app/dashboard/reports/WeeklyReportTab.tsx` | Client Component | via server action | via server action | via server action | via server action | Date-range picker (this week / last week / custom, max 90 days); calls `getWeeklyReport` |
| Weekly report server action | `src/features/reports/weekly-report.action.ts` | Server Action | `auth()` | ORG_OWNER/MANAGER allowlist | hard org gate on every join | `getUserAccessibleCentreIds` — no client-supplied centre param at all | Returns registrations, bookings, attendance-by-centre, pending actions for a date range |
| CEO PDF export | `src/lib/pdf-report.ts` | client-only lib | — (consumes already-authorized data) | — | — | — | `window.print()`-based; zero server round-trip; HTML-escapes every interpolated value |
| Bookings CSV export (Reports tab) | `ReportsClient.tsx` → `getExportData()` in `src/features/bookings/actions.ts` | Server Action | `auth()` | **TUTOR only** (see O1/O2) | org gate via `centres.organisationId` | **none** (see O2) | Client-side date filter after full fetch |
| Student CSV export (Reports tab) | `ReportsClient.tsx` → `getStudentExportData()` in `src/features/students/actions.ts` | Server Action | `auth()` | **TUTOR only** (see O3) | org gate via `parents.organisationId` | **none** (see O4); **no soft-delete filter** (see O5) | Client-side date filter after full fetch |
| `/api/reports/attendance` | `src/app/api/reports/attendance/route.ts` | Route Handler | `auth()` | ORG_OWNER/MANAGER | org gate via `accessibleCentreIds` | ✅ `getUserAccessibleCentreIds` | CSV, quoted+escaped |
| `/api/reports/bookings` | `src/app/api/reports/bookings/route.ts` | Route Handler | `auth()` | ORG_OWNER/MANAGER | org gate via `accessibleCentreIds` | ✅ `getUserAccessibleCentreIds` | CSV, quoted+escaped |
| `/api/reports/students` | `src/app/api/reports/students/route.ts` | Route Handler | `auth()` | ORG_OWNER/MANAGER | org gate via `parents.organisationId` | **none** (see O6); **no soft-delete filter** (see O7) | CSV, quoted+escaped |
| Legacy occupancy/attendance query helpers | `src/features/reports/queries.ts` (+ `queries.test.ts`) | lib functions | — | — | **none — no org filter at all** | takes raw `centreId` string, no validation | **Dead code** — zero callers anywhere in the app besides its own test (see R.1) |
| "Quick Data Export" widget | `src/components/dashboard/DataExportSection.tsx` | Client Component | — | — | — | — | **Orphaned** — not imported/rendered by any route (see R.2); it is the only caller of the three `/api/reports/*` routes above, but those routes remain independently reachable by direct request regardless |

No other Reports surfaces found. Searched beyond literal "reports" naming for: dashboard tabs, KPI/summary widgets, chart components, print views, CSV/PDF/export code, date-range/centre/status filter controls, aggregation helpers, API routes, server actions, and tests, across `src/app`, `src/features`, `src/lib`, `src/components`. `src/app/dashboard/incidents` matches "report" only in prose copy ("safeguarding, medical, and accident reports") — it is an unrelated, pre-existing incident-logging feature, not a Reports surface, and is untouched.

Finance/revenue: **Reports displays no financial data of any kind.** No invoice, payment, or revenue figures appear anywhere in the Reports module (confirmed by grep across every Reports-owned file for `invoice`, `payment`, `revenue`, `stripe` — zero hits). §17 (Finance report findings) is therefore **not applicable** — there is no in-scope surface to audit.

## B. Data sources

| Report state | Source table(s) | Join path | Derived from |
|---|---|---|---|
| `summary.newRegistrations` | `registrations` | `registrationChildren` (inner), `registrationParents` (left, primary only), `centres` (left, org-gated) | count of distinct `registrations.id` created in period |
| `summary.newBookings` | `bookings` | `centres` (inner, org-gated), `bookingAttendees` (inner), `children` (inner), `parents` alias (left, org-gated) | count of distinct `bookings.id` created in period |
| `summary.sessionsRun` / `attendanceByCentre[].sessionsRun` | `bookings` | `centres` (inner, org-gated), `bookingAttendees` (inner) | `countDistinct(bookings.id)` for confirmed bookings whose `startAt` falls in period — see C.1 for exact semantics |
| `summary.attendanceRate` / `attendanceByCentre[].attendanceRate` | `bookingAttendees` | via `bookings` → `centres` | `present / (all attendee rows for confirmed bookings in period)` — reconciled against `src/lib/attendance.ts` in C.2 |
| `summary.pendingRegistrationsThisPeriod` | `registrations` | — | count of `status = 'awaiting_confirmation'` created in period |
| `summary.overdueFollowUps` | `registrations` | `registrationChildren` | distinct `awaiting_confirmation` registrations created > 3 days ago (all-time backlog, not period-scoped — clearly labelled as such) |
| `pendingActions` (missed attendance) | `bookings` → `bookingAttendees` → `children` | — | confirmed bookings, `startAt` in last 30 days, more than 2h past start, with `attendanceStatus IS NULL` |
| Bookings CSV export | `bookings` → `bookingAttendees` → `children` → `parents` → `centres` | — | all rows, org-filtered, no date filter server-side |
| Student CSV export | `children` → `parents` | — | all rows, org-filtered, no date filter server-side |

All values are **derived at request time** — nothing is cached or pre-aggregated. There is no display-only calculation that diverges from a stored value (e.g. no client-side re-derivation of a rate the server already computed differently).

## C. Report / metric definitions — correctness audit

**C.1 — "Sessions Run" is a booking count, not a distinct-session-occurrence count (ambiguity, not a defect).**
`sessionsRun: countDistinct(bookings.id)` counts distinct **booking rows** (one per family's reservation) with `startAt` in the period and `status = 'confirmed'`, joined through `bookingAttendees` — the `countDistinct` correctly prevents the attendee join from inflating the count (multiple children on one booking still count once). However, since `bookings.centreId + modality + startAt` can legitimately be shared by many different families' bookings (the unique constraint is `(centreId, modality, startAt, parentId)` — per-parent, not per-slot), a single class occurrence attended by 10 families would show `sessionsRun = 10`, not `1`. Checked whether the frozen Attendance/Bookings modules define an established "sessions run" concept to compare against — **none exists anywhere else in the codebase**; this metric is Reports-original. Because there is no established source-module semantic being violated, and because "bookings that ran in this period" is itself a defensible, non-inflated reading of "sessions", this is classified as an **ambiguity**, not a confirmed defect — per the ticket's instruction not to invent an alternative metric definition. Documented for orchestrator awareness; **not changed**.

**C.2 — Attendance-rate definition reconciled and confirmed correct.**
Reports computes `attendanceRate = present / all-attendee-rows-in-period` (denominator includes not-yet-marked attendees; numerator counts only `attendanceStatus = 'present'`, excluding `late`/`no_show`/`excused`/null). Compared against two independent existing definitions:
- `src/lib/attendance.ts`'s shared `countAttendance()` helper: `attended++` fires **only** on `status === 'present'` — `late` is its own separate bucket. Match.
- The frozen Attendance dashboard (`src/app/dashboard/attendance/page.tsx:85-101`): `attendanceRate = present / totalStudents`, where `totalStudents` counts every expected slot regardless of whether it has been marked yet, and `present` counts only `attendanceStatus === 'present'`. Match on both numerator and denominator philosophy.

No divergence found. **Confirmed correct — no fix needed.**

**C.3 — Booking-status label completeness — found live in Stage C, fixed (O.9).**
`STATUS_LABELS` (shared between `registrations.status` and `bookings.status` display) omitted `rescheduled` (a valid `bookingStatusEnum` value) and `not_interested` (a valid `registrationStatusEnum2` value); both fell back to the raw enum string via `?? r.status`. Initially classified as a minor, cosmetic, not-fixed item during the static read (see original note below, kept for the record). **During Stage C live verification this became directly visible**: a live "rescheduled" booking rendered its status badge as lowercase "rescheduled" sitting directly next to properly-cased "Confirmed"/"Cancelled"/"Completed" badges in the same table column — a real, user-visible inconsistency, not merely theoretical. Reclassified as a confirmed defect and fixed (see O.9) — a one-line, zero-risk addition of the two missing map entries; the underlying data was always correct, only the display label was affected, and this mirrors the same "found live, not in the static audit" discipline documented for Milestone 3H's C10.
*(Original static-read note, retained for the audit trail: "This is a cosmetic label-completeness gap, not a data-correctness defect... documented under Debt, not fixed, to keep Stage B narrowly scoped." Superseded by the live finding above.)*

**C.4 — No classic reporting errors found.** Specifically checked and ruled out: booking-attendee fan-out inflating booking counts (correctly `countDistinct`-guarded everywhere); cancelled bookings counted as sessions/attendance (excluded via `status = 'confirmed'`); duplicate rows from the registration↔child↔parent join (grouped/deduplicated via `Map` before rendering, with an explicit comment calling out the fan-out risk); `centre=all` widening beyond role scope (impossible — see K); filtering on display labels instead of persisted enum values (all filters use the persisted enum columns).

## D. Date/time semantics

- All date-range inputs are plain `YYYY-MM-DD` strings, parsed with `new Date(...)` and normalised via `date-fns`' `startOfDay`/`endOfDay` — i.e. inclusive on both ends, in the **server process's local timezone** (no explicit UTC conversion or org-timezone lookup anywhere in the codebase — consistent with every other frozen module; this is pre-existing, org-wide behaviour, not a Reports-introduced inconsistency).
- Max range enforced: 90 days (`end - start > 90 * 24h` throws). End-before-start rejected.
- "Sessions Run" / attendance / new-bookings use `bookings.startAt` (the session's actual date/time) — the *session* basis, not the booking's `createdAt`.
- "New Registrations" / "New Bookings" (as distinct summary counts) use `registrations.createdAt` / `bookings.createdAt` — the *creation* basis.
- These two bases are used consistently and are clearly separated (a booking created weeks ago for a session happening this week appears in "Attendance by Centre" but not "New Bookings", and vice versa) — this is intentional, documented behaviour, not a bug.
- "Missed attendance" pending actions use a fixed trailing 30-day window from `now`, independent of the user's selected report period, with an explicit 2-hour grace period after `startAt` before a missing mark is flagged.
- "Overdue registrations" use a fixed 3-day-old threshold from `now`, independent of the selected period (all-time backlog), clearly labelled `overdueFollowUps` and described as "all-time".

No off-by-one or inclusive/exclusive boundary defects found in the reviewed code.

## E. Booking report findings

Covered under B/C above (no dedicated "Bookings Report" view exists beyond the Reports CSV export and the "New Bookings"/"Attendance by Centre" sections of the Activity Report). Bookings and attendee counts are correctly deduplicated at the booking level throughout. Cancelled/rescheduled/pending bookings are shown in the "New Bookings" activity table (their status is visibly labelled), while only `confirmed` bookings feed the attendance/session aggregates — this matches the same "confirmed-only for aggregate, all-statuses-with-visible-label for activity log" pattern established in Finance and Communications.

## F. Attendance report findings

See C.2 — reconciled and confirmed consistent with the frozen Attendance module's own definitions on both statuses counted and denominator composition. No separate defect found.

## G. Finance report findings

Not applicable — see A. Reports surfaces no financial data.

## H. Student / parent report findings

The "New Registrations" table and the two student-data exports are the only student/parent-facing surfaces. No fabricated "Active"/lifecycle status is invented anywhere — registration status uses the real persisted `registrationStatusEnum2` values, and the student exports use only real, persisted `children`/`parents` columns. See O.3–O.7 for the confirmed defects found in the export paths specifically (role gate, centre scope, soft-delete).

## I. Authorization matrix

| Surface | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| `/dashboard/reports` page | ✅ | ✅ | ❌ (redirect) | ❌ (redirect) |
| `getWeeklyReport` (Activity Report) | ✅ | ✅ | ❌ (throws) | ❌ (throws) |
| `getExportData` (Bookings CSV, Reports tab) | ✅ | ✅ | ⚠️ **not blocked — O1** | ❌ (throws) |
| `getStudentExportData` (Students CSV, Reports tab) | ✅ | ✅ | ⚠️ **not blocked — O3** | ❌ (throws) |
| `/api/reports/attendance` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `/api/reports/bookings` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `/api/reports/students` | ✅ | ✅ | ❌ (403) | ❌ (403) |

The intended, evidenced permission boundary for Reports (established consistently by the page gate and by 3 of the 5 independently-callable surfaces) is **ORG_OWNER/MANAGER only**. `getExportData` and `getStudentExportData` are the two outliers — see O.1/O.3.

## J. Organisation isolation

Every reviewed query carries an explicit organisation filter (`eq(*.organisationId, orgId)` or a hard org-gated join), independently of page-level auth, on every surface including both server actions and all three API routes. No ID-tampering vector was found that crosses organisations — `getWeeklyReport` accepts no IDs at all from the client (only two date strings), and the exports accept no parameters at all. **No organisation-isolation defect found.**

## K. Centre scoping

`getWeeklyReport` and the two `/api/reports/{attendance,bookings}` routes correctly scope to `getUserAccessibleCentreIds(session.user.id)`, with ORG_OWNER implicitly receiving every centre (the established codebase-wide convention). Reports has **no client-supplied `centreId` parameter anywhere** — not in the Activity Report, not in either CSV export flow, not in any of the three API routes. This eliminates the entire class of `centre=all`-widening or centre-ID-tampering risk that affected Parents (documented prior history) and that the ticket specifically asked to check for — there is no such parameter to tamper with. The centre-scoping gaps that do exist (O.2, O.4, O.6) are a *complete absence* of centre filtering rather than a tamperable/bypassable one — see below.

## L. Export findings — confirmed defects

**O.1 — `getExportData()` (bookings CSV export) does not block FRONT_DESK.**
`src/features/bookings/actions.ts:434-463`. Blocks only `TUTOR`. The Reports *page* redirects FRONT_DESK away, but this server action is independently POST-able — page-level gating does not protect it. A FRONT_DESK caller can invoke it directly and receive a full CSV-ready export of every booking in the organisation. Confirmed only caller is `ReportsClient.tsx` (grep-verified). **Fix**: block FRONT_DESK alongside TUTOR, matching the page gate and the two sibling `/api/reports/*` routes.

**O.2 — `getExportData()` has no centre scoping.**
Same location. Returns bookings across every centre in the org regardless of the caller's assigned centres — org-gated only. The frozen Bookings list page (`src/app/dashboard/bookings/page.tsx:166-172`) always restricts the "all centres" case to `inArray(bookings.centreId, accessibleCentreIds)` even for its own default view. This export is therefore *less* restrictive than the on-screen view it's meant to summarise, violating the ticket's "exports must enforce the same or stricter authorization as on-screen views" requirement. **Fix**: add the identical `inArray(bookings.centreId, accessibleCentreIds)` condition.

**O.3 — `getStudentExportData()` does not block FRONT_DESK.**
`src/features/students/actions.ts:10-36`. Same defect as O.1, same fix.

**O.4 — `getStudentExportData()` has no centre scoping.**
Same location, org-gated only. The frozen Students list page (`src/app/dashboard/students/page.tsx:100-109`) restricts its own "all centres" view to `inArray(children.centreId, accessibleCentreIds) OR children.centreId IS NULL` (children can be centre-less). **Fix**: add the identical condition.

**O.5 — `getStudentExportData()` has no soft-delete filter.**
Same location. The frozen Students list page filters `isNull(children.deletedAt)` and `isNull(parents.deletedAt)`; this export has neither, so a deleted student/parent record — invisible everywhere else in the product — would still appear in the CSV export. **Fix**: add both `isNull` conditions, matching the Students page precedent exactly.

**O.6 — `/api/reports/students/route.ts` has no centre scoping.**
Unlike its own two sibling files in the same directory (`attendance/route.ts`, `bookings/route.ts`), which both call `getUserAccessibleCentreIds` and filter accordingly, this route filters only by organisation. **Fix**: mirror the sibling routes' established pattern (including their "zero accessible centres → empty CSV" early-return shape) plus the children-can-be-centre-less OR-null condition from O.4.

**O.7 — `/api/reports/students/route.ts` has no soft-delete filter.**
Same rationale and fix as O.5.

**O.8 — CSV/formula-injection risk across every CSV-generating code path.**
All four CSV builders — `ReportsClient.tsx`'s `downloadCSV()`, and the local `escape()` functions in `attendance/route.ts`, `bookings/route.ts`, and `students/route.ts` — wrap every cell in double quotes and escape embedded quotes (correctly preventing delimiter/newline breakage), but do **not** neutralise a leading `=`, `+`, `-`, or `@`. Quoting alone does not stop a spreadsheet application from evaluating a quoted cell that starts with one of these characters as a formula. Several exported fields (parent first/last name, in particular) are free text supplied by parents through the public self-registration flow (see `src/app/centre-portal/[subdomain]/register/page.tsx`), so this is exploitable from a normal, unprivileged submission path, not merely a theoretical concern. **Fix**: add a single small shared helper that prefixes a neutralising character on any cell value beginning with `=`, `+`, `-`, or `@` (the standard mitigation), applied at all four sites.

No other export defects found. Filenames are static/date-based (no user input in filenames — no path-traversal concern). No export returns a field that isn't already shown on an equivalent on-screen surface (no over-broad payload beyond what §22 would flag).

## M. Performance findings

`getExportData()` and `getStudentExportData()` fetch the entire (now centre-scoped, post-fix) dataset in one query and let the browser filter it client-side by date for the "Last 30 Days"/"Last 7 Days"/"Custom Range" buttons. This is pre-existing behaviour (not introduced by this milestone) and, at this application's scale (a single after-school-club operator, not a multi-tenant SaaS with unbounded row counts), is not a confirmed performance defect — no evidence of unbounded growth or N+1 query patterns. `getWeeklyReport` runs its six queries in parallel (`Promise.all`) and is properly date/org/centre-bounded. No confirmed performance defect. Not fixed (no evidence it's dangerous, and the ticket explicitly says not to introduce caching/warehousing speculatively).

## N. RSC / client-boundary findings

`page.tsx` (Server Component) renders `<ReportsClient />` with **no props** — no serialization risk. `ReportsClient.tsx` and `WeeklyReportTab.tsx` are both `'use client'` and import their server actions directly (`getExportData`, `getStudentExportData`, `getWeeklyReport`) rather than receiving them as props — the correct pattern, no function-prop violations possible. No chart library is used anywhere in Reports (all visualisation is StatCards + tables), so the common "chart config containing functions" RSC failure mode does not apply. **No RSC/runtime defect found.**

**O.9 — `STATUS_LABELS` missing `rescheduled`/`not_interested` — found live in Stage C.**
See C.3. `src/features/reports/weekly-report.action.ts`. **Fix**: add both entries to the shared `STATUS_LABELS` map.

## O. Confirmed defects — summary

O.1, O.2, O.3, O.4, O.5, O.6, O.7, O.8, O.9 (all detailed in §L above and C.3; O.1–O.7 are authorization/isolation gaps, O.8 is the CSV-injection finding, O.9 is the display-label completeness fix found live in Stage C).

## P. Ambiguities

- C.1 ("Sessions Run" label) — documented, not changed; no established precedent to compare against, and the current computation is a defensible reading of the label.
- C.3 (two enum values missing from `STATUS_LABELS`) — originally classified here as minor debt, not a confirmed defect, during the static read. **Superseded**: Stage C live verification surfaced this directly (a "rescheduled" status badge rendering as raw lowercase text next to properly-cased badges), reclassifying it as confirmed defect O.9 and fixing it — see C.3 and O.9 for the full account. This line is retained rather than deleted so the audit trail shows the original static-read classification.

No metric definition or authorization decision was found to be materially ambiguous in a way that blocks Stage B — both open items above are narrow enough to document rather than requiring a stop.

## Q. Cross-module dependencies

Reports reads from (read-only, no writes anywhere in this module): `registrations`, `registrationChildren`, `registrationParents`, `centres`, `organisations`, `bookings`, `bookingAttendees`, `children`, `parents`. Two of the defects fixed in Stage B (O.1–O.5) live in **frozen-module files** (`src/features/bookings/actions.ts`, `src/features/students/actions.ts`) rather than Reports' own files, because the vulnerable functions are Reports' sole callers (grep-confirmed) despite being colocated with their respective feature's other code. Per the ticket's explicit allowance ("only make a tiny source-module fix if directly required and clearly evidenced... regression-check the frozen module"), these are fixed narrowly and the frozen modules' own test suites (`bookings/actions.test.ts`, `bookings/authorization.test.ts`, `students/authorization.test.ts`) are re-run as a regression check in Stage C.

Incidentally discovered, **not touched**: `src/app/dashboard/bookings/page.tsx:304` links to `/api/bookings/export?centre=...`, but no such route exists anywhere in the repo (404 on click). This is a pre-existing Bookings-module defect, unrelated to any Reports surface (Reports does not reference this link or route) — noted for the orchestrator's awareness only.

## R. Out-of-scope debt (kept visible, not fixed)

**R.1 — `src/features/reports/queries.ts` (`getOccupancyStats`, `getAttendanceStats`) is dead code.** Zero callers anywhere in the app besides its own test file. Also has no organisation filter at all (would be a real defect if it were ever wired up). Left untouched — no route/page/action references it, so it is unreachable, and "unrelated dead-code deletion" is explicitly out of scope.

**R.2 — `src/components/dashboard/DataExportSection.tsx` is an orphaned component.** Not imported by any page or layout. Pre-dates the design system (hardcoded `text-emerald-400`, `bg-red-500/10`, a raw `rgba()` box-shadow — none of it token-based). It is the only in-app caller of the three `/api/reports/*` routes; because those routes are still independently reachable by direct HTTP request regardless of whether any component links to them, O.6/O.7 remain live, exploitable gaps even though this specific component never renders. Left untouched — not part of any active route, and deleting/modernising an unmounted component is unrelated cleanup.

**R.3 — ~~`STATUS_LABELS` omits `rescheduled` and `not_interested`~~ — superseded, see O.9.** Originally listed here as out-of-scope cosmetic debt during the static read; found live in Stage C and fixed. Retained as a strikethrough entry for the audit trail rather than deleted.

**R.4 — Finance M6 (`resolveActiveCentreId` first-load mismatch).** Not applicable — Reports has no centre selector and never calls `resolveActiveCentreId` anywhere.

**R.5 — Communications "any one booking ever" consent semantics.** Not applicable — Reports does not report on communications consent.

**R.6 — Main-branch scheduled CI failures.** Untouched, out of scope, `main` not modified.

## S. Proposed Stage-B scope

1. O.1 + O.3 — add FRONT_DESK to the role block in `getExportData()` and `getStudentExportData()`.
2. O.2 — add centre scoping to `getExportData()`.
3. O.4 + O.5 — add centre scoping and soft-delete filtering to `getStudentExportData()`.
4. O.6 + O.7 — add centre scoping and soft-delete filtering to `/api/reports/students/route.ts`.
5. O.8 — add a narrow, shared CSV-formula-injection guard and apply it at all four CSV-generation sites.
6. Regression-check `bookings/actions.test.ts`, `bookings/authorization.test.ts`, `students/authorization.test.ts` after the frozen-module-file edits.
7. Add new regression tests for every fix above (none of the five touched functions currently have any test coverage).
8. No UI/visual changes are anticipated from the audit — Stage C will still verify 1440/834/375 and bright/dark against the frozen design language, but no confirmed visual defect was found during the static read. Any visual finding surfaced live in Stage C will be added here, following the same "found live, not in the static audit" discipline used in Milestone 3H.

No schema migration is required or proposed. No new report, metric, or export type is proposed. No frozen module's UI is touched — only two frozen-module **data-access functions**, narrowly, per §Q above.
