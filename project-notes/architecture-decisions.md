# Architecture Decisions — Milestone 1 (CMS Rebuild)

This records the significant judgment calls made during Milestone 1, and why. It is a
companion to `milestone-1-completion.md`, which covers what was done; this covers *why*,
for anything that wasn't a mechanical fix.

Base commit: `a9f00c7` on `rebuild/cms-modernisation`. All commits referenced below are on
that branch.

---

## 1. Upload security model (`89e1a98`)

`POST /api/upload` is a public, unauthenticated endpoint (used from the public booking and
registration flows, before a parent has an account). It can't be put behind auth. The
decision was to constrain it instead: enforce a strict file-type allowlist (images only),
a size cap, magic-byte content sniffing (not just trusting the client-supplied MIME type or
extension), and rate limiting per IP. This preserves the endpoint's public nature — required
for the booking/registration UX — while closing the arbitrary-file-upload and
MIME-spoofing gaps that existed before.

## 2. Dashboard authorisation model (`97b3030`)

The dashboard previously trusted a path-based header set by middleware for role gating,
which is spoofable if the header can be set directly (e.g. bypassing the middleware via a
direct request). Centralised authorisation into a single server-side check derived from the
authenticated session on every dashboard route, removing the header-trust path entirely.
This is a "preserve what's good, fix what's weak" change: the role model and route
structure were kept as-is; only the trust boundary moved from a spoofable header to the
session.

## 3. Parents Server Component crash — root cause (`807eae4`)

**Symptom:** `/dashboard/parents` crashed in production with "Event handlers cannot be
passed to Client Component props."

**Root cause:** `ParentsTable.tsx` (a Server Component) rendered a child `<Link>` with
`onClick={(e) => e.stopPropagation()}`. Functions cannot cross the Server→Client Component
boundary in React Server Components — passing one is always a hard error, not a warning,
the moment Next.js tries to serialize the RSC payload.

**Why it went unnoticed:** the existing test suite used `renderToStaticMarkup`, which
doesn't enforce the RSC serialization boundary — so a test using that method would pass even
with this bug present. The regression test added here (`ParentsTable.test.tsx`) instead
walks the actual React element tree returned by calling the component function directly and
asserts no element carries a function-typed prop, which does catch this class of bug. This
was also independently verified against a real Next.js dev server + Postgres + NextAuth
session, not just a mocked harness.

**Fix:** removed the `onClick` handler. It was attached to protect against event bubbling
into a parent row-level click handler — but no such row-level handler exists in this
component, so the handler was dead code from the start; it never did anything except crash
the page.

## 4. Students count/list inconsistency — root cause (`2f9020a`)

**Symptom:** the Students page KPI tile showed a nonzero count, but the table below it was
always empty.

**Root cause:** classic JS variable shadowing. The outer scope declared
`let enrichedStudents: StudentRow[] = [];` (this is what's actually passed to
`<StudentsTable students={enrichedStudents} />`). Deep in the function body, a
`const enrichedStudents: StudentRow[] = studentsList.map(...)` re-declared the name inside
a nested block, creating a new binding that shadowed the outer one. All the real work
happened on the shadowed inner variable; the outer one that actually reached the table was
never touched, so it stayed `[]`.

**Fix:** dropped the `const`/type annotation so the assignment targets the outer `let`
instead of shadowing it.

## 5. Logger signature / `normalizeContext` (`6f2997f`)

**Symptom:** ~319 of the ~374 pre-existing `tsc` errors were `logger.error(...)` /
`logger.info(...)` call sites failing type-checking, because `logger`'s methods required a
structured `LogContext` object as their second argument, and ~350 call sites across the
codebase were instead passing a raw `Error`, a string, or nothing.

**Real bug underneath the type error:** `Error` objects have non-enumerable `message` and
`stack` properties. Any code that spreads or `JSON.stringify`s an `Error` into a generic
object — which is what several call sites were effectively doing before this fix — silently
loses that detail. `JSON.stringify(new Error('x'))` is `"{}"`. This meant a meaningful slice
of the app's error logs (and whatever reached Sentry through them) were recording
essentially nothing useful about what actually failed.

