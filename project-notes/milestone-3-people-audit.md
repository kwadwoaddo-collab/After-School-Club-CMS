# Milestone 3 — People & Organisation Screens: Full Existing-State Audit

**Date:** 2026-08-22
**Branch:** `rebuild/cms-modernisation` @ `565422c` (clean, synchronized with `origin`)
**Status:** Stage A complete. No source files modified. This document is read-only research and precedes any implementation work, per the ticket's explicit sequencing requirement.

---

## 0. Scope and method

This audit covers the four modules in scope for Milestone 3 — Students, Parents, Team/Staff, Centres — plus a review of the InvoiceFlow reference material available in this workspace. It was produced by direct inspection of the CMS repository (route listing, `permissions.ts`, `centre-filter.ts`, targeted greps for `ROLE_HIERARCHY`/`requirePermission`/`resolveActiveCentreId`) combined with four focused audits of each module's routes, components, server/client boundaries, actions, and permission checks.

### InvoiceFlow reference material — important limitation

The InvoiceFlow copy staged in this workspace at `invoiceflow/` is **partial**. It contains:

- `docs/DESIGN-SYSTEM.md` — full token, typography, layout, and component-pattern reference (read in full).
- `src/components/ui/table.tsx` — the `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` primitives (read in full).
- `src/components/shell/status-badge.tsx` and `coming-soon.tsx` — status badge pattern and a minimal empty-state-like component (read in full).
- `src/app/(app)/dashboard/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, and the `ui`/`shell`/`dashboard` component directories.

It does **not** contain InvoiceFlow's own list or detail pages for its primary domain objects (invoices, customers) — `DESIGN-SYSTEM.md` itself cites `src/app/(app)/invoices/page.tsx` as the canonical list-page/mobile-card-collapse reference, but that file is absent from this staged copy. The fuller local InvoiceFlow checkout referenced in the Milestone 2 project docs (`claude/invoiceflow-patterns.md`) lives at a macOS path (`/Users/KWADW/Ai-Lab/agent-os/invoiceflow`) not reachable from this sandbox.

**Consequence:** rather than fabricating direct inspection of pages that are not present, this audit and the Students implementation extrapolate list/table/detail/form conventions from three things actually available and load-bearing: (1) `DESIGN-SYSTEM.md`'s written component patterns, including its explicit "tables collapse to stacked record cards below `md`" mobile rule; (2) the real `ui/table.tsx` primitive; (3) the CMS's own Milestone 2 shell/Dashboard, which is the already-approved, already-built InvoiceFlow adoption in this codebase and the most reliable ground truth for "what InvoiceFlow-in-this-app" looks like. This gap is flagged here rather than glossed over, per the ticket's instruction to be transparent about audit limitations.

---

## 1. InvoiceFlow design-system summary (from `DESIGN-SYSTEM.md`, `ui/table.tsx`, `shell/status-badge.tsx`, `shell/coming-soon.tsx`)

- **Surfaces:** warm off-white page background `#FAF9F7`, white card/table surfaces `#FFFFFF`.
- **Text tiers:** primary `#1C1B1A`, secondary `#57534E`, tertiary/metadata `#6B6560`.
- **Borders:** `#E7E3DE` (default), `#F0EDE9` (subtle/inner dividers).
- **Accent:** deep ink-teal `#0F5F5C`, hover `#0C4A47`. Used sparingly — primary actions, active nav, links — not as a decorative wash.
- **Semantic colours:** success/warning/danger/info, each with a soft background + solid foreground pair, used for status badges only.
- **Radius:** 3-tier scale, 6/10/16px. No large pill buttons, no oversized rounded containers.
- **Shadow:** a single `--shadow-card` token, reserved for popovers/menus — flat surfaces otherwise, no decorative card shadows.
- **Typography:** Geist (local package, no network font dependency), named scale exposed as `.text-*` utility classes in `@layer components` — `display`, `page-title`, `section-title`, `card-heading`, `body`, `small-body`, `metadata`, `label`, `table-value`, `financial-total`.
- **Layout:** fixed 240px sidebar + top bar + `max-w-6xl` content column; sidebar collapses to a slide-in sheet on mobile.
- **Tables:** `ui/table.tsx` uses consistent `px-5` cell padding, `text-label` for headers, `text-table-value` for cell content, `hover:bg-page/60` row hover, `data-[state=selected]:bg-accent-soft` for selection. **Below `md` (768px), tables collapse into stacked record cards, not horizontal scroll** — this is stated explicitly in the design doc and is the single most consequential mobile pattern for Milestone 3's four list screens.
- **Status badges:** `status-badge.tsx` implements a per-domain status→variant map (soft background + matching text colour), not a single generic badge — each domain (invoices, in our case students/parents/staff/centres) gets its own status vocabulary mapped onto the same small set of visual variants.
- **Empty states:** `coming-soon.tsx` is minimal — icon, short heading, one line of supporting text, no illustration, no card-inside-card.

