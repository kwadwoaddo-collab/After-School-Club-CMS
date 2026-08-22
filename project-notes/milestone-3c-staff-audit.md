# Milestone 3C — Staff Module Fresh Audit

Produced before any code changes, per ticket §4. This is a fresh, current-state
inspection of the Staff module — not a copy of the Students/Parents audits.
Staff's existing authorization posture is materially different from the
People module's, and this audit treats that as a fact to discover, not a
gap to "fix" by analogy.

## 0. Starting state

Confirmed before this audit began:

```
git status                                              → clean, up to date with origin
git branch --show-current                                → rebuild/cms-modernisation
git log -1 --oneline                                      → 912f4be docs(milestone-3b): Parents audit and completion report
```

Local HEAD matches the ticket's stated expected tip (`912f4be`) exactly, no
discrepancy requiring a stop-and-report.

## 1. Routes, components, server actions, API endpoints

| Layer | File | Role |
|---|---|---|
| List page | `src/app/dashboard/staff/page.tsx` | Server Component. `requireAuth({ roles: ['ORG_OWNER'] })`. Fetches staff, centre memberships, org centres, pending invites; builds `enrichedStaff`. |
| List client | `src/app/dashboard/staff/StaffDashboardClient.tsx` | Client Component. Stats strip, Active/Pending segmented tabs, search + role filter, invite revoke. |
| List loading | `src/app/dashboard/staff/loading.tsx` | Skeleton matching the current legacy list layout (accordion rows, `rounded-3xl`). Needs re-shaping alongside the list restyle so it doesn't flash a mismatched skeleton. |
| Detail page | `src/app/dashboard/staff/[userId]/page.tsx` | Server Component. Raw `auth()` + manual `role !== 'ORG_OWNER'` redirect (not `requireAuth`). Independently verifies org match. Computes `ownerCount`. |
| Detail loading | `src/app/dashboard/staff/[userId]/loading.tsx` | Skeleton matching the current `glassmorphic-card` hero layout. Same re-shaping note as above. |
| Detail form | `src/features/staff/components/StaffProfileForm.tsx` | Client Component. Orchestrates role selector + centre assignment + remove-staff danger zone + sticky save bar. |
| Role selector | `src/features/staff/components/StaffRoleSelector.tsx` | Client Component. 4 role cards, UI-level last-owner lock (`ownerCount === 1`). |
| Centre assignment | `src/features/staff/components/StaffCentreAssignment.tsx` | Client Component. Checkbox grid, pure UI state — no auth logic of its own. |
| Role-change action | `src/features/staff/staff-actions.ts` (`updateStaffRole`) | Server action. ORG_OWNER-only, blocks self-change, verifies org membership. |
| Invite page | `src/app/dashboard/staff/invite/page.tsx` | **Entirely a Client Component — no server wrapper, no page-level role gate.** |
| Invite API | `src/app/api/staff/invite/route.ts` (POST) | Raw `auth()`, ORG_OWNER-only, rate-limited, zod-validated, `role` enum excludes `ORG_OWNER`. |
| Role-change API (dead) | `src/app/api/staff/[id]/route.ts` PATCH | Raw `auth()`, ORG_OWNER-only. **No caller anywhere in the codebase** — `StaffProfileForm` uses the `updateStaffRole` server action instead. |
| Remove API (dead) | `src/app/api/staff/[id]/route.ts` DELETE | Raw `auth()`, ORG_OWNER-only, blocks self-removal **and blocks removing another ORG_OWNER**. **No caller anywhere in the codebase.** |
| Remove API (live) | `src/app/api/staff/remove/route.ts` (POST) | Raw `auth()`, ORG_OWNER-only, blocks self-removal. **Does not block removing another ORG_OWNER.** Called by `StaffProfileForm.tsx`. |
| Centre-assign API | `src/app/api/staff/assign-centres/route.ts` (POST) | Raw `auth()`, ORG_OWNER-only, org-verified, blocks assigning centres to an ORG_OWNER, 50-item cap. |
| Revoke invite API | `src/app/api/staff/invites/[id]/route.ts` (DELETE) | Raw `auth()`, ORG_OWNER-only, org-verified. |
| Clear-expired API | `src/app/api/staff/invites/clear-expired/route.ts` (DELETE) | Raw `auth()`, ORG_OWNER-only, org-scoped. |
| Accept-invite API | `src/app/api/staff/accept-invite/route.ts` (POST) | Unauthenticated by design (token-gated) — marks invite used, verifies email. |
| Magic-login API | `src/app/api/staff/magic-login/route.ts` (GET) | Unauthenticated by design (token-gated) — used by NextAuth's `CredentialsProvider`. |
| Request-magic-link API | `src/app/api/staff/request-magic-link/route.ts` (POST) | Unauthenticated by design — enumeration-safe (`{success:true}` regardless of match). |
| Validate-invite API | `src/app/api/staff/validate-invite/route.ts` (GET) | Unauthenticated by design (token-gated). |
| Accept-invite page | `src/app/accept-invite/page.tsx` | **Public, unauthenticated page** — the invitee's own landing page for a magic link. Not part of the ORG_OWNER-facing Staff dashboard. |
| Dead component | `src/components/dashboard/InvitationsList.tsx` | Not imported anywhere in `src/` (confirmed by grep). `StaffDashboardClient` has its own inline Pending-invites tab that duplicates this component's purpose. Orphaned. |

