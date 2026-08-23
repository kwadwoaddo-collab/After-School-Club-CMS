# Milestone 3H — Communications Module — Stage-A Audit

**Repo**: `kwadwoaddo-collab/After-School-Club-CMS`
**Branch**: `rebuild/cms-modernisation`
**Starting commit**: `3f2bd19` (frozen Milestone 3G — Finance tip)
**Frozen reference modules**: Students, Parents, Staff, Centres, Bookings, Attendance, Finance.

Starting-state verification: `git status` clean, `git branch --show-current` = `rebuild/cms-modernisation`, `git rev-parse --short HEAD` = `3f2bd19`, matching the ticket's expected authoritative starting state exactly. Branch is 4 commits ahead of `origin/rebuild/cms-modernisation` (unpushed 3G commits — the git proxy has rejected every push attempt in this session's history with a 403; this is pre-existing state carried in from 3G, not something introduced here).

---

## A. Surface inventory

**Dashboard route** — a single page, no sub-routes:

| Surface | File | Type | Auth |
|---|---|---|---|
| Broadcast Messaging page | `src/app/dashboard/communications/page.tsx` (65 lines) | Server Component | `auth()` + `session.user.organisationId` check only. **No role check at all** — unlike every role-gated page in every frozen module (which use `requireAuth({ roles: [...] })`). Any authenticated org member (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`) can view it. |
| Loading skeleton | `src/app/dashboard/communications/loading.tsx` (23 lines) | Server Component | n/a — static markup |
| Entire feature UI | `src/app/dashboard/communications/CommunicationsClient.tsx` (295 lines) | Client Component (`'use client'`) | Inherits page's session context via props; itself does no auth |

There is no `src/features/communications/components/` directory — the entire compose/history/detail UI lives in the one 295-line client component. `src/features/communications/actions.ts` (133 lines) holds all four server actions: `sendBroadcast`, `getBroadcasts`, `getClassesForCentre`, `getParentsForCentre`.

**API routes**: no `/api/broadcasts`, `/api/messaging`, `/api/email`, or `/api/sms` route exists — sending is a server action only, not a REST endpoint. `src/app/api/notifications/route.ts` (GET/PATCH) is a *different* system — the in-app notification bell (`notifications` table, keyed by `userId`, booking/system events) — not parent-facing broadcast messaging. `src/app/portal/notifications/actions.ts` is a third, separate system — the parent-portal bell (`portalNotifications` table). None of the three share code, schema, or UI with each other.

**Webhooks**: no Resend or Twilio delivery-status webhook exists anywhere in the repo (confirmed — the only webhook route in the whole app is Finance's Stripe one). `broadcasts.successCount`/`failureCount` reflect only whether the synchronous `resend.emails.send()` call itself threw at send time — there is no feedback loop for bounces, complaints, or actual delivery confirmation from the provider.

**A second, independent bulk-messaging surface exists outside Communications entirely**: `src/app/api/register/bulk-email/route.ts` lets staff bulk-email up to 50 registrations at once via `sendRegistrationStatusUpdate`. It is properly gated (`auth()` + `['ORG_OWNER','MANAGER'].includes(userRole)`, 401/403 on failure) — this is the established sibling pattern for "who may bulk-send" in this codebase, and is the evidence base for the C9 fix below (§N).

---

## B. Data model

**`broadcasts`** (`src/db/schema.ts:753-769`) — the sole Communications table:

```
id uuid PK · organisationId uuid NOT NULL FK→organisations (cascade)
centreId uuid FK→centres (cascade, nullable) · subject text NOT NULL · message text NOT NULL
recipientCount integer NOT NULL default 0 · successCount integer NOT NULL default 0
failureCount integer NOT NULL default 0 · createdAt timestamp(tz) NOT NULL defaultNow
```

Indexes: `broadcasts_org_idx` (organisationId), `broadcasts_centre_idx` (centreId). No unique constraints, no `updatedAt`, and critically **no `sentBy`/`createdByUserId` column** — there is no audit trail of which staff member sent a given broadcast, despite the UI's own "History & Audit Log" tab label implying one exists.

No per-recipient table exists — delivery is tracked only as two aggregate integer counters (`successCount`/`failureCount`), never a per-parent send/delivery record. This means the history view can show "12 sent, 1 failed" but never *which* parent failed.

**Consent**: `communicationsConsent` (`schema.ts:357`) is defined **only on `bookings`**, not on `parents`. A parent has no consent field of their own; `getParentsForCentre` derives one via `COALESCE(bool_or(bookings.communicationsConsent), false)` grouped by parent — i.e. a parent counts as consented if **any one** of their bookings (ever, any centre, any date) has consent=true, even if a more recent or more relevant booking has consent=false. There is no update path anywhere in the repo for a parent to change their consent after the fact (grep across the whole tree for writes to `communicationsConsent` finds only creation-time defaults in booking-creation flows — never a dedicated update/PATCH action).

**Two other, unrelated "notification" tables** exist and are worth naming so they aren't confused with Communications during Stage B: `notifications` (dashboard bell, keyed by `userId`) and `portalNotifications` (parent-portal bell, keyed by `parentId`; notably its `organisationId` column is a bare `uuid` with **no FK reference**, unlike every other `organisationId` column in the schema — flagged as pre-existing debt, out of Communications' ownership).

No `templates` table exists anywhere (see §G).

---

## C. Channels / providers

**Email** — `src/lib/services/email.ts` (1454 lines), provider **Resend**. Client is guarded against an unconfigured/placeholder API key (`RESEND_API_KEY` starting with `re_xxx` is treated as "not configured"); every method short-circuits to `{success:false}` rather than throwing when unconfigured. `FROM_EMAIL`/`FROM_NAME` fall back to hardcoded defaults (`noreply@sprintscaleit.co.uk` / `SprintScale`) since neither is documented in `.env.example`. No rate-limiting, retry, or idempotency logic anywhere in the file — every send is a single unguarded `resend.emails.send()` call.

The file exports many purpose-built templated methods (`sendBookingConfirmation`, `sendInvoiceCreated`, `sendStaffInvitation`, etc.) plus one generic function, `sendEmail(data: {to, subject, html, organisationId?})` (line 1422), explicitly documented in its own JSDoc as the "generic counterpart... for callers (e.g. broadcasts) that build their own HTML." **`sendBroadcast` is the only production call site of `sendEmail`** anywhere in the repo.

`src/app/api/cron/reminders/route.ts` instantiates its **own separate `Resend` client** (rather than reusing `emailService`) for next-day session reminders, and sends to every parent with a confirmed booking tomorrow with **no `communicationsConsent` check at all**. This is a pre-existing, cron-triggered surface entirely outside Communications' code — flagged as out-of-scope debt (§P), not fixed here, since it isn't Communications-owned and touching a cron job is outside this milestone's narrow-fix mandate.

**SMS** — `src/lib/services/sms.ts`, provider **Twilio**. Used exclusively by booking-related flows (confirmation/cancellation/reminder) via `src/lib/services/notifications.ts`. **Communications never touches SMS/Twilio at all** — `grep -rn "twilio" src/features/communications` returns nothing. `IMPROVEMENT_BRIEF.md:135` documents SMS-via-Twilio and "per-message delivery status" as part of the *originally envisioned* feature, but only the email half and aggregate (not per-message) status were ever built. This is a scope gap against the original product brief, not a regression — noted for context, not implemented here, per the ticket's explicit "do not add a new communication channel" / "do not add missing product features" instructions.

---

## D. Message lifecycle

There is no explicit status enum on `broadcasts` (unlike `invoices.status` in Finance). The only lifecycle signal is the pair of counters, updated once, asynchronously, after the initiating request has already returned (see §N, C1/C2 below — the send itself is fire-and-forget: `sendBroadcast` returns `{sent: 0, failed: 0}` immediately, and the real counts are written to the DB moments later by an un-awaited background task). There is no "draft," "scheduled," "cancelled," or "queued" concept anywhere in the code — every broadcast is composed and sent in one action with no draft-save or scheduling capability. This matches the ticket's own framing ("only if present") — none of those states exist, so none are audited further.

---

## E. Recipient selection

`getParentsForCentre(centreId, classId?)` is the only recipient-source function. It:
- Requires a session with `organisationId` (else returns `[]`).
- Scopes by `eq(parents.organisationId, session.user.organisationId)` — correct org scoping on this read.
- Joins `bookings` to compute the derived `communicationsConsent` value described in §B.
- Filters by `bookings.centreId`/`bookings.sessionId` when a specific centre/class is chosen, or returns organisation-wide when `centreId === 'all'`.
- **Does not check `getUserAccessibleCentreIds` for non-owner roles.** A caller-supplied `centreId` is trusted outright — there is no verification that the authenticated (non-owner) user is actually assigned to that centre before returning its parents' names/emails/consent status.

The actual send path, `sendBroadcast`, is worse: it receives `audienceParentIds: string[]` as a plain caller-supplied array and does `db.query.parents.findMany({ where: inArray(parents.id, data.audienceParentIds) })` — **no organisation filter, no centre filter, no consent re-check** on this query at all. Consent filtering (`parents.filter(p => p.communicationsConsent)`) happens **only in the client component** (`CommunicationsClient.tsx:52`), which is exactly the kind of client-side-only enforcement this codebase's own Finance/Bookings/Attendance milestones established must never be trusted for a security or policy boundary. See §N (C1–C4) for the confirmed-defect writeup.

---

## F. Bulk messaging

There is no separate "bulk" concept distinct from ordinary sending — every broadcast targets a list of parent IDs, which may be one or many; the same `sendBroadcast` action handles both. There is no pagination/cross-page selection UI (the recipient list is loaded in full for the resolved centre/class and "Select All" is implicit — the whole filtered list is always the audience, there's no individual-recipient checkbox UI). Given §E's findings, the central bulk-messaging risk is exactly the same as the general recipient-selection risk: a crafted `audienceParentIds` payload is not verified against organisation, centre, or consent boundaries server-side.

---

## G. Templates

**No template system exists** — confirmed via exhaustive grep (`template|placeholder|merge.?field`, case-insensitive) across `src/features/communications` and the dashboard route: zero matches, no `templates` table in the schema. The composer is free-text subject + body only. The single hardcoded wrapper in `actions.ts:54` — `` `<p>Dear ${parent.firstName},</p><p>${data.message}</p>` `` — is the entirety of the "templating," with exactly one merge field (`parent.firstName`).

**Confirmed defect**: neither `parent.firstName` nor the staff-authored `data.message` is HTML-escaped before being interpolated into this string, which becomes the literal email body HTML sent to real parents. `data.message` in particular is arbitrary free-text from a `<textarea>` with no length/content restriction — a staff member (or anyone reaching the action directly, given §N's auth gap) can inject arbitrary HTML/markup into every recipient's inbox. This exact "interpolate raw fields into an HTML template literal with no escaping" pattern is endemic across the *entire* `email.ts` file (every other templated method does the same), so it is **not** a Communications-introduced regression — it is pre-existing, shared, out-of-scope debt. What *is* in scope is `sendBroadcast`'s own interpolation in `actions.ts`, since that file is Communications-owned; see §N (C7).

---

## H. Cross-module dependencies

Per-module grep for any communications/email/SMS call:

- **Attendance**: no matches — never triggers a communication.
- **Staff**: no matches inside `src/features/staff`; staff-invitation email is sent from `src/app/api/staff/invite/route.ts` (an API route, not `src/features/staff`), via the same shared `emailService`.
- **Bookings**: `src/features/bookings/actions.ts:175` triggers `emailService.sendAssessmentFeedback` on assessment recording; has its own `auth()`/org check, untouched here.
- **Finance**: `src/features/finance/actions.ts` triggers `sendInvoiceCreated`, `sendPaymentReceiptEmail`, `sendVoucherPaymentVerified/Failed` — all via the same shared `emailService`, all through their own already-audited (Milestone 3G) authorization paths.

All of these go through `emailService`'s *templated* methods, never `sendEmail` (the generic function Communications uses) — so none of the fixes proposed below (scoped to `sendBroadcast`/`getParentsForCentre`/`getBroadcasts`/`getClassesForCentre` in `src/features/communications/actions.ts`) touch any code path any frozen module depends on. **No shared service file (`email.ts`, `sms.ts`, `notifications.ts`) needs to change for any confirmed Communications defect** — every fix is containable inside `src/features/communications/actions.ts` and its own test file. This is confirmed explicitly here because §42 of the ticket requires a frozen-consumer regression check only if a shared dependency changes; it does not.

---

## I. Authorization matrix

No role restriction exists anywhere in Communications today. Evidence-based matrix for what Stage B will establish (see §N, C9), modelled on the one sibling precedent that already exists in this codebase for bulk messaging (`/api/register/bulk-email`, which restricts to `ORG_OWNER`/`MANAGER`):

| Action | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| View Communications page (today) | ✅ | ✅ | ✅ | ✅ |
| View Communications page (proposed) | ✅ | ✅ | ❌ | ❌ |
| View broadcast history (today) | ✅ (no server check at all) | ✅ | ✅ | ✅ |
| Send a broadcast (today) | ✅ | ✅ | ✅ (page-reachable) | ✅ (page-reachable) — **and, since `sendBroadcast` has no `auth()` call, even a non-authenticated direct call succeeds** |
| Send a broadcast (proposed) | ✅ | ✅ | ❌ | ❌ |

---

## J. Organisation isolation

Reasoned through each tampering vector required by the ticket:

- **Parent-ID tampering**: confirmed exploitable today. `sendBroadcast`'s parent query has no `organisationId` filter — a caller from Org A supplying Org B's real parent IDs would have those parents actually emailed, with the `broadcasts` audit row recorded under Org A's `organisationId` (misattributing the send) while Org B's parents are the ones who actually receive it.
- **Message/broadcast-ID tampering (history lookup)**: `getBroadcasts(centreId)` has **no `organisationId` filter at all** — it filters solely by `centreId`. Since `centreId` is a UUID, this is not exploitable by simple enumeration, but it is inconsistent with this codebase's own established convention (every other read in every frozen module explicitly scopes by `eq(table.organisationId, orgId)` even when a more specific ID is also present, as defense-in-depth). Flagged as a confirmed defect (§N, C5) — narrow fix: add the explicit org check, matching the established convention.
- **Centre-ID tampering**: covered in §K.
- **Resend/retry against another org's message**: not applicable — there is no resend/retry action for a broadcast (a "failed" broadcast cannot be resent; the only way to reach a parent again is composing a new broadcast).
- **Provider-ID lookup**: not applicable — no per-message provider ID is stored (see §B).

---

## K. Centre scoping

`getParentsForCentre`, `getClassesForCentre`, and `getBroadcasts` all accept a caller-supplied `centreId` and use it directly in their query with **no `getUserAccessibleCentreIds` check for non-owner roles** — unlike the established pattern from Finance/Bookings/Attendance (`if (userRole !== 'ORG_OWNER') { const accessible = await getUserAccessibleCentreIds(...); if (!accessible.includes(centreId)) ... }`). In normal UI use this is masked because the page always resolves the caller's own `activeCentreId` via `resolveActiveCentreId` and redirects away from `centreId === 'all'` — but because these are independently callable server actions, a non-owner could call any of them directly with a foreign centre's ID and receive that centre's parent list (names, emails, consent status) or broadcast history. This is the same class of gap as Finance's L2/L2a/L2b, fixed the same evidenced way (§N, C4/C5).

`sendBroadcast`'s own `centreId` field is stored on the `broadcasts` row but is **never used to scope the parent query at all** — the function relies entirely on the client having pre-filtered `audienceParentIds` to the right centre. Org-wide (`centreId === 'all'`) behaviour for `ORG_OWNER` is intentional and consistent with every other frozen module's "owner sees everything" pattern; the gap is specifically the missing non-owner centre-membership check, not the existence of org-wide access itself.

---

## L. Privacy / contact-data findings

`getParentsForCentre`'s return shape includes `firstName`, `lastName`, `email`, and the derived `communicationsConsent` for every parent matching the (currently under-verified) centre/class filter — this is real PII returned to the client. Because of §K's centre-scoping gap, a non-owner could retrieve this list for a centre they have no assignment to. No autocomplete/search-as-you-type endpoint exists (the picker loads the full filtered list, not an incremental search), so there is no separate "search exposes more than the list view" concern to audit.

---

## M. Known test-failure root cause — **resolved this session**

**Original symptom**, reproduced exactly at `3f2bd19` before any change: running `npx vitest run src/features/communications/actions.test.ts` produced 0 tests collected and:

```
FAIL  src/features/communications/actions.test.ts [ src/features/communications/actions.test.ts ]
Error: Cannot find module '/home/claude/repo/node_modules/next/server' imported from /home/claude/repo/node_modules/next-auth/lib/env.js
Did you mean to import "next/server.js"?
```

**Root cause**: `src/features/communications/actions.ts` imports `auth` from `@/lib/auth` at module top level (used by `getBroadcasts`/`getClassesForCentre`/`getParentsForCentre`). `actions.test.ts` imported `sendBroadcast` from `./actions` **without ever mocking `@/lib/auth`** — unlike every other production-actions test file in this repo that touches an action module importing `@/lib/auth` (`src/features/billing/actions.test.ts`, `src/features/finance/actions.test.ts`, `src/features/billing/actions/reconcile-payment.test.ts` — all three mock `@/lib/auth` before importing the action file under test). Without that mock, Vitest's module graph pulled in the **real** `next-auth` package. `next-auth@5.0.0-beta.31`'s compiled `lib/env.js` does a bare `import { NextRequest } from "next/server"` with no explicit file extension; `next`'s own `package.json` has no `exports` map for `./server` to resolve that bare specifier through. Vitest externalizes `node_modules` packages for its SSR test environment and loads them through Node's own native ESM loader (not Vite's bundler-aware resolver) — and Node's ESM resolver, unlike a bundler or CJS `require()`, does **not** auto-append `.js` to an extensionless specifier. The failure is therefore a genuine upstream `next-auth`/`next` packaging mismatch, but one that **only ever manifests inside Vitest's Node-ESM externalization path** — confirmed separately that `npm run build` passes and the app runs correctly in dev, meaning Next's own bundler resolves `next/server` without issue at runtime and at build time. Production code was never broken.

**Determination against the ticket's five required questions**:
1. Originates in Communications test architecture — yes, specifically this one test file's missing mock, not a repo-wide Vitest config problem (368 other test files in this suite pass; the same `next-auth` package is transitively present in dozens of them, mocked away the same way every time).
2. Production Communications code is not broken — confirmed via a clean `npm run build`.
3. Caused by an invalid test mock/import pattern — yes, exactly: `@/lib/auth` was never mocked in this one file.
4. The `next-auth`/`next/server` dependency can be isolated safely in tests — yes, the exact same way every other passing test in the repo already does it.
5. Fixing it requires test-only changes — yes, no production code needed to change.

**Fix applied** (test-only, `src/features/communications/actions.test.ts`): added
```ts
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));
```
before the `./actions` import, matching the established repo-wide pattern exactly. Result: the suite now collects and runs. This surfaced two **pre-existing failing assertions** that the collection failure had been silently masking (see §N, C3/C6) — the test file asserted consent-filtering behaviour that production code never actually implemented. Both are addressed as confirmed defects in Stage B, with the test file's mocks updated to match the corrected implementation. Final result after Stage B: **all Communications tests pass; the full repository suite has zero known failures for the first time in this rebuild's history** (see the completion report for the exact final count).

---

## N. Confirmed defects

### C1 — `sendBroadcast` has no authentication check at all (most severe; same class as Finance Milestone 3G's L1)

- **Problem**: `sendBroadcast(data: {organisationId, centreId?, audienceParentIds, subject, message})` never calls `auth()`. `organisationId` is a plain caller-supplied argument, trusted without any session verification.
- **Impact**: any request that can reach this server action — authenticated as any role, or (since there is no session check) arguably not authenticated at all if the endpoint is otherwise reachable — can send a real email, to real parents, under any organisation's name, by supplying an arbitrary `organisationId`/`audienceParentIds`.
- **Fix**: derive `organisationId` from `auth()`'s session, exactly as every other function in this file (and every Finance/Bookings mutation) already does; reject with an error if there is no session.
- **Test**: new test asserting `sendBroadcast` rejects when there is no session, and that it uses `session.user.organisationId` rather than the caller-supplied value even when they differ.

### C2 — `sendBroadcast`'s recipient query has no organisation-ownership filter

- **Problem**: `db.query.parents.findMany({ where: inArray(parents.id, data.audienceParentIds) })` has no `eq(parents.organisationId, ...)` clause.
- **Impact**: even with C1 fixed (a valid session required), a caller from Org A supplying Org B's real parent IDs would still have those parents actually emailed under Org A's own send.
- **Fix**: add `eq(parents.organisationId, organisationId)` (the now session-derived value) to the query.
- **Test**: asserts a parent ID belonging to a different organisation is excluded from the send.

### C3 — Consent is enforced only client-side, never re-verified server-side

- **Problem**: `CommunicationsClient.tsx` filters `parents.filter(p => p.communicationsConsent)` before calling `sendBroadcast`; the server action performs no equivalent check of its own.
- **Impact**: a crafted call (or any bug in the client's own filtering logic) can message a parent who has explicitly opted out, directly contradicting the page's own stated claim ("Respects GDPR communication consent"). This is exactly the assertion the pre-existing (previously masked) test `should filter out parents without communicationsConsent` was written to verify.
- **Fix**: `sendBroadcast` re-derives consent server-side using the same join/aggregation `getParentsForCentre` already uses (`leftJoin(bookings)`, `bool_or(bookings.communicationsConsent)`), and filters `targetParents` down to consented parents before sending — rather than trusting a `communicationsConsent` field on the raw `parents.findMany` result (which doesn't exist on that table at all; see §B).
- **Test**: the pre-existing test's intent is preserved and its mock updated to match the corrected query shape (mocking the `.select()`/join chain rather than `db.query.parents.findMany`, matching this file's real corrected implementation).

### C4 — `sendBroadcast`, `getParentsForCentre`, `getClassesForCentre` have no centre-membership check for non-owner roles

- **Problem**: all three trust a caller-supplied `centreId` outright for non-owner roles.
- **Impact**: a MANAGER/FRONT_DESK assigned only to Centre A could call any of these with Centre B's ID (same organisation) and receive/message Centre B's parents, despite having no assignment there.
- **Fix**: apply the established `if (userRole !== 'ORG_OWNER') { ...accessibleCentreIds.includes(centreId)... }` pattern already used throughout Finance/Bookings/Attendance.
- **Test**: new tests per function asserting rejection for a non-owner without centre access, and success for one with it.

### C5 — `getBroadcasts` has no organisation-scoping at all

- **Problem**: `db.select().from(broadcasts).where(eq(broadcasts.centreId, centreId))` — no `eq(broadcasts.organisationId, ...)` clause.
- **Impact**: relies solely on `centreId` UUID unguessability for tenant isolation, inconsistent with this codebase's own convention of always scoping explicitly by organisation as defense-in-depth, even when a more specific ID is already present.
- **Fix**: add the explicit `eq(broadcasts.organisationId, session.user.organisationId)` clause, plus the same non-owner centre-membership check as C4.
- **Test**: asserts a broadcast belonging to a different organisation is not returned even if its `centreId` were somehow known/supplied.

### C6 — Confirmed: not a defect — consent's "any one booking" semantics is a pre-existing data-model characteristic, not a bug

- **Finding**: `bool_or` across all of a parent's bookings (§B) means one old, unrelated consenting booking permanently unlocks messaging for that parent regardless of more recent bookings' consent values. This is data-model **ambiguity/debt** (§O), not a fixable defect — "fixing" it would mean inventing new consent semantics (e.g. "most recent booking wins") with no evidence for which policy is correct. Left unchanged; flagged for a future product decision.

### C7 — `sendBroadcast`'s outgoing HTML has no escaping of interpolated fields

- **Problem**: `` `<p>Dear ${parent.firstName},</p><p>${data.message}</p>` `` interpolates both `parent.firstName` and the staff-authored, unrestricted-length `data.message` directly into HTML with no escaping.
- **Impact**: a composer user (or anyone reaching the action directly, prior to C1's fix) can inject arbitrary HTML/markup into every recipient's inbox via the message body.
- **Scope note**: this exact unescaped-interpolation pattern is endemic across the entire shared `email.ts` file (every templated method does the same) — that is pre-existing, out-of-scope debt (§P), since fixing it would mean touching Bookings/Finance/Staff-owned email templates. The narrow, in-scope fix here is limited to `sendBroadcast`'s own interpolation in `actions.ts` (Communications-owned code only).
- **Fix**: HTML-escape `parent.firstName` and `data.message` before interpolating.
- **Test**: asserts a message body containing `<script>`/`<img onerror>`-shaped input is escaped in the HTML passed to `sendEmail`.

### C10 — Delivery-status counting always records a send as successful, even when it failed (found live in Stage C, not in the original static read)

- **Problem**: `sendEmail`'s contract (`src/lib/services/email.ts`) is to *resolve* with `{success: boolean, error?}` on both success and failure — it does not throw. `sendBroadcast`'s background send loop only incremented `failureCount` inside a `catch` block, never inspecting the resolved `result.success` value; a resolved-but-failed send fell through to `successCount++` every time.
- **Impact**: `broadcasts.successCount`/`failureCount` — the exact numbers surfaced in the History & Audit Log view — were unreliable, silently overstating delivery success whenever the underlying send failed without throwing (an unconfigured provider, a rejected Resend API response, any non-exception failure mode).
- **Evidence**: found live, not in the original static read. Stage C sent a real broadcast through the actual UI with Resend deliberately unconfigured in the dev environment (confirmed via the `[EmailService] Resend client not initialized. Email not sent.` log line — proving no network call was attempted) and observed the resulting `broadcasts` row recorded `success_count: 1, failure_count: 0` despite the email never being sent.
- **Fix**: check `result.success` from `sendEmail`'s resolved value before incrementing either counter; the `catch` block remains as a second layer for the case `sendEmail` does throw.
- **Test**: two new tests asserting the background `db.update(broadcasts).set(...)` call records `successCount: 0, failureCount: 1` when `sendEmail` resolves with `{success: false}`, and `successCount: 1, failureCount: 0` when it resolves with `{success: true}`.

### C8 — No page-level or action-level role restriction (evidenced fix available, matches sibling bulk-send pattern)

- **Problem**: the Communications page and every action in it are reachable by any authenticated org member, including TUTOR — unlike the codebase's own established sibling precedent for bulk messaging, `/api/register/bulk-email`, which restricts to `['ORG_OWNER','MANAGER']`.
- **Impact**: FRONT_DESK/TUTOR can currently view parent contact data and send organisation-wide broadcasts, with no evidenced product reason they should be able to (compose/dashboard staff invites, invoices, and every other bulk/PII-adjacent surface in this codebase is ORG_OWNER/MANAGER-only).
- **Fix**: restrict the page (`requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })`, matching the established pattern) and independently restrict `sendBroadcast` itself server-side to the same two roles (page-level gating alone is not sufficient for a server action, per this codebase's own established doctrine). `getBroadcasts`/`getParentsForCentre`/`getClassesForCentre` remain reachable to any org member for read purposes since no evidence suggests history-viewing needs the same restriction as sending — restricting only the two highest-risk operations (page access and sending) that this milestone has direct sibling evidence for, rather than restricting reads with no such precedent.
- **Test**: new tests asserting a FRONT_DESK/TUTOR session is rejected by `sendBroadcast`.

---

## O. Ambiguities (not blocking, none material enough to stop)

- **O1 (=C6 above)** — the "any one booking's consent unlocks all future messaging" semantics. Left unchanged; flagged for a product decision.
- **O2** — whether `getBroadcasts`/`getParentsForCentre`/`getClassesForCentre` (read-only) should also be role-restricted beyond org/centre scoping. No sibling precedent exists either way for *read* access to this shape of data (unlike the clear `ORG_OWNER`/`MANAGER` precedent for *sending*), so left open rather than invented.
- **O3** — no draft-save, scheduling, or resend/retry capability exists. This may be an intentional simplicity choice or a gap against `IMPROVEMENT_BRIEF.md`'s original vision; not a defect, not implemented here (adding it would be a new feature, explicitly out of scope).

None of O1–O3 rise to the ticket's "material policy ambiguity" bar (a resolution that would materially change permissions or displayed liability) — Stage A therefore proceeds directly to Stage B without a stop.

---

## P. Out-of-scope debt

- `src/app/api/cron/reminders/route.ts`'s own separate `Resend` client and its lack of any `communicationsConsent` check for next-day session reminders — a cron job, not Communications-owned code, out of this milestone's narrow-fix mandate.
- The endemic unescaped-HTML-interpolation pattern across the rest of `email.ts`'s templated methods (Bookings/Finance/Staff-owned emails) — only `sendBroadcast`'s own interpolation (Communications-owned) is fixed here (C7).
- `portalNotifications.organisationId`'s missing FK reference — pre-existing schema debt, unrelated to Communications.
- No SMS/Twilio integration in Communications, and no per-message delivery status/scheduling — both were part of the original product brief (`IMPROVEMENT_BRIEF.md:135`) but were never built; not added here per the ticket's explicit "do not add a new communication channel" / "do not add missing product features" instructions.
- No `sentBy` column on `broadcasts` (no audit trail of which staff member sent a broadcast) — a schema gap; per the ticket's "do not introduce a schema migration merely because the model could be cleaner" and "if you believe a migration is required, STOP and report first" instructions, this is flagged but **not** implemented as a migration in Stage B. It doesn't block any confirmed-defect fix.

## Q. Proposed Stage-B scope

1. **C1** — add session-derived auth to `sendBroadcast`; stop trusting caller-supplied `organisationId`.
2. **C2** — add organisation-ownership filter to `sendBroadcast`'s recipient query.
3. **C3** — re-derive and enforce `communicationsConsent` server-side in `sendBroadcast`.
4. **C4** — add non-owner centre-membership checks to `sendBroadcast`, `getParentsForCentre`, `getClassesForCentre`.
5. **C5** — add organisation-scoping (plus the same centre check) to `getBroadcasts`.
6. **C7** — HTML-escape `parent.firstName`/`data.message` in `sendBroadcast`'s own interpolation.
7. **C8** — role-gate the Communications page and `sendBroadcast` to `ORG_OWNER`/`MANAGER`.
8. **C10** (found live during Stage C, added to this scope after the fact) — fix `sendBroadcast`'s success/failure counting to check `sendEmail`'s resolved `result.success` rather than only catching thrown exceptions.
9. Regression tests for every fix above, plus the resolved known-test-failure fix already applied (§M).
9. Visual modernisation — **revised after checking codebase precedent, not left as originally drafted.** `CommunicationsClient.tsx`'s empty state uses a `glassmorphic-card` class and a `bg-gradient-to-r from-[#3b82f6] to-[#6366f1]` button; an earlier draft of this section flagged both as violations of the ticket's generic "avoid glassmorphism/gradients" guidance. Checked against actual precedent before acting: `glassmorphic-card` is a shared, established global utility (`src/app/globals.css:586`) already used by the *frozen* `DataTable` component and other dashboard surfaces — removing it from Communications would make it *less* consistent with frozen modules, not more. The exact same gradient (`from-[#3b82f6] to-[#6366f1]`) is used verbatim on `src/app/login/page.tsx` (core auth) and two other dashboard empty/error states. Both are pre-existing, codebase-wide conventions, not Communications-specific issues — left unchanged. The rest of the component (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-secondary/60`, `rounded-2xl`/`rounded-3xl`, `text-success`/`text-destructive` with matching `/10` backgrounds) already matches the frozen InvoiceFlow token vocabulary throughout. No structural/layout redesign is needed — the compose/history/drawer structure is sound and appropriately different from a Students/Parents-style record layout, as the ticket anticipates Communications legitimately may be. **Confirmed via live screenshot review at 1440/834/375 × light/dark (§ Stage C in the completion report): the module already renders correctly and consistently at every breakpoint and theme, with zero console errors.** No visual changes were made to this component's structure or styling — only the behavioural changes needed for C1/C8 (a success/error result banner reflecting the new server-side authorization outcomes).

No material policy ambiguity was found requiring a Stage-A stop. Proceeding to Stage B.
