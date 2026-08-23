# Milestone 3E — Bookings Module: Completion Report

**Status: COMPLETE.** Stage-A audit done, four evidenced authorization defects fixed with regression tests; orchestrator-mandated Stage-A review follow-up performed (Reschedule-page organisation-isolation gap found and fixed, `GET /api/bookings/[bookingId]` confirmed absent with a regression test guarding against a future unprotected addition); Stage-B visual modernisation of every in-scope surface complete, with two further evidenced defects found during manual verification and fixed (broken booking search, missing `signed_up` status in list aggregates) plus one Stage-B-introduced responsive regression caught and fixed before commit; full quality gate suite clean; live production-style and security-regression verification performed against seeded data; git bundle produced. Per the orchestrator's explicit stop condition (§17 of the Stage-B authorisation), this report stops here — no other module has been touched, and no merge to `main` has been made.

Base SHA: `c291653` (the orchestrator-restated authoritative Milestone 3E base — a documentation-only descendant of the original ticket's literal `8e3681a` reference). Final SHA: not hardcoded here, for the same structural reason given in every prior milestone's completion report — a commit cannot correctly self-reference its own hash. Read it from `git log c291653..HEAD` on the delivered branch, or from `git bundle verify` on the delivered bundle; both are authoritative and neither can go stale the way a number typed into this file can.

---

## 1. What changed and why

### Stage A — security (audit §G, four confirmed defects)

All four were evidenced by comparison against an already-correct sibling performing the identical action on the same record — no invented policy:

1. **`DELETE /api/bookings/[bookingId]`** had no centre-membership check for non-`ORG_OWNER` users, unlike its `bulk-delete` sibling. Fixed to match.
2. **`PATCH /api/bookings/[bookingId]/centre`** (reassign) checked the *target* centre via `canUserAccessCentre` but never the booking's *current* (source) centre, unlike `cancel`/`reschedule`/`status`. Fixed to check both.
3. **Booking Detail page** (`/dashboard/bookings/[bookingId]`) had no centre-membership check at all for non-`ORG_OWNER` users — only an organisation check — despite every mutation acting on the same record enforcing centre membership, and despite the List page's own query already scoping to the viewer's accessible centres. Fixed with a matching check → `notFound()`.
4. **`GET /api/parents/[id]`** had no role restriction (deliberately left that way by Milestone 3B, which explicitly deferred the decision to "a future, properly-scoped Bookings/cross-module authorization pass" — see §4 below). Fixed to require `['ORG_OWNER','MANAGER','FRONT_DESK']`, the exact tuple already used by this endpoint's own `PATCH` sibling and by `/dashboard/bookings/new`'s own role gate — `BookingForm`'s only authenticated consumer of this endpoint.

### Stage-A review follow-up (orchestrator-mandated, before Stage B — see §3 below for full detail)

Two required investigations, both evidenced, no invented policy:

- **Reschedule page** (`/dashboard/bookings/[bookingId]/reschedule`) had a *more severe* gap than Booking Detail's pre-fix state: zero organisation-ownership check at all, not just a missing centre check. Fixed with both an organisation check and a centre-membership check, matching the pattern already used by Booking Detail and the mutation APIs.
- **`GET /api/bookings/[bookingId]`** does not exist in this codebase (only `DELETE` is exported from that route file) — confirmed statically and live (`curl` → `405`, no payload, before any application code including `auth()` runs). No defect, no change; a regression test guards against a future unprotected `GET` being added silently.

### Stage B — visual modernisation

Every surface in the orchestrator's approved primary scope list was restyled onto the frozen design system (`Table`, `Card`, `Badge`, `Button`, `EmptyState`, `Skeleton`, the semantic token vocabulary, and the established responsive/segmented-tab/modal patterns already in use on Students/Parents/Staff/Centres):

- **List** (`page.tsx`, `BookingsFilters`, `BookingsTable`) — raw markup and hardcoded gradient/glow/`rounded-[Npx]` styling replaced throughout; segmented status tabs now match the `StaffDashboardClient` pattern; the table uses the shared `Table` primitives with a responsive card view below `md`; empty and filtered-empty states use `EmptyState`; bulk-action bar, per-row dropdown, and all three confirmation modals (cancel/delete/bulk-delete) rebuilt on `Button`/token surfaces.
- **Booking Detail** — lifecycle timeline, attendee card(s), parent/staff info, and `AttendanceDropdown` all rebuilt on `Card`/`Badge`/token colours; the Stage-A centre-isolation fix is preserved verbatim, only presentation changed.
- **New booking** — the centre-picker and the dashboard-host wrapper around `BookingForm` were restyled; `BookingForm.tsx` itself was **not** touched (see §2's "Shared `BookingForm`" note below).
- **Reschedule** — the page wrapper and `RescheduleForm` restyled; the Stage-A-follow-up organisation/centre-isolation fix is preserved verbatim.
- `ReassignCentreButton`/`ReassignCentreModal`, `MarkAttendedButton`, and the three existing `loading.tsx` skeletons (`bookings/loading.tsx`, `bookings/[bookingId]/loading.tsx`, `bookings/new/loading.tsx`) were all restyled to match. A `.../reschedule/loading.tsx` does not exist in this codebase — confirmed by directory listing — so there was nothing to restyle there.
- `AppointmentScorecard.tsx` and `BookingList.tsx` (`src/features/bookings/components/`) were found still carrying the old visual language but are dead code — exported from `src/features/bookings/index.ts` but not imported by any route, dashboard surface, or public/portal host (confirmed by a repo-wide grep). Left untouched as out-of-scope debt rather than restyled or deleted, consistent with the ticket's "no unrelated cleanup" instruction.

Two further evidenced, narrow defects were found during manual verification of the restyled List page and fixed in the same pass (not deferred — same "evidenced sibling comparison, no invented policy" discipline as every Stage-A fix):

1. **Booking search was completely broken.** The search query joined `bookingAttendees` → an aliased `attendeeChildren`, but its `WHERE` clause also referenced the bare, never-joined `children` table. `bookings` has no direct child reference — only `bookingAttendees.childId → children.id`, which `attendeeChildren` already covers — so Postgres rejected every search with `invalid reference to FROM-clause entry for table "children"`. The existing `catch` block silently turned this into an "Unable to load bookings" banner and an always-empty result, i.e. the search box never returned a result for any query. Reproduced live and via direct `psql` execution of the generated SQL. Fixed by removing the two dead, duplicate conditions referencing the unjoined table (`attendeeChildren.firstName`/`lastName` already provide identical coverage). Reverified live: a real search now returns matches; a no-match search shows the plain empty state with no error banner.
2. **The `signed_up` booking status was invisible in list aggregates.** `VALID_BOOKING_STATUSES` and the row-level status badge maps already treat `signed_up` as one of six legitimate statuses — it renders correctly on individual rows — but the List page's `statusCounts` aggregation and `BookingsFilters`' status-tab list only ever handled five, omitting it. A booking in this status was invisible to every tab and silently excluded from the header's total, producing a visibly wrong "X of Y" count (reproduced live as "9 of 8" with one `signed_up` booking seeded). Fixed by completing both maps to match `VALID_BOOKING_STATUSES`; no new status or business rule introduced. Reverified live — header count and tab sum now agree.

One in-scope regression was introduced by the Stage-B restyle itself and caught during 375px responsive verification, fixed before commit: the restyled Booking Detail header (back-link + title + Reschedule/Mark-as-Attended buttons) did not wrap at 375px, producing 40px of horizontal overflow. Fixed with the same `flex-col`-below-`sm` pattern already used site-wide (Attendance, Communications, Incidents). A residual 28px of overflow at 375px on the Detail page traces to a `Safeguarding` radio label inside `InternalNotesTimeline` (`src/features/students/components/`) — a shared, frozen Students-feature component also rendered by other frozen/other-milestone surfaces. Fixing it is out of this milestone's scope and is documented here as inherited, pre-existing debt rather than fixed silently.

---

## 2. Required-section walkthrough

**Routes.** `/dashboard/bookings` (List), `/dashboard/bookings/[bookingId]` (Detail), `/dashboard/bookings/new` (Create), `/dashboard/bookings/[bookingId]/reschedule` (Reschedule). `POST /api/bookings` (intentionally public, rate-limited, staff-authenticated dashboard creation flow via `BookingService`), plus the authenticated mutation routes (`cancel`, `centre`, `reschedule`, `status`, `bulk-delete`, `bulk-update`, `DELETE [bookingId]`). No new routes added.

**Components.** `BookingsTable`, `BookingsFilters` (both client, List); `AttendanceDropdown`, `ReassignCentreButton`/`ReassignCentreModal`, `MarkAttendedButton` (client, Detail); `RescheduleForm` (client, Reschedule); `BookingForm` (client, shared across three hosts — **not modified**, see below). All Server Components (`page.tsx` files) unchanged in responsibility, only presentation and (List/Detail/Reschedule) the specific narrow fixes documented above.

**Server actions / API endpoints.** `src/features/bookings/actions.ts` (`updateBookingStatus`, `rescheduleBooking`, `saveAssessmentFeedback`, `sendAssessmentFeedback`, `markAttendeeAttendance`, `registerWalkInChild`/`registerExistingChildWalkIn`, `getExportData`) and the API routes under `src/app/api/bookings/`. Full inventory and the mutation-authorization matrix are in the Stage-A audit §E.

**Data model.** `bookings` has **no `organisationId` column** — tenant ownership is entirely inherited via `centreId → centres.organisationId`; `centreId` is nullable (a latent fragility, documented not fixed, per the ticket's explicit "no schema migration without a STOP-and-report" boundary). `bookingAttendees` is the per-child attendance/feedback join row. `clubSessions` is the actual structured session/slot table Bookings uses — distinct from the out-of-scope `centres.sessionSlots` JSON field (§ below). No schema changes were made anywhere in this milestone.

**Business behaviour.** Preserved exactly, with the two narrow Stage-B defect fixes and the responsive-regression fix documented above being the only functional changes; every other mutation, validation rule, and redirect is unchanged.

**Server/client boundaries.** No new Server→Client function-prop crossings were introduced. Every restyled component kept its existing `'use client'`/Server Component split. Re-audited live via console/`pageerror` listeners across every verification pass (screenshots, functional exercises) — zero RSC-boundary errors, zero hydration errors, zero non-serializable-prop errors observed.

**Security/RBAC audit + authorization matrix.** Stage-A audit §E (mutation-authorization matrix) and §G (four fixed defects); this report's §7 below re-states the full security-regression verification performed at the end of Stage B, with role-authorization and organisation/centre isolation reported separately per the ticket's instruction.

**Tenant/organisation isolation.** Re-verified live at the end of Stage B (not just via the existing unit-test suite) against a throwaway second-organisation booking: Booking Detail → `404`; Reschedule → redirect to `/dashboard/bookings`; `DELETE /api/bookings/[bookingId]` → `403`. See §7.

**Parents API audit (mandatory).** See §4 below.

**List/Detail/Create/Reschedule UI.** All four modernised as described in §1. Calendar/date/session interfaces (Reschedule's date/time pickers, the booking-status timeline) retained their workflow-specific structure rather than being forced into a record-management table layout, per the ticket's explicit allowance.

**Responsive/theme verification.** §5 below.

**RSC boundary safety.** No new boundary crossings; confirmed via live console/`pageerror` monitoring on every capture and functional exercise — zero errors across the entire verification pass.

**Quality gates.** §6 below.

**No business-logic regression / no unnecessary new primitives / no guessed authorization policy.** Confirmed throughout. Every fix (Stage A, the Stage-A follow-up, and the two Stage-B defects) traces to evidence — a sibling endpoint, an existing status enum, an existing joined alias — never an invented rule. No new shared primitive was created; every restyled surface reuses `Table`/`Card`/`Badge`/`Button`/`EmptyState`/`Skeleton` and the established token vocabulary.

**Shared `BookingForm` (ticket §6).** Left byte-for-byte unmodified. All three hosts were regression-checked live after the surrounding pages changed, with console/`pageerror` monitoring on each: the authenticated dashboard host (`/dashboard/bookings/new`) — new-family entry, existing-family search (`GET /api/search`) and selection (`GET /api/parents/[id]`, exercising the Stage-A role-restriction fix end-to-end) all functioned with zero errors; the public org/centre host (`/book/[orgSlug]/[centreSlug]`) — loaded and rendered its own unchanged styling, zero errors; the public centre-subdomain host (`/centre-portal/[subdomain]/book`) — same. No visual change was made to any of the three hosts; only the dashboard host's surrounding chrome (centre picker, wrapper) was restyled.

---

## 3. Stage-A Review Follow-up

Per the orchestrator's explicit instruction (§1 and §16 of the Stage-B authorisation), both required investigations were completed before any visual work began, and are restated here in full for the record.

### A. `/dashboard/bookings/[bookingId]/reschedule`

- **Prior behaviour:** the page loaded the booking (with parent, centre, and attendee data) and rendered the current date/time and a reschedule form with **no authorization check of any kind** beyond requiring an authenticated session — no organisation check, no centre-membership check. This was a strictly worse state than Booking Detail's pre-Stage-A-fix condition, which at least checked organisation match.
- **Data exposed:** child first/last name (via the page header), booking date/time, and (via `RescheduleForm`) the centre's operating hours — all for a booking in another organisation entirely, reachable by any authenticated staff member who could guess or enumerate a booking UUID.
- **Organisation check:** absent before the fix. Added: `booking.centreOrganisationId !== session.user.organisationId` → `redirect('/dashboard/bookings')`.
- **Centre check:** absent before the fix. Added: for non-`ORG_OWNER` users, `accessibleCentreIds.includes(booking.centreId)` → `redirect('/dashboard/bookings')` if not, matching the check already enforced by the reschedule mutation (`POST /api/bookings/[bookingId]/reschedule`) and by Booking Detail.
- **Final decision:** confirmed narrow centre/organisation-isolation defect; the already-evidenced policy (same as Booking Detail and the mutation APIs) was applied, not a new one invented.
- **Code change:** `src/app/dashboard/bookings/[bookingId]/reschedule/page.tsx` — added both checks immediately after the "booking not found" check, with an added `centreOrganisationId: centres.organisationId` column to the existing `db.select()`.
- **Regression test:** `src/features/bookings/authorization.test.ts`, describe block "ReschedulePage — organisation + centre isolation" — 4 tests (cross-org denial, cross-centre same-org denial, same-centre allow, `ORG_OWNER` bypass). Additionally reverified live with throwaway seed data (a real `psql`-inserted cross-org booking, navigated to as the seeded test user via a one-off Playwright script) before this fix was committed, and reconfirmed again during Stage B's final security-regression pass (§7).

### B. `GET /api/bookings/[bookingId]`

- **Prior behaviour:** does not exist. `src/app/api/bookings/[bookingId]/route.ts` exports only `DELETE`.
- **Data exposed:** none — there is no handler to expose anything. A `GET` request receives Next.js's standard `405 Method Not Allowed` with no payload, before any application code (including `auth()`) executes — confirmed live via `curl` against a running dev server.
- **Organisation check:** not applicable — no handler exists to check.
- **Centre check:** not applicable — no handler exists to check.
- **Final decision:** no defect, no change. Per the instruction not to invent a new role policy, no `GET` handler was added.
- **Code change:** none.
- **Regression test:** `src/features/bookings/authorization.test.ts`, describe block "GET /api/bookings/[bookingId] — confirmed absent" — asserts the route module exports no `GET` and does export `DELETE`, so a future PR that adds an unprotected `GET` handler here fails this test rather than shipping silently.

---

## 4. Parents API audit (mandatory, ticket §18)

`GET /api/parents/[id]` has exactly two consumers in the codebase: `ParentProfileClient.tsx` (Parents module) and `BookingForm.tsx` (this module, via its "existing parent" search-and-select flow). `BookingForm` reads only `firstName`/`lastName`/`email`/`phone`/`preferredContact` from the parent, plus each child's `id`/`firstName`/`lastName`/`schoolYear`/`dateOfBirth` — never `stripeCustomerId`, `magicLinkToken`, `magicLinkExpiresAt`, or address fields, all of which the endpoint used to return via an unfiltered full-row spread.

Milestone 3B's audit had *deliberately* left this endpoint role-unrestricted, explicitly because "Bookings redesign/RBAC is explicitly excluded" from that milestone and restricting it "risks silently breaking booking creation for a role this milestone hasn't reviewed" — flagged in that audit for "a future, properly-scoped Bookings/cross-module authorization pass," with a regression test (`src/features/parents/authorization.test.ts`) documenting the deliberate non-restriction. This milestone is that pass.

`BookingForm`'s only authenticated host (`/dashboard/bookings/new`) requires `requireAuth({ roles: ['ORG_OWNER','MANAGER','FRONT_DESK'] })` — the exact same tuple already used by this endpoint's own `PATCH` sibling and by the Parents module's own detail page. Applying that tuple to `GET` closes the 3B-deferred gap with zero legitimate breakage, since every real consumer already operates under that role floor. Fixed in Stage A (defect 4, §1 above); `src/features/parents/authorization.test.ts` was updated (not deleted) to replace its "deliberately unrestricted" tests with role-enforcement tests (403 for TUTOR, 401 unauthenticated, pass-through for the three allowed roles), and its header docblock updated to record the decision.

Per the orchestrator's explicit instruction: this endpoint has not been redesigned or replaced further, and no separate Bookings-specific parent endpoint was built for architectural neatness. The decision is final for this milestone unless new evidence arises.

---

## 5. Verification (dual-theme, responsive, seeded scenarios)

Seed data: the pre-existing "Bright Star Academy" org (3 centres: Main Campus, Secondary Campus, Riverside Annex; 11 parents; 12 children) with its 10 pre-existing bookings adjusted for visual/functional coverage across all six statuses (`confirmed`/Booked, `signed_up`/Signed-up, `pending`/Pending, `completed`/Attended, `cancelled`/Cancelled, `rescheduled`/Rescheduled) and across two centres (one booking moved to Secondary Campus for multi-centre coverage).

Live verification performed, with console/`pageerror` monitoring attached throughout (zero errors recorded across every capture and exercise below):

- **Populated list** — all six statuses and both represented centres visible, correct badges, correct counts.
- **Filtered-empty state** — a no-match search now renders the plain `EmptyState` with a "Clear All Filters" action (previously showed a false error banner — see §1's search-defect fix).
- **Booking Detail** — full record render, lifecycle timeline, attendee card, parent info, reassign-centre control.
- **New booking** — centre picker (3 centres), dashboard-host `BookingForm` (new-family entry; existing-family search returning a real match; parent selection round-tripping through the Stage-A-fixed `GET /api/parents/[id]`, confirmed via both the UI's "✓ Linked" state and the server log showing the request return `200`).
- **Reschedule** — page load, current-booking summary, date/time form.
- **Reassign centre** — full end-to-end exercise: dropdown → modal → select new centre → Save → `PATCH /api/bookings/[bookingId]/centre` (server-logged `200`) → database row confirmed updated via `psql`, then reverted to restore seed state.
- **Cancel-booking confirmation modal** — rendered correctly (not confirmed, to avoid mutating seed data unnecessarily beyond what was needed for the check).
- **Existing-parent selection, child selection** — exercised via the `BookingForm` "Existing Family" flow described above; session/date/time selection and full booking submission were not separately exercised beyond `RescheduleForm`'s equivalent date/time flow, since `BookingForm` itself is unmodified and its own creation-flow correctness is outside this milestone's diff.
- **Role denial, cross-centre denial, cross-org denial** — see §7.

Responsive: 1440/834/375px, List/Detail/Reschedule/New. No horizontal overflow at 1440 or 834 on any page (`document.documentElement.scrollWidth` measured equal to viewport width throughout). At 375px, one regression was found and fixed (Detail page header wrapping — §1); a small residual 28px overflow on Detail traces to a frozen, out-of-scope Students-feature component (`InternalNotesTimeline`) and is documented, not fixed. No other page overflows at 375px.

Theme: both bright and dark captured across List/Detail/Reschedule/New at 1440px; no hardcoded colours found on any restyled surface — all use semantic tokens (`bg-danger-soft`/`text-danger`, `bg-success-soft`/`text-success`, `bg-warning-soft`/`text-warning`, `bg-accent-soft`/`text-accent`, etc.), consistent with every other modernised module.

---

## 6. Quality gates

- `npm run typecheck` (`tsc --noEmit`) — 0 errors. Run repeatedly through the implementation and after every fix, including the final pass after all Stage-B defect fixes.
- `npm run lint` — 0 errors, 0 warnings across the whole repository (final pass run after all changes, not just the Bookings paths).
- `npx vitest run` — **301 tests passing**, 1 unrelated pre-existing collection failure (`src/features/communications/actions.test.ts`, a `next/server` module-resolution issue in `next-auth`'s import graph, unchanged since Milestone 2.5 and present before this milestone started).
- `npm run build` — passes; all Bookings routes (List, Detail, New, Reschedule, and every API route) compile and appear in the production route manifest.

New/updated tests this milestone: `src/features/bookings/authorization.test.ts` (new file, 17 tests across DELETE centre-membership, reassign source-centre-membership, Booking Detail centre-membership, Reschedule organisation+centre isolation, and the `GET`-absence guard); `src/features/parents/authorization.test.ts` (updated, not deleted — §4 above).

---

## 7. Security regression verification

Role authorization and organisation/centre isolation are reported separately, per the orchestrator's explicit instruction.

**Role authorization (automated, `authorization.test.ts` suites):**
- `GET /api/parents/[id]` — 403 for TUTOR, 401 unauthenticated, pass-through for `ORG_OWNER`/`MANAGER`/`FRONT_DESK`. ✅
- `getExportData` (the one Bookings action with a role check) continues to block TUTOR. ✅ (unchanged, verified present)

**Organisation/centre isolation (automated + live re-verification with throwaway seed data):**
- Cross-org Booking Detail denial — `404`. ✅ Reverified live.
- Cross-centre Booking Detail denial — `404`. ✅ (automated, Stage A)
- Cross-centre Reschedule-page denial — redirect to `/dashboard/bookings`. ✅ (automated + live, Stage-A follow-up and reverified in Stage B)
- Cross-org Reschedule-page denial — redirect to `/dashboard/bookings`, no data leak. ✅ Reverified live in Stage B.
- `GET /api/bookings/[bookingId]` centre isolation — **N/A, route does not exist** (guarded by a regression test against future addition).
- Single-booking `DELETE` centre isolation — 403 for a wrong-centre non-owner. ✅ (automated, Stage A) Reverified live in Stage B against a throwaway cross-org booking — `403 {"error":"Forbidden"}`.
- Reassign source-centre isolation — 403 if the *current* centre isn't accessible. ✅ (automated, Stage A)
- Reassign target-centre isolation — 403 if the *target* centre isn't accessible (pre-existing, unchanged). ✅
- `GET /api/parents/[id]` organisation isolation — pre-existing organisation scoping on the endpoint, unaffected by the new role check. ✅ (unchanged, verified present)

Live cross-org re-verification method (Stage B, §5 above): a throwaway organisation/centre/parent/booking were inserted via `psql`, exercised as the authenticated `ORG_OWNER` of the real seed organisation via Playwright, and deleted via `psql` immediately after. No leaked data (child name, parent contact details, centre name) appeared in `document.body.innerText` on either the Detail or Reschedule page for the cross-org booking; the `DELETE` API call returned `403`.

---

## 8. Ambiguities — not resolved, not fixed (deferred, per instruction)

- **`TUTOR` cancel/reschedule/status-change policy.** No repository evidence conclusively establishes whether `TUTOR` may cancel, reschedule, or change the status of a booking — six of seven Bookings server actions currently have an organisation check but no role check, meaning `TUTOR` (and any other authenticated org member) can currently perform these mutations. This was identified in the Stage-A audit, explicitly not resolved (no policy invented), and the orchestrator explicitly accepted deferring it. No new repository evidence surfaced during Stage B that would resolve it, so it remains deferred and is **not fixed in this milestone**. This is the single most consequential open item for a future, properly-scoped pass.
- **`bookingPlans`/`waitlistEntries`** exist in the schema with a service layer but no dashboard UI consumes either — confirmed still true, not built out (waitlist/booking-plan UI is explicitly out of scope per the ticket).
- **Capacity enforcement** — no repository evidence of an enforced booking-capacity limit against `clubSessions.capacity` on the dashboard creation path. Not resolved; no new capacity engine was built (explicitly out of scope).
- **Two independent booking-creation code paths** — `BookingService.createBooking()` (dashboard, via `POST /api/bookings`) and the parent self-service portal's direct `db.insert()` (`src/app/portal/book/actions.ts`) remain separate. Not unified (explicitly out of scope without product-owner approval).

## 9. Out-of-scope debt (confirmed present, deliberately untouched)

- `centres.sessionSlots` (a JSON `string[]`, used only by the public portal/registration flows) remains architecturally distinct from `clubSessions` (the structured table Dashboard Bookings actually uses) — confirmed again this milestone; not modified.
- `AppointmentScorecard.tsx`/`BookingList.tsx` — dead code, not imported anywhere, still carrying the old visual language. Not restyled or deleted (§1).
- `InternalNotesTimeline`'s 28px 375px overflow (`Safeguarding` label) — a shared, frozen Students-feature component. Not fixed (§1, §5).
- `getAttendanceColorClass`/`getAttendanceLabel` (`src/lib/attendance.ts`) still use hardcoded Tailwind colour utilities (`bg-emerald-500/20`, etc.) rather than semantic tokens — shared with the Students module (`StudentProfile`, `ActivityTab`, the Students attendance page). `AttendanceDropdown`'s surrounding chrome was modernised onto tokens; the shared colour function itself was left untouched to avoid an unreviewed cross-module change.
- Finance, Attendance (except the tiny already-confirmed-safe scope above), Parent Portal, Org Settings/Operating Hours, Students, Parents, Staff, Centres, Communications, Reports — all untouched, per the ticket's explicit out-of-scope list.

---

## 10. Similarity rating

| Area | Rating | Notes |
|---|---|---|
| Bookings List | CLOSE | Full `Table`/`EmptyState`/`Button`/segmented-tabs primitive adoption; responsive card view below `md`; matches Students/Parents/Staff/Centres structurally. |
| Booking Detail | CLOSE | `Card`/`Badge`/token adoption thorough; lifecycle timeline retains its own workflow-appropriate structure rather than being forced into a record-management layout, per the ticket's explicit allowance for scheduling UI. |
| Create (New Booking) | CLOSE | Wrapper/chrome fully modernised; `BookingForm` itself deliberately preserved unchanged to protect its two public hosts, per ticket §6 — a deliberate, documented exception, not a gap. |
| Reschedule | CLOSE | Wrapper and `RescheduleForm` fully modernised on `Card`/`Button`/token inputs; date/time pickers retain their workflow-specific structure. |
| Responsive behaviour | CLOSE | Verified at 1440/834/375; the one regression found was fixed before commit; the one residual overflow is pre-existing, out-of-scope, frozen-component debt, documented rather than hidden. |
| Bright theme | CLOSE | No hardcoded colours found on any restyled Bookings-owned surface. |
| Dark theme | CLOSE | Verified via the same captures — full token-driven contrast. |
| Shared primitives | CLOSE | No new primitive created; every restyled surface composes from `Table`/`Card`/`Badge`/`Button`/`EmptyState`/`Skeleton` and the established tokens. |
| Security posture | CLOSE | Four Stage-A defects + one Stage-A-follow-up defect, all evidenced and fixed with regression coverage; the one deliberately deferred policy question (`TUTOR` mutation rights) is flagged prominently, not silently left. |
| Overall | CLOSE | Two further evidenced, narrow functional defects (broken search, missing status in aggregates) found and fixed during verification rather than shipped; one Stage-B-introduced responsive regression caught and fixed before commit; every preserved architectural decision (shared `BookingForm`, dual creation paths, `sessionSlots` split) is deliberate and documented, not an oversight. |

No area is rated below CLOSE.

---

## 11. Git handoff

Base SHA: `c291653`.

**Why no "Final SHA" is hardcoded below:** identical structural reason as every prior milestone's completion report in this project — a commit's hash is computed from its own content, so a file committed as part of a change set cannot correctly name that same commit's hash. The authoritative tip is whatever `git log c291653..HEAD` reports on the actual repository at delivery time, or equivalently the ref printed by `git bundle verify` on the delivered bundle.

Commits in this milestone, oldest first:

1. `1120943` — docs+fix: Bookings Stage-A audit; close four evidenced centre/role authorization gaps
2. `0ae249e` — fix: close reschedule-page organisation isolation gap; confirm `GET /api/bookings/[bookingId]` absent
3. `e779107` — docs+fix: Bookings Stage-B visual modernisation

Push to `origin` is blocked by the sandbox's git-proxy restriction (`403`, "not in this session's authorized repository set"), consistent with every prior milestone this session — reconfirmed at the start of Stage B and again here. Per the orchestrator's §15 instruction, a **final** bundle superseding the Stage-A-only bundle has been produced: `milestone-3e-bookings-final.bundle`, covering `c291653..HEAD` (all three commits above). Verified with `git bundle verify` and sanity-tested against a scratch clone (`git merge-base --is-ancestor c291653 <bundle-tip>` confirmed true — a clean fast-forward). The exact tip it contains is whatever `git bundle verify` reports for that specific file, not a hash typed into this document.

---

## 12. Explicit stop

Per the orchestrator's §17 stop condition: Milestone 3E Bookings implementation, verification, this completion report, and the final git bundle are complete. **No work has begun on Milestone 3F or any other module. No merge to `main` has been made.** This report is the handoff for orchestrator review.
