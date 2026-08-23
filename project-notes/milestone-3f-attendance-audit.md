# Milestone 3F — Attendance Module — Stage A Audit

Base: `8b91c38` (frozen Milestone 3E — Bookings tip), branch `rebuild/cms-modernisation`.
Starting-state verification: branch = `rebuild/cms-modernisation`, HEAD = `8b91c38`, working tree clean, local branch aligned with `origin/rebuild/cms-modernisation` (both at `8b91c38` after `git fetch`).

## A. Surface inventory

| Surface | Route/file | Purpose | Type |
|---|---|---|---|
| Daily register | `src/app/dashboard/attendance/page.tsx` | Server data loader: date/centre resolution, expected-attendee compilation, stats | Server Component |
| Roll call UI | `src/app/dashboard/attendance/AttendanceRollCall.tsx` (58.8KB) | Per-child check-in/out, absence marking, bulk actions, search, walk-in modal | Client (`'use client'`) |
| Register loading | `src/app/dashboard/attendance/loading.tsx` | Skeleton | Server Component |
| Session ledger | `src/app/dashboard/attendance/ledger/page.tsx` | Server loader for session-credit/forgiveness ledger | Server Component |
| Ledger UI | `src/app/dashboard/attendance/ledger/LedgerClient.tsx` (27.7KB) | Ledger table, filters, forgive action | Client (`'use client'`) |
| Kiosk | `src/app/dashboard/kiosk/page.tsx` | Server loader for kiosk register, privacy-scrubs child data | Server Component |
| Kiosk UI | `src/app/dashboard/kiosk/KioskRegister.tsx` (40.2KB) | Staff-operated check-in/out kiosk with PIN-style checkout confirmation | Client (`'use client'`) |
| Kiosk loading | `src/app/dashboard/kiosk/loading.tsx` | Skeleton | Server Component |
| Attendance server actions | `src/features/attendance/actions.ts` | `updateAttendanceTimelog`, `getSessionLedger`, `forgiveSessionsAction`, `updateChildFlags` | `'use server'` |
| Attendance utils | `src/features/attendance/utils.ts` | Academic-year/scheduled-day/late-minutes pure helpers | plain module |
| Shared read-path helpers | `src/lib/attendance.ts` | `resolveAttendanceStatus`, `getAttendanceLabel`, `getAttendanceColorClass`, `countAttendance`, `compileDailyRegisterSlots` | plain module |
| CSV export (reports) | `src/app/api/reports/attendance/route.ts` | GET, CSV export, MANAGER/ORG_OWNER only, centre-scoped | API route |
| CSV export (register) | `src/app/api/export/register/route.ts` | GET, CSV export, any staff role, centre-scoped | API route |
| Student attendance history | `src/app/dashboard/students/[id]/attendance/page.tsx` | Per-child attendance history — lives under the **frozen Students module**, reuses shared read-path helpers | Server Component (out of scope, see M) |
| Bookings-owned attendance writes | `src/features/bookings/actions.ts` — `markAttendeeAttendance`, `registerWalkInChild`, `registerExistingChildWalkIn` | The actual mutation functions called by both Attendance surfaces and Kiosk | `'use server'` (Bookings-owned, frozen) |
| Booking Detail attendance controls | `src/app/dashboard/bookings/[bookingId]/AttendanceDropdown.tsx`, `src/features/bookings/components/MarkAttendedButton.tsx` | Frozen Bookings surfaces with their own attendance-adjacent controls | Client |

No `error.tsx` exists for any Attendance surface. No test files exist for `AttendanceRollCall.tsx`, `KioskRegister.tsx`, `LedgerClient.tsx`, or `src/features/attendance/actions.ts`.

## B. Data model / source of truth

`bookingAttendees` (`src/db/schema.ts:368-401`) is the **sole authoritative attendance table** — no standalone `attendance` table exists. One row per `(bookingId, childId)` (unique constraint, line 398), FK'd to `bookings`/`children` (cascade), org/centre inherited transitively via `bookingId → bookings.centreId → centres.organisationId`. Confirmed columns match the ticket's list exactly: `attendanceStatus` (enum `present|absent|late|no_show|excused`), `attendanceNote`, `lateMinutes`, `attendanceMarkedAt`, `attendanceMarkedBy` (→users), `checkInAt`/`checkOutAt` (timestamptz), `sessionType` (enum `scheduled|extra`), `absenceReason` (enum `illness|holiday|family|other`), `forgivenBy`/`forgivenAt`/`forgivenNote`.

