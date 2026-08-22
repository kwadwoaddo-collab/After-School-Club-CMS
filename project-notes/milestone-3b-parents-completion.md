# CMS Rebuild — Milestone 3B: Parents Module Modernisation — Completion Report

## STATUS

**PASS.** Parents is modernised to the frozen Students visual language, the
security gaps found during audit are closed with a directly-evidenced
policy (not invented), the RSC server/client boundary is verified intact
under production-style testing with real seeded data, and all quality gates
are green. See RECOMMENDATION below for the freeze call.

## STARTING STATE

Verified per ticket §0 before any edit:

```
git fetch origin        → rebuild/cms-modernisation: 565422c..993b9f5
git status               → clean, up to date with origin
git branch --show-current → rebuild/cms-modernisation
git rev-parse --short HEAD                             → 993b9f5
git rev-parse --short origin/rebuild/cms-modernisation  → 993b9f5
```

Local HEAD and origin matched exactly (the Milestone 3A bundle had already
been applied to origin by the time this milestone started), working tree
clean. No bundle-reapplication step was needed this time.

## AUDIT FINDINGS

Full detail in `project-notes/milestone-3b-parents-audit.md`. Summary:

- No create/edit route exists for Parents (`add/`, `[id]/edit/` — neither
  exists); the only edit surface is the inline contact editor already in
  `ParentProfileClient.tsx`. Create/Edit is not applicable this milestone
  per §9 ("if present").
- `ParentsTable.tsx` has prior production RSC-crash history (a Server
  Component that once passed an `onClick` handler into a `<Link>`), fixed
  before Milestone 3A and covered by
  `src/features/parents/components/ParentsTable.test.tsx`. This invariant
  had to survive the restyle — it did (see RSC VERIFICATION).
- Essentially no server-side role enforcement existed across Parents routes
  and mutations before this milestone — confirmed and sharpened from the
  Stage A finding. See SECURITY below.
- A second, independent bug was found in the Parents list query: selecting
  "all centres" applied no centre restriction at all for non-ORG_OWNER
  users, unlike the equivalent Students query. See SECURITY below.
- Visual debt was exactly what the ticket describes: legacy tokens
  (`bg-card`, `text-muted-foreground`), oversized radii, gradient avatars,
  a bespoke raw `<table>`, glassmorphic detail panels with a giant hero
  balance card, no shared primitives.

## STUDENTS PATTERNS REUSED

No new primitives were introduced beyond one file directly modelled on an
existing Students sibling. Reused as-is: `Table`/`TableHeader`/`TableBody`/
`TableRow`/`TableHead`/`TableCell`, `Badge`, `Card`/`CardContent`, `Button`,
`EmptyState`, `Pagination`, `HeaderPortal`. `ParentsGrid.tsx` (new) is
modelled directly on `StudentsGrid.tsx` — the same "table + grid sibling"
shape Students itself uses, not a speculative abstraction. The Parent
Detail page's tab bar, `SubPanel` pattern, and inline-edit input styling
(`h-9 px-3 bg-surface border border-border rounded-sm` +
`focus:outline focus:outline-2 focus:outline-accent`) are copied verbatim
from `StudentProfile.tsx`'s structure and conventions.

## PARENTS LIST

`src/app/dashboard/parents/page.tsx` + `ParentsTable.tsx` (rewritten) +
`ParentsGrid.tsx` (new) + `ParentsFilters.tsx` (rewritten):

- KPI cards (Families / Children / With balance / Outstanding) now match
  Students' `Card` + icon-chip + `text-financial-total` pattern exactly.
- Desktop table uses the shared `Table` primitive; linked-children pills
  use the soft-token badge treatment, kept scannable (name-only pills, not
  oversized decorative chips).
- Mobile (`<md`) collapses to `ParentsGrid` stacked record cards — same
  pattern as Students, verified at 375px with no horizontal overflow and
  full bottom-nav clearance.
- Empty states distinguish "No parents yet" (none exist) from "No parents
  match these filters" (active search/filter), via the same
  `hasActiveFilters` prop pattern `StudentsTable` uses.
- Filters restyled to the InvoiceFlow token system; search, status filter,
  and centre-filter integration (`CentreFilterContext`) behaviour
  unchanged.

## PARENT DETAIL

`src/app/dashboard/parents/[id]/page.tsx` (nav bar + header `Card`) +
`ParentProfileClient.tsx` (rewritten):

- Header: back link, destructive "Delete family" action, avatar + name +
  child-count badge, restrained Balance/Total-invoiced metric chips — no
  giant hero card, no KPI sprawl.