### Scope boundary: `accept-invite` page and the four unauthenticated APIs

`src/app/accept-invite/page.tsx` and the four token-gated API routes above
are the **invitee's** side of the invitation flow — a public page an
unauthenticated person lands on from an emailed link, structurally analogous
to how `BookingForm.tsx` was an out-of-scope consumer of a Parents endpoint
in Milestone 3B. The ticket's subject is the **Staff module** — the
ORG_OWNER-facing management surface under `/dashboard/staff`. Restyling a
public, unauthenticated, pre-login page is a different design system context
(it doesn't use the dashboard shell, `HeaderPortal`, or dark/light dashboard
theming — it's a fixed dark gradient landing page) and touching its auth
mechanics is explicitly out of bounds for a presentation-focused milestone.
**Left untouched**, same as Bookings was in 3B, and noted here rather than
silently skipped.

### `InvitationsList.tsx` — orphaned component, left untouched

Confirmed dead (no import statement anywhere in `src/`). Per the ticket's
instruction not to do unrequested cleanup, this file is left exactly as-is —
noted for completeness, not deleted.

## 2. Data model / relationships (from `src/db/schema.ts`, inspected directly)

- `users` — one row per person, `organisationId` nullable (null = detached/
  removed from every org), `role` is a single `userRoleEnum` column
  (`'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR'`) — **the role lives
  directly on `users`, not on a join table.** This is the field every
  role-change endpoint mutates.
- `centreMemberships` — `(centreId, userId)` unique pair with its own `role`
  column (currently unused by any Staff route read this milestone — all
  role checks read `users.role`, not `centreMemberships.role`; the column
  appears to be assignment-only metadata carried over from an earlier
  design). A user can have zero, one, or many centre memberships;
  `ORG_OWNER`s are never assigned individual centres (global access by
  construction — enforced server-side in `assign-centres/route.ts`).
- `orgMemberships` — a separate multi-org mapping table (`userId`,
  `organisationId`, `role`), explicitly commented in the schema as
  supporting "a user can belong to many orgs," with `users.organisationId`
  as the "currently active org" pointer. **Not read or written by any Staff
  route inspected this milestone** — the entire Staff module operates on
  `users.organisationId`/`users.role` directly. Out of scope to touch.
- `staffInvites` — `organisationId`, `email`, `role`, `token` (unique),
  `expiresAt`, `usedAt` (null = pending). No `revokedAt`/status column — a
  "Pending" vs "Expired" vs "Accepted" status is computed client-side from
  `usedAt`/`expiresAt` (see `InvitationsList.tsx`'s `getStatus`, mirrored in
  `StaffDashboardClient`). No lifecycle beyond delete (revoke) and the
  scheduled `clear-expired` sweep.
- No `deletedAt` column on `users`, no soft-delete/restore mechanism, **no
  Recovery Bin table or concept for Staff.** Removal is
  `users.organisationId = null` — the same row survives, centre memberships
  are hard-deleted, but the user is not re-addable through any "restore"
  flow found; they would need a fresh invite. This is confirmed, not
  assumed: no bin route, no bin component, no `deletedAt` field anywhere in
  the `users` table definition.

## 3. Server/client boundaries — RSC crash guardrail (§6/§20)

Unlike Parents (which had actual production crash history), Staff's
interactive surfaces are already cleanly split: `StaffDashboardClient.tsx`,
`StaffProfileForm.tsx`, `StaffRoleSelector.tsx`, and
`StaffCentreAssignment.tsx` are all `'use client'` from the top, and the
Server Component pages (`page.tsx`, `[userId]/page.tsx`) pass only
plain data (arrays of primitives/objects) as props — no function props
cross the boundary today. **No pre-existing RSC crash-class defect found in
Staff.**

This must still be actively re-verified after the restyle, per the ticket's
explicit instruction not to assume any prior milestone's fix generalises:
any new Server-Component-rendered list/grid component introduced for the
List page's mobile view (the Staff equivalent of `StudentsGrid`/
`ParentsGrid`) must not embed event handlers or function props if it stays a
Server Component, and if it needs interactivity (e.g. wrapping rows in a
clickable element with client-side behaviour) it should follow
`ParentsTable.tsx`'s proven shape: render pre-built Client Components
(like `DeleteParentButton`) rather than passing handlers down. Verified via
Playwright against a running dev server with production-style data after
implementation, watching for the exact
`Event handlers cannot be passed to Client Component props` signature.

