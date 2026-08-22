# Milestone 3D — Centres Module: Completion Report

**Status: COMPLETE.** Stage-A audit done, security defects fixed with regression tests, List/Add Centre/Settings/Billing modernised, verified in both themes at 1440/834/375, full quality gate clean, production-style verification with seeded data performed, git bundle produced. Per the ticket's explicit stop condition, this milestone stops here — Bookings, Attendance, and every other module are untouched, and no further module work has begun.

Base SHA: `6524d05` (Staff completion, Milestone 3C). Final SHA: `cbec556`. Five commits.

---

## 1. What changed and why

### Security (audit §5)
Two confirmed, narrowly-evidenced authorization gaps were fixed, both matching the exact defect class already fixed for Parents (3B) and Staff (3C): a UI-level role gate with no matching server-side check.

- **`updateCentreAction`** (Settings page, reachable via its Billing sub-tab) had no role check at all — any authenticated org member, including TUTOR, could rewrite a centre's identity fields and bank details by calling the server action directly. Fixed to require `['ORG_OWNER','MANAGER']` as a floor, plus `ORG_OWNER` specifically for `bankName`/`sortCode`/`accountNo`. This was not an invented policy — `api/centres/[id]/route.ts` already implements exactly this split (base role gate + field-level Owner-only re-check for the same billing fields), and `updateCentreBilling`'s own error text ("Only Owners can update billing settings") independently agrees. Bringing the weakest of three parallel write paths in line with the other two, which already agreed with each other.
- **`PATCH /api/centres/[id]/subdomain`** had no role check at all — any authenticated org member could change or clear a centre's public subdomain. Fixed to require `['ORG_OWNER','MANAGER']`, matching the Settings page gate that is the subdomain's natural home.

Both fixes preserve every existing behaviour for ORG_OWNER/MANAGER — only direct action/API access below that gate is closed. 10 new regression tests cover both fixes plus org isolation on each path (`src/app/dashboard/centres/authorization.test.ts`).

Also confirmed and left alone: tenant isolation was already correct on every Centres write path (verified again against a throwaway second-org centre in a live dev-server run, not just unit tests — see §5); the `sessionSlots` shape collision between the Centres module's structured slots and the out-of-scope org-Settings "Operating Hours" tab's flat-string slots (audit §4) is real but the endpoint that would write the incompatible shape (`/api/settings/centres/[id]/hours`) doesn't exist in the codebase, so there is no live path for it to actually corrupt data today; the commented-out `approvalDate` migration-0007 code is untouched.