- Overview tab: `SubPanel`-based Contact Details (editable in place,
  preserving the existing `PATCH /api/parents/[id]` call and all fields)
  and Associated Children list, which now scales correctly for 0/1/many
  children (see RSC VERIFICATION) and shows an explicit `EmptyState` for
  "No children linked yet" rather than silently rendering nothing.
- Finance / Ledger tab: reuses the existing `InvoiceTable` component
  unchanged; stats strip restyled to `SubPanel`s.
- A responsive defect was found and fixed during verification: the
  non-editing Contact Details rows used a `justify-between` layout that
  collided a long email address against its label at 375px. Fixed by
  switching to the same stacked label-above-value pattern Students'
  `InfoRow` already uses — robust at any width, and better reuse of an
  established pattern than the row layout it replaced. Verified fixed via
  a re-capture at 375px, both themes.

## CREATE/EDIT

Not applicable — no create/edit route exists for Parents (see AUDIT
FINDINGS). The only edit surface, the inline contact editor, is covered
under Parent Detail above.

## RECOVERY BIN

`src/app/dashboard/parents/bin/page.tsx` + `BinActions.tsx` (rewritten):

- Restyled to the shared `Table` primitive and `EmptyState` for "Bin is
  empty"; expiry uses `Badge` (`error` variant when ≤3 days left, `warning`
  otherwise) instead of ad hoc pill markup.
- Restore / permanent-delete confirmation dialogs restyled to the
  `Button`/token system; archive/restore/permanent-delete semantics,
  30-day retention window, and the "restore only children soft-deleted at
  the same timestamp as the parent" rule are all byte-for-byte unchanged.

## SECURITY

### Authorization matrix

The established People-module policy — `ORG_OWNER`, `MANAGER`,
`FRONT_DESK` allowed, `TUTOR` denied — is applied identically across every
Students route (list, detail, add, import, attendance, and all mutation
endpoints) and was already independently in force at Parents' own
`PATCH /api/parents/[id]`. That gave a directly-evidenced, non-invented
policy to apply everywhere else in Parents:

| Action | Before | After |
|---|---|---|
| LIST `/dashboard/parents` | Any authenticated org member | ORG_OWNER/MANAGER/FRONT_DESK |
| VIEW DETAIL `/dashboard/parents/[id]` | Any authenticated org member | ORG_OWNER/MANAGER/FRONT_DESK |
| CREATE | N/A (no route) | N/A |
| EDIT `PATCH /api/parents/[id]` | Already gated | Unchanged |
| ARCHIVE/DELETE `softDeleteParent` | Org check only | ORG_OWNER/MANAGER/FRONT_DESK |
| RESTORE `restoreParent` | Org check only, **no org-ownership check either** | ORG_OWNER/MANAGER/FRONT_DESK + org-ownership check added |
| RECOVERY BIN view `/dashboard/parents/bin` | Org check only | ORG_OWNER/MANAGER/FRONT_DESK |
| RECOVERY BIN permanent delete `hardDeleteParent` | Org check only, **no org-ownership check either** | ORG_OWNER/MANAGER/FRONT_DESK + org-ownership check added |
| `purgeStaleBinItems` (auto-run maintenance) | Org check only | ORG_OWNER/MANAGER/FRONT_DESK, for consistency |
| GET `/api/parents/[id]` | Org check only | **Unchanged — deliberate, documented below** |

### Gaps found and fixed

1. **Missing role gates** on the list page, detail page, bin page, and all
   four `bin.actions.ts` mutations — any authenticated org member,
   including TUTOR, could view every family's contact details and ledger,
   and archive/restore/permanently-delete family records. Fixed with
   `requireAuth`/`requireApiAuth` using the same role tuple used everywhere
   else in the People module.
2. **Missing organisation-ownership check** on `restoreParent` and
   `hardDeleteParent` — unlike `softDeleteParent`, neither verified the
   `parentId` actually belonged to the caller's organisation before acting,
   so a valid parent ID from a different organisation could in principle be
   restored or permanently deleted by any authenticated org member of any
   org. Found while adding the role gate to the same functions; fixed
   narrowly by adding the same ownership check `softDeleteParent` already
   had.
3. **Centre-scoping bypass** in the Parents list query — selecting "all
   centres" (reachable via `?centre=all`) applied no centre restriction at
   all for non-ORG_OWNER users, unlike the equivalent, already-approved
   Students query. Fixed by mirroring Students' `accessibleCentreIds`
   restriction, applied at the family level: a parent is excluded from the
   'all' view only if they have children in the organisation but none of
   them are in a centre the viewer can access (a parent with genuinely zero
   children anywhere is still shown, matching how Students treats children
   with no assigned centre — visible to anyone). ORG_OWNER is unaffected,
   since their accessible-centre set already covers the whole org.