`sessionCredits` (`schema.ts:711-723`) is a **separate** admin-granted forgiveness/credit ledger (child, academic year, sessions amount, admin, note) — this is what backs `/dashboard/attendance/ledger`, distinct from the per-attendee `forgiven*` columns on `bookingAttendees`.

`clubSessions` defines the recurring weekly session template a booking belongs to; `bookingAttendees.sessionType` distinguishes attendance against a regular scheduled slot vs. an ad-hoc "extra"/walk-in slot.

Precedence when both an explicit `bookingAttendees.attendanceStatus` and a `bookings.status` exist: **`attendanceStatus` wins**; `bookings.status` is only used as a legacy inference fallback (`resolveAttendanceStatus`, `src/lib/attendance.ts:43-70`, mapping `completed→present`, `cancelled→cancelled`, `rescheduled→rescheduled`). This precedence is documented in code comments, not in the schema itself.

The historical migrations (`src/scripts/add-attendance-columns.sql`, `src/db/migrations/20260714_03_attendance_timelog_and_ledger.sql`) are superseded by `drizzle/0013_brave_cerise.sql`, which converts the original varchar `check_in_time`/`check_out_time` to the current `timestamptz` `check_in_at`/`check_out_at` and backfills — this matches the live schema exactly.

## C. Attendance statuses / lifecycle

Real enum values: `present`, `absent`, `late`, `no_show`, `excused` (`schema.ts`, `attendance_status` enum). From the Attendance module's own UI, only **`present`** (via check-in) and **`absent`** (via a 4-reason picker: illness/holiday/family/other) are directly settable. **`late`** is never chosen manually — it is derived server-side from check-in time vs. slot time with a 10-minute grace window (`deriveLateMinutes`, `src/features/attendance/utils.ts:46-53`). `no_show` and `excused` are not set anywhere in the Attendance module or Kiosk; they exist only in the shared label/color helpers and are set from Booking Detail's `AttendanceDropdown`. Check-in/check-out is supplementary to (and drives) attendance status, not a separate workflow — setting a check-in time is what produces `present`/`late`.

## D. Daily register / session workflow

Attendance is **booking-driven**: the register (`compileDailyRegisterSlots`, `src/lib/attendance.ts:195-377`) compiles "expected attendees" from each child's regular weekly schedule plus actual `bookings` rows for the selected date, split into "Regular Register" and "Catch-Ups & Walk-Ins" columns per time slot. Date is chosen via `?date=` prev/next/today links; centre via `?centre=` resolved server-side through `resolveActiveCentreId`; free-text search filters the already-scoped list client-side. Per-child actions: Check In / Check Out (editable time inputs), Mark Absent (reason picker), per-slot bulk "Mark All In" and "Check Out (EOD)", and a Walk-In modal supporting both an existing-child picker and new child+parent registration. A `note` field exists in component state but has **no rendered input** — dead UI state, sent but never populated through the UI (`AttendanceRollCall.tsx:109`).

## E. Bookings / `bookingAttendees` interaction

Both the dedicated Attendance module and Kiosk call the same **Bookings-owned** mutation, `markAttendeeAttendance` (`src/features/bookings/actions.ts:199-423`), for check-in/out and absence marking; `AttendanceRollCall.tsx` additionally calls `registerWalkInChild`/`registerExistingChildWalkIn` (also Bookings-owned) for walk-ins, and its own module's `updateAttendanceTimelog` (`src/features/attendance/actions.ts`) for some edits. No Bookings surface calls into `src/features/attendance/actions.ts`. `MarkAttendedButton.tsx` (Booking Detail) is a **third, independent path** — it calls `PATCH /api/bookings/[bookingId]/status`, which only flips `bookings.status` and never touches `bookingAttendees` at all, so marking a booking "Attended" from Booking Detail leaves no `attendanceMarkedBy`/`attendanceMarkedAt` audit trail and is only ever inferred as "Present" via the `resolveAttendanceStatus` fallback. `markAttendeeAttendance` and `updateAttendanceTimelog` write an overlapping but not identical column set, and derive `checkInAt`/`checkOutAt` differently (server `new Date()` vs. client-supplied HH:mm strings parsed via `parseInTimezone`) — a real but narrow inconsistency, documented in K/L below. No code path updates `bookings.status` as a side effect of marking attendance, and no code path reconciles `bookingAttendees` when a booking is cancelled/rescheduled (stale-attendance risk, documented as debt, not fixed — out of Attendance's narrow-fix scope since the write paths live in the frozen Bookings module and no confirmed user-facing defect was observed).