This is already the basis for the Milestone 2 CMS shell/Dashboard (approved), so Students/Parents/Staff/Centres should read as siblings of that shell, not a new visual language.

---

## 2. Students

**Routes:** `/dashboard/students` (list, `page.tsx`), `/dashboard/students/[id]` (detail), `/dashboard/students/[id]/attendance`, `/dashboard/students/add`, `/dashboard/students/import` (+ `ImportStudentsClient.tsx`, `error.tsx`).
**API:** `src/app/api/students/route.ts`, `src/app/api/students/[id]/route.ts`.
**Feature components:** `src/features/students/components/{StudentsTable,StudentsGrid,StudentsFilters,StudentForm,StudentProfile,StudentActions,StudentNotesPanel,InternalNotesTimeline,ProgressNoteForm,ProgressTimeline}.tsx`; actions split across `actions.ts`, `student-actions.ts`, `import-actions.ts`, `notes.actions.ts`, `roll-actions.ts`.

**Current behaviour:**
- List page supports search, centre filter, and status/class-type filtering via `StudentsFilters`, rendered through `StudentsTable` (desktop) and `StudentsGrid` (an existing card-based alternative — worth checking whether this is already doing informal mobile duty, or is a separate view mode).
- Detail page (`StudentProfile`) aggregates identity, guardian/parent links, centre/class assignment, attendance, and a notes/progress timeline (`StudentNotesPanel`, `InternalNotesTimeline`, `ProgressNoteForm`, `ProgressTimeline`) — this is meaningfully more information-dense than a typical InvoiceFlow detail page and needs progressive disclosure (sections/tabs), not a single long scroll.
- `students/[id]/attendance` is a dedicated sub-route rather than a tab/section on the detail page — existing IA choice to preserve unless folding it in is a clear improvement without functional loss.
- Add/import are separate flows (`add/page.tsx` single-record form via `StudentForm`; `import/` bulk CSV-style flow with its own error boundary).
- `loading.tsx` exists at list, detail, and add levels already — skeleton work should extend this pattern, not invent a new one.

**Permissions gap (existing bug, not to fix silently):** only the list page (`students/page.tsx`) carries a `requirePermission`/`ROLE_HIERARCHY` gate. Detail, attendance, add, and import routes do not call it. This is a genuine pre-existing authorization gap, not something introduced by Milestone 2.5's console/lint pass.

**Server/client boundary:** list and detail are Server Components fetching data server-side; `StudentActions`, `StudentForm`, filters, and the notes timeline are Client Components. No known crash history here (unlike Parents).

---

## 3. Parents

**Routes:** `/dashboard/parents` (list, `page.tsx`), `/dashboard/parents/[id]` (detail, `page.tsx` + `ParentProfileClient.tsx`), `/dashboard/parents/bin` (Recovery Bin, `page.tsx` + `bin.actions.ts`).
**API:** `src/app/api/parents/[id]/route.ts`.

