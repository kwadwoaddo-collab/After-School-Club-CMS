# Milestone 3E — Bookings Module: Stage A Audit

## Starting state

Ticket's expected starting commit: `8e3681a`. Actual `HEAD` at the start of
this milestone was `c291653` — one commit ahead, consisting solely of
`docs(milestone-3d): stop hardcoding a self-referential final SHA in the
completion report` (a documentation-only fix made in direct response to an
explicit, out-of-band user request during Milestone 3D's closeout, with zero
application-code diff). Per the ticket's "STOP and report the discrepancy"
instruction, this was reported to the user via a structured question rather
than silently proceeding or altering git history; the user selected
"Treat c291653 as the base." No git history was reset, rebased, or amended.
Working tree was clean at the start of this milestone.

## A. Surface inventory

**Dashboard (staff-facing, in scope):**

| Route/file | Purpose | Component type | Auth |
|---|---|---|---|
| `/dashboard/bookings` (`page.tsx`) | List, search, filter, paginate bookings | Server | `auth()` only — no role gate |
| `/dashboard/bookings/new` (`page.tsx`) | Centre picker + create-booking form | Server | `requireAuth({roles:[ORG_OWNER,MANAGER,FRONT_DESK]})` |
| `/dashboard/bookings/[bookingId]` (`page.tsx`) | Booking detail — attendees, parent info, staff, notes | Server | `auth()` only (no role gate; centre gate added this milestone, see §G) |
| `/dashboard/bookings/[bookingId]/reschedule` (`page.tsx`) | Reschedule form | Server | `auth()` only — no role gate |
| `/dashboard/bookings/[bookingId]/AttendanceDropdown.tsx` | Per-child attendance status control | Client | calls `markAttendeeAttendance` action |
| `src/features/bookings/components/BookingForm.tsx` | Multi-step create/reschedule form (1044 lines) | Client | shared across 3 hosts, see §D |
| `src/features/bookings/components/BookingsTable.tsx` / `BookingList.tsx` / `BookingsFilters.tsx` | List rendering, filters | Client | — |
| `src/features/bookings/components/MarkAttendedButton.tsx` | Status-change control (booking-level) | Client | calls `PATCH .../status` |
| `src/features/bookings/components/ReassignCentreButton.tsx` / `ReassignCentreModal.tsx` | Centre-reassignment control | Client | calls `PATCH .../centre` |
| `src/features/bookings/components/RescheduleForm.tsx` | Reschedule submission | Client | calls `POST .../reschedule` |
| `src/features/bookings/components/AppointmentScorecard.tsx` | Dashboard KPI widget | Client | — |
| `src/features/bookings/actions.ts` | Server actions (status, reschedule, feedback, attendance, walk-in registration, export) | Server actions | org-check only on 6 of 7 (see §E) |
| `src/lib/services/booking.ts` (`BookingService`) | Create/cancel booking with Calendar+notification side effects | Service | used by public `POST /api/bookings` and `scripts/test-booking.ts` |
| `src/lib/validations/booking.ts` | Zod schemas for the public booking flow | — | — |

**API routes (`/api/bookings/**`):**

`POST /api/bookings` (public, rate-limited, by design — see §D), `GET`/`DELETE` `[bookingId]`, `POST [bookingId]/cancel`, `PATCH [bookingId]/centre`, `POST [bookingId]/reschedule`, `PATCH [bookingId]/status`, `DELETE bulk-delete`, `PATCH bulk-update`. All except the public `POST` require `auth()`; role/centre enforcement is inconsistent — see §E/§G.

**Cross-module consumers / dependencies (not themselves redesigned):**