## F. Walk-in workflow

`registerWalkInChild` (new child+parent) and `registerExistingChildWalkIn` (existing child), both in `src/features/bookings/actions.ts`, insert a new `bookings` row plus a `bookingAttendees` row (`attendanceStatus: 'present'`). Both verify the target centre belongs to the caller's organisation and (for existing children) that the child belongs to the caller's organisation — solid org isolation. Neither has a role restriction (any of the four roles can register a walk-in) — evidenced as intentional, matching the Attendance module's broader "operational roles can act, only forgiveness/exports are restricted" policy (see H).

## G. Kiosk workflow

`/dashboard/kiosk` is a normal authenticated dashboard route (inherits `src/app/dashboard/layout.tsx`'s session gate; the page also independently calls `auth()`), staff-operated, no role restriction. Centre scoping is correct: children/bookings are pre-scoped server-side to `getUserAccessibleCentres(session.user.id)`; the client-side search box filters only the already-scoped list. Privacy scrub nulls `parentPhone`/`parentEmail`/`notes` server-side before the page ships data to the client (`page.tsx:69-88`) — a genuinely good practice for a walk-up screen. There is no dedicated "kiosk mode" session — a user can navigate to any other `/dashboard/*` route they're authorized for at any time; a 4-digit checkout-confirmation PIN pad accepts **any** input (`handlePinDigit`, `KioskRegister.tsx:205-218`, explicit code comment "Dummy check - accept any PIN for now") — this is a soft UI confirmation gesture, not a security boundary (the real authorization happens server-side on the mutation), documented as known debt in N, not treated as a security defect. Kiosk calls `markAttendeeAttendance` only (no walk-in registration, no `updateAttendanceTimelog`).

## H. Authorization matrix (evidence-only)

| Action | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| View register / kiosk | Allowed | Allowed | Allowed | Allowed |
| View ledger | Allowed | Allowed | Allowed (no explicit role check — evidenced gap, see K) | Allowed (same) |
| Mark present/absent/late, check in/out | Allowed | Allowed | Allowed | Allowed |
| Add absence reason / edit existing mark | Allowed | Allowed | Allowed | Allowed |
| Add walk-ins | Allowed | Allowed | Allowed | Allowed |
| Forgive/authorise absence (session credit) | Allowed | Allowed | **Denied** (explicit role check, `actions.ts:211`) | **Denied** |
| Export via `/api/reports/attendance` | Allowed | Allowed | **Denied** (explicit, `route.ts:21-23`) | **Denied** |
| Export via `/api/export/register` | Allowed | Allowed | Allowed (no role check — see L) | Allowed |

This is a **distinct, evidenced Attendance-specific policy**, independent of and not resolving the unrelated Bookings-module TUTOR-cancel/reschedule question: TUTOR (and FRONT_DESK) can freely mark attendance, check children in/out, and register walk-ins, but cannot forgive absences or pull the manager-level attendance report. This matches the ticket's own hypothesis in §12 and is preserved as-is.

## I. Organisation isolation

Solid on the Bookings-owned mutation paths (`markAttendeeAttendance`, `registerWalkInChild`, `registerExistingChildWalkIn` — explicit org-match checks) and on both export routes (org derived server-side from session, never from client input). **Confirmed gaps**, all in Attendance-owned files (`src/features/attendance/actions.ts`):
- `updateAttendanceTimelog` (lines 31-67) checks only that a session exists — **no organisation check at all** before updating a client-supplied `attendeeId`.
- `forgiveSessionsAction` (lines 201-226) role-gates correctly but never verifies the client-supplied `childId` belongs to the caller's organisation.
- `updateChildFlags` (lines 230-250) has no org check on its client-supplied `childId`.
- `getSessionLedger` (lines 86-99) never verifies the client-supplied `centreId` belongs to the caller's organisation.

## J. Centre scoping

`attendance/page.tsx` and `kiosk/page.tsx` correctly derive centre scope from `getUserAccessibleCentres` (assignment-based), matching the established pattern. **`ledger/page.tsx` (lines 22-31) does not** — it builds its centre list from every centre in the organisation (`db.query.centres.findMany({ where: eq(centres.organisationId, ...) })`) rather than the user's accessible centres, so `resolveActiveCentreId` will accept a `?centre=` value for a centre the user isn't assigned to. Combined with `getSessionLedger`'s missing centre check (I), this means any authenticated org member can view session-credit/forgiveness data for any centre in the org, regardless of centre assignment — the same class of bypass the ticket asked to test for explicitly, though not via a literal `centre=all` string. No literal `centre=all`/`centreId === 'all'` bypass pattern was found anywhere in the Attendance/Kiosk files. Separately, `markAttendeeAttendance`'s on-demand booking-creation branch and `registerWalkInChild`/`registerExistingChildWalkIn` verify org membership on the target centre but not centre-*membership* (i.e., a TUTOR assigned only to Centre A can mark attendance or register a walk-in at Centre B, provided both centres are in the same org) — Bookings-owned code, addressed narrowly per K/§11 of the ticket.

## K. Confirmed defects (to fix in Stage B, all narrow, evidenced, regression-tested)

1. **`updateAttendanceTimelog`** — no org/centre ownership check on client-supplied `attendeeId` (cross-org IDOR). *Attendance-owned.*
2. **`forgiveSessionsAction`** — role-gated but no org check on client-supplied `childId`. *Attendance-owned.*
3. **`updateChildFlags`** — no org/centre check on client-supplied `childId`. *Attendance-owned.*
4. **`getSessionLedger`** — no org/centre-membership check on client-supplied `centreId`. *Attendance-owned.*
5. **`ledger/page.tsx`** — builds its centre-validation set from all org centres instead of the user's accessible centres, enabling the bypass in #4 to be reached via a normal page navigation. *Attendance-owned.*
6. **`markAttendeeAttendance` / `registerWalkInChild` / `registerExistingChildWalkIn`** — org membership is checked but centre *membership* is not, so any staff role can act on a centre in their org they are not assigned to. *Bookings-owned; permitted narrow dependency fix per ticket §11 — Attendance is the direct caller, the fix is a small addition of the same `canUserAccessCentre`/`getUserAccessibleCentreIds` check already established elsewhere in the codebase (including the frozen Bookings module itself, which already applies this exact pattern to other mutations), and regression tests will be added.*

None of these require a schema migration.

## L. Ambiguous behaviour (documented, not resolved by invented policy)

- **Export role inconsistency**: `/api/reports/attendance` explicitly blocks TUTOR/FRONT_DESK; `/api/export/register` explicitly documents itself as open to "any authenticated staff role" and exposes more sensitive data (parent phone number vs. email). Both are deliberate in their own code (not accidental omissions), so there's no repository evidence establishing which policy is "correct" for the other. Left as-is; flagged for product-owner decision.
- **`markAttendeeAttendance`/`updateAttendanceTimelog` timestamp semantics** differ slightly (server-clock `new Date()` vs. client-supplied local HH:mm parsed via `parseInTimezone`) for the same `checkInAt`/`checkOutAt` columns. Both are internally consistent and functioning; no evidence either is wrong, so left as documented behavioural debt rather than unified speculatively.
- **`students/[id]/attendance/page.tsx` module boundary**: this route displays attendance history but lives entirely inside the frozen Students module's `[id]/` structure, already gated by Students' own `requireAuth` roles and org/centre checks, and already reuses (rather than duplicates) the shared `src/lib/attendance.ts` read-path helpers. Treated as **out of scope** (frozen Students surface) rather than an Attendance surface — consistent with §18's instruction not to reopen Students casually, and with §4's instruction not to force Attendance's own structure onto Students' record pages. No functional or security defect was found there.

Neither of these rises to a "material policy ambiguity" blocking Stage B — both are narrow, documented items with no safe default to invent, exactly the category the ticket asks to document rather than resolve. Proceeding into Stage B on the evidenced behaviour above.

## M. Cross-module dependencies

- Bookings (frozen): `markAttendeeAttendance`, `registerWalkInChild`, `registerExistingChildWalkIn` (called by both Attendance surfaces and Kiosk); `AttendanceDropdown.tsx`/`MarkAttendedButton.tsx` (Booking Detail's own attendance-adjacent controls, unaffected by this milestone except for the narrow centre-check addition to the shared action).
- Students (frozen): `students/[id]/attendance/page.tsx` and `StudentProfile.tsx` consume `getAttendanceColorClass`/`getAttendanceLabel` from `src/lib/attendance.ts` — **not touched this milestone** (see N).
- Dashboard home: `ActivityTab.tsx` also consumes `getAttendanceColorClass` — same, not touched.
- `src/lib/attendance.ts`'s `resolveAttendanceStatus`/`compileDailyRegisterSlots` (business logic, not visual) are used by the Attendance module itself and by Students — preserved verbatim; no changes planned.

## N. Out-of-scope debt (documented, not fixed)

- `getAttendanceColorClass` (`src/lib/attendance.ts:90-111`) still returns hardcoded Tailwind classes (`bg-emerald-500/20`, `bg-amber-500/20`, `bg-rose-500/20`) for 4 of its 6 status branches, despite a docstring claiming semantic-token usage. **Zero consumers of this helper exist within the Attendance module's own routes** (confirmed by repo-wide grep) — its only consumers are the frozen Students surfaces, Booking Detail, and dashboard-home `ActivityTab`. Attendance-owned surfaces will be modernised using the `Badge` component's own variant system directly, with no change to this shared helper, avoiding any regression risk to its frozen consumers.
- Kiosk's checkout-confirmation PIN accepts any input (explicit "dummy check" comment in the code) — a real but non-security-boundary gap (the actual mutation is authorized server-side regardless of PIN). Implementing a genuine PIN system would be a new feature, not a narrow defect fix — left as documented debt.
- Kiosk's `StudentCard` still has a rendering branch for `attendee.notes` (potential medical/alert text) that would display if the server-side privacy scrub in `page.tsx` were ever incomplete; today that field is always nulled before reaching the client, so this is latent, not a live defect. Left as documented debt (defense-in-depth item), not changed.
- Export role-policy inconsistency (see L).
- `AttendanceHeatmap.tsx` (`src/components/dashboard/`) has zero importers anywhere in the repo — confirmed dead code. Not removed (§33: "Do not remove dead code merely because it was discovered").
- No test coverage exists today for `src/features/attendance/actions.ts` (the check-in/out/walk-in-adjacent engine), the Kiosk UI, the Roll Call UI, or either export route. Stage C will add regression tests for the confirmed defects in K only, per the ticket's "every confirmed defect requires regression coverage" instruction — not a general coverage push.
- Stale-attendance-on-cancel/reschedule (see E) — no reconciliation logic exists between `bookings.status` transitions and an already-set explicit `bookingAttendees.attendanceStatus`. No confirmed user-facing defect observed (this mirrors the exact fallback-precedence design already documented in `resolveAttendanceStatus`), left as documented cross-module debt.

## O. Proposed Stage-B implementation scope

**Security/functional fixes** (narrow, evidenced, regression-tested): items K1–K6 above. K6 is the one narrow, permitted touch to a Bookings-owned file (`src/features/bookings/actions.ts`), adding a centre-membership check consistent with the frozen module's own established pattern elsewhere.

**Visual modernisation** (design-system tokens, no business-logic change):
- `src/app/dashboard/attendance/page.tsx` — header/toolbar, date/centre navigation, stats strip, CSV export control, error banner, onto `Card`/`Badge`/`Button`/tokens.
- `src/app/dashboard/attendance/AttendanceRollCall.tsx` — child cards, status controls, absence picker, bulk actions, search, walk-in modal — onto `Card`/`Badge`/`Button`/`EmptyState`/token-based inputs, preserving `getAvatarGradient` (an established shared pattern also used by Registrations) and all business logic verbatim.
- `src/app/dashboard/attendance/loading.tsx` — replace legacy `glassmorphic-card` with `Skeleton`+`Card`, matching the pattern used across the other frozen modules.
- `src/app/dashboard/kiosk/page.tsx` / `KioskRegister.tsx` / `loading.tsx` — migrate off the legacy "shadcn-style" token set (`bg-card`, `text-foreground`, generic `bg-primary`, `text-tertiary`, `bg-error-container`) onto the frozen InvoiceFlow tokens and primitives, preserving large touch targets (tablet-first) and all mutation logic verbatim.
- `src/app/dashboard/attendance/ledger/page.tsx` / `LedgerClient.tsx` — same legacy-token migration, alongside the K5 centre-scoping fix.

**Explicitly not touched**: `src/lib/attendance.ts` (shared helper, zero Attendance-route consumers), `src/features/bookings/components/MarkAttendedButton.tsx` / `AttendanceDropdown.tsx` (frozen Bookings, no defect found), `students/[id]/attendance/page.tsx` (frozen Students), `ActivityTab.tsx` (dashboard home, unrelated module), `AttendanceHeatmap.tsx` (dead code, left alone), any schema/migration.
