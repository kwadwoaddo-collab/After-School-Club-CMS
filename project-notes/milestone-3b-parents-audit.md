# Milestone 3B — Parents Module Fresh Audit

Produced before any code changes, per ticket §4. Supersedes nothing in
`milestone-3-people-audit.md` (Stage A) — it confirms and sharpens that
audit's Parents section with a fresh, current-state inspection, and adds the
concrete fix decisions Stage A deliberately deferred.

## 0. Starting state

Confirmed before this audit began:

```
git fetch origin        → rebuild/cms-modernisation: 565422c..993b9f5
git status               → clean, up to date with origin
git branch --show-current → rebuild/cms-modernisation
git rev-parse --short HEAD                             → 993b9f5
git rev-parse --short origin/rebuild/cms-modernisation  → 993b9f5
```

Local HEAD and origin match exactly, working tree clean. The Milestone 3A
bundle has been applied to origin since 3A closed, so no bundle-reapplication
step was needed this time (unlike the 3A start, where origin was still on the
2.5 tip).

## 1. Routes, components, data sources

| Layer | File | Role |
|---|---|---|
| List page | `src/app/dashboard/parents/page.tsx` | Server Component. KPI query + filtered/paginated parent list. |
| List table | `src/features/parents/components/ParentsTable.tsx` | Server Component (no `'use client'`). Renders desktop table; delete action embedded per-row. |
| List filters | `src/features/parents/components/ParentsFilters.tsx` | Client Component. Search + status select, centre from `CentreFilterContext`. |
| Detail page | `src/app/dashboard/parents/[id]/page.tsx` | Server Component. Fetches parent + children + invoices, computes ledger stats. |
| Detail client | `src/app/dashboard/parents/[id]/ParentProfileClient.tsx` | Client Component. Overview/Finance tabs, inline contact editor, children list, ledger. |
| Delete (list + detail) | `src/features/parents/components/DeleteParentButton.tsx` | Client Component. Calls `softDeleteParent` server action directly (not a prop-drilled handler). |
| Recovery Bin page | `src/app/dashboard/parents/bin/page.tsx` | Server Component. Lists soft-deleted parents; calls `purgeStaleBinItems()` on every load. |
| Bin row actions | `src/features/parents/components/BinActions.tsx` | Client Component. Restore / permanent-delete. |
| Server actions | `src/app/dashboard/parents/bin.actions.ts` | `softDeleteParent`, `restoreParent`, `hardDeleteParent`, `purgeStaleBinItems`. |
| API route | `src/app/api/parents/[id]/route.ts` | `GET` (fetch parent + children), `PATCH` (edit contact fields). |
| Parent-facing auth | `src/lib/parent-auth.ts` | **Unrelated system** — JWT session for the parent's own self-service portal login (`parent_session` cookie). Not part of the staff-facing CMS module this milestone touches. Noted for completeness only. |

