# Milestone 3D — Centres Module: Stage A Audit

**Status:** Complete. Implementation has not started; this document is written before any Centres code is touched, per the ticket's explicit ordering requirement.

**Starting state check:** Local HEAD is `6524d05` (docs(milestone-3c): Staff completion report), matching the ticket's stated expected tip exactly. Working tree clean. Branch `rebuild/cms-modernisation`. `origin` remains at `912f4be` only because of the pre-existing, already-explained sandbox git-proxy push restriction (403, "not in this session's authorized repository set") — not a surprise discrepancy, so this is not treated as a STOP condition.

---

## 1. Scope boundary: what "the Centres module" actually is

Before anything else, this audit had to resolve a scoping question the ticket doesn't spell out: several files that read/write `centres` table columns do **not** live under `/dashboard/centres/*` at all — they live inside the **org-level Settings page** (`/dashboard/settings`, driven by `src/features/settings/components/SettingsTabs.tsx`), which is a structurally separate feature area with its own tabs (General Info, Operating Hours, Branding, **Finance & Pricing**, Registration Form, Discount Rules, Danger Zone).

Determination: **the Centres module, for this milestone, is the route tree under `src/app/dashboard/centres/**`, plus the API routes under `src/app/api/centres/**`.** The org-level Settings page is a different module. It is not named in the ticket, "Finance redesign" is explicitly out of scope, and the ticket frames this milestone as modernising "the Centres module" specifically (paralleling how Students/Parents/Staff each mean their own route tree). Two of its tabs happen to read and write centre rows (`CentreHoursTab`/`CentreHoursForm` and `FinancePricingForm`) and are documented below for security-matrix completeness — because a mutation path touching the same rows is relevant no matter which page it's reachable from — but **none of `SettingsTabs.tsx`, `CentreHoursTab.tsx`, `CentreHoursForm.tsx`, `FinancePricingForm.tsx`, `OrganisationInfoForm.tsx`, `BrandingForm.tsx`, `RegistrationTermsForm.tsx`, `DiscountsForm.tsx` will be modernised or otherwise edited this milestone.** They are pre-existing, out-of-scope, and any defect found in them is documented, not fixed, unless it directly implicates a Centres-module write path that IS in scope.

---

## 2. Actual surface inventory

### Routes (Centres module)
| Route | File | Type |
|---|---|---|
| `/dashboard/centres` | `src/app/dashboard/centres/page.tsx` | Server Component (List) |
| `/dashboard/centres` (loading) | `src/app/dashboard/centres/loading.tsx` | Suspense fallback |
| `/dashboard/centres/add` | `src/app/dashboard/centres/add/page.tsx` + `AddCentreForm.tsx` | Server + Client |
| `/dashboard/centres/[id]` (loading) | `src/app/dashboard/centres/[id]/loading.tsx` | Shared Suspense fallback for **both** `[id]/settings` and `[id]/billing` (neither has its own `loading.tsx`) |
| `/dashboard/centres/[id]/settings` | `src/app/dashboard/centres/[id]/settings/page.tsx` + `CentreSettingsClient.tsx` | Server + Client — this **is** Centre Detail; there is no separate detail-only view |
| `/dashboard/centres/[id]/billing` | `src/app/dashboard/centres/[id]/billing/page.tsx` + `CentreBillingForm.tsx` | Server + Client — dedicated, stricter-gated sub-route |

There is no `/dashboard/centres/[id]` index route and no standalone "Centre Detail" page distinct from Settings — Settings *is* the detail view, split into General / Sessions / Billing tabs within one client component. Billing additionally has its own dedicated route with a different (stricter) gate and different (real) validation. This preserves the app's existing route/tab split; the audit does not propose collapsing or restructuring it.

