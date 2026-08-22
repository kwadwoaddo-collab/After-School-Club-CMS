# CMS Rebuild — Milestone 3C: Staff Module Modernisation — Completion Report

## STATUS

**PASS.** Staff is modernised to the frozen People-module visual language
(Students, then Parents), the two security gaps found during audit are
closed with a directly-evidenced, narrow policy — Staff's own existing,
stricter ORG_OWNER-only posture, not the Students/Parents role tuple —
the RSC server/client boundary is verified clean under production-style
testing with real seeded data, and all quality gates are green. See
RECOMMENDATION below for the freeze call.

## STARTING STATE

Verified per ticket §0 before any edit:

```
git status                → clean, up to date with origin
git branch --show-current  → rebuild/cms-modernisation
git log -1 --oneline       → 912f4be docs(milestone-3b): Parents audit and completion report
```

Local HEAD matched the ticket's stated expected tip (`912f4be`) exactly,
working tree clean. No discrepancy requiring a stop-and-report.

## AUDIT FINDINGS

Full detail in `project-notes/milestone-3c-staff-audit.md`. Summary:

- Staff's existing authorization posture is **already ORG_OWNER-only**
  across essentially every route and mutation — materially stricter than,
  and structurally different from, the Students/Parents
  `['ORG_OWNER','MANAGER','FRONT_DESK']` tuple. Corroborated independently
  by a pre-existing regression test outside this module
  (`src/lib/security-p6.test.ts`, "`/dashboard/staff` denies FRONT_DESK").
  Per the ticket's explicit instruction, the People-module tuple was **not**
  applied here.
- Two parallel staff-removal endpoints exist: the live
  `POST /api/staff/remove` (called by `StaffProfileForm.tsx`) and an
  unreferenced dead sibling `DELETE /api/staff/[id]`. The dead sibling
  already blocks removing another `ORG_OWNER`; the live one didn't. This
  gave direct, non-invented evidence for the fix (see SECURITY).
- `/dashboard/staff/invite` had **no page-level role gate at all** — the
  entire route was a Client Component with no server wrapper, unlike every
  other Staff page.
- No pre-existing RSC crash-class defect was found — Staff's interactive
  components were already cleanly split into Client Components before this
  milestone, unlike Parents' historical bug. Re-verified after the restyle
  (see RSC VERIFICATION).
- No Recovery Bin and no deactivate/reactivate lifecycle exist for Staff —
  confirmed directly from the schema (`users` has no `deletedAt`) and from
  the absence of any bin route/component. Not invented this milestone.
- Visual debt was exactly what the ticket describes: legacy tokens
  (`bg-card`, `text-muted-foreground`), oversized radii (`rounded-3xl`,
  `rounded-[32px]`), `glassmorphic-card`/`glow-btn`, a bespoke accordion
  list instead of the shared `Table`, hard-coded per-role colour classes
  duplicated in an orphaned component, no shared primitives.

## STUDENTS/PARENTS PATTERNS REUSED

No new primitives were introduced beyond one file directly modelled on an
existing sibling. Reused as-is: `Table`/`TableHeader`/`TableBody`/
`TableRow`/`TableHead`/`TableCell`, `Badge`, `Card`/`CardHeader`/
`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Button`,
`EmptyState`, `HeaderPortal`. `StaffGrid.tsx` (new) is modelled directly on
`StudentsGrid.tsx`/`ParentsGrid.tsx` — the same "table + grid sibling"
shape those modules use, not a speculative abstraction. The Staff Detail
page's restrained header `Card` (avatar, name, role `Badge`, metric chips)
is copied structurally from `ParentProfileClient`'s header in 3B. The
remove-staff confirmation modal reuses the exact fixed-overlay dialog
pattern from `BinActions.tsx`/`DeleteParentButton.tsx`.

## STAFF LIST