### Visual modernisation
- **List** (`page.tsx`): raw `<table>` → `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, with a `md:hidden` stacked-card view for mobile (matching Students/Staff). Bespoke dashed-border empty state → shared `EmptyState`. Gradient avatars → neutral `bg-accent-soft`/`text-accent` icon circle (same de-gradient move already made for Students/Parents). Legacy `bg-primary`/`glow-btn` Add-Centre button → `Button` via `HeaderPortal`. Dropped the hardcoded, non-functional "Active" status dot (no status column exists on `centres` — confirmed via a fresh schema read, audit §7) and gave Address its own column instead. The 7-day forecast column and `LoadForecast` are untouched (Bookings redesign out of scope).
- **Add Centre**: `glassmorphic-card`/`rounded-[32px]`/`glow-btn` → `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter` and `Button`, using the Invite Staff form as the language reference. All validation (`name` required, 3+ chars), the auto-generated slug, the `timezone` default, and the post-create redirect to Settings are unchanged.
- **Settings** (General/Sessions/Billing tabs): legacy `bg-secondary/50`/`rounded-xl`/`rounded-2xl`/`focus:ring-2` → `Card`, `rounded-sm`/`rounded-md`, the established `focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent` input pattern, `text-label`/`text-metadata` tokens. The pill tab switcher is now the same segmented control already used for Staff's Active/Pending toggle. The sticky "Unsaved Changes" bar now matches `StaffProfileForm`'s bar exactly. The three-tab single-form architecture (one combined React Hook Form, `useFieldArray` session-slot builder, all fields submit together through `updateCentreAction`) is preserved unchanged, as are both default seeded session slots.
- **Billing** (dedicated page): `glassmorphic-card` sections with non-semantic per-section icon colours → `Card`/`CardHeader`/`CardTitle`/`CardContent` with one consistent semantic tone. Hardcoded rose/emerald banners → `bg-danger-soft`/`text-danger` and `bg-success-soft`/`text-success`. Save button → `Button`. The commented-out `approvalDate` block is untouched, verbatim, including its migration-0007 comment. All field semantics, the zod-validated `updateCentreBilling` call, and the `ORG_OWNER`-only gate are unchanged.
- Both `[id]/settings/page.tsx` and `[id]/billing/page.tsx`, plus `add/page.tsx`, normalised from a raw `auth()` + manual role check to the established `requireAuth` helper (identical default redirects — `/login`, `/onboarding`, `/dashboard` — so behaviour is unchanged), matching the consistency pass already done for Staff's `[userId]` page in 3C.
- Both `loading.tsx` skeletons reshaped to match the new layouts (table skeleton for List; single-column card skeleton for the shared `[id]` boundary).

A real layout bug was caught during Playwright verification and fixed in a follow-up commit: the session-builder's native `type="time"` inputs were clipping ("09:0", "07:30 A") because they were squeezed into a 12-column grid alongside four other fields, and an interim fix attempt stacked a conflicting `px-2` onto `inputCls`'s own `px-3` — exactly the `cn()`-doesn't-merge pitfall documented in the audit. Fixed by giving Start/End their own row with fixed-width containers, and rebalancing the remaining row. Also widened the tab strip's mobile padding after a 375px capture showed "Billing" clipping.

---

## 2. Required-section walkthrough

**Routes.** `/dashboard/centres` (List), `/dashboard/centres/add` (Add Centre), `/dashboard/centres/[id]/settings` (Detail/Settings — General/Sessions/Billing tabs; this *is* the detail view, there is no separate detail-only page), `/dashboard/centres/[id]/billing` (dedicated, stricter-gated Billing route). This preserves the app's existing route/tab split — no restructuring into a mega-page.

**Components.** `CentreSettingsClient` (client, RHF + `useFieldArray`), `AddCentreForm` (client, `useActionState`), `CentreBillingForm` (client, local `useState`). All Server Components (`page.tsx` files) unchanged in responsibility, only auth-helper-normalised.

**Server actions / API endpoints.** `createCentre`, `updateCentreAction`, `updateCentreBilling` (server actions); `GET /api/centres`, `PATCH /api/centres/[id]`, `PATCH /api/centres/[id]/subdomain` (API routes). Full inventory, including the out-of-scope org-Settings write paths that touch the same columns, is in the audit §2 and §4.

**Data model.** `centres` table fields and relationships documented fresh from `src/db/schema.ts` in the audit §2 — no schema changes made. The `children.centreId` backfill migrations are historical/completed, not touched.

**Business behaviour.** Preserved exactly: all validation, defaults (2 seeded session slots, `timezone: 'Europe/London'`, random-suffixed slug), mutations, redirects, and the distinct role gates already present per surface (`['ORG_OWNER','MANAGER']` for List/Settings/Add, `ORG_OWNER`-only for the dedicated Billing page).

**Server/client boundaries.** No new client/server boundary crossings were introduced; all restyled components keep their existing `'use client'`/Server Component split. No function-prop-across-RSC-boundary pattern was introduced or found.

**Security/RBAC audit + authorization matrix.** Audit §5, §8. Two gaps fixed (above), full matrix produced covering List/View/Create/Edit/Edit-billing/Change-subdomain/Delete-deactivate — the last is **NOT APPLICABLE — feature does not exist in current CMS** (no status/lifecycle column, no DELETE route).

**Tenant/organisation isolation.** Audit §6 — every write path already correctly scoped by `organisationId`; re-verified live (not just via mocked unit tests) against a throwaway second-org centre in a running dev server: Settings redirects to `/dashboard/centres`, Billing renders the real 404 page, and the subdomain API returns `404 {"error":"Centre not found"}`. No tenant-isolation defect found or introduced.

**Subdomain write-path audit.** Audit §5 Defect 2 — the sole write path (`PATCH /api/centres/[id]/subdomain`) had no role check; fixed. Documented the distinct org-level `subdomain` concept on `organisations` (out of scope, edited via org Settings, not touched).

**Billing/settings write-path audit.** Audit §4 — four overlapping write paths documented (two in-scope and fixed/already-correct, two out-of-scope and left alone, one of the out-of-scope ones confirmed to call a genuinely non-existent endpoint).

**List/Detail/Add/lifecycle UI.** List, Detail(=Settings), Add Centre modernised as described above. Lifecycle: **NOT APPLICABLE — feature does not exist in current CMS** (confirmed absent from both the schema and the API surface; the List page's previously-hardcoded "Active" badge, which was not backed by any real field, has been removed rather than preserved as fake status UI).

**Responsive/theme verification.** §3 below.

**RSC boundary safety.** No new Server→Client function-prop crossings introduced; verified via `checkNoRscError` in every Playwright capture (checks for the historical RSC crash indicator text) — none triggered across 27 captures in both themes.

**Quality gates.** §4 below.

**No business-logic regression / no unnecessary new primitives / no guessed authorization policy.** Confirmed throughout — every fix and every restyle traces to evidence documented in the audit, not invention. No new shared primitive was created; every restyled surface reuses `Table`, `Card`, `Button`, `EmptyState`, `HeaderPortal`, and the established typography/input tokens.

---

## 3. Verification (dual-theme, responsive, seeded scenarios)

Seed data extended beyond the pre-existing "Bright Star Academy" org (Main Campus: 2 staff, 12 children; Secondary Campus: 1 staff, 0 children) with a new **Riverside Annex** centre (0 staff, 0 children, no subdomain) and distinct subdomains set on the two existing centres (`main`, `secondary`). Main Campus was also given a full billing/fee state (bank details, fees, manager name, billing contact) for visual verification of the populated case, while Secondary Campus was left empty to verify the placeholder/empty case. This satisfies every scenario the ticket asked for: multi-centre org, a centre with staff, a centre with children, a centre with no staff, a centre with no children, distinct subdomains, and varied billing states.

27 Playwright screenshots captured across bright and dark themes at 1440/834/375 (attached: `milestone-3d-centres-screenshots.zip`): List (all three widths, both themes), Settings General tab (all three seed centres, both key widths, 834 for Main Campus), Sessions tab (both themes, mobile), the Settings page's own Billing sub-tab, the dirty-state sticky bar, the dedicated Billing page (both a populated and an empty centre, all three widths for Main Campus), Add Centre (both themes, both widths), and a skip-link regression check at 375. Console-error and failed-request listeners were attached throughout; the only failed-request entries across the whole run were benign dev-server chunk-load aborts during rapid navigation, not application errors — zero console errors were recorded. An `RSC/crash indicator` check ran on every navigation and never triggered.

Cross-org denial was verified live, not just in unit tests (§2 above and reproduced from the audit's org-isolation review), against a throwaway second organisation and centre created and destroyed for this check only — not part of the persisted seed data.

---

## 4. Quality gates

- `npm ci` — clean install, no changes to `package.json`/`package-lock.json`.
- `npm run typecheck` (`tsc --noEmit`) — 0 errors, run repeatedly through the implementation and after the layout fix.
- `npm run lint` — 0 errors, 0 warnings across the whole repo.
- `npm test` (vitest) — 285 tests passing, 1 unrelated pre-existing collection failure (`src/features/communications/actions.test.ts`, a missing `next/server` resolution in `next-auth`'s import graph, unrelated to Centres and present before this milestone started).
- `npm run build` — passes. (One build attempt hit `SIGKILL` from memory pressure while the dev server was also running in the same container; stopping the dev server and rebuilding completed cleanly — not a code issue.)

New tests added: `src/app/dashboard/centres/authorization.test.ts` (10 tests) covering both fixed defects and org isolation on each path.

---

## 5. Similarity rating

| Area | Rating | Notes |
|---|---|---|
| Centres List | CLOSE | Full Table/EmptyState/Button primitive adoption, responsive stacked-card mobile view, matches Students/Staff structurally and visually. |
| Centre Detail (= Settings) | CLOSE | Card/segmented-tabs/input-token adoption is thorough; the three-tab single-form architecture is a genuine, preserved difference from the People modules' single-page detail views, appropriate to Centres' own settings-hub nature rather than a People-record page — not a gap, a deliberate preservation per the ticket's own instruction not to force-fit the People structure. |
| Add Centre | CLOSE | Directly mirrors the Invite Staff form language as instructed. |
| Billing / Operational Settings | CLOSE | Billing page fully modernised on Card/Button/semantic tokens; the underlying four-write-path situation (audit §4) is a pre-existing data-model condition documented for product-owner attention, not a styling gap. |
| Responsive behaviour | CLOSE | Verified and, where found lacking, fixed (session-builder time inputs, tab-strip mobile padding) before final capture. |
| Bright theme | CLOSE | No hardcoded colours found on any restyled surface. |
| Dark theme | CLOSE | Verified via the same captures — full token-driven contrast, no light-mode-only styling found. |
| Shared primitives | CLOSE | No new primitive created; every restyled surface composes from `Table`/`Card`/`Button`/`EmptyState`/`HeaderPortal` and the established tokens. |
| Overall | CLOSE | Two real, evidenced security defects fixed with regression coverage; every visually-modernised surface reuses established primitives; every preserved architectural decision (route/tab split, three-tab combined form, dedicated stricter Billing page) is deliberate and documented, not an oversight. |

No area is rated below CLOSE.

---

## 6. Git handoff

Base SHA: `6524d05`. Final SHA: `cbec556` (this report's own commit, the last in the milestone). Five commits:

1. `f72dbfc` — docs+fix: Stage-A audit; fix two evidenced authorization gaps
2. `2d67aa9` — feat: modernise Centres List and Add Centre
3. `5375070` — feat: modernise Centre Settings and Billing
4. `1990c8f` — fix: session-builder time-input clipping found in Playwright verification
5. `cbec556` — docs: this completion report

Push to `origin` is expected to remain blocked by the sandbox's git-proxy restriction (403, "not in this session's authorized repository set"), consistent with every prior milestone this session. One incremental bundle was produced instead: `milestone-3d-centres.bundle`, covering `6524d05..cbec556`, verified with `git bundle verify` and sanity-tested against a scratch clone.

---

## 7. Explicit stop

Per the ticket's stop condition, Centres is now audited, security-reviewed, tenant-scoping-verified, subdomain/billing-paths-reviewed, modernised, dual-theme-verified, responsive-verified, tested, built, and documented. **No work has begun on Bookings, Attendance, or any other module.** This report is the handoff for product-owner review.