### API endpoints (Centres module)
| Endpoint | Method | Purpose |
|---|---|---|
| `src/app/api/centres/route.ts` | GET | Returns `{id, name}` for every centre in the caller's org — feeds dropdowns (e.g. `InviteStaffForm`'s centre picker). Any authenticated org member; low-sensitivity fields only. No issue. |
| `src/app/api/centres/[id]/route.ts` | PATCH | The most complete of the four billing/fee write paths — see §4. Actually reachable in production only via `FinancePricingForm.tsx` (org Settings → Finance & Pricing tab), i.e. **not called from anywhere inside the Centres module itself today**, but it is live, working code, not dead code. |
| `src/app/api/centres/[id]/subdomain/route.ts` | PATCH | Sets/clears a centre's public subdomain. **Confirmed defect — see §5.** |

Server actions:
| Action | File | Reachable from |
|---|---|---|
| `createCentre` | `add/actions.ts` | Add Centre form |
| `updateCentreAction` | `[id]/settings/actions.ts` | Settings page (General / Sessions / Billing tabs — one combined form) |
| `updateCentreBilling` | `[id]/billing/actions.ts` | Dedicated Billing page |

### Data model (fresh read of `src/db/schema.ts`, not assumed from prior milestones)
`centres` table: `id, organisationId (FK→organisations, cascade), name, slug (unique), address, timezone (default 'Europe/London'), operatingHours (text), sessionSlots (text/JSON), feeSelfFinance (numeric 10,2), feeAssistedFinance (numeric 10,2), bankName, sortCode, accountNo, ofstedId, managerName, billingPhone, billingEmail, signatureUrl, subdomain (unique varchar 63), createdAt, updatedAt`, plus index `centres_org_idx(organisationId)`. There is **no** status/`isActive`/`deletedAt`/lifecycle column of any kind.

A commented-out `approvalDate` column exists in the schema (`// approvalDate: added in migration 0007 — uncomment after running: ALTER TABLE centres ADD COLUMN approval_date varchar(100)`), with matching commented-out form code in `CentreBillingForm.tsx`. This is a **paused, incomplete migration**, not a defect. Per the ticket's migration restriction, it is left exactly as-is — not finished, not removed.

`organisations` table also carries its own, separate `subdomain` (unique varchar 63) and its own `sessionSlots` (text/JSON) and `registrationPricing` (JSON `{selfFinanceRate, taxCreditRate}`) columns. These are genuinely distinct, **org-level** concepts (org-wide white-label routing / org-wide registration defaults) from the **centre-level** `subdomain`/`sessionSlots` columns — confirmed by the schema's own inline comments (`// Per-centre subdomain for white-label routing` vs `// Per-org subdomain for white-label routing`). The org-level ones are edited via `OrganisationInfoForm.tsx` (org Settings → General Info tab) — out of scope, not touched.

`children.centreId` (nullable FK→centres) exists via two prior migrations (`20260519_01_add_centre_to_children.sql`, `20260519_02_backfill_children_centre.sql`) — a non-breaking, idempotent add-column-then-backfill pair (backfill priority: bookings → registrations → most-recent-centre for conflicts). Historical/completed migration, not touched.

### Current seed data (fresh `psql` query, not assumed)
Org "Bright Star Academy" has exactly 2 centres:
- **Main Campus** — 2 staff members, 12 children, no subdomain set.
- **Secondary Campus** — 1 staff member, 0 children, no subdomain set.

This already covers "multi-centre org", "centre with staff", "centre with children", "centre with no children" from the ticket's required seed scenarios. It does **not** yet cover "centre with no staff" or "distinct subdomains" — additional seeding is required before verification (see Pending Work, §13).

### Shared components confirmed reused elsewhere (available to Centres)
`Table`, `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`, `Badge`, `Button`, `EmptyState`, `PageHeader`/`HeaderPortal`, the typography scale, and the established `h-9 px-3 rounded-sm border border-border bg-surface focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent` input pattern — all as established and reused in Students/Parents/Staff. None of these currently appear in the Centres module's own files (List uses a raw `<table>`; both Settings/Billing forms use ad hoc `rounded-2xl`/`rounded-3xl`/`rounded-[32px]` "glassmorphic-card" styling with `focus:ring-2 focus:ring-primary/50` — pre-InvoiceFlow legacy).