`src/app/dashboard/staff/page.tsx` + `StaffDashboardClient.tsx` (rewritten)
+ `StaffGrid.tsx` (new):

- Role-count `Card` KPI strip (Owner / Manager / Front Desk / Tutor) now
  matches Students/Parents' icon-chip + `text-financial-total` pattern.
- Desktop Active-staff view uses the shared `Table` primitive; mobile
  (`<md`) collapses to `StaffGrid` stacked cards.
- Empty states now distinguish "No staff yet" (org has no staff at all —
  a gap the pre-restyle version didn't cover) from "No staff match these
  filters" (active search/role filter).
- Pending Invites tab restyled onto the same `Table` + `Badge`
  (Pending/Expired, using the existing computed statuses — no new status
  invented) pattern; revoke action uses the shared `Button`.
- Both loading skeletons (`loading.tsx` for List and `[userId]/loading.tsx`
  for Detail) reshaped to match the new layouts so they no longer flash a
  legacy-shaped placeholder.

## STAFF DETAIL

`src/app/dashboard/staff/[userId]/page.tsx` (restyled header, auth
normalised) + `StaffProfileForm.tsx` + `StaffRoleSelector.tsx` +
`StaffCentreAssignment.tsx` (all rewritten):

- Header: back link, restrained `Card` (avatar, name, role `Badge`, email,
  Centres/Joined metric chips) — no giant hero, no glassmorphism.
- Role & access: the 4 role cards restyled onto the `ROLE_COLORS`/
  `ROLE_AVATAR_COLORS` semantic tokens already half-adopted in
  `staff-constants.ts` (`success`/`info`/`accent-violet`/`warning`), rather
  than the per-role bespoke Tailwind shades the original used. "Club
  Leader" retired in favour of `ROLE_LABELS`' "Tutor" everywhere, matching
  the rest of the app (the constant already noted the retirement; the
  selector hadn't picked it up). The UI-level last-owner lock and the
  promote/demote warning banners are unchanged in logic, restyled onto
  tokens.
- Centre assignments: checkbox grid restyled with `EmptyState` for the
  zero-centres case, Select all/Clear all as `Button`s.
- Remove staff member: now uses a modal confirmation dialog (matching the
  Parents module's destructive-action pattern) instead of an inline
  expand-in-place block.
- Sticky "unsaved changes" action bar restyled onto tokens; save/discard
  logic unchanged.

## STAFF INVITE

`src/app/dashboard/staff/invite/page.tsx` (new thin Server Component
wrapper) + `src/features/staff/components/InviteStaffForm.tsx` (the form,
moved and restyled):

- Established form language: `rounded-sm` inputs, `focus:outline
  focus:outline-2 focus:outline-accent`, shared `Card`/`Button`/
  `CardFooter`, role options rendered from `ROLE_LABELS`.
- All validation, centre-dropdown fetching, submission
  (`POST /api/staff/invite`), and duplicate/error handling are
  byte-for-byte unchanged — see SECURITY for the page-level gate this
  split enabled.

## CREATE/EDIT LIFECYCLE, DEACTIVATE/REACTIVATE, RECOVERY BIN

**NOT APPLICABLE — these features do not exist in the current CMS for
Staff.** Confirmed directly from the schema and codebase (no `deletedAt`
on `users`, no bin route/component, no distinct deactivate action beyond
remove-then-reinvite) — see the audit's §4. Not invented to satisfy this
report.

## SECURITY

### Authorization matrix

Every Staff route and mutation was already ORG_OWNER-only before this
milestone, independently corroborated by a pre-existing test outside this
module (`security-p6.test.ts`). Two gaps were found and closed with
narrow, directly-evidenced fixes — not the People-module tuple, and not
guesses:

| Action | Before | After |
|---|---|---|
| LIST `/dashboard/staff` | ORG_OWNER only (`requireAuth`) | Unchanged |
| VIEW DETAIL `/dashboard/staff/[userId]` | ORG_OWNER only (raw `auth()`) | ORG_OWNER only, normalised to `requireAuth` |
| INVITE (page) `/dashboard/staff/invite` | **No page-level gate at all** | ORG_OWNER only (`requireAuth`) — **fixed** |
| INVITE (API) `POST /api/staff/invite` | ORG_OWNER only | Unchanged |
| EDIT ROLE `updateStaffRole` | ORG_OWNER only, blocks self-change | Unchanged |
| ASSIGN CENTRES `POST /api/staff/assign-centres` | ORG_OWNER only | Unchanged |
| REMOVE (live) `POST /api/staff/remove` | ORG_OWNER only, blocks self-removal, **no owner-removal guard** | + blocks removing another ORG_OWNER — **fixed** |
| REMOVE (dead) `DELETE /api/staff/[id]` | ORG_OWNER only, already blocks owner-removal | Unchanged (unreferenced; not requested to remove) |
| RESEND/CANCEL invitation | ORG_OWNER only | Unchanged |
| CLEAR EXPIRED invitations | ORG_OWNER only | Unchanged |
| ACCEPT INVITE (invitee flow) | Unauthenticated, token-gated | Unchanged — out of scope (see below) |
| DEACTIVATE/REACTIVATE | — | **NOT APPLICABLE** |
| RECOVERY BIN | — | **NOT APPLICABLE** |

### Gaps found and fixed

1. **`POST /api/staff/remove` could remove another ORG_OWNER.** Its
   unreferenced sibling `DELETE /api/staff/[id]` already blocked this
   ("Cannot remove another owner. Change their role first."), giving
   direct evidence of the intended policy. Ported the identical check into
   the live endpoint, with a regression test.
2. **`/dashboard/staff/invite` had no page-level role gate.** The whole
   route was a Client Component; submission was already server-gated via
   `POST /api/staff/invite`, but the form's UI itself was reachable by any
   authenticated user. Split the form into `InviteStaffForm.tsx` and added
   a `requireAuth({roles:['ORG_OWNER']})` Server Component wrapper,
   matching every other Staff page.

### Investigated and resolved without a code change

`updateStaffRole`'s owner-safety was traced explicitly rather than assumed
from the more-conservative UI lock: the action unconditionally blocks
self-role-change, so the only way to demote a *different* ORG_OWNER
requires at least two owners to exist at the moment of the call (the
caller plus the target), and the caller remains an owner immediately after.
**The action cannot reduce an org's owner count to zero by construction.**
No server-side change was needed; this reasoning is now also covered by a
regression test (see TESTS).

### Deliberately left unchanged (out of scope)

`src/app/accept-invite/page.tsx` and its four unauthenticated,
token-gated API routes (`accept-invite`, `magic-login`,
`request-magic-link`, `validate-invite`) are the invitee's own side of the
invitation flow — a public, pre-login landing page structurally analogous
to `BookingForm.tsx`'s out-of-scope consumption of a Parents endpoint in
3B. Different design-system context (fixed dark gradient page, no
dashboard shell), and touching its auth mechanics is outside a
presentation-focused Staff-module milestone. Left untouched. The dead
`PATCH`/`DELETE /api/staff/[id]` endpoints and the orphaned
`InvitationsList.tsx` component (confirmed unreferenced by grep) were also
left as-is — not requested to be removed, and `DELETE /api/staff/[id]` is
itself the evidence for the fix above.

### Tests

`src/features/staff/authorization.test.ts` (new, 15 tests) covers: the
newly-gated invite page (denial + pass-gate); the newly-fixed
`POST /api/staff/remove` owner-removal guard, self-removal block, and org
isolation; and `updateStaffRole`'s non-owner rejection, self-change guard,
successful demotion of a different staff member, and org isolation —
including an explicit regression test for the owner-safety reasoning
above.

## RSC VERIFICATION

No pre-existing crash-class defect existed in Staff, and none was
introduced. `StaffDashboardClient.tsx` and the new `StaffGrid.tsx` are both
Client Components (`'use client'`), so there is no Server→Client function-
prop boundary in the List view; the Server Component `page.tsx` files pass
only plain serializable data as props. Verified live against a running dev
server with production-style seeded data covering all of the required
scenarios: `ORG_OWNER` (2, to exercise a non-locked role selector),
`MANAGER` assigned to 2 centres (multi-centre), `FRONT_DESK` assigned to 1
centre (single-centre), `TUTOR` assigned to 0 centres (exercises the "no
data access" warning), a pending invitation, and an expired invitation. No
`pageerror` events, no console errors, and no crash-indicator text ("Event
handlers cannot be passed to Client Component props", "Application error",
an error-boundary digest) were observed on any captured page across either
theme.

## THEMES

Bright and dark captured and visually inspected for: Staff list (1440 /
834 / 375), Pending Invites tab (1440), Staff detail for the multi-centre
manager / single-centre front-desk / zero-centre tutor cases (1440, plus
375/834 for the multi-centre case), Invite form (1440 / 375). Both themes
read as production-quality, matching Students/Parents' token usage
throughout — no hard-coded light-only or dark-only colours found or
introduced.

## RESPONSIVE

Verified at 1440 / 834 / 375 for List, Detail, and Invite:

- **375:** no horizontal overflow anywhere; `StaffGrid` stacked cards used
  for the list instead of a squeezed table; bottom-nav clearance preserved
  (matching the Milestone 3A global fix); skip-link still activates
  correctly on focus; the invite form and detail header both read cleanly
  with no label/value collisions (the Parents-module class of bug from 3B
  was specifically checked for and not present, since Staff's header uses
  a Badge-plus-metric-chip layout rather than the row layout that caused
  it there).
- **834:** role cards, centre-assignment grid, and the detail header all
  reflow correctly; bottom-nav clearance holds.

## TESTS

`npm test` (Vitest): **275 passed**, 1 pre-existing unrelated collection
failure (`src/features/communications/actions.test.ts` — module resolution
issue with `next/server` under next-auth, documented since Milestone 2.5;
not touched or worsened by this milestone). This is 15 more passing tests
than the 3B baseline (260), all from the new
`src/features/staff/authorization.test.ts`.

## TYPECHECK

`npm run typecheck` (`tsc --noEmit`): **0 errors.**

## LINT

`npm run lint` (`eslint`): **0 errors, 0 warnings.**

## BUILD

`npm run build`: **PASS.** Compiled successfully; all routes generated
including `/dashboard/staff`, `/dashboard/staff/[userId]`, and
`/dashboard/staff/invite`.

## FILES CHANGED

- `src/app/api/staff/remove/route.ts` — owner-removal guard added.
- `src/app/dashboard/staff/invite/page.tsx` — rewritten as a thin `requireAuth` Server Component wrapper.
- `src/features/staff/components/InviteStaffForm.tsx` — **new** (form moved from the old page.tsx), full restyle.
- `src/app/dashboard/staff/[userId]/page.tsx` — auth normalised to `requireAuth`, restyled header.
- `src/app/dashboard/staff/page.tsx` — restyled header/KPI strip.
- `src/app/dashboard/staff/StaffDashboardClient.tsx` — full restyle.
- `src/app/dashboard/staff/loading.tsx` — reshaped skeleton.
- `src/app/dashboard/staff/[userId]/loading.tsx` — reshaped skeleton.
- `src/features/staff/components/StaffGrid.tsx` — **new**, mobile record cards.
- `src/features/staff/components/StaffProfileForm.tsx` — full restyle, modal remove-confirmation.
- `src/features/staff/components/StaffRoleSelector.tsx` — full restyle, "Tutor" label fix.
- `src/features/staff/components/StaffCentreAssignment.tsx` — full restyle.
- `src/features/staff/authorization.test.ts` — **new**, 15 tests.
- `project-notes/milestone-3c-staff-audit.md` — **new**, pre-implementation audit.
- `project-notes/milestone-3c-staff-completion.md` — **new**, this document.

No changes were made to: business logic beyond the two narrow security
fixes above, RBAC architecture, database schema, the invitee-facing
accept-invite flow, or any file outside the Staff module and its direct
dependencies.

## GIT

Starting SHA: `912f4be` (= origin tip at milestone start).
Commits (small, logical, on `rebuild/cms-modernisation`):

1. `docs(milestone-3c): Staff module fresh audit`
2. `fix(milestone-3c): close two Staff authorization gaps`
3. `refactor(milestone-3c): normalise Staff detail auth to requireAuth`
4. `test(milestone-3c): add Staff authorization regression coverage`
5. `feat(milestone-3c): modernise Staff List, Detail, and Invite to the frozen People-module visual system`

Push remains blocked in this sandbox (same 403 as every prior milestone).
One incremental bundle was produced from `912f4be..HEAD`, verified with
`git bundle verify` and sanity-tested by fast-forwarding a scratch clone to
confirm the exact tip SHA. Base/tip/verification reported in the delivery
message.

## BUGS DISCOVERED

1. `POST /api/staff/remove` missing owner-removal guard — **fixed** (see SECURITY).
2. `/dashboard/staff/invite` missing page-level role gate — **fixed** (see SECURITY).
3. `[userId]/page.tsx` using a raw `auth()` pattern instead of `requireAuth` — **normalised** (consistency, not a vulnerability — it already enforced the correct restriction).
4. `StaffRoleSelector` displaying the retired "Club Leader" label instead of `ROLE_LABELS`' "Tutor" — **fixed** (presentation only).

## REMAINING DEBT

- The invitee-facing `accept-invite` page and its four unauthenticated API
  routes remain on their own separate, pre-login design language —
  deliberately out of scope this milestone (see SECURITY).
- The dead `PATCH`/`DELETE /api/staff/[id]` endpoints and the orphaned
  `src/components/dashboard/InvitationsList.tsx` component remain
  unreferenced — not requested to be removed, and the dead DELETE endpoint
  is itself the evidence trail for this milestone's security fix, so
  removing it would erase that trail.
- The unrelated `communications/actions.test.ts` collection failure
  persists, as it has since Milestone 2.5 — explicitly out of scope.

## SIMILARITY RATINGS

| Area | Rating |
|---|---|
| Staff List | CLOSE |
| Staff Detail | CLOSE |
| Staff Forms (Invite) | CLOSE |
| Pending Invitations | CLOSE |
| Lifecycle / Recovery Bin | NOT APPLICABLE — feature does not exist |
| Responsive Behaviour | CLOSE |
| Bright Theme | CLOSE |
| Dark Theme | CLOSE |
| Shared Primitives | CLOSE |
| **Overall Staff Module** | **CLOSE** |

Staff now reads as the same module family as Students and Parents: same
table/card/badge/button primitives, same typography scale, same restrained
detail-page header, same mobile-card collapse behaviour, same dual-theme
token discipline — reused deliberately, and Staff's already-stricter,
already-correct authorization posture was preserved rather than loosened
or replaced by analogy.

## RECOMMENDATION

**Safe to freeze Staff alongside Students and Parents** as the third
approved People-module reference implementation. All quality gates are
green, no RSC crash class was found or introduced, the two security gaps
found during audit are closed with policy that was already independently
established elsewhere in the same module (the dead sibling endpoint,
`security-p6.test.ts`) — not invented, and not borrowed from a different
module's policy — and every out-of-scope boundary (the invitee-facing
accept-invite flow, the dead endpoints, the orphaned component) is
documented rather than silently touched or silently ignored.

Per the ticket's stop condition: **stopping here.** Not beginning Centres.
Awaiting product-owner review.