- `src/app/portal/book/**` — a **separate**, parent-facing self-service booking/reschedule flow (`createPortalBooking`, `reschedulePortalBooking` in `portal/book/actions.ts`) that inserts directly into `bookings`/`bookingAttendees`, bypassing `BookingService` entirely. Uses the legacy (pre-token-system) `bg-surface`/`bg-card`/`rounded-2xl` visual language, distinct from both the dashboard's design and the frozen People-module tokens.
- `src/app/book/[orgSlug]/[centreSlug]` and `src/app/centre-portal/[subdomain]/book` — **public**, unauthenticated marketing/white-label hosts for `BookingForm`.
- `src/features/attendance/**`, `src/app/dashboard/attendance/**`, `src/app/dashboard/kiosk/**` — read/write `bookings`/`bookingAttendees` for daily register and walk-in flows (`registerWalkInChild`, `registerExistingChildWalkIn` in `bookings/actions.ts`). Out of scope; Attendance module is frozen per ticket.
- `src/app/api/reports/bookings`, `src/features/reports/**` — reporting queries over `bookings`. Out of scope (Finance/Reports frozen).
- `src/lib/services/availability.ts`, `capacity.ts`, `waitlist.ts`, `plan.ts` — availability/capacity/waitlist/booking-plan logic backing `clubSessions` (the structured session table — see §B). Reviewed at the interface level only; not modified.
- `src/lib/services/google-calendar.ts`, `stripe.ts`, `notifications.ts`, `email.ts`, `sms.ts` — integrations triggered from `BookingService`/API routes. Reviewed at the call-site level only (see §F); not modified.

## B. Data model