## 4. Existing business behaviour (confirmed, not assumed)

- **Lifecycle**: Invite (pending) → Accept (via magic link, `usedAt` set) →
  active staff member → Remove (org-detach) → re-invite required to return.
  No deactivate/reactivate distinct from remove/re-invite;
  **NOT APPLICABLE — no deactivate/reactivate feature exists.**
- **No Recovery Bin** for Staff — confirmed by schema (§2) and by the
  absence of any bin route/component under `src/app/dashboard/staff/` or
  `src/features/staff/`. **NOT APPLICABLE — feature does not exist in
  current CMS.** Not to be invented this milestone.
- **Multi-owner is supported by design**: `updateStaffRole` and the dead
  `PATCH /api/staff/[id]` both allow setting a target's role to
  `ORG_OWNER`, and centre-assignment explicitly exempts owners from needing
  any centre. The "last owner" protections that do exist (see §5) are about
  not stranding an org with zero owners, not about restricting to exactly
  one.
- **Multi-centre staff is supported**: `centreMemberships` is a many-to-many
  join; the List page's "Global" label is shown only for `ORG_OWNER` (who
  have no memberships by construction), otherwise a centre count/list is
  rendered.

## 5. Security — authorization matrix

**Governing evidence, found directly in the code, not assumed by analogy:**
every Staff mutation and every Staff page inspected this milestone already
enforces **ORG_OWNER only** — not the People-module's
`['ORG_OWNER','MANAGER','FRONT_DESK']` tuple. This is corroborated
independently by a pre-existing regression test outside this module,
`src/lib/security-p6.test.ts` ("`/dashboard/staff` denies FRONT_DESK
(ORG_OWNER only)"), which predates this milestone and encodes the same
policy. Per the ticket's explicit instruction, **the People-module tuple is
not applied here** — Staff's own, stricter, already-in-force policy is
preserved and extended only to the gaps found below.

| Action | Existing enforcement | Evidence | Intended policy | Change? |
|---|---|---|---|---|
| **LIST** `/dashboard/staff` | `requireAuth({roles:['ORG_OWNER']})` | `page.tsx:19` | ORG_OWNER only | No change |
| **VIEW DETAIL** `/dashboard/staff/[userId]` | Raw `auth()` + manual role check, ORG_OWNER only, + org-match check | `[userId]/page.tsx` | ORG_OWNER only | **Consistency-only**: normalise to `requireAuth` (no behaviour change — already correctly enforced) |
| **INVITE (page)** `/dashboard/staff/invite` | **None** — pure Client Component, no server wrapper | `invite/page.tsx` (no `requireAuth`, no parent Server Component) | ORG_OWNER only (matches the API it submits to, matches every other Staff page) | **Fix** — add a server-side page gate |
| **INVITE (API)** `POST /api/staff/invite` | Raw `auth()`, ORG_OWNER only, rate-limited | `invite/route.ts:?` | ORG_OWNER only | No change |
| **EDIT ROLE (server action)** `updateStaffRole` | ORG_OWNER only, blocks self-change, org-verified | `staff-actions.ts` | ORG_OWNER only | No change |
| **EDIT ROLE (dead API)** `PATCH /api/staff/[id]` | ORG_OWNER only, blocks self-change, org-verified | `[id]/route.ts` | Unreferenced — no live caller | No change (leave as-is; not requested to remove) |
| **ASSIGN CENTRES** `POST /api/staff/assign-centres` | ORG_OWNER only, org-verified, blocks assigning centres to an owner | `assign-centres/route.ts` | ORG_OWNER only | No change |
| **REMOVE (live)** `POST /api/staff/remove` | ORG_OWNER only, blocks self-removal, org-verified, **no owner-removal guard** | `remove/route.ts` | ORG_OWNER only, **and must block removing another ORG_OWNER** — directly evidenced by its own dead sibling endpoint below | **Fix** — add the missing guard |
| **REMOVE (dead API)** `DELETE /api/staff/[id]` | ORG_OWNER only, blocks self-removal, org-verified, **blocks removing another ORG_OWNER** | `[id]/route.ts:93-96` | Unreferenced — no live caller | No change (this endpoint is the evidence for the fix above, not itself broken) |
| **RESEND / CANCEL invitation** `DELETE /api/staff/invites/[id]` | ORG_OWNER only, org-verified | `invites/[id]/route.ts` | ORG_OWNER only | No change |
| **CLEAR EXPIRED invitations** `DELETE /api/staff/invites/clear-expired` | ORG_OWNER only, org-scoped | `invites/clear-expired/route.ts` | ORG_OWNER only | No change |
| **ACCEPT INVITE** (invitee flow) | Unauthenticated, token-gated | `accept-invite/route.ts`, `magic-login/route.ts`, `validate-invite/route.ts` | Intentionally open to an unauthenticated invitee holding a valid token — out of scope (§1) | No change |
| **DEACTIVATE / REACTIVATE** | — | — | **NOT APPLICABLE — feature does not exist in current CMS.** | N/A |
| **RECOVERY BIN** (any action) | — | — | **NOT APPLICABLE — feature does not exist in current CMS.** | N/A |

### Confirmed defect: `POST /api/staff/remove` can remove another ORG_OWNER

`StaffProfileForm.tsx`'s "Remove staff member" action calls
`POST /api/staff/remove` (confirmed the live caller by grep — no other file
references this endpoint). That handler blocks removing yourself but has no
check on the target's role, unlike its unused sibling
`DELETE /api/staff/[id]`, which explicitly blocks removing another
`ORG_OWNER` with the message *"Cannot remove another owner. Change their
role first."* Because the two endpoints implement the same product action
(remove a staff member from the org) and one already encodes the intended
safeguard, this is a **narrow, directly-evidenced fix** per §5/§7 of the
ticket — not a guess: port the same `if (target.role === 'ORG_OWNER')
return 400` check into `remove/route.ts`, with a regression test.

This does not, by itself, allow an org to reach zero owners in one call
(the caller remains an owner throughout), but it does allow an ORG_OWNER to
unilaterally remove every *other* owner one at a time with no
confirmation beyond the generic "remove staff member" dialog — the same
class of action the dead endpoint's author clearly intended to prevent.

### Investigated and resolved: `updateStaffRole` cannot create an ownerless org

`updateStaffRole` (`staff-actions.ts`) has no explicit `ownerCount` check,
unlike `StaffRoleSelector`'s UI-level lock
(`disabled={currentRole==='ORG_OWNER' && ownerCount===1 && role.value!=='ORG_OWNER'}`).
Traced explicitly: the action unconditionally blocks
`targetUserId === session.user.id` (self-change). The only way to reduce the
owner count via this action is to demote a *different* user who is
currently `ORG_OWNER` — which requires the caller (also `ORG_OWNER`, by the
action's own gate) and that target to both hold the role at the moment of
the call, i.e. at least two owners exist immediately before the demotion,
and the caller remains one immediately after. **The action cannot reduce
the owner count to zero by construction.** The UI's `ownerCount === 1` lock
is therefore a strictly more conservative (not required, but harmless)
client-side affordance, not a gap — no server-side change needed here. This
was verified by direct code tracing rather than asserted from the UI
behaviour, satisfying the ticket's "do not guess" bar.

### Organisation isolation — verified across every mutation

Every Staff mutation independently verifies the target row's
`organisationId` equals the caller's before acting:
`updateStaffRole`, `POST /api/staff/remove`, `POST /api/staff/assign-centres`,
`DELETE /api/staff/invites/[id]`, `DELETE /api/staff/invites/clear-expired`
(scoped by `where` clause), and both methods of the dead
`[id]/route.ts`. No cross-tenant gap found.

### Raw `auth()` vs `requireAuth` — consistency debt, not a vulnerability

`[userId]/page.tsx` uses raw `auth()` + manual redirect instead of the
`requireAuth` helper used by the List page and by every People-module page.
It correctly enforces the same restriction (confirmed above) — this is a
code-consistency normalisation candidate for this milestone's implementation
pass, not a security fix, and is called out as such rather than mislabelled.

## 6. Visual debt vs. frozen Students/Parents reference

Staff is on the same pre-Milestone-2 legacy language as Parents was before
3B: `bg-card`/`text-foreground`/`text-muted-foreground`/`border-border`
tokens (not `bg-surface`/`text-text`/`text-text-secondary`/
`border-border-subtle`), oversized radii (`rounded-3xl`, `rounded-[32px]`,
`rounded-[24px]`, `rounded-2xl` pill scale — not `rounded-sm/md/lg`),
hard-coded per-role Tailwind colour classes in `staff-constants.ts` and
duplicated inline in `InvitationsList.tsx` (`amber-500`, `emerald-500`,
`violet-500`, `red-500` — not the semantic `success`/`warning`/`info`/
`accent-violet` tokens, even though `staff-constants.ts` is already
half-migrated: `ROLE_COLORS` does use `warning`/`accent-violet`/`info`/
`success`, so the token names exist and just need consistent adoption),
`glassmorphic-card`/`glow-btn` classes on the invite page and detail loading
state, a bespoke accordion-row list instead of the shared `Table` primitive,
no `EmptyState`/`Badge`/`Card`/`Button`/`PageHeader` primitives in the list
or detail views, and a single generic empty-state message that doesn't yet
distinguish "no staff at all" from "no results for this filter" (the same
gap Parents had before 3B).

None of this is a logic problem — presentation-only debt, consistent with
what the ticket expects to find.

## 7. Reuse plan

Reused as-is, no new primitives: `Table`/`TableHeader`/`TableBody`/
`TableRow`/`TableHead`/`TableCell`, `Badge`, `Card`/`CardHeader`/
`CardTitle`/`CardContent`, `Button`, `EmptyState`, `PageHeader`/
`HeaderPortal` (matching the Students/Parents list pattern), `Pagination`
(not currently used by Staff's list at all — Staff has no pagination today;
not introduced this milestone unless the existing unpaginated list is
already the intended behaviour, which it is — no evidence of a page-size
cap or `LIMIT`/`OFFSET` anywhere in `page.tsx`'s query, so **NOT
APPLICABLE — Staff list is not currently paginated; not invented here**).
`ROLE_LABELS`/`ROLE_COLORS`/`ROLE_AVATAR_COLORS` from `staff-constants.ts`
are kept as the single source of truth for role display and adopted
consistently (replacing the ad hoc duplicate in `InvitationsList.tsx`'s
`getRoleBadge`, which stays unused/untouched since the component itself is
dead code). A new mobile-card component modelled directly on
`StudentsGrid.tsx`/`ParentsGrid.tsx` is added for the List page's small-
viewport view — same reasoning as Parents 3B: mirrors an existing sibling
file, not a speculative new abstraction. `StaffRoleSelector`'s permission-
description cards and last-owner lock/warning banners are restyled in place
(tokens/radii only) — their logic is untouched.

## 8. Summary of fixes carried into implementation

1. Restyle List (`page.tsx` + `StaffDashboardClient.tsx` + both loading
   skeletons), Detail (`[userId]/page.tsx` + `StaffProfileForm.tsx` +
   `StaffRoleSelector.tsx` + `StaffCentreAssignment.tsx`), and Invite
   (`invite/page.tsx`) to the frozen Students/Parents visual system
   (presentation only).
2. Add the missing page-level ORG_OWNER gate to `/dashboard/staff/invite`
   (currently has none).
3. Fix the confirmed security defect: add the "cannot remove another
   ORG_OWNER" check to the live `POST /api/staff/remove` endpoint, matching
   its already-correct dead sibling `DELETE /api/staff/[id]`.
4. Normalise `[userId]/page.tsx` from raw `auth()` to `requireAuth` for
   consistency with every other gated page in the app (no behaviour
   change — already correctly ORG_OWNER-only).
5. Leave the invitee-facing `accept-invite` page and its four unauthenticated
   API routes untouched (out of scope, analogous to Bookings in 3B).
6. Leave the dead `PATCH`/`DELETE /api/staff/[id]` endpoints and the
   orphaned `InvitationsList.tsx` component untouched — unreferenced, not
   requested to be removed.
7. Do not invent a deactivate/reactivate lifecycle or a Recovery Bin — both
   confirmed absent from the current schema and codebase.
8. Preserve the RSC server/client boundary shape through the restyle
   (no pre-existing crash-class defect to fix, but re-verify after
   implementation).
9. Add targeted Staff authorization regression tests covering: the invite
   page gate, the `remove` endpoint's new owner-removal guard, org
   isolation across the mutations above, and the `updateStaffRole`
   owner-safety reasoning in §5 — mirroring
   `src/features/parents/authorization.test.ts`.