**Critical history:** `/dashboard/parents` previously crashed from a Server→Client function-prop serialization violation (a Server Component passing a function down into a Client Component, which Next.js's RSC boundary cannot serialize). The current split — a Server Component `page.tsx` handing data to `ParentProfileClient.tsx` — is the fixed shape. **Any redesign touching this boundary must be re-verified with a production-style build/run, not just static review**, per the ticket's explicit instruction, because this is exactly the class of change (adding new interactive affordances, action menus, dialogs) that could reintroduce it if a new Server Component prop is casually typed as a function (e.g. an inline callback) instead of routed through a server action or converted to data.

**Current behaviour:**
- List page shows parents with centre relationships and (implicitly, via the schema) linked children; no dedicated "no linked children" empty state was confirmed to exist distinctly from the general empty state — needs explicit handling per the ticket (0/1/many children cases).
- Detail page surfaces parent identity, contact info, and linked children; `ParentProfileClient.tsx` is where interactive elements (likely edit, contact actions) live.
- Recovery Bin (`bin/page.tsx`, `bin.actions.ts`) is a separate soft-delete/restore flow, structurally analogous to but visually and probably functionally divergent from the rest of the module — the ticket calls for modernising it "consistently" while keeping destructive/recovery behaviour intact.

**Permissions gap (existing bug):** essentially no server-side role enforcement was found across the Parents routes/actions, apart from one `PATCH` route. This is more severe than the Students gap and should be documented and reported explicitly rather than fixed as a drive-by change, per the Business Logic Guardrail (document → assess if it blocks the redesign → fix only if narrow/safe → add regression coverage → report).

---

## 4. Team / Staff

**Routes:** `/dashboard/staff` (list, `page.tsx` + `StaffDashboardClient.tsx`), `/dashboard/staff/[userId]` (detail), `/dashboard/staff/invite`.
**API:** `src/app/api/staff/{route,invite,accept-invite,assign-centres,magic-login,remove,request-magic-link,validate-invite}.ts`, `src/app/api/staff/invites/[id]/route.ts`, `src/app/api/staff/invites/clear-expired/route.ts`.

**RBAC model:** `src/lib/permissions.ts` implements centre-based access control (`getUserAccessibleCentres`, `getUserAccessibleCentreIds`) built around `ORG_OWNER` (org-wide) vs. `MANAGER`/`FRONT_DESK`/`TUTOR` (centre-scoped via `centreMemberships`). Separately, `ROLE_HIERARCHY`/`requirePermission` (referenced across `dashboard/layout.tsx`, most module `page.tsx` files, and `src/lib/security-p6.test.ts`) implements the capability-gate layer. Staff screens are the direct UI for this model and must not change its semantics — role labels, invitation states, and centre assignment must display accurately but the underlying authorization logic is out of scope for this milestone.

**Current behaviour:**
- List (`StaffDashboardClient.tsx`) shows staff identity, role, status (active/invited), and centre assignment.
- Invite flow is a distinct route (`invite/page.tsx`) backed by `api/staff/invite`, `validate-invite`, `accept-invite`, `magic-login`, `request-magic-link`, and expiry cleanup (`invites/clear-expired`) — a genuinely more complex state machine than Students/Parents/Centres (pending/expired/accepted/active), which the redesign needs to represent legibly without inventing new states.
- `assign-centres` and `remove` are separate write endpoints from the main staff `route.ts`.

**Permissions gaps (existing bugs, found during audit, not yet acted on):**
1. Demoting the last remaining `ORG_OWNER` has no server-side guard (client-side UI may prevent it, but the API doesn't enforce it).
2. The live `api/staff/remove` endpoint does not block removing another `ORG_OWNER`, while an apparently unused sibling code path does contain that check — i.e. the safer logic exists in the codebase but isn't wired to the endpoint actually being called.

These are exactly the kind of "narrow, discoverable-during-visual-work" bugs the ticket anticipates. They should be documented in the completion report; whether to fix them narrowly (with regression tests) is a decision to make explicitly when Team/Staff (Stage E) is reached, not now.

---

## 5. Centres

**Routes:** `/dashboard/centres` (list), `/dashboard/centres/add` (+ `AddCentreForm.tsx`, `actions.ts`), `/dashboard/centres/[id]` (detail), `/dashboard/centres/[id]/settings` (+ `CentreSettingsClient.tsx`, `actions.ts`), `/dashboard/centres/[id]/billing` (+ `CentreBillingForm.tsx`, `actions.ts`).
**API:** `src/app/api/centres/route.ts`, `src/app/api/centres/[id]/route.ts`, `src/app/api/centres/[id]/subdomain/route.ts`.

**Centre-switcher mechanism (explicitly protected, do not alter):** `src/components/dashboard/CentreFilterContext.tsx` + `src/lib/centre-filter.ts` (`resolveActiveCentreId`), backed by the `selected_centre_id` cookie and `dashboard_centre_filter` localStorage key, referenced across most dashboard module pages (`finance`, `students`, `registrations`, `parents`, `incidents`, `communications`, `attendance`, `bookings`, `kiosk`, `dashboard/page.tsx` itself, plus its own test `centre-filter.test.ts`). Centres/Stage F work must not touch this mechanism's persistence or resolution logic — only the sidebar switcher's visual presentation may be touched, and the ticket explicitly calls for a regression test of the switcher after Stage F.

**Current behaviour:**
- List page shows centres with (presumably) status and key contact/location info.
- Detail, Settings, and Billing are three separate routes/pages rather than one detail view with sections — Settings and Billing each have their own `actions.ts`.

**Permissions gap (existing bug, most severe of the four modules):** billing-related fields are writable through **three different code paths** (general centre `route.ts` PATCH, `centres/[id]/settings/actions.ts`, `centres/[id]/billing/actions.ts`) with **inconsistent role gates** between them — i.e. the same field can be more or less protected depending on which UI surface/action wrote to it. Additionally, `api/centres/[id]/subdomain/route.ts` (subdomain change) has **no role check at all**. These are real, exploitable authorization inconsistencies surfaced by reading the code while auditing for the redesign, not new findings from Milestone 2.5. They must be documented and reported per the Business Logic Guardrail; Stage F (last of the four modules) is where a decision on narrow remediation gets made.

---

## 6. Cross-cutting observations

- **Duplicated UI patterns across modules:** each of Students/Parents/Staff/Centres currently implements its own ad hoc table, filter bar, and status representation — there is no shared `DataTable`/`StatusBadge`/`RowActions` layer yet. This is the concrete justification for Workstream 2 (shared people-screen architecture) — extraction is warranted here because ≥2 (in fact 4) real screens need the same primitives, not because of speculative future reuse.
- **Mobile handling today:** none of the four modules currently implement InvoiceFlow's "collapse to stacked cards below `md`" pattern — Students has a `StudentsGrid` component that may already do informal card-based mobile duty and should be evaluated first before building a new one from scratch (Workstream 2 principle: reuse before building).
- **Loading states:** `loading.tsx` exists at multiple route levels already across all four modules — the shared skeleton system (Workstream 3/9) should generalize what's there, not replace working Suspense boundaries.
- **RBAC display vs. enforcement:** across all four modules, role/permission checks are inconsistently applied at the route/action layer even though a real capability model (`permissions.ts`, `ROLE_HIERARCHY`/`requirePermission`) exists. The UI work in this milestone should surface role/status/permission context accurately (badges, disabled/hidden actions where already gated) without attempting to close these server-side gaps as a side effect — each gap is logged above per-module and will be restated in the completion report.
- **Server/Client boundary risk is concentrated in Parents** (documented crash history) but the same risk class applies anywhere a new action menu, dialog, or inline-edit affordance is added to a Server Component page across any of the four modules — every new interactive element introduced in Stages B–F should be checked for this, not only in Parents.

---

## 7. InvoiceFlow adoption table

| CMS pattern | Classification | Rationale |
|---|---|---|
| Page background / surface / border / text-tier tokens | ADOPT CLOSELY | Already the Milestone 2 shell/Dashboard tokens; People screens must read as the same app. |
| Typography scale (`page-title`, `section-title`, `table-value`, `label`, `metadata`, etc.) | ADOPT CLOSELY | Directly reusable utility classes; no CMS-specific reason to diverge. |
| Accent teal, restrained use for primary actions/active state only | ADOPT CLOSELY | Matches Milestone 2 approved direction. |
| Table primitive (`px-5` padding, `text-label` header, `text-table-value` cell, row hover, no zebra striping) | ADOPT CLOSELY | `ui/table.tsx` is a real, available primitive — build the shared `DataTable` directly on this shape. |
| Status badge: soft-bg + solid-fg pair, per-domain variant map | ADOPT CLOSELY | Directly applicable to student status, parent consent flags, staff role/invite status, centre status. |
| Radius scale (6/10/16px), single popover-only shadow token, flat surfaces | ADOPT CLOSELY | Explicit anti-goals in the ticket (no glassmorphism/gradients/glow/decorative shadow) map onto this exactly. |
| Mobile table → stacked record cards below `md` | ADOPT CLOSELY | Explicit InvoiceFlow rule; matches ticket's "not a horizontal-scrolled desktop table" instruction. Evaluate reusing/adapting Students' existing `StudentsGrid` as the starting point rather than building fresh. |
| `max-w-6xl` content column, fixed sidebar + top bar shell | ADOPT CLOSELY | Already the Milestone 2 shell — People screens render inside it unchanged. |
| Empty-state minimalism (icon + heading + one line, no illustration) | ADOPT CLOSELY | Matches `coming-soon.tsx`; differentiate "none exist" vs "no filter matches" copy only, not visual structure. |
| Exact list/detail/form page compositions for a specific domain object (invoices, customers) | ADAPT | InvoiceFlow's own domain pages are not present in this staged copy; CMS list/detail/form layouts are being composed from the design-system rules + Milestone 2 shell precedent, not copied from an inspected InvoiceFlow page. Documented as a known limitation above. |
| Information density and section grouping on detail pages | ADAPT | CMS records (Student, Parent, Staff, Centre) carry materially more relationship/operational data than a typical InvoiceFlow record; progressive disclosure (sections, not tabs-by-default) adapts the pattern rather than adopting a 1:1 layout. |
| Multi-state invite lifecycle UI (Staff: pending/expired/accepted/active + magic-link) | ADAPT | No InvoiceFlow equivalent exists in the reference material; visual language (badges, restrained controls) adopts closely, but the state machine itself is CMS-specific. |
| Recovery Bin (Parents soft-delete/restore) | ADAPT | No InvoiceFlow equivalent; apply the same table/empty-state/action-button visual language while preserving the existing restore/permanent-delete business logic untouched. |
| RBAC / capability model (`ROLE_HIERARCHY`, `requirePermission`, `getUserAccessibleCentres`) | PRESERVE | Explicit ticket guardrail; UI may surface role/permission state, must not change how it's computed or enforced. |
| Centre-switcher mechanism (`resolveActiveCentreId`, cookie/localStorage persistence, `CentreFilterContext`) | PRESERVE | Explicit ticket guardrail; only the switcher's visual chrome may change. |
| Server/Client boundary shape on Parents (`page.tsx` → `ParentProfileClient.tsx`) | PRESERVE | Crash history; re-verify after any change rather than redesign the split. |
| Destructive/recovery semantics (Parents bin restore/permanent-delete, Staff removal, Centre settings writes) | PRESERVE | Business Logic Guardrail; visual confirmation-dialog treatment may modernise, underlying action/permission logic may not. |
| Existing route-level permission gaps (Students detail/add/import ungated; Parents ~ungated; Staff last-owner/remove-owner gaps; Centres inconsistent billing role gates + ungated subdomain change) | OUT OF SCOPE (this stage) | Real bugs, documented above per-module for the completion report; any fix is a deliberate, narrow, separately-justified decision made when that module's stage is reached — not a byproduct of visual work. |
| InvoiceFlow's own feature set (invoices, customers, two-tier portal model) | OUT OF SCOPE | Not part of this CMS's domain; only the design system and shell/table/badge patterns transfer, per `claude/invoiceflow-patterns.md`. |

---

## 8. Reusable component candidates (Workstream 2 input — not a commitment, evaluated properly in Stage C)

Based on the duplication observed in §6, the following are genuine ≥2-screen candidates once Students (Stage B) proves the pattern in real use:

- `DataTable` / table primitives wrapping `ui/table.tsx`'s shape — used by all four list pages.
- `StatusBadge` with a per-domain variant map — student status, parent consent, staff role/invite state, centre status.
- `SearchField` + `FilterBar` (search + centre filter + secondary filters) — Students, Parents, Staff, Centres list toolbars.
- `RowActions` (consistent dropdown action menu) — all four list pages.
- `MobileRecordCard` (stacked-card mobile representation) — evaluate adapting Students' existing `StudentsGrid` first.
- `RecordHeader` + `DetailSection` — detail pages for all four modules, given their shared need for identity header + grouped sections.
- `EmptyState` (no-records vs no-filter-matches variants) — all four list pages.
- `ConfirmDialog` for destructive/recovery actions — Parents bin, Staff removal, Centre settings changes.

Extraction happens only once Students (Stage B) has proven each pattern works standalone, per the ticket's Critical Implementation Strategy — this list is a forecast, not a build plan.

---

## 9. Business behaviour inventory (must not regress)

- Student–parent/guardian linking, centre/class assignment, attendance record association, notes/progress timeline history.
- Parent consent flags (e.g. `communicationsConsent`, used elsewhere by `sendBroadcast`), parent-child linkage cardinality (0/1/many), Recovery Bin restore/permanent-delete semantics.
- Staff role hierarchy (`TUTOR < FRONT_DESK < MANAGER < ORG_OWNER`), centre membership assignment, invitation lifecycle (invite → validate → accept/magic-login → expire/clear), removal semantics.
- Centre org-wide vs. centre-scoped access split, active-centre persistence (cookie + localStorage), settings/billing field writes, subdomain assignment.
- All of the permission gaps in §2–§5 are pre-existing states, not to be silently "fixed" as part of a visual pass — they are inputs to the completion report's Bugs Discovered section.

---

## 10. Conclusion

Stage A audit is complete. The codebase supports the ticket's sequencing plan: Students has the cleanest existing structure (dedicated feature directory, existing `StudentsGrid` mobile candidate, existing loading boundaries) and is confirmed as the right reference-implementation choice for Stage B. Parents carries real regression risk (RSC crash history + weakest permission enforcement) and correctly sits after Students in the sequence so proven patterns land there rather than novel ones. Staff and Centres carry the most complex non-visual logic (invite state machine; three-path billing writes) and are correctly sequenced last.

Proceeding to Stage B: Students reference implementation (Task #20).
