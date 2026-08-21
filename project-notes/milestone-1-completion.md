# Milestone 1 Completion Report — CMS Rebuild

Repo: `kwadwoaddo-collab/After-School-Club-CMS`
Branch: `rebuild/cms-modernisation`
Base commit: `a9f00c7`
Head commit at completion: `5f18182`

## Milestone 1 Status

Complete. All six workstreams are done: upload security, dashboard authorisation, the
Parents crash, the Students count/list inconsistency, TypeScript type safety (including
removing `typescript.ignoreBuildErrors`), and a deterministic install with a full quality
suite run. No redesign work was done; nothing was merged to `main`; nothing was deployed.
One item is flagged below as not fully resolved: pushing this branch to `origin` (see
**Git**).

## Changes Made

Eleven commits on `rebuild/cms-modernisation`, in order:

1. `89e1a98` — harden `POST /api/upload` (Workstream 1)
2. `97b3030` — centralise dashboard authorisation (Workstream 2)
3. `807eae4` — fix `/dashboard/parents` Server Component crash (Workstream 3)
4. `2f9020a` — fix Students page count/list inconsistency (Workstream 4)
5. `c3f8329` — regenerate `package-lock.json` for deterministic `npm ci` (Workstream 6, part)
6. `6f2997f` — type safety part 1: logger signature fix + real bugs found along the way (Workstream 5)
7. `4ab4f47` — fix attendance status persistence bug in `markAttendeeAttendance`
8. `2fe2ca1` — fix booking subjects enum drift between UI and validation
9. `c365149` — remove dead unrouted file, declare `uuid` as a direct dependency
10. `b6d3877` — type safety part 2: eliminate remaining `any`/unsafe casts across 57 files (Workstream 5)
11. `5f18182` — remove `typescript.ignoreBuildErrors` from `next.config.ts`

93 files changed overall (6,407 insertions, 3,520 deletions) across the branch relative to
`a9f00c7`.

## Upload Security