**Decision:** fix this once, centrally, rather than editing all ~350 call sites to
match the existing signature. Added `normalizeContext(context: unknown)` to `logger.ts`,
which special-cases `Error` (pulling out `name`/`message`/`stack` into a plain object),
passes through plain objects, and wraps anything else (a string, a number) in
`{ detail: context }`. The public logger methods now accept `context?: unknown` instead of
`context?: LogContext`. This fixed the large majority of the tsc backlog and the underlying
logging-detail-loss bug in one change, without touching the ~350 call sites individually
(though a handful of those call sites had their own separate bugs — e.g. a 3-argument
`logger.error` call silently dropping its 3rd argument — which were fixed at the call site
since normalizing the signature doesn't fix a caller passing the wrong number of arguments).

## 6. `materialiseBookingPlan` — left incomplete, made to fail loudly (`6f2997f`)

**What was found:** `src/lib/services/plan.ts`'s `materialiseBookingPlan` computes booking
occurrences from a `bookingPlans` row (term dates, weekday, session-exception exclusion) and
then attempts `db.insert(bookings).values(bookingsToCreate)`. That insert was missing several
NOT NULL columns the `bookings` table actually requires (`parentId`, `modality`,
`confirmationCode`, `magicLinkToken`), and never created the corresponding `bookingAttendees`
row that's how child↔booking linkage actually works in this schema (`bookings` has no
`childId` column). This function has never been callable end-to-end.

**Two bugs were fixed in the occurrence-calculation itself** (see completion report for
detail): a schema-drift bug (`ex.date` → `ex.exceptionDate`) that made session-exception
exclusion a permanent no-op, and the missing-persistence issue below.

**Decision on the persistence gap:** rather than completing the insert (deriving a
`parentId`, generating a `confirmationCode`/`magicLinkToken` matching `booking.ts`'s
`createBooking` pattern — which involves security-sensitive hashing and a side-effecting
write to the `parents` table — and adding the `bookingAttendees` insert), the function now
throws a clear, documented error before attempting the incomplete insert. Two things drove
this: first, `materialiseBookingPlan`/`bookingPlans` has no caller anywhere in the app (no
route, action, or cron references it — confirmed via grep) and `bookingPlans` itself has no
creation path outside a dev reset script, so this is unfinished, unwired scaffolding, not a
regression in a working feature. Second, completing it properly requires booking-domain
design decisions (token/attendee-linkage model) that are explicitly out of scope for this
milestone ("redesign finance/bookings" is on the excluded list). Failing loudly and clearly,
with the reasoning in a code comment, was judged safer than either leaving a subtly broken
insert in place or inventing a persistence design under time pressure. The
occurrence-calculation logic itself — which is correct — is left in place for whoever
completes this feature.

## 7. Booking subjects enum drift (`2fe2ca1`)

**What was found:** three-way drift between (a) the actual Postgres enum backing
`childSubjects.subject` (`Maths`, `English`, `Science`, `Other` — 4 values), (b) the Zod
validation enum in `validations/booking.ts` gating what `BookingForm.tsx`'s
react-hook-form submission would accept (a different, larger 8-value list, itself already
inconsistent with (a)), and (c) `BookingForm.tsx`'s own `SUBJECTS` UI constant (a 6-value
list — `Maths, English, Science, 11+, Stem Activities, Childcare` — introduced by commit
`f1832a8`, "update club activities to Maths, English, Science, 11+, Stem Activities,
Childcare").

Commit `f1832a8` changed only the UI constant and never touched the Zod schema, meaning
selecting `11+`, `Stem Activities`, or `Childcare` — half the selectable options — caused
the client-side `zodResolver` to reject the form, blocking submission entirely for any
parent who picked one of those three. This was a real, currently-reproducible bug, not a
type-safety nicety.

**Decision:** update the Zod enum in `validations/booking.ts` to match
`BookingForm.tsx`'s `SUBJECTS` constant — its only real caller (confirmed via grep: only
`BookingForm.tsx` and `api/bookings/route.ts` import this schema) — rather than reverting
the UI to the older list. The UI change was clearly deliberate product intent (the commit
message states it outright); the validation schema had simply never been updated to match.
The DB-level enum (a) is untouched and doesn't need to be: `booking.ts`'s `createBooking`
already coerces any non-canonical subject value to `'Other'` + a free-text `customSubject`
before writing to `childSubjects`, so this was already safe at the DB layer — the bug was
purely that validation was blocking submission before that coercion ever ran.