`cn()` (`src/components/ui/utils.ts`) remains a plain `classes.filter(Boolean).join(' ')`, not a merge — same care needed as in 3B/3C when overriding a primitive's own layout classes via `className`.

---

## 3. Business behaviour actually present (vs. what the ticket asks to check "if present")

- **Centre List** — table (raw `<table>`, not the shared primitive) of every centre in the org: gradient-avatar identity + address, Ofsted-ID badge (or em-dash), a **hardcoded** green-dot "Active" status (see §7), a 7-day booking-forecast sparkline (`LoadForecast`, unmodified/out of scope — Bookings redesign excluded), and a chevron. Every row links to that centre's Settings page. "Add Centre" button linked top-right.
- **Add Centre** — exists. Two fields (Name, required 3+ chars; Address, optional). Auto-generates a random-suffixed slug, defaults `timezone` to `'Europe/London'`. Redirects to the new centre's Settings page on success. Both the page (`['ORG_OWNER','MANAGER']`, raw `auth()`) and the action independently re-check the same role tuple — a correctly-defended write path, unlike the two below.
- **Centre Detail/Settings** — one combined React Hook Form across three tabs (General: name/address/Ofsted ID; Sessions: a `useFieldArray` builder for structured, bookable session slots — `{name, startTime, endTime, price, capacity, daysActive}` — defaulting to two seeded slots when empty; Billing: fees + bank details). Submitting from any tab sends the whole form (RHF retains hidden-tab field values), which is why the Billing sub-tab's fields flow through the *same* `updateCentreAction` as General/Sessions.
- **Dedicated Billing page** — a second, separate surface for an overlapping-but-not-identical set of fields (bank details, Ofsted ID, address, manager name, billing phone/email — **not** fees, **not** name, **not** session slots), with its own stricter role gate and real zod validation. An info banner states these fields are what print on invoices/receipts/PDFs, tying this surface to Finance PDF generation (out of scope to touch beyond the Centres-facing form itself).
- **Hours/Schedule config** — ambiguous by name; resolved as follows. The Centres module's own Settings page has a "Sessions" tab, but that edits **bookable registration slot pricing/capacity** (`sessionSlots`, structured objects), not day-by-day opening hours. A **separate** component pair, `CentreHoursForm.tsx`/`CentreHoursTab.tsx` (`src/features/settings/components/`), edits actual day-by-day opening hours (`operatingHours`) — but this pair is embedded in the **org-level Settings page** ("Operating Hours" tab), not the Centres module, per §1's scope determination. It is documented here (§6) but **not modernised this milestone.**
- **Lifecycle (delete/deactivate/archive)** — confirmed absent. No status column exists on `centres`, no DELETE handler exists on `api/centres/[id]/route.ts` (PATCH only) or anywhere else in the Centres API surface, and the List page's "Active" badge is not backed by any real field (§7). **Ticket §14 answer: NOT APPLICABLE — feature does not exist in current CMS.**

---

## 4. The multiple-write-path problem (billing/bank fields) — exactly as the ticket pre-flagged

Four surfaces write overlapping subsets of `bankName`/`sortCode`/`accountNo`/`ofstedId`/fee fields/etc. on the same `centres` row:

| # | Write path | Reachable from | Role check | Field validation | Fields written |
|---|---|---|---|---|---|
| 1 | `updateCentreAction` (`[id]/settings/actions.ts`) | Centres module Settings page, Billing tab | **NONE** — only checks `organisationId` is present | none | `name, address, ofstedId, sessionSlots, bankName, sortCode, accountNo, feeSelfFinance, feeAssistedFinance` |
| 2 | `updateCentreBilling` (`[id]/billing/actions.ts`) | Centres module, dedicated Billing page | `ORG_OWNER` only (`"Only Owners can update billing settings"`) | Full zod schema: sortCode → 6 digits, accountNo → 8 digits, email format, length caps | `bankName, sortCode, accountNo, ofstedId, managerName, billingPhone, billingEmail, address` |
| 3 | `PATCH /api/centres/[id]` (`api/centres/[id]/route.ts`) | Org Settings page → Finance & Pricing tab (`FinancePricingForm.tsx`) — outside the Centres module, but a live, working, called endpoint | `['ORG_OWNER','MANAGER']` base, **plus** a field-level `ORG_OWNER`-only re-check specifically when any billing-shaped field is present in the body | none | `sessionSlots, operatingHours, feeSelfFinance, feeAssistedFinance, bankName, sortCode, accountNo, ofstedId, managerName, billingPhone, billingEmail, signatureUrl` |
| 4 | `PATCH /api/settings/centres/[id]/hours` (referenced by `CentreHoursForm.tsx`) | Org Settings page → Operating Hours tab | N/A | N/A | **This endpoint does not exist anywhere in `src/app/api`.** Confirmed by direct filesystem search. The "Save" button on that tab calls a route that 404s. This is pre-existing broken functionality in an out-of-scope module; documented, not fixed. |

**Why this matters, and why path #3 resolves the ambiguity:** path #3 is the one surface that gets both the base-role gate *and* a field-specific Owner-only re-check right, for the exact set of sensitive fields, with clear evidence of intended policy in its own logic (not invented — the code itself branches on `isUpdatingBilling`). This is treated as the strongest available evidence of the app's actual intended authorization policy for these fields, and is the basis for the fix decided in §5 below — not a guess.

**Separately confirmed:** `sessionSlots` is written with **two incompatible shapes** depending on which UI is used. The Centres module's Settings-page Sessions tab writes an array of structured objects (`{name, startTime, endTime, price, capacity, daysActive}`). The out-of-scope `CentreHoursForm.tsx` (org Settings → Operating Hours tab) writes a flat array of plain display strings (e.g. `"Wednesday 3:30–5:00 pm"`) to the *same column* — but only via the dead endpoint in row 4 above, so in practice this shape collision cannot currently occur (the save silently fails as a 404). This is flagged as a pre-existing data-integrity risk worth product-owner attention, not fixed — fixing it would mean redesigning the Hours feature or the Sessions data model, both explicitly out of scope, and the endpoint being dead means there is no live path for it to actually corrupt data today.

---

## 5. Confirmed, narrowly-evidenced security defects (fix + regression test planned)