`bookings` (the record this module's dashboard surfaces manage): `id`, `centreId` (nullable FK → `centres`, no cascade), `parentId` (FK → `parents`, cascade, **not** nullable), `staffId` (FK → `users`), `sessionId` (FK → `clubSessions`, set-null), `assessmentType`, `startAt`, `duration`, `modality`, `status` (`bookingStatusEnum`: confirmed/cancelled/rescheduled/completed/pending/signed_up), `confirmationCode` (unique), `magicLinkToken` (unique), `googleCalendarEventId`, `communicationsConsent`, timestamps. Unique constraint on `(centreId, modality, startAt, parentId)` prevents double-booking at the DB level. **No `organisationId` column** — tenant ownership is entirely inherited, via `centreId → centres.organisationId` (used everywhere in this codebase) or `parentId → parents.organisationId` (unused for scoping, but available). Since `centreId` is nullable, a booking with a null centre would be unreachable by every organisation-scoping check in this codebase (all of them join through `centre`); no evidence was found of bookings actually having a null `centreId` in practice, but this is a latent data-model fragility worth naming rather than fixing (schema change, out of scope without a demonstrated defect).

`bookingAttendees`: per-child join row carrying its own attendance state (`attendanceStatus`, `attendanceNote`, `lateMinutes`, `attendanceMarkedAt/By`, `checkInAt/checkOutAt`, `sessionType`, `absenceReason`, `forgivenBy/At/Note`) and assessment-feedback state (`feedbackNotes/Score/AttachmentBase64/Mime/Status/SentAt`). Unique on `(bookingId, childId)`.

`clubSessions`: the actual structured session/slot table this module's bookings reference (`organisationId`, `centreId`, `type` [breakfast/after_school/holiday], `weekday`, `startTime`, `endTime`, `capacity`, `price`, `amPrice`/`pmPrice`, `earlyBirdCutoffDate`/`Price`). **This is a distinct table from `centres.sessionSlots`** (see §C) — `bookings.sessionId` references `clubSessions`, not the Centres module's JSON field. `bookingPlans` (recurring term-based bookings) and `waitlistEntries` also reference `clubSessions`; no dashboard UI consumes either table today — they appear to be schema/service-layer only (a `plan.ts`/`waitlist.ts` service exists but no route under `/dashboard/bookings` renders a "plans" or "waitlist" view). Flagged as an ambiguity, not a gap to fill — see §I.

Lifecycle, evidenced from code (not invented): `pending`/`confirmed` → `completed` | `cancelled` | `rescheduled`, set via `updateBookingStatus`, `PATCH .../status`, `rescheduleBooking`/`PATCH .../reschedule` (which forces the new row back to `confirmed`), and `POST .../cancel` (which sets `cancelled` and is idempotent if already cancelled). No state-machine validation exists anywhere — any status can be PATCHed to any other status via `PATCH .../status` or `bulk-update`. No evidence this is a defect (no illegal-transition bug report or observed data corruption); flagged as debt, not fixed.

## C. `sessionSlots` interaction (ticket §10)

Confirmed: the dashboard Bookings module (`BookingForm`, `actions.ts`, the List/Detail pages) **does not read or write `centres.sessionSlots` at all**. It uses `clubSessions` exclusively for session data. The only consumers of `centres.sessionSlots` (the JSON `string[]` field) are the **public portal booking flow** (`src/app/portal/book/**`), the **public registration flow** (`src/app/register/[...slug]/page.tsx`, `src/app/dashboard/registrations/[id]/page.tsx`), the Org-Settings `CentreHoursForm`/`CentreHoursTab` (already documented as out-of-scope debt in Milestone 3D), and `StudentProfile.tsx`. Since the dashboard Bookings module itself has zero dependency on `sessionSlots`, there is no evidenced defect requiring any change here; the pre-existing shape mismatch documented in 3D remains untouched, as instructed.

## D. Create/reschedule flow

Two independent code paths create rows in `bookings`, which is itself worth flagging (§I):

1. **Staff-authenticated dashboard flow**: `/dashboard/bookings/new` → `BookingForm` → `POST /api/bookings` → `BookingService.createBooking()`. Resolves/creates parent+children via `resolveOrCreateParent`/`resolveOrCreateChild`, creates a Google Calendar event, sends email/SMS confirmation, creates a Stripe customer if needed, writes an in-app owner notification. `POST /api/bookings` is **intentionally public/unauthenticated** (rate-limited via `apiRateLimit`) because the identical endpoint also backs the two public marketing/white-label hosts below — this is by design, not a gap.
2. **Public parent self-service flow**: `/portal/book` → `createPortalBooking`/`reschedulePortalBooking` (`portal/book/actions.ts`) → direct `db.insert(bookings)`/`bookingAttendees`, bypassing `BookingService`, Calendar sync, and Stripe entirely. Duplicate-booking checked via both an explicit query and reliance on the DB unique constraint.

`BookingForm` is shared, unmodified, across three hosts with different auth postures: `/dashboard/bookings/new` (staff, `requireAuth({roles:[ORG_OWNER,MANAGER,FRONT_DESK]})`), `/book/[orgSlug]/[centreSlug]` (public), `/centre-portal/[subdomain]/book` (public). Its "existing parent" lookup mode (search + autofill) is rendered unconditionally regardless of host — in the public hosts, the underlying `GET /api/search` call 401s for an unauthenticated visitor, so that mode is non-functional there in practice, but nothing in the component itself gates it off. This is pre-existing behaviour, not changed this milestone (no evidence of exploitability, since the endpoints it calls are still auth-checked — see §H).

Capacity/conflict checking on the dashboard create path is limited to the DB unique constraint (`(centreId, modality, startAt, parentId)`) plus a pre-insert `slotHolds` reservation (`AvailabilityService.holdSlot`) to reduce double-booking races on the public endpoint; no capacity-vs-`clubSessions.capacity` check was found wired into `BookingService.createBooking` or the dashboard form itself (capacity logic exists in `src/lib/services/capacity.ts` but no evidenced call site inside the Bookings creation path was found). This is recorded as an ambiguity/gap for product-owner attention, not fixed — no bug report or reproduction evidences it as a live defect.

## E. Mutation-authorization audit (ticket §16)

Every action in `src/features/bookings/actions.ts` was checked. Six of seven check organisation membership only (`session?.user?.organisationId`), with **no role check whatsoever**: `updateBookingStatus`, `rescheduleBooking`, `saveAssessmentFeedback`, `sendAssessmentFeedback`, `markAttendeeAttendance`, `registerWalkInChild`/`registerExistingChildWalkIn`. Only `getExportData` has a role check (blocks `TUTOR`). This mirrors the org-check-only pattern found and fixed in every prior milestone, but here it is **not confirmed as a defect** for most of these actions, because — unlike Parents/Staff/Centres, where a stricter page-level or sibling-endpoint role gate already existed as evidence of intended policy — no such sibling evidence exists for booking status/reschedule/attendance mutations: the pages hosting them (`/dashboard/bookings`, `/dashboard/bookings/[bookingId]`, the reschedule page) are themselves `auth()`-only with no role restriction, and the equivalent `/api/bookings/**` mutation routes (cancel, reschedule, status) are also role-unrestricted (centre-membership-only). There is no internal inconsistency here to point to as evidence — see §I for why this is recorded as an ambiguity rather than "fixed."

Where a genuine, **evidenced** inconsistency was found — one endpoint enforcing a check that an identical sibling endpoint (same action, same data) omits — it is treated as a confirmed defect and fixed. Three such cases were found (see §G).

## F. Integrations

`BookingService.createBooking`/`cancelBooking` call `googleCalendarService` (create/delete event, best-effort — failure is logged and does not block the booking), `notificationService`/`emailService` (email+SMS confirmation/cancellation/reschedule, best-effort), `stripeService.createCustomer` (best-effort, only if the parent lacks a `stripeCustomerId`), and `notifyOwners` (in-app bell, fire-and-forget). All failure paths are caught and logged without surfacing to the caller or blocking the booking — consistent, defensive design; no evidenced defect. IDs stored: `googleCalendarEventId`, `stripeCustomerId` (on `parents`, not `bookings`). No retry/idempotency layer beyond the DB unique constraint and `slotHolds`. Not modified — this milestone did not touch integration architecture.

## G. Confirmed defects — found and fixed

Each of the four defects below is a **narrow, dual-evidenced inconsistency**: an already-established, correctly-enforced check on one endpoint/page, missing from a sibling performing the identical action on the identical data. No new policy was invented in any of these fixes.

1. **`DELETE /api/bookings/[bookingId]`** checked organisation membership only. Its sibling `POST /api/bookings/bulk-delete` — the identical action, bulk form — already restricts non-`ORG_OWNER` users to bookings in their accessible centres. **Fixed**: added the same `getUserAccessibleCentreIds` check.
2. **`PATCH /api/bookings/[bookingId]/centre`** (reassign) checked the caller's access to the *target* centre (`canUserAccessCentre`) but never checked their access to the booking's *current* centre. Its siblings — `POST .../cancel`, `POST .../reschedule`, `PATCH .../status` — all check the current centre for non-`ORG_OWNER` users. Without this, a user could reassign a booking away from a centre they have no membership in, as long as they had access to some destination centre. **Fixed**: added the same source-centre check.
3. **`/dashboard/bookings/[bookingId]`** (the detail page) had no centre check at all — only an organisation check. The List page it's linked from only ever queries the viewer's accessible centres, and the mutation APIs acting on the same booking (cancel/reschedule/status) all enforce centre membership for non-`ORG_OWNER` users. A staff member could therefore view another centre's booking — child name/DOB, parent phone/email, internal notes — by navigating directly to its URL, inconsistent with both the list they'd normally browse from and the mutations gated on the same record. **Fixed**: added the same centre-membership check, `notFound()` on failure (matching the page's existing not-found pattern for cross-org access).
4. **`GET /api/parents/[id]`** (the mandatory §18 item) — see §H below.

Regression tests: `src/features/bookings/authorization.test.ts` (new, 8 tests) covers 1–3; `src/features/parents/authorization.test.ts` (updated) covers 4. `npm test` — 296 passing (unchanged pre-existing Communications collection failure, present since Milestone 2.5, not touched). `npm run typecheck` — 0 errors. `npm run lint` — 0 errors/warnings. `npm run build` — succeeds, all routes compile including every touched route.

## H. `GET /api/parents/[id]` audit (ticket §18 — mandatory)

**Consumers** (exhaustive, confirmed by grep across `src/`): exactly two — `src/app/dashboard/parents/[id]/ParentProfileClient.tsx` (Parents module) and `src/features/bookings/components/BookingForm.tsx` (`handleSelectParent`, this module).

**What `BookingForm` actually needs**: `data.parent.firstName`, `.lastName`, `.email`, `.phone`, `.preferredContact` (to autofill the parent-contact step), and `data.children[].{id, firstName, lastName, schoolYear, dateOfBirth}` (to populate the "existing child" picker). It does not read `stripeCustomerId`, `magicLinkToken`, `magicLinkExpiresAt`, `addressLine1/2`, `city`, `postcode`, `relationship`, `organisationId`, or any timestamp field — all of which the endpoint currently returns via a full-row spread.

**Legitimate Booking roles for this call site**: `BookingForm`'s only *authenticated* host is `/dashboard/bookings/new`, which requires `requireAuth({roles:[ORG_OWNER, MANAGER, FRONT_DESK]})`. Its two other hosts are unauthenticated public pages, where this endpoint already 401s regardless of role.

**History**: this endpoint was deliberately left role-unrestricted in Milestone 3B, explicitly *because* Bookings hadn't been audited yet (`project-notes/milestone-3b-parents-audit.md` §4: "Restricting this endpoint's role would risk breaking booking creation for any role that is allowed to create bookings but would be newly locked out... Flagged here for a future, properly-scoped Bookings/cross-module authorization pass."). A regression test (`src/features/parents/authorization.test.ts`) documented that decision in code.

**Finding**: the two role tuples now in evidence — the endpoint's own `PATCH` sibling (`ORG_OWNER, MANAGER, FRONT_DESK`) and `BookingForm`'s sole authenticated host — are **identical**. Applying that tuple to `GET` breaks no evidenced legitimate caller (the public hosts were already denied by the auth check; `ParentProfileClient` is already behind the same tuple at the page level). This closes the exact gap 3B flagged, using only evidence gathered this milestone, per §18's requirement to check all consumers before changing anything and not invent a new endpoint. **Fixed**: `GET` now requires the same three roles as `PATCH`. The 3B regression test documenting the old decision was updated (not deleted) to document the new one, with a pointer to this document.

## I. Ambiguities — not resolved, not fixed

- **Whether `TUTOR` should be able to cancel/reschedule/change the status of a booking.** Creation explicitly excludes `TUTOR` (`requireAuth` on `/dashboard/bookings/new`), but cancel/reschedule/status-change are centre-membership-gated only, with no role check — and there is no sibling endpoint or page enforcing a stricter rule to serve as evidence either way (contrast with the four items in §G, where a stricter sibling existed). Per the ticket's instruction not to invent permissions, this is left exactly as found.
- **`bookingPlans` and `waitlistEntries`**: fully modelled in the schema, with a service layer (`plan.ts`, `waitlist.ts`), but no dashboard route under `/dashboard/bookings` renders either. Unclear whether this is an intentionally deferred feature or a partially-built one. Not built out this milestone (ticket explicitly forbids creating product features because they "sound desirable").
- **Capacity enforcement at booking-creation time**: no call site connecting `capacity.ts` to `BookingService.createBooking` or `POST /api/bookings` was found. Not fixed — no reproduction or bug report evidences this as a live defect, and inventing enforcement without a demonstrated failure would be scope creep.
- **Two independent booking-creation code paths** (`BookingService.createBooking` for staff/public-widget bookings vs. direct-insert `createPortalBooking`/`reschedulePortalBooking` for the parent self-service portal) diverge in behaviour (Calendar sync, Stripe customer creation, notification channel) with no evidence either is wrong — flagged for product-owner awareness, not unified.

## J. Out-of-scope debt (confirmed present, deliberately untouched)

`centres.sessionSlots` / `CentreHoursForm` shape mismatch (pre-existing, documented in Milestone 3D, irrelevant to this module per §C above). `src/app/portal/book/**`'s legacy `bg-surface`/`rounded-2xl` visual language — this is the Parent Portal, not the staff-facing Bookings module this ticket scopes; out of scope. `getAvatarGradient` (shared legacy utility, already flagged in every prior milestone). The unrelated `src/features/communications/actions.test.ts` collection failure (present since Milestone 2.5).

## K. Proposed Stage B implementation scope

Modernise the staff-facing dashboard surfaces onto the frozen design system while preserving the calendar/scheduling-appropriate layout latitude the ticket explicitly grants: List (`page.tsx`, `BookingsTable`, `BookingsFilters`), Detail (`page.tsx`, `AttendanceDropdown`), New/Create host (`new/page.tsx` wrapper — `BookingForm` itself is shared with two public hosts and will be restyled carefully to avoid breaking those), Reschedule (`reschedule/page.tsx`, `RescheduleForm`), and the reassign-centre modal. Full responsive/theme verification, RSC boundary re-check under real seeded data, and the completion report follow per the ticket's process — all as a subsequent piece of this milestone's work.