### Deliberately left unchanged

**`GET /api/parents/[id]`** remains role-unrestricted (authenticated +
org-scoped only). It is consumed by `src/features/bookings/components/
BookingForm.tsx`, which is out of scope for this milestone (Bookings
redesign/RBAC is explicitly excluded per §3). Restricting this endpoint's
role without auditing who is allowed to create bookings risks silently
breaking booking creation for a role this milestone hasn't reviewed. Per
§5 ("if any policy is genuinely ambiguous, document it and stop short of
inventing permissions"), this is left as-is and flagged for a future,
properly-scoped Bookings/cross-module authorization pass. A regression
test (`GET /api/parents/[id] — deliberately left unrestricted`) documents
this decision in code so it isn't silently "fixed" inconsistently later.

### Tests

`src/features/parents/authorization.test.ts` (new, 25 tests) covers:
page-level denial for TUTOR/unauthenticated on all three Parents pages;
`bin.actions.ts` role enforcement for all four mutations; regression
coverage for the previously-untested `PATCH /api/parents/[id]` gate; and
the deliberate-no-restriction decision on `GET`.

## RSC VERIFICATION

`ParentsTable.tsx`'s existing regression test suite
(`ParentsTable.test.tsx`) — which walks the raw element tree for any
function-typed prop, the exact defect class of the historical crash — was
re-run after every change to the file and passes (4/4). Production-style
Playwright verification was run against the dev server with real seeded
data covering all three required cases:

- **One linked child** (Raj Patel / Sophia Patel) — list, detail (bright +
  dark, 1440 + 375).
- **Multiple linked children** (Sarah Harrison, 3 children — the seed data
  was extended with two siblings specifically to exercise this case) —
  list, detail overview + Finance/Ledger tab (bright + dark, 1440 + 834 +
  375).
- **Zero linked children** (a new parent, Grace Okafor, added to seed data
  specifically for this case) — detail overview showing the "No children
  linked yet" `EmptyState`, and the same record exercised through
  soft-delete → Recovery Bin to also verify that flow with a real
  zero-child record.

No `pageerror` events, no console errors, and no crash-indicator text
("Event handlers cannot be passed to Client Component props", "Application
error", a Next.js error-boundary digest) were observed on any captured
page across either theme.

## THEMES

Bright and dark captured and visually inspected for: Parents list (1440 /
834 / 375), Parent detail for all three linked-children cases (1440 / 375,
plus 834 for the multi-child case), Parent detail Finance/Ledger tab
(1440), Parent detail contact-edit mode (1440), Recovery Bin (1440 / 375).
Both themes read as production-quality, matching Students' token usage
throughout (no hard-coded light-only or dark-only colors found or
introduced).

## RESPONSIVE

Verified at 1440 / 834 / 375 for List, Detail (all three children-count
cases), and Recovery Bin:

- **375:** no horizontal overflow anywhere; mobile record cards
  (`ParentsGrid`) used for the list instead of a squeezed table; bottom-nav
  clearance preserved (confirmed by scrolling the list to its end — the
  last card sits fully clear of the nav bar, matching the Milestone 3A
  global fix); skip-link still activates correctly on focus; the contact
  details/edit form is fully usable, and the row-collision defect found
  during this pass (email colliding with its label) was fixed (see PARENT
  DETAIL above).
- **834:** the approved shell behaviour holds — no bottom-nav overlap, no
  desktop-table squeeze (Parents list still renders as a full table at this
  width, matching Students), all actions reachable.

## TESTS

`npm test` (Vitest): **260 passed**, 1 pre-existing unrelated collection
failure (`src/features/communications/actions.test.ts` — module resolution
issue with `next/server` under next-auth, documented as a known, separately
tracked issue since Milestone 2.5; not touched or worsened by this
milestone). This is 25 more passing tests than the 3A baseline (235), all
from the new `src/features/parents/authorization.test.ts`.

## TYPECHECK

`npm run typecheck` (`tsc --noEmit`): **0 errors.**

## LINT

`npm run lint` (`eslint`): **0 errors, 0 warnings.**

## BUILD

`npm run build`: **PASS.** Compiled successfully; all 123 routes generated
including `/dashboard/parents`, `/dashboard/parents/[id]`, and
`/dashboard/parents/bin`. The one build-time warning (a Turbopack
file-tracing note about `next.config.ts` → `google-calendar.ts` →
`booking.ts`) is pre-existing, unrelated to Parents, and not something this
milestone introduced or is in scope to fix.

## FILES CHANGED

- `src/app/dashboard/parents/page.tsx` — role gate, centre-scoping fix, full restyle.
- `src/app/dashboard/parents/[id]/page.tsx` — role gate, restyled header/nav.
- `src/app/dashboard/parents/[id]/ParentProfileClient.tsx` — full restyle, responsive fix.
- `src/app/dashboard/parents/bin/page.tsx` — role gate, full restyle.
- `src/app/dashboard/parents/bin.actions.ts` — role gates + org-ownership checks added to all four actions.
- `src/features/parents/components/ParentsTable.tsx` — full restyle (RSC-safety preserved).
- `src/features/parents/components/ParentsGrid.tsx` — **new**, mobile record cards.
- `src/features/parents/components/ParentsFilters.tsx` — full restyle.
- `src/features/parents/components/DeleteParentButton.tsx` — full restyle.
- `src/features/parents/components/BinActions.tsx` — full restyle.
- `src/features/parents/authorization.test.ts` — **new**, 25 tests.
- `project-notes/milestone-3b-parents-audit.md` — **new**, pre-implementation audit.
- `project-notes/milestone-3b-parents-completion.md` — **new**, this document.

No changes were made to: business logic, RBAC architecture, database
schema, booking/attendance/finance logic, or any file outside the Parents
module and its direct dependencies.

## GIT

Starting SHA: `993b9f5` (= origin tip at milestone start).
Commits (small, logical, on `rebuild/cms-modernisation`):

1. `feat(milestone-3b): modernise Parents list — restyle to Students visual system, close list/bin auth gaps and centre-scoping bug`
2. `feat(milestone-3b): modernise Parent detail — restyle to Students visual system, close detail-page auth gap`
3. `feat(milestone-3b): modernise Recovery Bin — restyle to Students visual system`
4. `test(milestone-3b): add Parents authorization regression coverage`
5. `docs(milestone-3b): Parents audit and completion report`

Push remains blocked in this sandbox (same 403 as every prior milestone).
One incremental bundle was produced from `993b9f5..HEAD`, verified with
`git bundle verify` and sanity-tested by fast-forwarding a scratch clone to
confirm the exact tip SHA. Base/tip/verification reported in the delivery
message.

## BUGS DISCOVERED

1. Missing role enforcement across almost all Parents routes/mutations — **fixed** (see SECURITY).
2. Missing organisation-ownership check on `restoreParent`/`hardDeleteParent` — **fixed** (see SECURITY).
3. Centre-scoping bypass on the Parents list 'all centres' view — **fixed** (see SECURITY).
4. `GET /api/parents/[id]` role gap — **documented, deliberately not fixed** this milestone (cross-module, out of scope; see SECURITY).
5. Contact-details row layout collision at 375px — **fixed** (see PARENT DETAIL).

## REMAINING DEBT

- `GET /api/parents/[id]`'s role restriction is unresolved pending a
  proper Bookings-module authorization audit (see SECURITY).
- `src/components/ui/Pagination.tsx` and `getAvatarGradient` (in
  `src/components/ui/utils.ts`) remain on legacy tokens/styling — both are
  shared components already used, unchanged, by the frozen Students module,
  so restyling them is out of this milestone's scope (would touch Students'
  already-approved output) and is the same pre-existing, documented debt
  noted in the Milestone 3A closure report.
- The unrelated `communications/actions.test.ts` collection failure
  persists, as it has since Milestone 2.5 — explicitly out of scope per
  ticket §14.

## SIMILARITY RATINGS

| Area | Rating |
|---|---|
| Parents List | CLOSE |
| Parent Detail | CLOSE |
| Parent Forms (inline contact editor) | CLOSE |
| Recovery Bin | CLOSE |
| Responsive Behaviour | CLOSE |
| Bright Theme | CLOSE |
| Dark Theme | CLOSE |
| Shared Primitives | CLOSE |
| **Overall Parents Module** | **CLOSE** |

Parents now reads as the same module family as Students: same table/card/
badge/button primitives, same typography scale, same tab-and-SubPanel
detail-page structure, same mobile-card collapse behaviour, same dual-theme
token discipline — reused deliberately rather than reinvented, per §1's
critical design rule.

## RECOMMENDATION

**Safe to freeze Parents alongside Students** as the second approved
People-module reference implementation. All quality gates are green, the
RSC crash class is verified not reintroduced under real data, the security
gaps found during audit are closed with policy that was already
independently established elsewhere in the codebase (not invented), and
the one gap left open (`GET /api/parents/[id]`) is narrow, deliberate, and
documented rather than silently carried forward.

Per the ticket's stop condition: **stopping here.** Not beginning Staff.
Awaiting product-owner review.