No create/edit route exists under `/dashboard/parents` (no `add/`, no
`[id]/edit/`). Parents are created implicitly elsewhere in the app (student
registration / booking flow creates a parent record if one doesn't exist) —
confirmed by grep, no dedicated "Add Parent" UI anywhere in the codebase.
Per ticket §9 ("if present"), Create/Edit is **not applicable** this
milestone; the only edit surface is the inline contact editor in
`ParentProfileClient.tsx`, which is in scope as part of Parent Detail.

## 2. Data model / relationships

- `parents` ← 1:many → `children` (`children.parentId`). A parent can have
  zero, one, or many children — all three cases are real and must render
  sensibly (list "No children" pill already exists; detail page's children
  grid simply renders nothing extra when empty — needs an explicit empty
  state per §8).
- `parents` ← 1:many → `invoices` (family-level billing, not per-child) →
  1:many → `payments`. The detail page's "Finance / Ledger" tab is this
  consolidated family ledger, reusing `InvoiceTable` from
  `@/features/finance/components/FinanceDashboardClient`.
- Soft delete: `parents.deletedAt` / `children.deletedAt`. Deleting a parent
  cascades a soft-delete to all their children (same timestamp); restoring
  only restores children soft-deleted at the *same* timestamp (so a child
  independently archived earlier stays archived) — this exact semantics is
  preserved untouched.
- Centre scoping: children carry `centreId` directly (post-migration, per
  `permissions.ts`). Parents themselves have no direct centre column — a
  parent's centre relevance is derived transitively through their children.

## 3. Server/client boundaries — RSC crash guardrail (§6)

`ParentsTable.tsx` has **prior production crash history**: a Server
Component (no `'use client'`) that rendered `<Link onClick={...}>` per
child-pill, which is a function prop crossing the Server→Client
serialization boundary — "Event handlers cannot be passed to Client
Component props." This was fixed before Milestone 3A and is covered by a
dedicated regression test,
`src/features/parents/components/ParentsTable.test.tsx`, which walks the
raw element tree returned by `ParentsTable()` and asserts **no element
anywhere in the tree carries a function-typed prop**, for parents with
children, without children, and with the error banner shown.

This invariant must survive the restyle. Verified by re-running this exact
test suite after every ParentsTable change, plus (per §6) production-style
Playwright verification with real seeded data covering: parent with one
child, parent with multiple children, parent with zero children.

`DeleteParentButton` and `BinActions` are already correctly split — they are
`'use client'` components that import and call the server action directly
(`softDeleteParent`, `restoreParent`, `hardDeleteParent`), not functions
handed to them as props from a Server Component. This shape is preserved.

## 4. Security — authorization matrix

The established policy for the People module (Students, confirmed
Milestone 3 / 3A) is uniform across every route and mutation:
**`ORG_OWNER`, `MANAGER`, `FRONT_DESK` allowed; `TUTOR` denied.** This is
enforced via `requireAuth({ roles: [...] })` (pages) and
`requireApiAuth({ roles: [...] })` (API routes) in `src/lib/require-auth.ts`,
and is applied identically on every Students route: list, detail, add,
import, attendance, `POST /api/students`, `PATCH`/`DELETE
/api/students/[id]`, and the CSV import action (see
`src/features/students/authorization.test.ts`).

Parents' own `PATCH /api/parents/[id]` **already independently uses this
exact same role tuple** (`['ORG_OWNER', 'MANAGER', 'FRONT_DESK']`), which is
strong, non-ambiguous evidence of the intended policy for this module — it
isn't an invented rule, it's the one rule already in force at one of
Parents' own endpoints, and it matches every sibling People-module route.

| Action | Before (this audit) | Intended (evidence) | Fix |
|---|---|---|---|
| **LIST** `/dashboard/parents` | Any authenticated user w/ org (`auth()` + org check only) | ORG_OWNER/MANAGER/FRONT_DESK (matches Students list) | **Fix** — page-level `requireAuth` |
| **VIEW DETAIL** `/dashboard/parents/[id]` | Any authenticated user w/ org | Same three roles (matches Students detail) | **Fix** — page-level `requireAuth` |
| **CREATE** | N/A — no route exists | N/A | Not applicable |
| **EDIT** `PATCH /api/parents/[id]` | Already gated to the three roles | Same | No change |
| **ARCHIVE/DELETE** `softDeleteParent` | Org check only, no role check | Same three roles (matches Students `DELETE`) | **Fix** — add role check |
| **RESTORE** `restoreParent` | Org check only, no role check | Same three roles | **Fix** — add role check |
| **RECOVERY BIN** view (`/dashboard/parents/bin`) | Org check only | Same three roles | **Fix** — page-level `requireAuth` |
| **RECOVERY BIN** permanent delete `hardDeleteParent` | Org check only, no role check | Same three roles (Students' own permanent `DELETE` uses the same tuple, not a stricter one — no evidence anywhere of a stricter rule for permanent deletion) | **Fix** — add role check |
| `purgeStaleBinItems` (auto-run maintenance call on Bin page load) | Org check only | Same three roles, for defense-in-depth consistency (it is only ever invoked from the now-gated Bin page) | **Fix** — add role check |
| **GET** `/api/parents/[id]` | Org check only, no role check | **Genuinely ambiguous — left unchanged, documented below** | No change |

### GET /api/parents/[id] — deliberately left unchanged

This endpoint is consumed from two places: `ParentProfileClient.tsx` (in
scope, already page-gated once the fix above lands) and
`src/features/bookings/components/BookingForm.tsx` (**out of scope** —
Bookings redesign/RBAC is explicitly excluded, §3). Restricting this
endpoint's role would risk breaking booking creation for any role that is
allowed to create bookings but would be newly locked out of this read
endpoint — and this milestone has not audited who that is. Per §5 ("if any
policy is genuinely ambiguous: do not guess, document it and stop short of
inventing permissions"), this endpoint's role is left exactly as it was:
authenticated + org-scoped, no role restriction. Flagged here for a future,
properly-scoped Bookings/cross-module authorization pass.

### Centre-scoping gap — found and fixed

Independent of the role-gate gaps above, the Parents list query has a
second, narrower bug: when the active centre resolves to `'all'`, the
Students list (`src/app/dashboard/students/page.tsx`, lines ~100-109)
explicitly still restricts results to
`inArray(children.centreId, accessibleCentreIds)` for non-ORG_OWNER users.
The Parents list's equivalent SQL (`page.tsx`, `ParentBase` CTE) only ever
conditions on `activeCentreId !== 'all'` — when `'all'` is selected (which a
non-ORG_OWNER user can force via `?centre=all` in the URL, since
`resolveActiveCentreId` returns `'all'` verbatim whenever the caller
explicitly asks for it), **no centre restriction is applied at all**, and a
FRONT_DESK/MANAGER/TUTOR-turned-FRONT_DESK user scoped to one centre could
see every parent/family in the organisation, including ones tied only to
centres they have no membership in.

This is a genuine, narrow, Parents-specific security gap with a
directly-evidenced fix (the exact pattern already used one file over, in
Students). Fixed by adding the same `accessibleCentreIds` restriction to the
Parents list's main query and KPI query for non-`'all'`-eligible cases.
`ORG_OWNER` is unaffected (their `accessibleCentreIds` already covers every
centre in the org, per `getUserAccessibleCentreIds`).

## 5. Visual debt vs. frozen Students reference

Parents currently uses the pre-Milestone-2 legacy design language
throughout: `bg-card`/`bg-secondary`/`text-foreground`/`text-muted-foreground`
tokens (not the InvoiceFlow `bg-surface`/`text-text`/`text-text-secondary`
tokens), oversized `rounded-[28px]`/`rounded-[40px]`/`rounded-3xl` radii
(not the `rounded-md`/`rounded-lg`/`rounded-sm` scale), gradient avatar
circles via `getAvatarGradient` (Students uses flat `bg-accent-soft
text-accent`), a bespoke raw `<table>` (not the shared `Table` primitive
Students already uses), no `EmptyState`/`Badge`/`Card`/`Button`/`PageHeader`
primitives, glassmorphic detail-page panels (`glassmorphic-card
rounded-[40px]`) with a giant hero balance card, KPI-style stat blocks
instead of Students' restrained `text-financial-total` cards, and an inline
contact editor styled with `focus:ring-2 ring-primary/20` instead of the
established `focus:outline focus:outline-2 focus:outline-accent` pattern.

None of this is a logic problem — it is exactly the presentation-only debt
this milestone exists to close, using Students' already-frozen
implementation as the direct structural and visual reference throughout
(Table primitive + `ParentsGrid` mobile cards for List; `Card` + tab bar +
`SubPanel` sections for Detail; same primitives for the Bin).

## 6. Reuse plan (§11)

Reused as-is, no new primitives:
`Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`,
`Badge`, `Card`/`CardContent`, `Button`, `EmptyState`, `PageHeader`
(where it fits the existing `HeaderPortal` pattern already used by both
Students and Parents list pages), `Pagination` (shared, already used by
both, left untouched), `HeaderPortal`. A new `ParentsGrid.tsx` mobile-card
component is added, directly modelled on `StudentsGrid.tsx` — this mirrors
Students' own file (list table + list grid as siblings), not a speculative
new abstraction. No other new component is introduced.

## 7. Summary of fixes carried into implementation

1. Restyle List, Detail, Recovery Bin to the frozen Students visual system (presentation only).
2. Add the missing `requireAuth`/`requireApiAuth` role gates listed in §4, matching the established Students/People-module policy exactly.
3. Fix the `'all'`-centre scoping bypass in the Parents list query.
4. Leave `GET /api/parents/[id]` unchanged (documented, cross-module, out of scope to resolve here).
5. Preserve the RSC server/client boundary shape and its regression test through the restyle.
6. Add targeted authorization regression tests mirroring `src/features/students/authorization.test.ts`.