**Defect 1 — `updateCentreAction` has no role check at all.** Any authenticated member of the organisation, including TUTOR, can call this server action directly (server actions are independently invocable — the page's own `['ORG_OWNER','MANAGER']` gate does not protect it) and rewrite the centre's name, address, Ofsted ID, session slots, bank name, sort code, account number, and both fee fields. This is the same defect class already fixed for Parents (3B) and Staff (3C): UI-level gating without a matching server-side check.

Planned fix, evidenced by §4 row 3 (the one surface that gets this right): add the page's own `['ORG_OWNER','MANAGER']` role check to `updateCentreAction` as the floor for all fields, **and** add the same field-specific `ORG_OWNER`-only re-check for `bankName/sortCode/accountNo` that `api/centres/[id]/route.ts` already implements and that `updateCentreBilling`'s own error message states in plain text ("Only Owners can update billing settings"). This is not inventing a policy — it is bringing the weakest of three parallel implementations up to match the other two, which independently agree with each other. `feeSelfFinance`/`feeAssistedFinance` are only guarded by the base `['ORG_OWNER','MANAGER']` tuple in path #3, so the fix will match that (not additionally Owner-gated) rather than guessing a stricter rule for fees that no existing path actually enforces.

**Defect 2 — `api/centres/[id]/subdomain/route.ts` has no role check at all.** Only checks that `session.user.organisationId` exists. Any authenticated org member, any role, can change or clear a centre's public subdomain. This is exactly what the ticket pre-flagged as "previously noted as worth review." Planned fix: add `['ORG_OWNER','MANAGER']`, matching the List/Settings page gate — the subdomain is an operational/identity setting reachable from the Settings surface, not a billing field, so the evidenced-from-context rule is the base Centres role tuple, not an Owner-only one (there is no existing evidence anywhere in the app of an Owner-only policy for subdomains specifically).

Both defects preserve existing behaviour for everyone who currently passes the *intended* gate (ORG_OWNER, MANAGER) — only TUTOR/FRONT_DESK-level direct API/action access is closed off. No redirect/UX change for anyone using the actual Settings/Billing UI as designed, since those pages already only render for `['ORG_OWNER','MANAGER']`/`ORG_OWNER` respectively.

**Not a defect, documented only:** `api/centres/[id]/route.ts`'s final `db.update(centres).set(...).where(eq(centres.id, id))` does not re-scope the UPDATE itself by `organisationId` — but it is preceded by an existence check that already confirms the centre belongs to the caller's org, and `id` is a UUID primary key, so there is no cross-tenant vector. Documented for completeness, not changed (out of scope — this file's core logic is not being touched, only used as reference evidence).

---

## 6. Tenant/organisation isolation review

Every Centres-module mutation reachable from a client scopes its lookup/update by `organisationId` before writing:
- `createCentre` — inserts with `organisationId: session.user.organisationId`, no cross-org vector.
- `updateCentreAction` — `WHERE and(eq(centres.id, centreId), eq(centres.organisationId, session.user.organisationId))`. Correct.
- `updateCentreBilling` — looks up via `db.query.centres.findFirst` scoped by org before writing, throws `'Centre not found'` on mismatch. Correct.
- `api/centres/[id]/route.ts` PATCH — existence check scoped by org before the update (see §5 note on the update's own WHERE clause). Correct in effect.
- `api/centres/[id]/subdomain/route.ts` PATCH — existence check scoped by org (`and(eq(centres.id, centreId), eq(centres.organisationId, ...))`) before any write; the uniqueness checks against `organisations.subdomain` and other centres' `subdomain` are intentionally **not** org-scoped (subdomains must be globally unique for DNS/routing to work) — correct by necessity.
- Centre List and Settings/Billing page server-side reads all scope by `organisationId`, `redirect`/`notFound()` on mismatch.

**No tenant-isolation defect found in the Centres module.** The only defects found (§5) are missing *role* checks, not missing *org-scoping* checks — these are independent axes and both were verified separately per the ticket's instruction.

---

## 7. List page "Active" status badge

The List page renders a hardcoded green dot + "Active" text for every row, unconditionally. No `status`/`isActive`/`deletedAt` column exists on `centres` (confirmed via fresh schema read, §2). This is decorative-only, not driven by data. Documented as a finding; the restyled List will not fabricate a lifecycle it doesn't have — options for the implementation phase are either to drop the badge entirely or to keep a static "Active" indicator with no toggle affordance (since there is nothing to toggle), decided during implementation and recorded in the completion report, not invented here as new lifecycle UI.

---

## 8. Authorization matrix (Centres module)

| Action | Required role (as currently enforced or as it will be after the §5 fixes) | Evidence |
|---|---|---|
| List centres | `['ORG_OWNER','MANAGER']` | `page.tsx` `requireAuth` |
| View centre (= Settings page) | `['ORG_OWNER','MANAGER']` | `settings/page.tsx` raw `auth()` check |
| Create centre | `['ORG_OWNER','MANAGER']` | `add/page.tsx` **and** `add/actions.ts` both check |
| Edit centre (name/address/Ofsted/session slots) | `['ORG_OWNER','MANAGER']` **after fix** (currently: none) | §5 Defect 1; evidenced by `api/centres/[id]/route.ts`'s base gate |
| Edit centre billing/bank fields (via Settings-page Billing tab) | `ORG_OWNER` **after fix** (currently: none) | §5 Defect 1; evidenced by `updateCentreBilling`'s explicit error text and `api/centres/[id]/route.ts`'s field-level re-check |
| Edit centre billing (dedicated `/billing` route) | `ORG_OWNER` | `billing/page.tsx` + `updateCentreBilling`, already correct |
| Change subdomain | `['ORG_OWNER','MANAGER']` **after fix** (currently: none) | §5 Defect 2; evidenced by the Settings-page gate that is the subdomain's natural home |
| Change hours (`operatingHours`) | Out of scope (org Settings module) — not modernised or fixed this milestone | §1, §4 row 4 |
| Assign staff to centre | Out of scope — this is Staff module functionality (`StaffProfileForm`, frozen in 3C), Centres only supplies the dropdown list via `GET /api/centres` | — |
| Delete/deactivate centre | NOT APPLICABLE — no such feature exists (§3, §7) | Confirmed absent from schema and API surface |

---

## 9. Visual/styling debt inventory (for the modernisation pass)

- List: raw `<table>` → shared `Table` primitive; bespoke dashed-border empty state → shared `EmptyState`; gradient avatars (`getAvatarGradient`) → drop, matching the precedent already set when Students/Parents moved away from gradients (utility itself stays, shared/frozen, not touched); `bg-primary rounded-2xl ... glow-btn` Add-Centre button → `Button` primitive; hardcoded "Active" badge → resolved per §7.
- Settings (`CentreSettingsClient.tsx`): `bg-secondary/50`, `rounded-xl/2xl/3xl`, `focus:ring-2 focus:ring-primary/50`, hardcoded uppercase-tracking-wide labels → established `Card`, `rounded-sm`/`rounded-md`, the `focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent` input pattern, `text-label`/`text-metadata` typography tokens.
- Billing (`CentreBillingForm.tsx`): `glassmorphic-card`, `rounded-[32px]`, per-section colour-tinted decorative icon chips (`bg-violet-500/10` etc, non-semantic), rose/emerald hardcoded banners, `bg-primary` save button → shared `Card`, semantic `bg-danger-soft`/`text-danger` and `bg-success-soft`/`text-success` tokens, `Button` primitive. The commented-out `approvalDate` block is left untouched exactly as-is.
- Add Centre (`AddCentreForm.tsx`): `glassmorphic-card p-10 rounded-[32px]`, `rounded-2xl` inputs, `glow-btn` → `Card`, established input pattern, `Button` primitive — using the Add Student/Staff Invite form language as the reference per the ticket.
- Both `loading.tsx` skeletons need reshaping to match whatever final layouts are chosen (List → table skeleton matching `Table`; `[id]` → card skeleton matching restyled Settings/Billing).

---

## 10. Pending work before implementation begins

1. Seed one additional centre with **zero** staff members, and set distinct `subdomain` values on at least two centres, to satisfy every scenario the ticket requires for verification (multi-centre ✓ already true, staffed centre ✓ already true, centre with children ✓ already true, centre with no children ✓ already true, centre with no staff — needs seeding, distinct subdomains — needs seeding).
2. Proceed to implementation: fix Defects 1 and 2 with regression tests, then restyle List / Settings / Billing / Add Centre onto shared primitives, preserving all validation/defaults/mutations/redirects.
3. Dual-theme and responsive (1440/834/375) Playwright verification.
4. Full quality gate (`npm ci`, typecheck, lint, test, build).
5. Write `project-notes/milestone-3d-centres-completion.md`.
6. Git bundle handoff (push is expected to remain blocked by the sandbox proxy, as with all prior milestones).

This audit intentionally stops here — no code has been modified. Implementation begins in the next phase.