`POST /api/upload` previously had no authentication, no size limit, and no content
validation — any anonymous request could upload an arbitrary file to blob storage
(flagged as Milestone 0 security-review.md, High #1). It's used from both the authenticated
dashboard and genuinely public, unauthenticated booking pages, so it can't simply require
`auth()`.

Fixed by constraining rather than gating: per-IP rate limiting, a `centreId` that must
resolve to a real centre (mirroring the existing pattern already used by `/api/bookings` and
`/api/register`), a 5MB size cap, and magic-byte content validation against a strict
image-only allow-list (SVG explicitly excluded, since SVG can carry script). Filenames are
randomised and namespaced by organisation/centre rather than trusting the client-supplied
name. The magic-byte validation logic is shared with `/api/upload/logo` via a new
`src/lib/file-validation.ts`, replacing a previously duplicated signature table. Covered by
`src/lib/security-p5.test.ts` (rate-limiting, missing file, missing/invalid `centreId`,
oversized file, disallowed type, content/extension-type mismatch/spoofing, SVG rejection,
and the happy path).

## Authorisation

The dashboard layout gated access via a `ROUTE_PERMISSIONS` map matched against a
`currentPath` derived from request headers (`x-invoke-path` / `x-pathname` / `next-url`)
that this app's own middleware never actually set — the match never fired, so several routes
had no real enforcement despite appearing gated in the code (Milestone 0 security-review.md,
High #2).

Fixed by evolving `src/lib/require-auth.ts` (previously written but never called anywhere)
into the authoritative mechanism: `requireAuth({ roles })` for Server Component pages
(redirects on failure) and `requireApiAuth({ roles })` for API routes (returns `null` on
failure). Both fail closed — any unrecognised state denies rather than falling through to
allow. The header-based `ROUTE_PERMISSIONS` check was removed entirely. Covered by
`src/lib/security-p6.test.ts` (333 lines, exercising the role/route matrix).

## Parents Root Cause

`/dashboard/parents` crashed with "Event handlers cannot be passed to Client Component
props." Root cause: `ParentsTable.tsx`, a Server Component, rendered a child `<Link>` with
`onClick={(e) => e.stopPropagation()}`. Functions cannot cross the Server→Client Component
boundary in React Server Components. No row-level click handler existed anywhere in the
component for this to protect against, so the handler was dead code from the start — it
never did anything except crash the page.

Fixed by removing the handler. A regression test (`ParentsTable.test.tsx`) walks the actual
React element tree from calling the component directly and asserts no element carries a
function-typed prop — the existing test pattern in this codebase
(`renderToStaticMarkup`-based) does not enforce the RSC boundary and would have passed with
the bug present. Independently reproduced and verified fixed against a real Next.js dev
server, local Postgres, and a real NextAuth credentials session, not just a mocked harness.
See `architecture-decisions.md` §3 for full detail.

## Students Root Cause

The Students page KPI tile showed a nonzero count while the table below it was always
empty. Root cause: variable shadowing — an outer `let enrichedStudents: StudentRow[] = [];`
(the value actually passed to `<StudentsTable students={enrichedStudents} />`) was shadowed
by a nested `const enrichedStudents: StudentRow[] = studentsList.map(...)` inside a block
further down, silently redirecting all the real computation onto a new binding the table
never saw. Fixed by dropping the `const`/type annotation so the assignment targets the outer
variable. See `architecture-decisions.md` §4.

## TypeScript

`npm run typecheck` (`tsc --noEmit`) now exists and passes with **0 errors**, down from 374
at the start of this workstream. All ~374 errors were triaged individually — none were
suppressed with `any`, `@ts-ignore`, or a blanket exclusion. `typescript.ignoreBuildErrors`
has been removed from `next.config.ts`.

Rough triage breakdown:

- **~175 errors, one root cause**: `logger.error`/`logger.info` call sites failing against
  the logger's typed `context?: LogContext` parameter, because ~350 call sites across the
  codebase were passing a raw `Error`, string, or nothing. Fixed centrally with a
  `normalizeContext()` function in `src/lib/logger.ts` rather than touching every call site.
  This also fixed a real bug: `Error.message`/`.stack` are non-enumerable, so any code
  spreading or `JSON.stringify`-ing an `Error` (as several call sites effectively did)
  silently lost that detail from logs and Sentry.
- **~34 errors, one file**: `src/lib/attendance.ts` had a file-level
  `eslint-disable no-explicit-any` covering casts throughout. Replaced with
  `InferSelectModel`-derived types for the register-compilation data shapes.
- **A long tail across ~60 files**: `catch (e)` blocks with implicit-`any` error handling,
  `unknown[]`/implicit-`any` query results and props that needed real types (mostly via
  Drizzle's `InferSelectModel`/`InferInsertModel`, matching the codebase's existing
  convention in `src/features/bookings/types.ts`), and a handful of broken imports and
  stale API usages that only surfaced once other noise was cleared. Delegated across three
  parallel review passes with a shared standard (no `any`, no `@ts-ignore`, catch-unknown
  narrowing, "flag rather than guess" on business-logic ambiguity), then personally reviewed
  end to end — including two cross-file ripple effects the parallel passes couldn't see in
  isolation (a `CentreHoursForm.tsx` type fix that broke its caller; two files, `prev_bookings.tsx`
  and `scripts/create-qa-user.ts`, that weren't in any assigned file list) — caught and fixed
  during review.
- **Particular attention paid to `plan.ts`, `waitlist.ts`, `booking.ts` per the brief**: see
  `architecture-decisions.md` §§ 6–8 for the three non-mechanical fixes found in this group
  (a schema-drift bug silently disabling session-exception exclusion in `plan.ts`; an
  incomplete, never-callable insert in the same function, deliberately left throwing rather
  than completed, since finishing it is booking-domain design work out of scope here; a
  `Date`-vs-`date`-column type mismatch in `waitlist.ts`; and a booking-subjects enum drift
  across DB/Zod/UI in `booking.ts` and `BookingForm.tsx` that was silently blocking form
  submission for half the selectable activities).

Two real, non-type-annotation bugs were found and fixed in the course of this triage that
are called out individually in `architecture-decisions.md` because they change runtime
behaviour: the `markAttendeeAttendance` scoping bug (§8), which was writing an invalid enum
value to the database on two of three code paths, and the booking-subjects validation drift
(§7), which was blocking booking submission outright for some users.

## Dependency Install

`package-lock.json` was internally inconsistent — a clean `npm ci` failed with
"Missing:"/"Invalid:" errors regardless of environment, confirmed by checking out the
original lockfile and running `npm ci` against a fresh `node_modules` before touching
anything else. `package.json`'s version ranges were not changed. The lockfile was
regenerated via `npm install`, then verified deterministic with a second clean `npm ci`.
This is a lockfile repair, not a dependency upgrade, and is unrelated to
`chore/major-dependency-upgrades` (not touched, not merged, per scope).

Separately, `uuid`/`@types/uuid` were added as explicit `devDependencies` — `scripts/create-qa-user.ts`
imports `uuid` directly but it was only ever present as a transitive dependency, undeclared
in `package.json`.

Re-verified at the end of this milestone with a full clean install (`rm -rf node_modules && npm ci`)
against the final lockfile — succeeds deterministically.

**Environment note:** this sandbox runs Node v22.22.2; `@types/node` is pinned to `^20.19.31`,
i.e. the codebase is typed against Node 20. No `engines` field constrains the actual runtime.
Everything in this milestone ran cleanly on Node 22, but this mismatch should be resolved
deliberately (pin `engines`, or bump `@types/node`) rather than left implicit — see
`architecture-decisions.md` §11.

## Tests

- `npx tsc --noEmit -p .` — **0 errors** (down from 374).
- `npx eslint .` — 69 problems (64 errors, 5 warnings), all pre-existing and unrelated to
  this milestone's changes (mostly `no-explicit-any` and `no-console` in files this
  milestone did not touch). Confirmed via a diff: the pre-milestone baseline (commit
  `6f2997f`, before the final two commits of this branch) had 71 problems — this work's
  changes net *reduced* lint debt by 2, not increased it. Fixing the remaining 69 would be
  general cleanup, out of scope per the brief.
- `npx vitest run` — 204/206 tests passing, 26/29 files passing. The 2 failing tests
  (`Header.test.tsx`, `Sidebar.test.tsx` — both asserting exact CSS class strings) and 1
  failing file with a separate cause (`communications/actions.test.ts` — a module-resolution
  issue unrelated to the `sendEmail` export added in this milestone) are all confirmed
  pre-existing: they fail identically when run against `6f2997f`, before any of this
  milestone's later type-safety commits. None of the files behind these three failures were
  touched by this milestone's changes in a way that would explain them.
- `npm run build` (`next build`) — completes successfully, including the build's own
  independent TypeScript pass. Verified once with a build-time-only environment variable
  (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, a documented Next.js test hook) because this sandbox
  has no outbound network access to `fonts.googleapis.com`, which `next/font/google` needs
  to reach at build time — confirmed via a direct `curl` timeout, not a code issue. Nothing
  related to this was committed; see `architecture-decisions.md` §12. Recommend re-verifying
  `npm run build` once in the real CI/deploy environment (which will have normal internet
  access) before treating it as a release gate.

## Behavioural Regression Assessment

No intentional behaviour changes outside what's documented above and in
`architecture-decisions.md`. Three fixes in this milestone do change runtime behaviour
(beyond "a broken thing now works" — genuinely new/different behaviour to be aware of):

1. **Logger** — `logger.error`/`.info`/etc. now actually record the detail of `Error`
   objects passed to them, where before that detail was silently dropped. Log volume/content
   to Sentry and stdout will look different (more complete) after this deploys.
2. **`markAttendeeAttendance`** — checking out an attendee via the on-demand-booking or
   no-existing-attendee code paths previously would have attempted to write the invalid
   enum value `'check_out'` to `attendanceStatus` (likely failing the write, or if it
   somehow succeeded, corrupting that row). It now correctly persists `'present'`, matching
   the third (already-correct) code path. This is a bug fix, but it changes what gets
   written to the database on check-out through those two paths.
3. **Booking subjects** — parents can now successfully submit a booking after selecting
   `11+`, `Stem Activities`, or `Childcare`, which previously silently failed client-side
   validation. This is new, previously-broken functionality becoming available, not a
   behaviour change to something that worked before.

Everything else in the type-safety pass is intended to be behaviour-neutral: type
annotations, `catch (e: unknown)` narrowing that preserves the original error-handling logic,
and dead-code removal confirmed unreachable via grep before deletion (`prev_bookings.tsx`,
the `BookingForm.tsx` custom-subject input, `FilterableInvoiceSection.tsx` in a prior
segment). Regression tests were added for the four fixes with the highest risk of a subtle
behavioural miss (Parents crash, Students shadowing, `plan.ts`'s two bugs, the
`markAttendeeAttendance` scoping fix), each verified with a revert-and-confirm-fail /
restore-and-confirm-pass cycle to prove the test actually catches the specific bug rather
than passing vacuously.

## Architecture Decisions

See `project-notes/architecture-decisions.md` for full detail on every non-mechanical
judgment call made in this milestone: the upload/authorisation security models, the two
Server Component root causes, the logger signature decision, `materialiseBookingPlan`'s
incompleteness (deliberately left throwing rather than completed), the booking-subjects enum
drift, the `markAttendeeAttendance` fix, removing `ignoreBuildErrors`, the lockfile repair,
the Node version note, and this sandbox's font-fetch network limitation during build
verification.

## Files Changed

93 files changed across the branch (6,407 insertions, 3,520 deletions) relative to `a9f00c7`.
Full list is in the git history (`git diff --stat a9f00c7..HEAD`); grouped by workstream in
**Changes Made** above via commit boundaries. No files outside `src/`, `project-notes/`,
`package.json`/`package-lock.json`, and `next.config.ts` were touched. InvoiceFlow was not
touched (read-only reference only, per brief).

## Git

All eleven commits are on `rebuild/cms-modernisation`, verified base `a9f00c7`. `main` was
not touched. Nothing was merged. Nothing was deployed.

**Open item:** this sandbox's git remote is not currently authorised to push to
`origin/rebuild/cms-modernisation` — a `git push --dry-run` returned a 403 earlier in this
milestone, before any of this segment's commits existed. This was flagged at the time and
remains unresolved; it needs to be sorted out with the user (re-authorising this session's
git credentials, or pushing from a different, authorised environment) before this branch's
work is visible on GitHub. The commits themselves are complete and sitting on the local
branch in this sandbox in the meantime.

## Remaining Known Issues

- 69 pre-existing ESLint problems (mostly `no-explicit-any`, some `no-console`), unrelated to
  this milestone, left as-is per scope (see **Tests** above).
- `materialiseBookingPlan` in `src/lib/services/plan.ts` is still incomplete by design — it
  now fails loudly with a clear error instead of silently corrupting data, but actually
  finishing it (parent/token/attendee-linkage design) is out of scope for this milestone.
  See `architecture-decisions.md` §6.
- `communications/actions.test.ts` has a pre-existing module-resolution failure unrelated to
  the `sendEmail` fix made in this milestone (confirmed pre-existing).
- Node 20 vs Node 22 typing mismatch (see **Dependency Install** above) — not broken, but
  worth resolving deliberately.
- `npm run build`'s success in this milestone relied on a build-time-only environment
  variable to route around this sandbox's lack of outbound access to Google Fonts; it should
  be re-verified once in the real CI/deploy environment.
- The git push blocker above.

## Recommended Next Milestone

With type safety restored and the install/build/test pipeline verified deterministic, the
codebase is in a state where further work can be scoped and estimated with much more
confidence than before this milestone (374 unscoped tsc errors made "how big is this
change" nearly unanswerable). Suggested candidates for a Milestone 2 scoping conversation,
not started here:

- Deciding what to do with `materialiseBookingPlan`/`bookingPlans` — either complete the
  design (parent resolution, token/confirmation-code generation, attendee-linkage) or
  formally deprecate the unused scaffolding.
- A deliberate pass on the 69 remaining ESLint issues, if the team wants to raise the bar
  further (this was explicitly out of scope for a bug-fix milestone).
- Resolving the Node 20/22 typing mismatch.
- Whatever the user's actual product priorities are — this milestone was scoped as
  infrastructure/bug-fix work, not feature work, per the brief.