A dead "specify a custom subject" input in `BookingForm.tsx`, gated on
`subjects.includes('Other')`, was also removed — unreachable since `'Other'` was dropped
from `SUBJECTS` in the same `f1832a8` change and never reintroduced. Reinstating a working
custom-subject option is a product decision about what activities are offered, out of scope
here.

## 8. `markAttendeeAttendance` scoping bug → real persistence bug (`4ab4f47`)

**What was found:** `finalStatus` (which maps the UI-only pseudo-status `'check_out'` to the
DB-valid `'present'`, since the `attendanceStatus` enum has no `'check_out'` member) and an
update-fields object were both declared inside the `if (hasBooking)` block but referenced
from sibling branches outside that block — a genuine JS/TS scoping error, which is how this
surfaced as a `tsc` error in the first place. Underneath the type error was a real
data-integrity bug: two other persistence paths (on-demand booking creation, and the
no-existing-attendee fallback) were writing the *raw* `status` value straight into
`attendanceStatus`, meaning a parent checked out through either of those paths would attempt
to persist the invalid enum value `'check_out'`.

**Fix:** hoisted `finalStatus` to function scope so all three `attendanceStatus` writes
agree, and gave the on-demand branch its own typed update-fields object instead of reaching
across a block boundary for one that doesn't exist there. Verified via
`bookings/actions.test.ts` (6/6 passing). This is treated as a bug fix within the existing
attendance-marking design, not a redesign — the three code paths were always meant to behave
identically here.

## 9. TypeScript build-error suppression removed (`5f18182`)

`next.config.ts` had `typescript: { ignoreBuildErrors: true }`, meaning `next build` would
succeed even with type errors present — which is how ~374 tsc errors could accumulate
without blocking deploys. With `npx tsc --noEmit -p .` now passing cleanly (see completion
report), this flag no longer has anything to hide behind and was removed so a future type
regression fails the build instead of shipping silently.

## 10. Lockfile regeneration, not a dependency upgrade (`c3f8329`)

The committed `package-lock.json` was internally inconsistent — `npm ci` against a clean
`node_modules` failed with "Missing:"/"Invalid:" errors regardless of environment,
independently reproduced before touching any other code. `package.json`'s version ranges
were not changed; the lockfile was regenerated via `npm install` against the existing
`package.json`, then verified deterministic via a second clean `npm ci`. This is a lockfile
*repair*, not a dependency upgrade, and is unrelated to `chore/major-dependency-upgrades`
(untouched, per scope).

## 11. Environment note: Node 20 vs Node 22

`package.json`'s `devDependencies` pins `@types/node` to `^20.19.31`, i.e. the codebase is
typed against Node 20 APIs. This sandbox's actual Node runtime is v22.22.2. No `engines`
field constrains this in `package.json`. Everything in this milestone — `npm ci`, `tsc`,
`vitest`, and `next build` — was run and verified on Node 22 without incident, but this
mismatch is worth resolving deliberately (either pin `engines`/CI to Node 20, or bump
`@types/node` to match Node 22) rather than leaving it implicit. Left as-is here since
changing either is a project-configuration decision outside a bug-fix milestone, not
something broken.

## 12. Production build verification and this sandbox's network restriction

This sandbox has no outbound network access to `fonts.googleapis.com` (confirmed via a
direct `curl`, which timed out with no response). `src/app/layout.tsx` uses
`next/font/google`'s `Inter`, which fetches font CSS from Google Fonts at build time — so
`npm run build` cannot complete in this sandbox using its default configuration.

This is a sandbox/environment limitation, not a code defect, and per this milestone's scope
("do not change typography") the font-loading code itself was not touched. To still verify
the rest of the build pipeline (compilation, the build's own independent TypeScript pass,
static generation, route manifest), the build was run once with Next.js's documented
test-only `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` environment variable pointing at a local mock
response — this is a build-time env var only, not a code or config change, and nothing
related to it was committed. With that in place, `next build` completed successfully with no
errors. The recommendation is to verify `npm run build` in the actual CI/deploy environment
(which will have real internet access) before relying on it as a release gate; this sandbox
cannot be the source of truth for that specific check.
